const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User, Patient } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAudit } = require('../utils/audit');

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

const signAccess = (user) =>
  jwt.sign({ sub: user.id, role: user.role, type: 'access' }, env.jwtSecret, { expiresIn: env.accessTokenExpiresIn });

const signRefresh = (user) =>
  jwt.sign({ sub: user.id, type: 'refresh', jti: crypto.randomUUID() }, env.jwtRefreshSecret, {
    expiresIn: env.refreshTokenExpiresIn,
  });

// Creates both tokens and remembers a HASH of the refresh token (never the token itself).
async function issueTokens(user) {
  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user);
  await User.updateOne({ _id: user._id }, { refreshTokenHash: sha256(refreshToken) });
  return { accessToken, refreshToken };
}

// Public sign-up for patients: creates a Patient record + a login linked to it.
exports.register = asyncHandler(async (req, res) => {
  const { password, firstName, lastName, email, phone, dateOfBirth, gender } = req.body;

  // Never auto-link to an existing patient record: anyone could claim someone else's
  // history just by typing their email. Staff must link accounts for existing patients.
  if (await Patient.exists({ email }) || (await User.exists({ email }))) {
    throw new AppError('An account or patient record with this email already exists. Please contact the clinic.', 409);
  }

  const patient = await Patient.create({ firstName, lastName, email, phone, dateOfBirth, gender });
  let user;
  try {
    user = await User.create({ name: `${firstName} ${lastName}`, email, password, role: 'patient', patient: patient._id });
  } catch (err) {
    await Patient.deleteOne({ _id: patient._id }); // roll back so we do not leave half a signup
    throw err;
  }

  const tokens = await issueTokens(user);
  res.status(201).json({ success: true, data: { user, ...tokens } });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  const ok = user && user.isActive && (await user.comparePassword(password));

  if (!ok) {
    await recordAudit({ action: 'LOGIN_FAILED', entity: 'User', entityId: user?._id });
    // Same message for "no such user" and "wrong password" so attackers learn nothing.
    throw new AppError('Invalid email or password', 401);
  }

  const tokens = await issueTokens(user);
  await recordAudit({ action: 'LOGIN', entity: 'User', entityId: user._id, user: user._id, userRole: user.role });
  res.json({ success: true, data: { user, ...tokens } });
});

exports.refresh = asyncHandler(async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.body.refreshToken, env.jwtRefreshSecret);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }
  if (payload.type !== 'refresh') throw new AppError('Invalid refresh token', 401);

  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || !user.isActive || user.refreshTokenHash !== sha256(req.body.refreshToken)) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  // Rotation: every refresh gives a NEW refresh token and the old one stops working.
  const tokens = await issueTokens(user);
  res.json({ success: true, data: tokens });
});

exports.logout = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $unset: { refreshTokenHash: 1 } });
  await recordAudit({ action: 'LOGOUT', entity: 'User', entityId: req.user._id });
  res.json({ success: true, message: 'Logged out' });
});

exports.me = (req, res) => res.json({ success: true, data: { user: req.user } });
