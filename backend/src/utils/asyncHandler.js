// Wraps an async route so errors go to the error middleware automatically.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
