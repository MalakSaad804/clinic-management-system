const { User, Doctor, Patient } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, pageMeta } = require('../utils/pagination');

exports.create = asyncHandler(async (req, res) => {
  const { doctorId, patientId, ...rest } = req.body;
  const data = { ...rest };
  if (rest.role === 'doctor') {
    if (!(await Doctor.exists({ _id: doctorId }))) throw new AppError('Doctor profile not found', 404);
    data.doctor = doctorId;
  }
  if (rest.role === 'patient') {
    if (!(await Patient.exists({ _id: patientId }))) throw new AppError('Patient record not found', 404);
    data.patient = patientId;
  }
  const user = await User.create(data);
  res.status(201).json({ success: true, data: user });
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    User.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, page, limit) });
});

exports.update = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  Object.assign(user, req.body);
  await user.save(); // save() runs validation and the audit hook
  res.json({ success: true, data: user });
});
