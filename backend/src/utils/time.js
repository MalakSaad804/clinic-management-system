const env = require('../config/env');

const MIN = 60 * 1000;

// Convert a clinic-local wall clock time to a real Date (UTC based).
function clinicTimeToDate(year, month, day, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - env.clinicTzOffsetMinutes * MIN);
}

// Break a Date into clinic-local parts.
function clinicParts(date) {
  const shifted = new Date(date.getTime() + env.clinicTzOffsetMinutes * MIN);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(), // 0 = Sunday
  };
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// "+05:00" style string used by MongoDB aggregation $dateToString.
function tzString() {
  const off = env.clinicTzOffsetMinutes;
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

// Is [start, start+duration] inside the doctor's working day and hours?
function isWithinWorkingHours(doctor, start, durationMinutes) {
  const p = clinicParts(start);
  if (!doctor.workingDays.includes(p.weekday)) return false;
  const startMin = p.hour * 60 + p.minute;
  return (
    startMin >= toMinutes(doctor.workingHours.start) &&
    startMin + durationMinutes <= toMinutes(doctor.workingHours.end)
  );
}

module.exports = { clinicTimeToDate, clinicParts, toMinutes, tzString, isWithinWorkingHours, MIN };
