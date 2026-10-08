const { z, objectId, nonEmpty } = require('./common');
const { password } = require('./auth');

const create = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email(),
    password,
    role: z.enum(['admin', 'doctor', 'patient']),
    doctorId: objectId.optional(),
    patientId: objectId.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.role === 'doctor' && !v.doctorId) ctx.addIssue({ code: 'custom', path: ['doctorId'], message: 'doctorId is required for doctors' });
    if (v.role === 'patient' && !v.patientId) ctx.addIssue({ code: 'custom', path: ['patientId'], message: 'patientId is required for patients' });
  });

const update = nonEmpty(z.object({ isActive: z.boolean().optional(), name: z.string().trim().min(2).max(100).optional() }).strict());

module.exports = { create, update };
