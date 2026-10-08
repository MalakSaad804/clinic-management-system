const { z, objectId, isoDay, nonEmpty } = require('./common');

const create = z
  .object({
    patient: objectId,
    doctor: objectId.optional(),
    scheduledAt: z.coerce.date(),
    durationMinutes: z.number().int().min(10).max(240).optional(),
    reason: z.string().trim().min(3).max(300),
    notes: z.string().trim().max(5000).optional(),
  })
  .strict();

const update = nonEmpty(
  z
    .object({
      scheduledAt: z.coerce.date(),
      durationMinutes: z.number().int().min(10).max(240),
      status: z.enum(['scheduled', 'completed', 'cancelled']),
      reason: z.string().trim().min(3).max(300),
      notes: z.string().trim().max(5000),
      diagnosis: z.string().trim().max(1000),
      internalNotes: z.string().trim().max(5000),
    })
    .partial()
    .strict()
);

const list = z.object({
  doctor: objectId.optional(),
  patient: objectId.optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const slots = z
  .object({ doctorId: objectId, date: isoDay.optional(), from: isoDay.optional(), to: isoDay.optional() })
  .refine((q) => q.date || (q.from && q.to), { message: 'Provide date, or from and to' });

module.exports = { create, update, list, slots };
