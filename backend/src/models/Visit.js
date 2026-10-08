const mongoose = require('mongoose');
const auditPlugin = require('./auditPlugin');

const STATUSES = ['scheduled', 'completed', 'cancelled'];

const prescriptionSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true }, // random name on disk
    originalName: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const visitSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    scheduledAt: { type: Date, required: [true, 'Visit date/time is required'] },
    durationMinutes: { type: Number, default: 30, min: 10, max: 240 },
    endsAt: { type: Date }, // computed automatically from scheduledAt + duration
    status: { type: String, enum: STATUSES, default: 'scheduled' },
    reason: { type: String, required: [true, 'Reason is required'], trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 5000 }, // visit notes (patient can read)
    diagnosis: { type: String, trim: true, maxlength: 1000 },
    internalNotes: { type: String, trim: true, maxlength: 5000 }, // doctors/admin only
    prescriptions: [prescriptionSchema],
  },
  { timestamps: true }
);

visitSchema.pre('validate', function () {
  if (this.scheduledAt && this.durationMinutes) {
    this.endsAt = new Date(this.scheduledAt.getTime() + this.durationMinutes * 60 * 1000);
  }
});

// Indexes that match the real queries (calendar, conflicts, history, reports)
visitSchema.index({ doctor: 1, scheduledAt: 1, endsAt: 1 });
visitSchema.index({ patient: 1, scheduledAt: -1 });
visitSchema.index({ status: 1, scheduledAt: 1 });

visitSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    if (ret.prescriptions) {
      ret.prescriptions = ret.prescriptions.map((p) => ({
        ...p,
        url: `/api/visits/${ret._id}/prescriptions/${p.filename}`,
      }));
    }
    return ret;
  },
});

visitSchema.plugin(auditPlugin, { entity: 'Visit' });

module.exports = mongoose.model('Visit', visitSchema);
module.exports.STATUSES = STATUSES;
