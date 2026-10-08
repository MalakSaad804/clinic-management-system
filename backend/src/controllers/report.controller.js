const mongoose = require('mongoose');
const { Visit, Doctor, Patient } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { clinicTimeToDate, clinicParts, tzString } = require('../utils/time');

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// Doctors only ever see their own numbers; admins can see everyone or pick one doctor.
function doctorScope(user, requestedDoctor) {
  if (user.role === 'doctor') return toObjectId(user.doctor);
  if (requestedDoctor) return toObjectId(requestedDoctor);
  return null;
}

// GET /api/reports/appointments-by-doctor-month?year=2026&doctor=<id>
// Uses ONE aggregation pipeline that runs inside MongoDB (fast, uses the
// {doctor, scheduledAt} index) instead of loading visits into Node.js.
exports.appointmentsByDoctorMonth = asyncHandler(async (req, res) => {
  const year = req.query.year || clinicParts(new Date()).year;
  const scope = doctorScope(req.user, req.query.doctor);

  const match = {
    scheduledAt: { $gte: clinicTimeToDate(year, 1, 1), $lt: clinicTimeToDate(year + 1, 1, 1) },
  };
  if (scope) match.doctor = scope;

  const count = (status) => ({ $sum: { $cond: [{ $eq: ['$status', status] }, 1, 0] } });

  const rows = await Visit.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          doctor: '$doctor',
          month: { $dateToString: { format: '%Y-%m', date: '$scheduledAt', timezone: tzString() } },
        },
        total: { $sum: 1 },
        scheduled: count('scheduled'),
        completed: count('completed'),
        cancelled: count('cancelled'),
      },
    },
    { $sort: { '_id.month': 1 } },
  ]);

  const doctors = await Doctor.find({ _id: { $in: [...new Set(rows.map((r) => String(r._id.doctor)))] } }).select(
    'firstName lastName specialization'
  );
  const byId = new Map(doctors.map((d) => [String(d._id), d]));

  const data = rows
    .map((r) => {
      const d = byId.get(String(r._id.doctor));
      return {
        doctorId: r._id.doctor,
        doctorName: d ? `Dr. ${d.firstName} ${d.lastName}` : 'Unknown',
        specialization: d?.specialization,
        month: r._id.month,
        total: r.total,
        scheduled: r.scheduled,
        completed: r.completed,
        cancelled: r.cancelled,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month) || a.doctorName.localeCompare(b.doctorName));

  res.json({ success: true, data: { year, rows: data } });
});

// GET /api/reports/summary - numbers for the dashboard cards
exports.summary = asyncHandler(async (req, res) => {
  const scope = doctorScope(req.user);
  const match = scope ? { doctor: scope } : {};

  const [statusRows, upcoming, patients, doctors] = await Promise.all([
    Visit.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Visit.countDocuments({ ...match, status: 'scheduled', scheduledAt: { $gte: new Date() } }),
    Patient.countDocuments(),
    Doctor.countDocuments({ isActive: true }),
  ]);

  const byStatus = { scheduled: 0, completed: 0, cancelled: 0 };
  statusRows.forEach((r) => {
    byStatus[r._id] = r.count;
  });

  res.json({
    success: true,
    data: {
      totalVisits: byStatus.scheduled + byStatus.completed + byStatus.cancelled,
      byStatus,
      upcomingVisits: upcoming,
      patients,
      activeDoctors: doctors,
    },
  });
});
