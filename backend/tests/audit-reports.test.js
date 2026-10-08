const request = require('supertest');
const app = require('../src/app');
const { Audit, Visit, Patient } = require('../src/models');
const db = require('./helpers/db');
const f = require('./helpers/factory');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('Audit logging', () => {
  it('records CREATE with action, user, timestamp and affected document', async () => {
    const doc = await f.makeDoctorLogin();
    const res = await request(app).post('/api/patients').set(f.bearer(doc.token)).send(f.patientData());
    const log = await Audit.findOne({ action: 'CREATE', entity: 'Patient' });
    expect(log).not.toBeNull();
    expect(String(log.entityId)).toBe(res.body.data._id);
    expect(String(log.user)).toBe(String(doc.user._id));
    expect(log.userRole).toBe('doctor');
    expect(log.timestamp).toBeInstanceOf(Date);
    expect(log.method).toBe('POST');
    expect(log.path).toBe('/api/patients');
  });

  it('records UPDATE with field NAMES only (never the values)', async () => {
    const doc = await f.makeDoctorLogin();
    const p = await f.makePatient();
    await request(app).patch(`/api/patients/${p._id}`).set(f.bearer(doc.token)).send({ phone: '0300 1112223' });
    const log = await Audit.findOne({ action: 'UPDATE', entity: 'Patient', entityId: p._id });
    expect(log.changedFields).toContain('phone');
    expect(JSON.stringify(log.toObject())).not.toContain('0300 1112223');
  });

  it('records DELETE', async () => {
    const admin = await f.makeUser('admin');
    const p = await f.makePatient();
    await request(app).delete(`/api/patients/${p._id}`).set(f.bearer(admin.token));
    expect(await Audit.countDocuments({ action: 'DELETE', entity: 'Patient', entityId: p._id })).toBe(1);
  });

  it('records visit changes made through save() hooks', async () => {
    const doc = await f.makeDoctorLogin();
    const p = await f.makePatient();
    const v = await request(app)
      .post('/api/visits')
      .set(f.bearer(doc.token))
      .send({ patient: String(p._id), scheduledAt: f.futureSlot().toISOString(), reason: 'Check-up' });
    await request(app).patch(`/api/visits/${v.body.data._id}`).set(f.bearer(doc.token)).send({ diagnosis: 'Fine' });
    expect(await Audit.countDocuments({ entity: 'Visit', action: 'CREATE' })).toBe(1);
    const upd = await Audit.findOne({ entity: 'Visit', action: 'UPDATE' });
    expect(upd.changedFields).toContain('diagnosis');
  });

  it('records LOGIN and LOGIN_FAILED', async () => {
    const { user } = await f.makeUser('admin');
    await request(app).post('/api/auth/login').send({ email: user.email, password: 'Password123' });
    await request(app).post('/api/auth/login').send({ email: user.email, password: 'WrongPass9' });
    expect(await Audit.countDocuments({ action: 'LOGIN' })).toBe(1);
    expect(await Audit.countDocuments({ action: 'LOGIN_FAILED' })).toBe(1);
  });

  it('records READ when someone opens a patient history', async () => {
    const doc = await f.makeDoctorLogin();
    const p = await f.makePatient();
    await request(app).get(`/api/patients/${p._id}/history`).set(f.bearer(doc.token));
    const log = await Audit.findOne({ action: 'READ', entityId: p._id });
    expect(log).not.toBeNull();
    expect(String(log.user)).toBe(String(doc.user._id));
  });

  it('is append-only: updates and deletes through Mongoose are refused', async () => {
    const doc = await f.makeDoctorLogin();
    await request(app).post('/api/patients').set(f.bearer(doc.token)).send(f.patientData());
    await expect(Audit.deleteMany({})).rejects.toThrow(/append-only/);
    await expect(Audit.updateOne({}, { action: 'READ' })).rejects.toThrow(/append-only/);
  });

  it('GET /api/audit-logs is admin only and supports filters + pagination', async () => {
    const admin = await f.makeUser('admin');
    const doc = await f.makeDoctorLogin();
    await request(app).post('/api/patients').set(f.bearer(doc.token)).send(f.patientData());
    await request(app).post('/api/patients').set(f.bearer(doc.token)).send(f.patientData());

    expect((await request(app).get('/api/audit-logs').set(f.bearer(doc.token))).status).toBe(403);

    const all = await request(app).get('/api/audit-logs?entity=Patient&action=CREATE&limit=1').set(f.bearer(admin.token));
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(1);
    expect(all.body.meta.total).toBe(2);
    expect(all.body.data[0].user.email).toBe(doc.user.email);

    const byUser = await request(app).get(`/api/audit-logs?user=${doc.user._id}`).set(f.bearer(admin.token));
    expect(byUser.body.data.length).toBeGreaterThan(0);
    const future = await request(app)
      .get(`/api/audit-logs?from=${new Date(Date.now() + 86400000).toISOString()}`)
      .set(f.bearer(admin.token));
    expect(future.body.data).toHaveLength(0);
    expect((await request(app).get('/api/audit-logs?entity=Hacker').set(f.bearer(admin.token))).status).toBe(400);
  });
});

