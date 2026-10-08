const { z, objectId } = require('./common');

const perDoctorMonth = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  doctor: objectId.optional(),
});

const auditList = z.object({
  user: objectId.optional(),
  entity: z.enum(['User', 'Patient', 'Doctor', 'Visit']).optional(),
  entityId: objectId.optional(),
  action: z.enum(['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

module.exports = { perDoctorMonth, auditList };
