import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { errorMessage } from '../api.js';
import { Alert } from '../components/ui.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', phone: '', dateOfBirth: '', gender: 'female',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card wide" onSubmit={submit}>
        <h2>Patient sign-up</h2>
        <Alert>{error}</Alert>
        <div className="grid2">
          <label>First name<input required value={form.firstName} onChange={set('firstName')} /></label>
          <label>Last name<input required value={form.lastName} onChange={set('lastName')} /></label>
        </div>
        <label>Email<input type="email" required value={form.email} onChange={set('email')} /></label>
        <label>Password (8+ characters, letters and numbers)
          <input type="password" required minLength={8} value={form.password} onChange={set('password')} />
        </label>
        <div className="grid2">
          <label>Phone<input required value={form.phone} onChange={set('phone')} /></label>
          <label>Date of birth<input type="date" required value={form.dateOfBirth} onChange={set('dateOfBirth')} /></label>
        </div>
        <label>Gender
          <select value={form.gender} onChange={set('gender')}>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </label>
        <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="muted">Already registered? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}
