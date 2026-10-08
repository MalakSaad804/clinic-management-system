// Fills the database with demo data:  npm run seed
const mongoose = require('mongoose');
const env = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const { User, Doctor, Patient, Visit } = require('../src/models');
const { clinicParts, clinicTimeToDate } = require('../src/utils/time');

const PASSWORD = 'Password123';

function nextWorkingSlot(daysAhead, hour) {
  const d = new Date(Date.now() + daysAhead * 86400000);
  let p = clinicParts(d);
  while (p.weekday === 0 || p.weekday === 6) {
    d.setTime(d.getTime() + 86400000);
    p = clinicParts(d);
  }
  return clinicTimeToDate(p.year, p.month, p.day, hour, 0);
}

(async () => {
  await connectDB();
  await Promise.all(
    [User, Doctor, Patient, Visit].map((M) => M.collection.deleteMany({})) // native call, skips hooks
  );
  await mongoose.connection.collection('audits').deleteMany({});

  const [d1, d2] = await Doctor.create([
    { firstName: 'Ayesha', lastName: 'Khan', email: 'ayesha.khan@brewbean.test', specialization: 'General Physician', licenseNumber: 'PMC-1001', phone: '0300 1112233' },
    { firstName: 'Bilal', lastName: 'Ahmed', email: 'bilal.ahmed@brewbean.test', specialization: 'Cardiologist', licenseNumber: 'PMC-1002', phone: '0300 4445566' },
  ]);
  const [p1, p2, p3] = await Patient.create([
    { firstName: 'Sara', lastName: 'Ali', email: 'sara.ali@example.com', phone: '0311 1234567', dateOfBirth: '1996-04-12', gender: 'female', bloodGroup: 'O+' },
    { firstName: 'Usman', lastName: 'Tariq', email: 'usman.tariq@example.com', phone: '0322 7654321', dateOfBirth: '1988-09-30', gender: 'male', bloodGroup: 'A+', allergies: ['Penicillin'] },
    { firstName: 'Hina', lastName: 'Shah', email: 'hina.shah@example.com', phone: '0333 9876543', dateOfBirth: '2001-01-20', gender: 'female' },
  ]);

  await User.create([
    { name: 'Clinic Admin', email: 'admin@brewbean.test', password: PASSWORD, role: 'admin' },
    { name: 'Dr. Ayesha Khan', email: d1.email, password: PASSWORD, role: 'doctor', doctor: d1._id },
    { name: 'Dr. Bilal Ahmed', email: d2.email, password: PASSWORD, role: 'doctor', doctor: d2._id },
    { name: 'Sara Ali', email: p1.email, password: PASSWORD, role: 'patient', patient: p1._id },
    { name: 'Usman Tariq', email: p2.email, password: PASSWORD, role: 'patient', patient: p2._id },
  ]);

  await Visit.create([
    { patient: p1._id, doctor: d1._id, scheduledAt: nextWorkingSlot(1, 10), reason: 'Seasonal flu symptoms', notes: 'Advised rest and fluids.', internalNotes: 'Watch for repeat visits.' },
    { patient: p2._id, doctor: d2._id, scheduledAt: nextWorkingSlot(2, 11), reason: 'Chest discomfort follow-up' },
    { patient: p3._id, doctor: d1._id, scheduledAt: nextWorkingSlot(3, 14), reason: 'General check-up' },
  ]);

  console.log('Seed complete. Login with any of these (password: %s):', PASSWORD);
  console.log('  admin  -> admin@brewbean.test');
  console.log('  doctor -> %s', d1.email);
  console.log('  patient-> %s', p1.email);
  await mongoose.disconnect();
  console.log('(MongoDB: %s)', env.mongoUri.replace(/\/\/.*@/, '//***@'));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
