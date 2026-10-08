import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert, Modal, Pager, fmtDate } from '../components/ui.jsx';

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', gender: 'female', bloodGroup: '' };

export default function Patients() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/patients', { params: { q: q || undefined, page, limit: 10 } });
      setRows(data.data);
      setMeta(data.meta);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [q, page]);

  useEffect(() => {
    const t = setTimeout(load, 250); // small delay while typing in the search box
    return () => clearTimeout(t);
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const body = { ...form };
      if (!body.bloodGroup) delete body.bloodGroup;
      await api.post('/patients', body);
      setAdding(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete ${p.fullName}?`)) return;
    try {
      await api.delete(`/patients/${p._id}`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div className="row between">
        <h2>Patients</h2>
        <button className="btn" onClick={() => setAdding(true)}>+ New patient</button>
      </div>
      <input className="search" placeholder="Search name, email or phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      <Alert>{error}</Alert>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Age</th><th>DOB</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p._id}>
                <td>{p.fullName}</td><td>{p.email}</td><td>{p.phone}</td><td>{p.age}</td><td>{fmtDate(p.dateOfBirth)}</td>
                <td className="actions">
                  <Link className="btn small ghost" to={`/patients/${p._id}/history`}>History</Link>
                  {user.role === 'admin' && <button className="btn small danger" onClick={() => remove(p)}>Delete</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="6" className="muted">No patients found.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager meta={meta} onPage={setPage} />

      {adding && (
        <Modal title="New patient" onClose={() => setAdding(false)}>
          <form onSubmit={save} className="form">
            <Alert>{formError}</Alert>
            <div className="grid2">
              <label>First name<input required value={form.firstName} onChange={set('firstName')} /></label>
              <label>Last name<input required value={form.lastName} onChange={set('lastName')} /></label>
            </div>
            <label>Email<input type="email" required value={form.email} onChange={set('email')} /></label>
            <div className="grid2">
              <label>Phone<input required value={form.phone} onChange={set('phone')} /></label>
              <label>Date of birth<input type="date" required value={form.dateOfBirth} onChange={set('dateOfBirth')} /></label>
            </div>
            <div className="grid2">
              <label>Gender
                <select value={form.gender} onChange={set('gender')}>
                  <option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
                </select>
              </label>
              <label>Blood group
                <select value={form.bloodGroup} onChange={set('bloodGroup')}>
                  <option value="">—</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}
                </select>
              </label>
            </div>
            <button className="btn">Save patient</button>
          </form>
        </Modal>
      )}
    </>
  );
}
