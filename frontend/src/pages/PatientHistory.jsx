import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import api from '../api.js';
import { Alert, Pager, StatusBadge, fmtDate, fmtDateTime, useLoad } from '../components/ui.jsx';

export default function PatientHistory() {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const { data, error, loading } = useLoad(
    () => api.get(`/patients/${id}/history`, { params: { page, limit: 10 } }).then((r) => r.data),
    [id, page]
  );

  if (error) return <Alert>{error}</Alert>;
  if (loading || !data) return <p className="muted">Loading…</p>;
  const { patient, visits, view } = data.data;

  return (
    <>
      <div className="row between">
        <h2>{patient.fullName}</h2>
        <span className={`pill ${view === 'full' ? 'completed' : 'scheduled'}`}>
          {view === 'full' ? 'Full clinical view' : 'Patient view'}
        </span>
      </div>
      <div className="card info-grid">
        <div><span className="muted">Email</span><br />{patient.email}</div>
        <div><span className="muted">Phone</span><br />{patient.phone}</div>
        <div><span className="muted">Age</span><br />{patient.age} ({fmtDate(patient.dateOfBirth)})</div>
        <div><span className="muted">Blood group</span><br />{patient.bloodGroup || '—'}</div>
        <div><span className="muted">Allergies</span><br />{patient.allergies?.length ? patient.allergies.join(', ') : '—'}</div>
      </div>

      <div className="card">
        <h3>Visit history</h3>
        {view === 'patient' && <p className="muted small-text">Private clinician notes are never shown in the patient view.</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Doctor</th><th>Reason</th><th>Diagnosis</th><th>Status</th>{view === 'full' && <th>Internal notes</th>}<th /></tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v._id}>
                  <td>{fmtDateTime(v.scheduledAt)}</td>
                  <td>Dr. {v.doctor?.lastName}</td>
                  <td>{v.reason}</td>
                  <td>{v.diagnosis || '—'}</td>
                  <td><StatusBadge status={v.status} /></td>
                  {view === 'full' && <td>{v.internalNotes || '—'}</td>}
                  <td><Link to={`/visits/${v._id}`}>Open</Link></td>
                </tr>
              ))}
              {visits.length === 0 && <tr><td colSpan="7" className="muted">No visits yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager meta={data.meta} onPage={setPage} />
      </div>
    </>
  );
}
