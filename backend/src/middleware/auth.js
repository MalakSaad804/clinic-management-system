const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const context = require('../utils/context');

// 1) Authentication: "who are you?" - checks the JWT in the Authorization header.
const protect = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError('Authentication required', 401);

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw new AppError(err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token', 401);
  }
  if (payload.type !== 'access') throw new AppError('Invalid token', 401);

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new AppError('User no longer exists or is disabled', 401);

  req.user = user;
  context.get().user = user; // lets audit hooks know who is acting
  next();
});

// 2) Authorization: "are you allowed?" - checks the role.
const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to do this', 403));
    }
    next();
  };

module.exports = { protect, authorize };
