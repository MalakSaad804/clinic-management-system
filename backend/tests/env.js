const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.BCRYPT_ROUNDS = '4'; // fast hashing for tests only
process.env.CLINIC_TZ_OFFSET_MINUTES = '300';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'clinic-test-uploads');
process.env.MAX_UPLOAD_MB = '5';
