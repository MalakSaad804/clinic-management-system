const { z, nonEmpty } = require('./common');

const base = z.object({
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,20}$/, 'Invalid phone number'),
  dateOfBirth: z.coerce.date().refine((d) => d <= new Date(), 'Date of birth cannot be in the future'),
  gender: z.enum(['male', 'female', 'other']),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  address: z.string().trim().max(200).optional(),
  allergies: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  emergencyContact: z.object({ name: z.string().trim().max(100).optional(), phone: z.string().trim().max(20).optional() }).optional(),
});

const create = base.strict();
const update = nonEmpty(base.partial().strict());
const list = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

module.exports = { create, update, list };
