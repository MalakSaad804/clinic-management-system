const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const ctrl = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const v = require('../validators/auth');

// Slows down password-guessing attacks (disabled while running tests).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { success: false, message: 'Too many attempts, please try again later' },
});

router.post('/register', authLimiter, validate({ body: v.register }), ctrl.register);
router.post('/login', authLimiter, validate({ body: v.login }), ctrl.login);
router.post('/refresh', authLimiter, validate({ body: v.refresh }), ctrl.refresh);
router.post('/logout', protect, ctrl.logout);
router.get('/me', protect, ctrl.me);

module.exports = router;