describe('Privacy-aware patient history', () => {
  let doc;
  let me;
  beforeEach(async () => {
    doc = await f.makeDoctorLogin();
    me = await f.makePatientLogin();
    await Visit.create([
      { patient: me.patient._id, doctor: doc.doctor._id, scheduledAt: new Date('2026-01-10T10:00:00Z'), reason: 'Flu', notes: 'Rest', internalNotes: 'Secret doctor note' },
      { patient: me.patient._id, doctor: doc.doctor._id, scheduledAt: new Date('2026-02-10T10:00:00Z'), reason: 'Follow-up', internalNotes: 'Another secret' },
    ]);
  });

  it('doctors see the FULL history including internal notes', async () => {
    const res = await request(app).get(`/api/patients/${me.patient._id}/history`).set(f.bearer(doc.token));
    expect(res.status).toBe(200);
    expect(res.body.data.view).toBe('full');
    expect(res.body.data.visits).toHaveLength(2);
    expect(res.body.data.visits[0].reason).toBe('Follow-up'); // newest first
    expect(res.body.data.visits[0].internalNotes).toBe('Another secret');
    expect(res.body.data.visits[0].doctor.lastName).toBe('Khan');
  });

  it('patients see their own history WITHOUT internal notes', async () => {
    const res = await request(app).get(`/api/patients/${me.patient._id}/history`).set(f.bearer(me.token));
    expect(res.status).toBe(200);
    expect(res.body.data.view).toBe('patient');
    expect(res.body.data.visits).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect(JSON.stringify(res.body)).not.toContain('Secret');
  });

  it("patients get 403 for someone else's history", async () => {
    const other = await f.makePatientLogin();
    const res = await request(app).get(`/api/patients/${me.patient._id}/history`).set(f.bearer(other.token));
    expect(res.status).toBe(403);
  });

  it('paginates and returns 404 for unknown patients', async () => {
    const res = await request(app).get(`/api/patients/${me.patient._id}/history?limit=1&page=2`).set(f.bearer(doc.token));
    expect(res.body.data.visits).toHaveLength(1);
    expect(res.body.meta.pages).toBe(2);
    expect((await request(app).get('/api/patients/64b7f0f0f0f0f0f0f0f0f0f0/history').set(f.bearer(doc.token))).status).toBe(404);
  });
});

