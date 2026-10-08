require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clinic',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-access-secret-change-me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-only-refresh-secret-change-me',
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 5,
  // Clinic time zone as minutes from UTC. Pakistan = +05:00 = 300.
  clinicTzOffsetMinutes: process.env.CLINIC_TZ_OFFSET_MINUTES
    ? Number(process.env.CLINIC_TZ_OFFSET_MINUTES)
    : 300,
  // Folder that holds the built React app (only used in production / Docker).
  frontendDist: process.env.FRONTEND_DIST || '',
};

if (env.isProd) {
  const missing = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'MONGO_URI'].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = env;
