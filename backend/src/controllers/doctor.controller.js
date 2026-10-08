const { Doctor, Visit, User } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, pageMeta } = require('../utils/pagination');

exports.create = asyncHandler(async (req, res) => {
  const doctor = await Doctor.create(req.body);
  res.status(201).json({ success: true, data: doctor });
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.specialization) filter.specialization = req.query.specialization;
  const [items, total] = await Promise.all([
    Doctor.find(filter).sort({ lastName: 1, firstName: 1 }).skip(skip).limit(limit),
    Doctor.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, page, limit) });
});

exports.getOne = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw new AppError('Doctor not found', 404);
  res.json({ success: true, data: doctor });
});

exports.update = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findOneAndUpdate({ _id: req.params.id }, req.body, { new: true, runValidators: true });
  if (!doctor) throw new AppError('Doctor not found', 404);
  res.json({ success: true, data: doctor });
});

exports.remove = asyncHandler(async (req, res) => {
  if (await Visit.exists({ doctor: req.params.id })) {
    throw new AppError('This doctor has visits on record. Set isActive to false instead of deleting.', 409);
  }
  const doctor = await Doctor.findOneAndDelete({ _id: req.params.id });
  if (!doctor) throw new AppError('Doctor not found', 404);
  await User.deleteMany({ doctor: doctor._id });
  res.json({ success: true, message: 'Doctor deleted' });
});
