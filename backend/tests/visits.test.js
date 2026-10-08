const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const app = require('../src/app');
const { Visit } = require('../src/models');
const { uploadRoot } = require('../src/middleware/upload');
const db = require('./helpers/db');
const f = require('./helpers/factory');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

let doc; // doctor login
let pat; // patient login
const book = (token, o = {}) =>
  request(app)
    .post('/api/visits')
    .set(f.bearer(token))
    .send({ patient: String(pat.patient._id), scheduledAt: f.futureSlot().toISOString(), reason: 'Check-up', ...o });

beforeEach(async () => {
  doc = await f.makeDoctorLogin();
  pat = await f.makePatientLogin();
});

describe('Scheduling', () => {
  it('a doctor schedules a visit for themselves (201)', async () => {
    const res = await book(doc.token);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('scheduled');
    expect(res.body.data.durationMinutes).toBe(30);
    expect(res.body.data.doctor.lastName).toBe('Khan');
  });

  it('an admin must say which doctor', async () => {
    const admin = await f.makeUser('admin');
    expect((await book(admin.token)).status).toBe(400);
    expect((await book(admin.token, { doctor: String(doc.doctor._id) })).status).toBe(201);
  });

  it('a doctor cannot schedule for another doctor (403)', async () => {
    const other = await f.makeDoctor();
    const res = await book(doc.token, { doctor: String(other._id) });
    expect(res.status).toBe(403);
  });

  it('a patient cannot schedule (403)', async () => {
    const res = await book(pat.token, { doctor: String(doc.doctor._id) });
    expect(res.status).toBe(403);
  });

  it('rejects a time in the past (400)', async () => {
    const res = await book(doc.token, { scheduledAt: new Date(Date.now() - 3600000).toISOString() });
    expect(res.status).toBe(400);
  });

  it('rejects a time outside working hours (400)', async () => {
    const res = await book(doc.token, { scheduledAt: f.futureSlot({ hour: 3 }).toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/working/);
  });

  it('rejects a non-working day (400)', async () => {
    const res = await book(doc.token, { scheduledAt: f.futureSunday().toISOString() });
    expect(res.status).toBe(400);
  });

  it('rejects overlapping visits for the same doctor (409)', async () => {
    expect((await book(doc.token)).status).toBe(201);
    const clash = await book(doc.token, { scheduledAt: f.futureSlot({ hour: 10, minute: 15 }).toISOString() });
    expect(clash.status).toBe(409);
  });

  it('allows back-to-back visits', async () => {
    expect((await book(doc.token)).status).toBe(201);
    expect((await book(doc.token, { scheduledAt: f.futureSlot({ hour: 10, minute: 30 }).toISOString() })).status).toBe(201);
  });

  it('a cancelled visit frees the slot', async () => {
    const first = await book(doc.token);
    await request(app).patch(`/api/visits/${first.body.data._id}`).set(f.bearer(doc.token)).send({ status: 'cancelled' });
    expect((await book(doc.token)).status).toBe(201);
  });

  it('validates input: unknown patient (404), bad ids and fields (400)', async () => {
    expect((await book(doc.token, { patient: '64b7f0f0f0f0f0f0f0f0f0f0' })).status).toBe(404);
    expect((await book(doc.token, { patient: 'abc' })).status).toBe(400);
    expect((await book(doc.token, { reason: '' })).status).toBe(400);
    expect((await book(doc.token, { durationMinutes: 5 })).status).toBe(400);
  });
});

describe('Reading and updating visits', () => {
  let visitId;
  beforeEach(async () => {
    const res = await book(doc.token, { notes: 'Visible note' });
    visitId = res.body.data._id;
    await request(app).patch(`/api/visits/${visitId}`).set(f.bearer(doc.token)).send({ internalNotes: 'Doctor only' });
  });

  it('staff see internalNotes, patients do not', async () => {
    const staff = await request(app).get(`/api/visits/${visitId}`).set(f.bearer(doc.token));
    expect(staff.body.data.internalNotes).toBe('Doctor only');
    const mine = await request(app).get(`/api/visits/${visitId}`).set(f.bearer(pat.token));
    expect(mine.status).toBe(200);
    expect(mine.body.data.internalNotes).toBeUndefined();
    expect(mine.body.data.notes).toBe('Visible note');
  });

  it("a patient cannot open someone else's visit (403)", async () => {
    const stranger = await f.makePatientLogin();
    const res = await request(app).get(`/api/visits/${visitId}`).set(f.bearer(stranger.token));
    expect(res.status).toBe(403);
  });

  it('the list is forced to the patient\'s own visits even if they ask for others', async () => {
    const stranger = await f.makePatientLogin();
    await Visit.create({ patient: stranger.patient._id, doctor: doc.doctor._id, scheduledAt: f.futureSlot({ hour: 12 }), reason: 'Other' });
    const res = await request(app).get(`/api/visits?patient=${stranger.patient._id}`).set(f.bearer(pat.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].internalNotes).toBeUndefined();
  });

  it('staff can filter by doctor, status and date range', async () => {
    const day = f.futureSlot();
    const from = new Date(day.getTime() - 86400000).toISOString();
    const to = new Date(day.getTime() + 86400000).toISOString();
    const res = await request(app)
      .get(`/api/visits?doctor=${doc.doctor._id}&status=scheduled&from=${from}&to=${to}`)
      .set(f.bearer(doc.token));
    expect(res.body.data).toHaveLength(1);
    const none = await request(app).get('/api/visits?status=completed').set(f.bearer(doc.token));
    expect(none.body.data).toHaveLength(0);
  });

  it('completes a visit with diagnosis (200)', async () => {
    const res = await request(app)
      .patch(`/api/visits/${visitId}`)
      .set(f.bearer(doc.token))
      .send({ status: 'completed', diagnosis: 'Viral flu', notes: 'Rest and fluids' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.diagnosis).toBe('Viral flu');
  });

  it('reschedules a visit, and refuses a clashing new time (409)', async () => {
    const second = await book(doc.token, { scheduledAt: f.futureSlot({ hour: 14 }).toISOString() });
    const ok = await request(app)
      .patch(`/api/visits/${second.body.data._id}`)
      .set(f.bearer(doc.token))
      .send({ scheduledAt: f.futureSlot({ hour: 15 }).toISOString() });
    expect(ok.status).toBe(200);
    const clash = await request(app)
      .patch(`/api/visits/${second.body.data._id}`)
      .set(f.bearer(doc.token))
      .send({ scheduledAt: f.futureSlot({ hour: 10 }).toISOString() });
    expect(clash.status).toBe(409);
  });

  it("a doctor cannot change another doctor's visit (403); patients cannot edit at all", async () => {
    const other = await f.makeDoctorLogin();
    expect((await request(app).patch(`/api/visits/${visitId}`).set(f.bearer(other.token)).send({ notes: 'hack' })).status).toBe(403);
    expect((await request(app).patch(`/api/visits/${visitId}`).set(f.bearer(pat.token)).send({ notes: 'hack' })).status).toBe(403);
  });

  it('404 for a missing visit; delete is admin-only', async () => {
    const admin = await f.makeUser('admin');
    expect((await request(app).get('/api/visits/64b7f0f0f0f0f0f0f0f0f0f0').set(f.bearer(doc.token))).status).toBe(404);
    expect((await request(app).delete(`/api/visits/${visitId}`).set(f.bearer(doc.token))).status).toBe(403);
    expect((await request(app).delete(`/api/visits/${visitId}`).set(f.bearer(admin.token))).status).toBe(200);
    expect((await request(app).delete(`/api/visits/${visitId}`).set(f.bearer(admin.token))).status).toBe(404);
  });
});

describe('GET /api/visits/slots', () => {
  const day = () => {
    const d = f.futureSlot({ hour: 12 });
    return new Date(d.getTime() + 5 * 3600000).toISOString().slice(0, 10); // clinic-local YYYY-MM-DD
  };

  it('lists the day\'s slots and marks booked ones unavailable', async () => {
    await book(doc.token); // 10:00-10:30
    const res = await request(app).get(`/api/visits/slots?doctorId=${doc.doctor._id}&date=${day()}`).set(f.bearer(doc.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(16); // 09:00-17:00 in 30 min steps
    const booked = res.body.data.filter((s) => !s.available);
    expect(booked).toHaveLength(1);
    expect(new Date(booked[0].start).getTime()).toBe(f.futureSlot().getTime());
  });

  it('supports a date range and rejects ranges over 14 days', async () => {
    const d = day();
    const week = await request(app).get(`/api/visits/slots?doctorId=${doc.doctor._id}&from=${d}&to=${d}`).set(f.bearer(doc.token));
    expect(week.status).toBe(200);
    const huge = await request(app).get(`/api/visits/slots?doctorId=${doc.doctor._id}&from=2030-01-01&to=2030-03-01`).set(f.bearer(doc.token));
    expect(huge.status).toBe(400);
  });

  it('returns nothing on a non-working day, 404 for unknown doctor, 400 without dates', async () => {
    const sunday = f.futureSunday().toISOString().slice(0, 10);
    const res = await request(app).get(`/api/visits/slots?doctorId=${doc.doctor._id}&date=${sunday}`).set(f.bearer(doc.token));
    expect(res.body.data).toHaveLength(0);
    expect((await request(app).get(`/api/visits/slots?doctorId=64b7f0f0f0f0f0f0f0f0f0f0&date=${sunday}`).set(f.bearer(doc.token))).status).toBe(404);
    expect((await request(app).get(`/api/visits/slots?doctorId=${doc.doctor._id}`).set(f.bearer(doc.token))).status).toBe(400);
  });
});

describe('Prescription uploads', () => {
  let visitId;
  beforeEach(async () => {
    visitId = (await book(doc.token)).body.data._id;
  });

  const upload = (token, buf = f.PNG, opts = { filename: 'rx.png', contentType: 'image/png' }) =>
    request(app).post(`/api/visits/${visitId}/prescriptions`).set(f.bearer(token)).attach('prescription', buf, opts);

  it('accepts a PNG, stores it, and returns a URL', async () => {
    const res = await upload(doc.token);
    expect(res.status).toBe(201);
    const [rx] = res.body.data.prescriptions;
    expect(rx.url).toBe(`/api/visits/${visitId}/prescriptions/${rx.filename}`);
    expect(rx.filename).toMatch(/\.png$/);
    expect(fs.existsSync(path.join(uploadRoot, rx.filename))).toBe(true);
  });

  it('rejects non-image types (415) and files with fake content (415)', async () => {
    const pdf = await upload(doc.token, Buffer.from('%PDF-1.4'), { filename: 'rx.pdf', contentType: 'application/pdf' });
    expect(pdf.status).toBe(415);
    const fake = await upload(doc.token, Buffer.from('this is not really an image at all'));
    expect(fake.status).toBe(415);
  });

  it('rejects files bigger than the limit (413)', async () => {
    const big = Buffer.concat([f.PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await upload(doc.token, big);
    expect(res.status).toBe(413);
  });

  it('returns 400 when no file is attached', async () => {
    const res = await request(app).post(`/api/visits/${visitId}/prescriptions`).set(f.bearer(doc.token));
    expect(res.status).toBe(400);
  });

  it('patients cannot upload (403) and other doctors cannot upload to this visit (403)', async () => {
    expect((await upload(pat.token)).status).toBe(403);
    const other = await f.makeDoctorLogin();
    const res = await upload(other.token);
    expect(res.status).toBe(403);
  });

  it('removes the file from disk when the visit does not exist', async () => {
    const before = fs.readdirSync(uploadRoot).length;
    const res = await request(app)
      .post('/api/visits/64b7f0f0f0f0f0f0f0f0f0f0/prescriptions')
      .set(f.bearer(doc.token))
      .attach('prescription', f.PNG, { filename: 'rx.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
    expect(fs.readdirSync(uploadRoot).length).toBe(before);
  });

  it('the patient can download their own prescription; strangers cannot', async () => {
    const up = await upload(doc.token);
    const { url } = up.body.data.prescriptions[0];
    const mine = await request(app).get(url).set(f.bearer(pat.token));
    expect(mine.status).toBe(200);
    expect(mine.headers['content-type']).toMatch(/image\/png/);
    const stranger = await f.makePatientLogin();
    expect((await request(app).get(url).set(f.bearer(stranger.token))).status).toBe(403);
    expect((await request(app).get(url)).status).toBe(401);
  });

  it('404 for unknown prescription files; 400 for path tricks', async () => {
    expect((await request(app).get(`/api/visits/${visitId}/prescriptions/abc.png`).set(f.bearer(doc.token))).status).toBe(404);
    expect((await request(app).get(`/api/visits/${visitId}/prescriptions/..%2F..%2Fsecret.png`).set(f.bearer(doc.token))).status).toBe(400);
  });

  it('a doctor can delete a prescription (file removed too)', async () => {
    const up = await upload(doc.token);
    const { filename, url } = up.body.data.prescriptions[0];
    const del = await request(app).delete(url).set(f.bearer(doc.token));
    expect(del.status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));
    expect(fs.existsSync(path.join(uploadRoot, filename))).toBe(false);
    expect((await request(app).delete(url).set(f.bearer(doc.token))).status).toBe(404);
  });

  it('deleting a visit removes its files', async () => {
    const admin = await f.makeUser('admin');
    const up = await upload(doc.token);
    const { filename } = up.body.data.prescriptions[0];
    await request(app).delete(`/api/visits/${visitId}`).set(f.bearer(admin.token));
    await new Promise((r) => setTimeout(r, 100));
    expect(fs.existsSync(path.join(uploadRoot, filename))).toBe(false);
  });
});
