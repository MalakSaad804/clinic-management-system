import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert, StatusBadge, fmtDateTime, useLoad } from '../components/ui.jsx';

function StaffDashboard() {
  const [year, setYear] = useState(new Date().getFullYear());
  const summary = useLoad(() => api.get('/reports/summary').then((r) => r.data.data), []);
  const report = useLoad(
    () => api.get('/reports/appointments-by-doctor-month', { params: { year } }).then((r) => r.data.data),
    [year]
  );
  const s = summary.data;

  return (
    <>
      <h2>Dashboard</h2>
      <Alert>{summary.error}</Alert>
      {s && (
        <div className="cards">
          <div className="card stat"><b>{s.upcomingVisits}</b><span>Upcoming visits</span></div>
          <div className="card stat"><b>{s.byStatus.completed}</b><span>Completed</span></div>
          <div className="card stat"><b>{s.byStatus.cancelled}</b><span>Cancelled</span></div>
          <div className="card stat"><b>{s.patients}</b><span>Patients</span></div>
          <div className="card stat"><b>{s.activeDoctors}</b><span>Active doctors</span></div>
        </div>
      )}

      <div className="card">
        <div className="row between">
          <h3>Appointments per doctor per month</h3>
          <label className="inline">Year
            <input type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} />
          </label>
        </div>
        <Alert>{report.error}</Alert>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Month</th><th>Doctor</th><th>Total</th><th>Scheduled</th><th>Completed</th><th>Cancelled</th></tr>
            </thead>
            <tbody>
              {(report.data?.rows || []).map((r) => (
                <tr key={r.doctorId + r.month}>
                  <td>{r.month}</td><td>{r.doctorName}</td><td><b>{r.total}</b></td>
                  <td>{r.scheduled}</td><td>{r.completed}</td><td>{r.cancelled}</td>
                </tr>
              ))}
              {report.data && report.data.rows.length === 0 && (
                <tr><td colSpan="6" className="muted">No visits in {year}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function PatientDashboard({ user }) {
  const upcoming = useLoad(() => api.get('/visits', { params: { status: 'scheduled' } }).then((r) => r.data.data), []);
  return (
    <>
      <h2>Welcome, {user.name}</h2>
      <div className="card">
        <h3>My upcoming visits</h3>
        <Alert>{upcoming.error}</Alert>
        {upcoming.data?.length === 0 && <p className="muted">No upcoming visits.</p>}
        <ul className="list">
          {(upcoming.data || []).map((v) => (
            <li key={v._id}>
              <Link to={`/visits/${v._id}`}>{fmtDateTime(v.scheduledAt)}</Link> — Dr. {v.doctor?.lastName} — {v.reason}{' '}
              <StatusBadge status={v.status} />
            </li>
          ))}
        </ul>
        <p><Link to={`/patients/${user.patient}/history`}>See my full visit history →</Link></p>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user, isStaff } = useAuth();
  return isStaff ? <StaffDashboard /> : <PatientDashboard user={user} />;
}
