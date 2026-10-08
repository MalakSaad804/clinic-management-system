const request = require('supertest');
const app = require('../src/app');
const { Visit } = require('../src/models');
const db = require('./helpers/db');
const f = require('./helpers/factory');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('Doctor CRUD', () => {
  let admin;
  beforeEach(async () => {
    admin = await f.makeUser('admin');
  });

  it('creates a doctor with default working hours and a virtual fullName', async () => {
    const res = await request(app).post('/api/doctors').set(f.bearer(admin.token)).send(f.doctorData());
    expect(res.status).toBe(201);
    expect(res.body.data.fullName).toBe('Dr. Ayesha Khan');
    expect(res.body.data.workingHours).toEqual({ start: '09:00', end: '17:00' });
    expect(res.body.data.workingDays).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejects invalid working hours (400)', async () => {
    const res = await request(app)
      .post('/api/doctors')
      .set(f.bearer(admin.token))
      .send(f.doctorData({ workingHours: { start: '18:00', end: '09:00' } }));
    expect(res.status).toBe(400);
  });

  it('returns 409 for a duplicate license number', async () => {
    const body = f.doctorData();
    await request(app).post('/api/doctors').set(f.bearer(admin.token)).send(body);
    const res = await request(app).post('/api/doctors').set(f.bearer(admin.token)).send({ ...body, email: 'other@test.com' });
    expect(res.status).toBe(409);
  });

  it('any logged-in user can list/read doctors (needed to show names)', async () => {
    const d = await f.makeDoctor({ specialization: 'Cardiologist' });
    await f.makeDoctor();
    const patient = await f.makePatientLogin();
    const list = await request(app).get('/api/doctors?specialization=Cardiologist').set(f.bearer(patient.token));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect((await request(app).get(`/api/doctors/${d._id}`).set(f.bearer(patient.token))).status).toBe(200);
    expect((await request(app).get('/api/doctors/64b7f0f0f0f0f0f0f0f0f0f0').set(f.bearer(patient.token))).status).toBe(404);
  });

  it('updates a doctor (200) and 404 when missing', async () => {
    const d = await f.makeDoctor();
    const res = await request(app).patch(`/api/doctors/${d._id}`).set(f.bearer(admin.token)).send({ slotMinutes: 20 });
    expect(res.status).toBe(200);
    expect(res.body.data.slotMinutes).toBe(20);
    expect((await request(app).patch('/api/doctors/64b7f0f0f0f0f0f0f0f0f0f0').set(f.bearer(admin.token)).send({ slotMinutes: 20 })).status).toBe(404);
  });

  it('deletes a doctor, but not one with visits', async () => {
    const free = await f.makeDoctor();
    const busy = await f.makeDoctor();
    const p = await f.makePatient();
    await Visit.create({ patient: p._id, doctor: busy._id, scheduledAt: new Date(), reason: 'Old visit' });
    expect((await request(app).delete(`/api/doctors/${free._id}`).set(f.bearer(admin.token))).status).toBe(200);
    expect((await request(app).delete(`/api/doctors/${busy._id}`).set(f.bearer(admin.token))).status).toBe(409);
    expect((await request(app).delete(`/api/doctors/${free._id}`).set(f.bearer(admin.token))).status).toBe(404);
  });
});
