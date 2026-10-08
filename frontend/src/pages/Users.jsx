import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api.js';
import { Alert, Modal } from '../components/ui.jsx';

const EMPTY = { name: '', email: '', password: '', role: 'doctor', doctorId: '', patientId: '' };

export default function Users() {
  const [rows, setRows] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      const [u, d, p] = await Promise.all([
        api.get('/users', { params: { limit: 100 } }),
        api.get('/doctors', { params: { limit: 100 } }),
        api.get('/patients', { params: { limit: 100 } }),
      ]);
      setRows(u.data.data);
      setDoctors(d.data.data);
      setPatients(p.data.data);
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
    const body = { name: form.name, email: form.email, password: form.password, role: form.role };
    if (form.role === 'doctor') body.doctorId = form.doctorId;
    if (form.role === 'patient') body.patientId = form.patientId;
    try {
      await api.post('/users', body);
      setAdding(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const toggle = async (u) => {
    try {
      await api.patch(`/users/${u._id}`, { isActive: !u.isActive });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div className="row between">
        <h2>User accounts</h2>
        <button className="btn" onClick={() => setAdding(true)}>+ New account</button>
      </div>
      <Alert>{error}</Alert>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th /></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td><td>{u.email}</td><td><span className="badge">{u.role}</span></td>
                <td>{u.isActive ? 'Yes' : 'No'}</td>
                <td><button className="btn small ghost" onClick={() => toggle(u)}>{u.isActive ? 'Disable' : 'Enable'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <Modal title="New account" onClose={() => setAdding(false)}>
          <form onSubmit={save} className="form">
            <Alert>{formError}</Alert>
            <label>Name<input required value={form.name} onChange={set('name')} /></label>
            <label>Email<input type="email" required value={form.email} onChange={set('email')} /></label>
            <label>Password<input type="password" required minLength={8} value={form.password} onChange={set('password')} /></label>
            <label>Role
              <select value={form.role} onChange={set('role')}>
                <option value="doctor">Doctor</option><option value="admin">Admin</option><option value="patient">Patient</option>
              </select>
            </label>
            {form.role === 'doctor' && (
              <label>Doctor profile
                <select required value={form.doctorId} onChange={set('doctorId')}>
                  <option value="">Select…</option>
                  {doctors.map((d) => <option key={d._id} value={d._id}>{d.fullName}</option>)}
                </select>
              </label>
            )}
            {form.role === 'patient' && (
              <label>Patient record
                <select required value={form.patientId} onChange={set('patientId')}>
                  <option value="">Select…</option>
                  {patients.map((p) => <option key={p._id} value={p._id}>{p.fullName} ({p.email})</option>)}
                </select>
              </label>
            )}
            <button className="btn">Create account</button>
          </form>
        </Modal>
      )}
    </>
  );
}
