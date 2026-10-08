const { Audit } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, pageMeta } = require('../utils/pagination');

// GET /api/audit-logs  (admin only)
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { user, entity, entityId, action, from, to } = req.query;

  const filter = {};
  if (user) filter.user = user;
  if (entity) filter.entity = entity;
  if (entityId) filter.entityId = entityId;
  if (action) filter.action = action;
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = from;
    if (to) filter.timestamp.$lte = to;
  }

  const [items, total] = await Promise.all([
    Audit.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).populate('user', 'name email role'),
    Audit.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, page, limit) });
});