describe('Reports (MongoDB aggregation)', () => {
  let d1;
  let d2;
  let p;
  beforeEach(async () => {
    d1 = await f.makeDoctorLogin({ firstName: 'Ayesha', lastName: 'Khan' });
    d2 = await f.makeDoctorLogin({ firstName: 'Bilal', lastName: 'Ahmed' });
    p = await f.makePatient();
    const mk = (doctor, iso, status = 'scheduled') => ({ patient: p._id, doctor: doctor._id, scheduledAt: new Date(iso), reason: 'Visit', status });
    await Visit.create([
      mk(d1.doctor, '2026-01-05T06:00:00Z', 'completed'),
      mk(d1.doctor, '2026-01-06T06:00:00Z', 'completed'),
      mk(d1.doctor, '2026-01-07T06:00:00Z', 'cancelled'),
      mk(d1.doctor, '2026-02-02T06:00:00Z'),
      mk(d2.doctor, '2026-01-09T06:00:00Z', 'completed'),
      mk(d2.doctor, '2025-12-09T06:00:00Z', 'completed'), // other year - must be excluded
    ]);
  });

  it('returns counts per doctor per month for the year', async () => {
    const admin = await f.makeUser('admin');
    const res = await request(app).get('/api/reports/appointments-by-doctor-month?year=2026').set(f.bearer(admin.token));
    expect(res.status).toBe(200);
    const rows = res.body.data.rows;
    expect(rows).toHaveLength(3);
    const jan1 = rows.find((r) => r.month === '2026-01' && r.doctorName === 'Dr. Ayesha Khan');
    expect(jan1).toMatchObject({ total: 3, completed: 2, cancelled: 1, scheduled: 0 });
    const feb1 = rows.find((r) => r.month === '2026-02');
    expect(feb1).toMatchObject({ total: 1, scheduled: 1 });
    const jan2 = rows.find((r) => r.doctorName === 'Dr. Bilal Ahmed');
    expect(jan2.total).toBe(1);
  });

  it('a doctor only sees their own numbers', async () => {
    const res = await request(app).get('/api/reports/appointments-by-doctor-month?year=2026').set(f.bearer(d2.token));
    expect(res.body.data.rows).toHaveLength(1);
    expect(res.body.data.rows[0].doctorName).toBe('Dr. Bilal Ahmed');
  });

  it('an admin can filter by doctor; the default year is the current year', async () => {
    const admin = await f.makeUser('admin');
    const res = await request(app)
      .get(`/api/reports/appointments-by-doctor-month?year=2026&doctor=${d1.doctor._id}`)
      .set(f.bearer(admin.token));
    expect(res.body.data.rows.every((r) => r.doctorName === 'Dr. Ayesha Khan')).toBe(true);
    const def = await request(app).get('/api/reports/appointments-by-doctor-month').set(f.bearer(admin.token));
    expect(def.body.data.year).toBe(new Date().getFullYear());
  });

  it('patients are blocked (403) and bad years are rejected (400)', async () => {
    const me = await f.makePatientLogin();
    expect((await request(app).get('/api/reports/summary').set(f.bearer(me.token))).status).toBe(403);
    const admin = await f.makeUser('admin');
    expect((await request(app).get('/api/reports/appointments-by-doctor-month?year=abc').set(f.bearer(admin.token))).status).toBe(400);
  });

  it('summary returns dashboard totals', async () => {
    const admin = await f.makeUser('admin');
    const res = await request(app).get('/api/reports/summary').set(f.bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.data.totalVisits).toBe(6);
    expect(res.body.data.byStatus).toEqual({ scheduled: 1, completed: 4, cancelled: 1 });
    expect(res.body.data.patients).toBe(await Patient.countDocuments());
    expect(res.body.data.activeDoctors).toBe(2);
    const own = await request(app).get('/api/reports/summary').set(f.bearer(d2.token));
    expect(own.body.data.totalVisits).toBe(2);
  });

  it('the report query uses the {doctor, scheduledAt} index', async () => {
    const indexes = await Visit.collection.indexes();
    const names = indexes.map((i) => Object.keys(i.key).join(','));
    expect(names).toContain('doctor,scheduledAt,endsAt');
    expect(names).toContain('patient,scheduledAt');
  });
});
