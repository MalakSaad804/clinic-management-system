const mongoose = require('mongoose');
const auditPlugin = require('./auditPlugin');

const patientSchema = new mongoose.Schema(
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
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
      match: [/^[0-9+\-\s]{7,20}$/, 'Invalid phone number'],
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
      validate: { validator: (v) => v <= new Date(), message: 'Date of birth cannot be in the future' },
    },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    address: { type: String, trim: true, maxlength: 200 },
    allergies: [{ type: String, trim: true }],
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtuals = computed fields (not stored in the database)
patientSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

patientSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return undefined;
  const now = new Date();
  let age = now.getFullYear() - this.dateOfBirth.getFullYear();
  const beforeBirthday =
    now.getMonth() < this.dateOfBirth.getMonth() ||
    (now.getMonth() === this.dateOfBirth.getMonth() && now.getDate() < this.dateOfBirth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
});

// Indexes (email already has a unique index from `unique: true`)
patientSchema.index({ lastName: 1, firstName: 1 });
patientSchema.index({ phone: 1 });

patientSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

patientSchema.plugin(auditPlugin, { entity: 'Patient' });

module.exports = mongoose.model('Patient', patientSchema);
