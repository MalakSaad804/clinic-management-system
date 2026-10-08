const { Visit, Doctor, Patient } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, pageMeta } = require('../utils/pagination');
const { recordAudit } = require('../utils/audit');
const { isWithinWorkingHours, clinicTimeToDate, toMinutes, MIN } = require('../utils/time');
const { hasImageSignature, removeFile, uploadRoot } = require('../middleware/upload');

const POPULATE = [
  ['patient', 'firstName lastName email phone'],
  ['doctor', 'firstName lastName specialization'],
];

const withPopulate = (q) => POPULATE.reduce((query, [p, s]) => query.populate(p, s), q);

// Patients must never receive doctor-only fields.
function present(user, visit) {
  const obj = visit.toJSON();
  if (user.role === 'patient') delete obj.internalNotes;
  return obj;
}

function assertCanView(user, visit) {
  if (user.role === 'patient' && String(visit.patient?._id || visit.patient) !== String(user.patient)) {
    throw new AppError('You can only view your own visits', 403);
  }
}

// Doctors may change only their own visits; admins may change any.
function assertCanModify(user, visit) {
  if (user.role === 'doctor' && String(visit.doctor?._id || visit.doctor) !== String(user.doctor)) {
    throw new AppError('You can only modify your own visits', 403);
  }
}

async function findVisitOrFail(id) {
  const visit = await Visit.findById(id);
  if (!visit) throw new AppError('Visit not found', 404);
  return visit;
}

// The three rules for a bookable time: in the future, inside working hours, no overlap.
async function assertSlotBookable(doctor, start, durationMinutes, ignoreVisitId) {
  if (start <= new Date()) throw new AppError('Visit time must be in the future', 400);
  if (!isWithinWorkingHours(doctor, start, durationMinutes)) {
    throw new AppError('This time is outside the doctor\'s working days/hours', 400);
  }
  const end = new Date(start.getTime() + durationMinutes * MIN);
  const filter = {
    doctor: doctor._id,
    status: { $ne: 'cancelled' },
    scheduledAt: { $lt: end },
    endsAt: { $gt: start },
  };
  if (ignoreVisitId) filter._id = { $ne: ignoreVisitId };
  if (await Visit.exists(filter)) throw new AppError('This time slot is already booked', 409);
}

exports.create = asyncHandler(async (req, res) => {
  const { user } = req;
  const doctorId = req.body.doctor || (user.role === 'doctor' ? String(user.doctor) : undefined);
  if (!doctorId) throw new AppError('doctor is required', 400);
  if (user.role === 'doctor' && doctorId !== String(user.doctor)) {
    throw new AppError('Doctors can only schedule their own visits', 403);
  }

  const [doctor, patient] = await Promise.all([Doctor.findById(doctorId), Patient.findById(req.body.patient)]);
  if (!doctor || !doctor.isActive) throw new AppError('Doctor not found or inactive', 404);
  if (!patient) throw new AppError('Patient not found', 404);

  const duration = req.body.durationMinutes || doctor.slotMinutes;
  await assertSlotBookable(doctor, req.body.scheduledAt, duration);

  const visit = await Visit.create({ ...req.body, doctor: doctor._id, durationMinutes: duration });
  const populated = await withPopulate(Visit.findById(visit._id));
  res.status(201).json({ success: true, data: present(user, populated) });
});

exports.list = asyncHandler(async (req, res) => {
  const { user } = req;
  const { page, limit, skip } = getPagination(req.query, 500);
  const filter = {};
  if (req.query.doctor) filter.doctor = req.query.doctor;
  if (req.query.status) filter.status = req.query.status;
  if (user.role === 'patient') filter.patient = user.patient; // forced - cannot be overridden
  else if (req.query.patient) filter.patient = req.query.patient;
  if (req.query.from || req.query.to) {
    filter.scheduledAt = {};
    if (req.query.from) filter.scheduledAt.$gte = req.query.from;
    if (req.query.to) filter.scheduledAt.$lt = req.query.to;
  }

  let query = withPopulate(Visit.find(filter).sort({ scheduledAt: 1 }).skip(skip).limit(limit));
  if (user.role === 'patient') query = query.select('-internalNotes');
  const [items, total] = await Promise.all([query, Visit.countDocuments(filter)]);
  res.json({ success: true, data: items, meta: pageMeta(total, page, limit) });
});

exports.getOne = asyncHandler(async (req, res) => {
  const visit = await withPopulate(Visit.findById(req.params.id));
  if (!visit) throw new AppError('Visit not found', 404);
  assertCanView(req.user, visit);
  res.json({ success: true, data: present(req.user, visit) });
});

