import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert, Modal } from '../components/ui.jsx';

const EMPTY = { firstName: '', lastName: '', email: '', specialization: '', licenseNumber: '', phone: '' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Doctors() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/doctors', { params: { limit: 100 } });
      setRows(data.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const body = { ...form };
      if (!body.phone) delete body.phone;
      await api.post('/doctors', body);
      setAdding(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete ${d.fullName}?`)) return;
    try {
      await api.delete(`/doctors/${d._id}`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div className="row between">
        <h2>Doctors</h2>
        {user.role === 'admin' && <button className="btn" onClick={() => setAdding(true)}>+ New doctor</button>}
      </div>
      <Alert>{error}</Alert>
      <div className="cards">
        {rows.map((d) => (
          <div className="card" key={d._id}>
            <h3>{d.fullName}</h3>
            <p className="muted">{d.specialization}</p>
            <p className="small-text">
              {d.workingDays.map((n) => DAYS[n]).join(', ')} · {d.workingHours.start}–{d.workingHours.end} · {d.slotMinutes} min slots
            </p>
            <p className="small-text">{d.email}</p>
            {user.role === 'admin' && <button className="btn small danger" onClick={() => remove(d)}>Delete</button>}
          </div>
        ))}
      </div>

      {adding && (
        <Modal title="New doctor" onClose={() => setAdding(false)}>
          <form onSubmit={save} className="form">
            <Alert>{formError}</Alert>
            <div className="grid2">
              <label>First name<input required value={form.firstName} onChange={set('firstName')} /></label>
              <label>Last name<input required value={form.lastName} onChange={set('lastName')} /></label>
            </div>
            <label>Email<input type="email" required value={form.email} onChange={set('email')} /></label>
            <div className="grid2">
              <label>Specialization<input required value={form.specialization} onChange={set('specialization')} /></label>
              <label>License number<input required value={form.licenseNumber} onChange={set('licenseNumber')} /></label>
            </div>
            <label>Phone<input value={form.phone} onChange={set('phone')} /></label>
            <p className="muted small-text">Default schedule: Mon–Fri, 09:00–17:00, 30 minute slots.</p>
            <button className="btn">Save doctor</button>
          </form>
        </Modal>
      )}
    </>
  );
}
