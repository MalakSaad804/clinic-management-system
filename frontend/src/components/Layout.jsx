import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Layout() {
  const { user, isStaff, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">☕ Brew &amp; Bean Clinic</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/calendar">Calendar</NavLink>
          {isStaff && <NavLink to="/patients">Patients</NavLink>}
          {!isStaff && user.patient && <NavLink to={`/patients/${user.patient}/history`}>My history</NavLink>}
          <NavLink to="/doctors">Doctors</NavLink>
          {user.role === 'admin' && <NavLink to="/audit">Audit log</NavLink>}
          {user.role === 'admin' && <NavLink to="/users">Users</NavLink>}
        </nav>
        <div className="who">
          <span>{user.name} <span className="badge">{user.role}</span></span>
          <button className="btn small ghost" onClick={onLogout}>Log out</button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
