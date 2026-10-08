const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { User } = require('../src/models');
const db = require('./helpers/db');
const f = require('./helpers/factory');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

const signup = (o = {}) => ({
  firstName: 'Sara',
  lastName: 'Ali',
  email: 'sara@test.com',
  password: 'Password123',
  phone: '0311 1234567',
  dateOfBirth: '1996-04-12',
  gender: 'female',
  ...o,
});

describe('POST /api/auth/register', () => {
  it('creates a patient account and returns tokens (never the password)', async () => {
    const res = await request(app).post('/api/auth/register').send(signup());
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.role).toBe('patient');
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('stores the password hashed with bcrypt', async () => {
    await request(app).post('/api/auth/register').send(signup());
    const user = await User.findOne({ email: 'sara@test.com' }).select('+password');
    expect(user.password).not.toBe('Password123');
    expect(user.password.startsWith('$2')).toBe(true);
  });

  it('rejects a weak password with 400', async () => {
    const res = await request(app).post('/api/auth/register').send(signup({ password: 'short' }));
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('rejects unknown fields (cannot sneak in role=admin)', async () => {
    const res = await request(app).post('/api/auth/register').send(signup({ role: 'admin' }));
    expect(res.status).toBe(400);
  });

  it('returns 409 when the email already exists', async () => {
    await request(app).post('/api/auth/register').send(signup());
    const res = await request(app).post('/api/auth/register').send(signup());
    expect(res.status).toBe(409);
  });

  it('does not let someone claim an existing patient record by email', async () => {
    await f.makePatient({ email: 'existing@test.com' });
    const res = await request(app).post('/api/auth/register').send(signup({ email: 'existing@test.com' }));
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(signup());
  });

  it('returns a JWT that has an expiration', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'sara@test.com', password: 'Password123' });
    expect(res.status).toBe(200);
    const payload = jwt.decode(res.body.data.accessToken);
    expect(payload.exp).toBeDefined();
    expect(payload.exp).toBeGreaterThan(payload.iat);
    expect(payload.role).toBe('patient');
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'sara@test.com', password: 'WrongPass1' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('gives the same message for unknown emails (no user enumeration)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'Password123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('blocks disabled accounts', async () => {
    await User.updateOne({ email: 'sara@test.com' }, { isActive: false });
    const res = await request(app).post('/api/auth/login').send({ email: 'sara@test.com', password: 'Password123' });
    expect(res.status).toBe(401);
  });
});

describe('protected routes', () => {
  it('reject requests without a token', async () => {
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(401);
  });

  it('reject a garbage token', async () => {
    const res = await request(app).get('/api/patients').set(f.bearer('not.a.token'));
    expect(res.status).toBe(401);
  });

  it('reject an expired token', async () => {
    const { user } = await f.makeUser('admin');
    const expired = jwt.sign({ sub: user.id, role: 'admin', type: 'access' }, env.jwtSecret, { expiresIn: -10 });
    const res = await request(app).get('/api/patients').set(f.bearer(expired));
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token expired');
  });

  it('reject a token signed with the wrong secret', async () => {
    const { user } = await f.makeUser('admin');
    const forged = jwt.sign({ sub: user.id, role: 'admin', type: 'access' }, 'attacker-secret');
    const res = await request(app).get('/api/patients').set(f.bearer(forged));
    expect(res.status).toBe(401);
  });

  it('reject a refresh token used as an access token', async () => {
    const { user } = await f.makeUser('admin');
    const refresh = jwt.sign({ sub: user.id, type: 'refresh' }, env.jwtSecret);
    const res = await request(app).get('/api/patients').set(f.bearer(refresh));
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns the logged-in user', async () => {
    const { token, user } = await f.makeUser('doctor', { doctor: await f.makeDoctor() });
    const res = await request(app).get('/api/auth/me').set(f.bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
  });
});

describe('role-based access control', () => {
  it('patient cannot list patients (403)', async () => {
    const { token } = await f.makePatientLogin();
    const res = await request(app).get('/api/patients').set(f.bearer(token));
    expect(res.status).toBe(403);
  });

  it('doctor cannot create doctors (403) but admin can (201)', async () => {
    const doc = await f.makeDoctorLogin();
    const admin = await f.makeUser('admin');
    const body = f.doctorData();
    expect((await request(app).post('/api/doctors').set(f.bearer(doc.token)).send(body)).status).toBe(403);
    expect((await request(app).post('/api/doctors').set(f.bearer(admin.token)).send(body)).status).toBe(201);
  });

  it('only admins can manage users', async () => {
    const doc = await f.makeDoctorLogin();
    const admin = await f.makeUser('admin');
    expect((await request(app).get('/api/users').set(f.bearer(doc.token))).status).toBe(403);
    expect((await request(app).get('/api/users').set(f.bearer(admin.token))).status).toBe(200);
  });

  it('admin can create a doctor login linked to a doctor profile', async () => {
    const admin = await f.makeUser('admin');
    const doctor = await f.makeDoctor();
    const res = await request(app)
      .post('/api/users')
      .set(f.bearer(admin.token))
      .send({ name: 'Dr New', email: 'drnew@test.com', password: 'Password123', role: 'doctor', doctorId: String(doctor._id) });
    expect(res.status).toBe(201);
    expect(res.body.data.doctor).toBe(String(doctor._id));
    const missing = await request(app)
      .post('/api/users')
      .set(f.bearer(admin.token))
      .send({ name: 'Dr X', email: 'drx@test.com', password: 'Password123', role: 'doctor' });
    expect(missing.status).toBe(400);
  });

  it('admin can disable a user', async () => {
    const admin = await f.makeUser('admin');
    const target = await f.makeUser('admin');
    const res = await request(app).patch(`/api/users/${target.user._id}`).set(f.bearer(admin.token)).send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
    const blocked = await request(app).get('/api/auth/me').set(f.bearer(target.token));
    expect(blocked.status).toBe(401);
  });
});

describe('refresh tokens and logout', () => {
  it('rotates refresh tokens - the old one stops working', async () => {
    const reg = await request(app).post('/api/auth/register').send(signup());
    const first = reg.body.data.refreshToken;

    const r1 = await request(app).post('/api/auth/refresh').send({ refreshToken: first });
    expect(r1.status).toBe(200);
    expect(r1.body.data.accessToken).toBeDefined();

    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: first });
    expect(reuse.status).toBe(401);
  });

  it('rejects a bogus refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'x'.repeat(30) });
    expect(res.status).toBe(401);
  });

  it('rejects an access token sent as refresh token', async () => {
    const reg = await request(app).post('/api/auth/register').send(signup());
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: reg.body.data.accessToken });
    expect(res.status).toBe(401);
  });

  it('logout invalidates the refresh token', async () => {
    const reg = await request(app).post('/api/auth/register').send(signup());
    const { accessToken, refreshToken } = reg.body.data;
    const out = await request(app).post('/api/auth/logout').set(f.bearer(accessToken));
    expect(out.status).toBe(200);
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });
});

describe('misc', () => {
  it('health check is public', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('unknown routes return 404 for logged-in users', async () => {
    const { token } = await f.makeUser('admin');
    const res = await request(app).get('/api/nothing-here').set(f.bearer(token));
    expect(res.status).toBe(404);
  });

  it('invalid JSON returns 400', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
  });
});
