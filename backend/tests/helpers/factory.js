const jwt = require('jsonwebtoken');
const env = require('../../src/config/env');
const { User, Doctor, Patient } = require('../../src/models');
const { clinicParts, clinicTimeToDate } = require('../../src/utils/time');

let counter = 0;
const uid = () => {
  counter += 1;
  return `${Date.now()}${counter}`;
};

const tokenFor = (user) => jwt.sign({ sub: user.id, role: user.role, type: 'access' }, env.jwtSecret, { expiresIn: '15m' });

const doctorData = (o = {}) => ({
  firstName: 'Ayesha',
  lastName: 'Khan',
  email: `doc${uid()}@test.com`,
  specialization: 'General Physician',
  licenseNumber: `LIC-${uid()}`,
  ...o,
});

const patientData = (o = {}) => ({
  firstName: 'Sara',
  lastName: 'Ali',
  email: `pat${uid()}@test.com`,
  phone: '0311 1234567',
  dateOfBirth: '1996-04-12',
  gender: 'female',
  ...o,
});

const makeDoctor = (o) => Doctor.create(doctorData(o));
const makePatient = (o) => Patient.create(patientData(o));

async function makeUser(role, { doctor, patient, ...o } = {}) {
  const user = await User.create({
    name: `${role} user`,
    email: `${role}${uid()}@test.com`,
    password: 'Password123',
    role,
    ...(doctor && { doctor: doctor._id }),
    ...(patient && { patient: patient._id }),
    ...o,
  });
  return { user, token: tokenFor(user) };
}

// Convenience: a doctor profile + its login
async function makeDoctorLogin(o) {
  const doctor = await makeDoctor(o);
  const login = await makeUser('doctor', { doctor });
  return { doctor, ...login };
}

async function makePatientLogin(o) {
  const patient = await makePatient(o);
  const login = await makeUser('patient', { patient });
  return { patient, ...login };
}

// A future time on a Mon-Fri (clinic local time) so it passes the "working hours" rule.
function futureSlot({ hour = 10, minute = 0, daysAhead = 3 } = {}) {
  let d = new Date(Date.now() + daysAhead * 86400000);
  let p = clinicParts(d);
  while (p.weekday === 0 || p.weekday === 6) {
    d = new Date(d.getTime() + 86400000);
    p = clinicParts(d);
  }
  return clinicTimeToDate(p.year, p.month, p.day, hour, minute);
}

function futureSunday() {
  let d = new Date(Date.now() + 3 * 86400000);
  let p = clinicParts(d);
  while (p.weekday !== 0) {
    d = new Date(d.getTime() + 86400000);
    p = clinicParts(d);
  }
  return clinicTimeToDate(p.year, p.month, p.day, 10, 0);
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

module.exports = {
  doctorData,
  patientData,
  makeDoctor,
  makePatient,
  makeUser,
  makeDoctorLogin,
  makePatientLogin,
  futureSlot,
  futureSunday,
  tokenFor,
  bearer,
  PNG,
};
