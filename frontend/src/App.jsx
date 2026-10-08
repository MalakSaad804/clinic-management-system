import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Patients from './pages/Patients.jsx';
import PatientHistory from './pages/PatientHistory.jsx';
import Doctors from './pages/Doctors.jsx';
import VisitDetail from './pages/VisitDetail.jsx';
import AuditLogs from './pages/AuditLogs.jsx';
import Users from './pages/Users.jsx';

// The calendar library is big, so it is only downloaded when someone opens the calendar.
const CalendarPage = lazy(() => import('./pages/CalendarPage.jsx'));

// Only lets logged-in users (with an allowed role) see a page.
function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route index element={<Dashboard />} />
        <Route
          path="calendar"
          element={
            <Suspense fallback={<p className="muted">Loading calendar…</p>}>
              <CalendarPage />
            </Suspense>
          }
        />
        <Route
          path="patients"
          element={
            <Guard roles={['admin', 'doctor']}>
              <Patients />
            </Guard>
          }
        />
        <Route path="patients/:id/history" element={<PatientHistory />} />
        <Route path="doctors" element={<Doctors />} />
        <Route path="visits/:id" element={<VisitDetail />} />
        <Route
          path="audit"
          element={
            <Guard roles={['admin']}>
              <AuditLogs />
            </Guard>
          }
        />
        <Route
          path="users"
          element={
            <Guard roles={['admin']}>
              <Users />
            </Guard>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
