const AppError = require('../utils/AppError');

// validate({ body: zodSchema, query: zodSchema, params: zodSchema })
module.exports =
  (schemas) =>
  (req, _res, next) => {
    for (const key of ['params', 'query', 'body']) {
      if (!schemas[key]) continue;
      const result = schemas[key].safeParse(req[key]);
      if (!result.success) {
        const details = result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        }));
        return next(new AppError('Validation failed', 400, details));
      }
      req[key] = result.data;
    }
    next();
  };
