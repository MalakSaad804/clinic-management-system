const mongoose = require('mongoose');
const auditPlugin = require('./auditPlugin');

const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

const doctorSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: [true, 'First name is required'], trim: true, minlength: 2, maxlength: 50 },
    lastName: { type: String, required: [true, 'Last name is required'], trim: true, minlength: 2, maxlength: 50 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    phone: { type: String, trim: true, match: [/^[0-9+\-\s]{7,20}$/, 'Invalid phone number'] },
    specialization: { type: String, required: [true, 'Specialization is required'], trim: true },
    licenseNumber: { type: String, required: [true, 'License number is required'], unique: true, trim: true },
    // Used by the appointment calendar to create available slots
    workingDays: {
      type: [{ type: Number, min: 0, max: 6 }], // 0 = Sunday ... 6 = Saturday
      default: [1, 2, 3, 4, 5],
    },
    workingHours: {
      start: { type: String, default: '09:00', match: hhmm },
      end: { type: String, default: '17:00', match: hhmm },
    },
    slotMinutes: { type: Number, default: 30, min: 10, max: 120 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

doctorSchema.virtual('fullName').get(function () {
  return `Dr. ${this.firstName} ${this.lastName}`;
});

doctorSchema.index({ specialization: 1 });
doctorSchema.index({ lastName: 1, firstName: 1 });

doctorSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

doctorSchema.plugin(auditPlugin, { entity: 'Doctor' });

module.exports = mongoose.model('Doctor', doctorSchema);