exports.update = asyncHandler(async (req, res) => {
  const visit = await findVisitOrFail(req.params.id);
  assertCanModify(req.user, visit);

  const before = { at: visit.scheduledAt.getTime(), dur: visit.durationMinutes, status: visit.status };
  Object.assign(visit, req.body);
  const timeChanged = visit.scheduledAt.getTime() !== before.at || visit.durationMinutes !== before.dur;
  const reopened = before.status === 'cancelled' && visit.status === 'scheduled';

  if (visit.status === 'scheduled' && (timeChanged || reopened)) {
    const doctor = await Doctor.findById(visit.doctor);
    await assertSlotBookable(doctor, visit.scheduledAt, visit.durationMinutes, visit._id);
  }

  await visit.save();
  const populated = await withPopulate(Visit.findById(visit._id));
  res.json({ success: true, data: present(req.user, populated) });
});

exports.remove = asyncHandler(async (req, res) => {
  const visit = await Visit.findOneAndDelete({ _id: req.params.id });
  if (!visit) throw new AppError('Visit not found', 404);
  visit.prescriptions.forEach((p) => removeFile(p.filename));
  res.json({ success: true, message: 'Visit deleted' });
});

// ---- Available slots for the calendar -------------------------------------
exports.slots = asyncHandler(async (req, res) => {
  const { doctorId, date } = req.query;
  const from = date || req.query.from;
  const to = date || req.query.to;

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new AppError('Doctor not found', 404);

  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const dayCount = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000) + 1;
  if (dayCount < 1 || dayCount > 14) throw new AppError('Date range must be between 1 and 14 days', 400);

  const rangeStart = clinicTimeToDate(fy, fm, fd);
  const rangeEnd = new Date(rangeStart.getTime() + dayCount * 86400000);
  const booked = await Visit.find({
    doctor: doctor._id,
    status: { $ne: 'cancelled' },
    scheduledAt: { $lt: rangeEnd },
    endsAt: { $gt: rangeStart },
  }).select('scheduledAt endsAt');

  const now = new Date();
  const slots = [];
  for (let i = 0; i < dayCount; i += 1) {
    const day = new Date(Date.UTC(fy, fm - 1, fd + i));
    if (!doctor.workingDays.includes(day.getUTCDay())) continue;
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    const startMin = toMinutes(doctor.workingHours.start);
    const endMin = toMinutes(doctor.workingHours.end);
    for (let t = startMin; t + doctor.slotMinutes <= endMin; t += doctor.slotMinutes) {
      const start = clinicTimeToDate(y, m, d, Math.floor(t / 60), t % 60);
      const end = new Date(start.getTime() + doctor.slotMinutes * MIN);
      const taken = booked.some((b) => b.scheduledAt < end && b.endsAt > start);
      slots.push({ start, end, available: !taken && start > now });
    }
  }
  res.json({ success: true, data: slots });
});

// ---- Prescription uploads ---------------------------------------------------
exports.uploadPrescription = asyncHandler(async (req, res) => {
  const { file } = req;
  if (!file) throw new AppError('Attach an image in the "prescription" field', 400);

  try {
    if (!hasImageSignature(file.path)) throw new AppError('File content is not a valid image', 415);
    const visit = await findVisitOrFail(req.params.id);
    assertCanModify(req.user, visit);
    if (visit.prescriptions.length >= 10) throw new AppError('Maximum 10 prescriptions per visit', 400);

    visit.prescriptions.push({
      filename: file.filename,
      originalName: file.originalname.slice(0, 120),
      mimetype: file.mimetype,
      size: file.size,
    });
    await visit.save();
    const populated = await withPopulate(Visit.findById(visit._id));
    res.status(201).json({ success: true, data: present(req.user, populated) });
  } catch (err) {
    removeFile(file.filename); // never keep a file that was rejected
    throw err;
  }
});

exports.getPrescription = asyncHandler(async (req, res, next) => {
  const visit = await findVisitOrFail(req.params.id);
  assertCanView(req.user, visit);
  const item = visit.prescriptions.find((p) => p.filename === req.params.filename);
  if (!item) throw new AppError('Prescription not found', 404);

  await recordAudit({ action: 'READ', entity: 'Visit', entityId: visit._id });
  res.sendFile(
    item.filename,
    {
      root: uploadRoot,
      headers: { 'Content-Type': item.mimetype, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' },
    },
    (err) => err && next(new AppError('File not found', 404))
  );
});

exports.deletePrescription = asyncHandler(async (req, res) => {
  const visit = await findVisitOrFail(req.params.id);
  assertCanModify(req.user, visit);
  const item = visit.prescriptions.find((p) => p.filename === req.params.filename);
  if (!item) throw new AppError('Prescription not found', 404);

  visit.prescriptions = visit.prescriptions.filter((p) => p.filename !== item.filename);
  await visit.save();
  removeFile(item.filename);
  res.json({ success: true, message: 'Prescription removed' });
});
