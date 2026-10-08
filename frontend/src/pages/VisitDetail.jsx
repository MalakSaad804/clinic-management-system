import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert, StatusBadge, fmtDateTime } from '../components/ui.jsx';
import PrescriptionThumb from '../components/PrescriptionThumb.jsx';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;

export default function VisitDetail() {
  const { id } = useParams();
  const { user, isStaff } = useAuth();
  const [visit, setVisit] = useState(null);
  const [form, setForm] = useState({ status: 'scheduled', notes: '', diagnosis: '', internalNotes: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const apply = (v) => {
    setVisit(v);
    setForm({ status: v.status, notes: v.notes || '', diagnosis: v.diagnosis || '', internalNotes: v.internalNotes || '' });
  };

  useEffect(() => {
    api.get(`/visits/${id}`).then((r) => apply(r.data.data)).catch((e) => setError(errorMessage(e)));
  }, [id]);

  // Doctors can only edit their own visits; admins can edit all.
  const canEdit = isStaff && visit && (user.role === 'admin' || String(visit.doctor?._id) === String(user.doctor));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      const { data } = await api.patch(`/visits/${id}`, form);
      apply(data.data);
      setOk('Visit saved.');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setOk('');
    // Same rules as the server - checked here first so people get instant feedback.
    if (!ALLOWED.includes(file.type)) return setError('Only JPEG, PNG or WebP images are allowed.');
    if (file.size > MAX_MB * 1024 * 1024) return setError(`File is too large (max ${MAX_MB} MB).`);

    const body = new FormData();
    body.append('prescription', file);
    setUploading(true);
    try {
      const { data } = await api.post(`/visits/${id}/prescriptions`, body);
      apply(data.data);
      setOk('Prescription uploaded.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeRx = async (rx) => {
    if (!window.confirm('Remove this prescription?')) return;
    try {
      await api.delete(rx.url.replace(/^\/api/, ''));
      const { data } = await api.get(`/visits/${id}`);
      apply(data.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!visit) return error ? <Alert>{error}</Alert> : <p className="muted">Loading…</p>;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <p><Link to="/calendar">← Back to calendar</Link></p>
      <div className="row between">
        <h2>Visit: {visit.reason}</h2>
        <StatusBadge status={visit.status} />
      </div>
      <Alert>{error}</Alert>
      <Alert kind="success">{ok}</Alert>

      <div className="card info-grid">
        <div><span className="muted">When</span><br />{fmtDateTime(visit.scheduledAt)}</div>
        <div><span className="muted">Duration</span><br />{visit.durationMinutes} min</div>
        <div><span className="muted">Patient</span><br />
          {isStaff ? <Link to={`/patients/${visit.patient?._id}/history`}>{visit.patient?.firstName} {visit.patient?.lastName}</Link> : 'You'}
        </div>
        <div><span className="muted">Doctor</span><br />Dr. {visit.doctor?.firstName} {visit.doctor?.lastName}</div>
      </div>

      <div className="card">
        <h3>Visit notes</h3>
        {canEdit ? (
          <form className="form" onSubmit={save}>
            <label>Status
              <select value={form.status} onChange={set('status')}>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label>Notes (visible to the patient)<textarea rows="4" value={form.notes} onChange={set('notes')} /></label>
            <label>Diagnosis<input value={form.diagnosis} onChange={set('diagnosis')} /></label>
            <label>Private clinician notes (never shown to the patient)
              <textarea rows="3" value={form.internalNotes} onChange={set('internalNotes')} />
            </label>
            <button className="btn">Save notes</button>
          </form>
        ) : (
          <>
            <p><b>Notes:</b> {visit.notes || '—'}</p>
            <p><b>Diagnosis:</b> {visit.diagnosis || '—'}</p>
            {isStaff && <p><b>Private notes:</b> {visit.internalNotes || '—'}</p>}
          </>
        )}
      </div>

      <div className="card">
        <h3>Prescriptions</h3>
        {canEdit && (
          <div className="upload">
            <input ref={fileRef} type="file" accept={ALLOWED.join(',')} onChange={upload} disabled={uploading} />
            <span className="muted small-text">{uploading ? 'Uploading…' : `JPEG, PNG or WebP, up to ${MAX_MB} MB`}</span>
          </div>
        )}
        {visit.prescriptions.length === 0 && <p className="muted">No prescriptions uploaded.</p>}
        <div className="thumbs">
          {visit.prescriptions.map((rx) => (
            <PrescriptionThumb key={rx.filename} rx={rx} canDelete={canEdit} onDelete={removeRx} />
          ))}
        </div>
      </div>
    </>
  );
}
