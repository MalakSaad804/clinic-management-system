const context = require('../utils/context');

// Runs every request inside its own "context" so audit hooks know the IP,
// route and (after login check) the user who triggered a database change.
module.exports = (req, _res, next) => {
  context.run({ ip: req.ip, method: req.method, path: req.originalUrl.split('?')[0] }, next);
};
