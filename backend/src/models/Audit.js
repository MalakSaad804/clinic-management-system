const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT'],
    },
    entity: { type: String, required: true }, // e.g. "Patient", "Visit"
    entityId: { type: mongoose.Schema.Types.ObjectId },
    // Only field NAMES are stored, never values - so the audit log itself
    // never becomes a second copy of private patient data.
    changedFields: [String],
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userRole: String,
    ip: String,
    method: String,
    path: String,
    timestamp: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

auditSchema.index({ timestamp: -1 });
auditSchema.index({ user: 1, timestamp: -1 });
auditSchema.index({ entity: 1, entityId: 1, timestamp: -1 });
auditSchema.index({ action: 1, timestamp: -1 });

// Audit logs are append-only: nobody can edit or delete them through Mongoose.
['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'deleteOne', 'deleteMany'].forEach(
  (op) => {
    auditSchema.pre(op, function () {
      throw new Error('Audit logs are append-only');
    });
  }
);

module.exports = mongoose.model('Audit', auditSchema);
