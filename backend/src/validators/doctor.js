const { z, nonEmpty } = require('./common');

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

const base = z.object({
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,20}$/, 'Invalid phone number').optional(),
  specialization: z.string().trim().min(2).max(80),
  licenseNumber: z.string().trim().min(3).max(40),
  workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  workingHours: z.object({ start: hhmm, end: hhmm }).refine((h) => h.start < h.end, 'End must be after start').optional(),
  slotMinutes: z.number().int().min(10).max(120).optional(),
  isActive: z.boolean().optional(),
});

const create = base.strict();
const update = nonEmpty(base.partial().strict());
const list = z.object({
  specialization: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

module.exports = { create, update, list };
