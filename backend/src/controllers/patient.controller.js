const { Patient, Visit, User } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { getPagination, pageMeta } = require('../utils/pagination');
const { recordAudit } = require('../utils/audit');

exports.create = asyncHandler(async (req, res) => {
  const patient = await Patient.create(req.body);
  res.status(201).json({ success: true, data: patient });
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx }];
  }
  const [items, total] = await Promise.all([
    Patient.find(filter).sort({ lastName: 1, firstName: 1 }).skip(skip).limit(limit),
    Patient.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, page, limit) });
});

// A patient may only open THEIR OWN record. Staff can open any.
function assertCanSeePatient(user, patientId) {
  if (user.role === 'patient' && String(user.patient) !== String(patientId)) {
    throw new AppError('You can only view your own records', 403);
  }
}

exports.getOne = asyncHandler(async (req, res) => {
  assertCanSeePatient(req.user, req.params.id);
  const patient = await Patient.findById(req.params.id);
  if (!patient) throw new AppError('Patient not found', 404);
  res.json({ success: true, data: patient });
});

exports.update = asyncHandler(async (req, res) => {
  const patient = await Patient.findOneAndUpdate({ _id: req.params.id }, req.body, { new: true, runValidators: true });
  if (!patient) throw new AppError('Patient not found', 404);
  res.json({ success: true, data: patient });
});

exports.remove = asyncHandler(async (req, res) => {
  if (await Visit.exists({ patient: req.params.id })) {
    throw new AppError('This patient has visit history and cannot be deleted', 409);
  }
  const patient = await Patient.findOneAndDelete({ _id: req.params.id });
  if (!patient) throw new AppError('Patient not found', 404);
  await User.deleteMany({ patient: patient._id }); // remove the login too
  res.json({ success: true, message: 'Patient deleted' });
});

// Privacy-aware history: patients see only their own, with doctor-only fields removed.
exports.history = asyncHandler(async (req, res) => {
  const { id } = req.params;
  assertCanSeePatient(req.user, id);

  const patient = await Patient.findById(id);
  if (!patient) throw new AppError('Patient not found', 404);

  const isStaff = req.user.role !== 'patient';
  const { page, limit, skip } = getPagination(req.query);

  const query = Visit.find({ patient: id })
    .sort({ scheduledAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('doctor', 'firstName lastName specialization');
  if (!isStaff) query.select('-internalNotes');

  const [visits, total] = await Promise.all([query, Visit.countDocuments({ patient: id })]);

  // Reading medical history is itself an auditable event.
  await recordAudit({ action: 'READ', entity: 'Patient', entityId: patient._id });

  res.json({
    success: true,
    data: { patient, visits, view: isStaff ? 'full' : 'patient' },
    meta: pageMeta(total, page, limit),
  });
});
