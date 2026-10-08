const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const idParams = z.object({ id: objectId });
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const nonEmpty = (schema) => schema.refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field' });

module.exports = { z, objectId, idParams, isoDay, nonEmpty };
