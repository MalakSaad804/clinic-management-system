import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import api, { errorMessage } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert, Modal } from './ui.jsx';

// <input type="datetime-local"> wants "yyyy-MM-ddTHH:mm" in local time
const toInput = (d) => format(d, "yyyy-MM-dd'T'HH:mm");

export default function BookingModal({ start, doctors, defaultDoctorId, onClose, onSaved }) {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    patient: '',
    doctor: defaultDoctorId || doctors[0]?._id || '',
    scheduledAt: toInput(start),
    durationMinutes: 30,
    reason: '',
  });

  useEffect(() => {
    api.get('/patients', { params: { limit: 100 } }).then((r) => setPatients(r.data.data)).catch((e) => setError(errorMessage(e)));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = {
        patient: form.patient,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        reason: form.reason,
      };
      if (user.role === 'admin') body.doctor = form.doctor;
      await api.post('/visits', body);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Schedule a visit" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Alert>{error}</Alert>
        <label>Patient
          <select required value={form.patient} onChange={set('patient')}>
            <option value="">Select patient…</option>
            {patients.map((p) => <option key={p._id} value={p._id}>{p.fullName} — {p.phone}</option>)}
          </select>
        </label>
        {user.role === 'admin' && (
          <label>Doctor
            <select required value={form.doctor} onChange={set('doctor')}>
              {doctors.map((d) => <option key={d._id} value={d._id}>{d.fullName} — {d.specialization}</option>)}
            </select>
          </label>
        )}
        <div className="grid2">
          <label>Date &amp; time<input type="datetime-local" required value={form.scheduledAt} onChange={set('scheduledAt')} /></label>
          <label>Duration (min)<input type="number" min="10" max="240" step="5" required value={form.durationMinutes} onChange={set('durationMinutes')} /></label>
        </div>
        <label>Reason for visit<input required minLength={3} maxLength={300} value={form.reason} onChange={set('reason')} /></label>
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Schedule visit'}</button>
      </form>
    </Modal>
  );
}
