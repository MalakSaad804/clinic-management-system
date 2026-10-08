const context = require('./context');

// Writes one audit entry. Never throws: a broken audit write must not
// destroy a request that already succeeded (it is logged to the console).
async function recordAudit({ action, entity, entityId, changedFields = [], user, userRole }) {
  try {
    const Audit = require('../models/Audit'); // lazy require avoids circular imports
    const ctx = context.get();
    await Audit.create({
      action,
      entity,
      entityId,
      changedFields,
      user: user || ctx.user?._id,
      userRole: userRole || ctx.user?.role,
      ip: ctx.ip,
      method: ctx.method,
      path: ctx.path,
    });
  } catch (err) {
    console.error('[audit] failed to write audit entry:', err.message);
  }
}

module.exports = { recordAudit };
