const request = require('supertest');
const app = require('../src/app');
const { Visit } = require('../src/models');
const db = require('./helpers/db');
const f = require('./helpers/factory');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

let doctor;
beforeEach(async () => {
  doctor = await f.makeDoctorLogin();
});

describe('Patient CRUD', () => {
  it('POST creates a patient (201) with computed fullName and age', async () => {
    const res = await request(app).post('/api/patients').set(f.bearer(doctor.token)).send(f.patientData({ dateOfBirth: '2000-01-01' }));
    expect(res.status).toBe(201);
    expect(res.body.data.fullName).toBe('Sara Ali');
    expect(res.body.data.age).toBeGreaterThanOrEqual(25);
  });

  it('POST rejects missing required fields (400) and lists them', async () => {
    const res = await request(app).post('/api/patients').set(f.bearer(doctor.token)).send({ firstName: 'A' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toEqual(expect.arrayContaining(['lastName', 'email']));
  });

  it('POST rejects a future date of birth', async () => {
    const res = await request(app).post('/api/patients').set(f.bearer(doctor.token)).send(f.patientData({ dateOfBirth: '2999-01-01' }));
    expect(res.status).toBe(400);
  });

  it('POST returns 409 for a duplicate email (unique index)', async () => {
    const body = f.patientData();
    await request(app).post('/api/patients').set(f.bearer(doctor.token)).send(body);
    const res = await request(app).post('/api/patients').set(f.bearer(doctor.token)).send(body);
    expect(res.status).toBe(409);
  });

  it('GET list supports search and pagination', async () => {
    await f.makePatient({ firstName: 'Zainab', lastName: 'Noor' });
    await f.makePatient({ firstName: 'Omar', lastName: 'Farooq' });
    const all = await request(app).get('/api/patients?limit=1').set(f.bearer(doctor.token));
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(1);
    expect(all.body.meta.total).toBe(2);
    expect(all.body.meta.pages).toBe(2);

    const found = await request(app).get('/api/patients?q=zain').set(f.bearer(doctor.token));
    expect(found.body.data).toHaveLength(1);
    expect(found.body.data[0].firstName).toBe('Zainab');
  });

  it('search treats special characters literally (no regex injection)', async () => {
    await f.makePatient();
    const res = await request(app).get('/api/patients?q=.*').set(f.bearer(doctor.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('GET /:id returns the patient, 404 if missing, 400 if the id is malformed', async () => {
    const p = await f.makePatient();
    expect((await request(app).get(`/api/patients/${p._id}`).set(f.bearer(doctor.token))).status).toBe(200);
    expect((await request(app).get('/api/patients/64b7f0f0f0f0f0f0f0f0f0f0').set(f.bearer(doctor.token))).status).toBe(404);
    expect((await request(app).get('/api/patients/abc').set(f.bearer(doctor.token))).status).toBe(400);
  });

  it('PATCH updates only the given fields', async () => {
    const p = await f.makePatient();
    const res = await request(app).patch(`/api/patients/${p._id}`).set(f.bearer(doctor.token)).send({ phone: '0300 9998887' });
    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('0300 9998887');
    expect(res.body.data.firstName).toBe('Sara');
  });

  it('PATCH rejects an empty body and invalid values', async () => {
    const p = await f.makePatient();
    expect((await request(app).patch(`/api/patients/${p._id}`).set(f.bearer(doctor.token)).send({})).status).toBe(400);
    expect((await request(app).patch(`/api/patients/${p._id}`).set(f.bearer(doctor.token)).send({ email: 'nope' })).status).toBe(400);
    expect((await request(app).patch('/api/patients/64b7f0f0f0f0f0f0f0f0f0f0').set(f.bearer(doctor.token)).send({ phone: '0300 9998887' })).status).toBe(404);
  });

  it('DELETE is admin-only', async () => {
    const admin = await f.makeUser('admin');
    const p = await f.makePatient();
    expect((await request(app).delete(`/api/patients/${p._id}`).set(f.bearer(doctor.token))).status).toBe(403);
    expect((await request(app).delete(`/api/patients/${p._id}`).set(f.bearer(admin.token))).status).toBe(200);
    expect((await request(app).delete(`/api/patients/${p._id}`).set(f.bearer(admin.token))).status).toBe(404);
  });

  it('DELETE is blocked (409) when the patient has visit history', async () => {
    const admin = await f.makeUser('admin');
    const p = await f.makePatient();
    await Visit.create({ patient: p._id, doctor: doctor.doctor._id, scheduledAt: new Date(), reason: 'Old visit' });
    const res = await request(app).delete(`/api/patients/${p._id}`).set(f.bearer(admin.token));
    expect(res.status).toBe(409);
  });
});

describe('Patient privacy on /api/patients/:id', () => {
  it('a patient can read their own record', async () => {
    const me = await f.makePatientLogin();
    const res = await request(app).get(`/api/patients/${me.patient._id}`).set(f.bearer(me.token));
    expect(res.status).toBe(200);
  });

  it("a patient cannot read someone else's record", async () => {
    const me = await f.makePatientLogin();
    const other = await f.makePatient();
    const res = await request(app).get(`/api/patients/${other._id}`).set(f.bearer(me.token));
    expect(res.status).toBe(403);
  });
});
