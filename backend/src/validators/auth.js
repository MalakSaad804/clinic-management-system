const { z } = require('./common');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password needs a letter')
  .regex(/[0-9]/, 'Password needs a number');

const register = z
  .object({
    firstName: z.string().trim().min(2).max(50),
    lastName: z.string().trim().min(2).max(50),
    email: z.string().trim().toLowerCase().email(),
    password,
    phone: z.string().trim().regex(/^[0-9+\-\s]{7,20}$/, 'Invalid phone number'),
    dateOfBirth: z.coerce.date(),
    gender: z.enum(['male', 'female', 'other']),
  })
  .strict();

const login = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }).strict();
const refresh = z.object({ refreshToken: z.string().min(10) }).strict();

module.exports = { register, login, refresh, password };
