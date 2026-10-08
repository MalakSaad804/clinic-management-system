import { useState } from 'react';
import api from '../api.js';
import { Alert, Pager, fmtDateTime, useLoad } from '../components/ui.jsx';

export default function AuditLogs() {
  const [filters, setFilters] = useState({ entity: '', action: '' });
  const [page, setPage] = useState(1);
  const { data, error, loading } = useLoad(
    () =>
      api
        .get('/audit-logs', {
          params: { entity: filters.entity || undefined, action: filters.action || undefined, page, limit: 20 },
        })
        .then((r) => r.data),
    [filters, page]
  );

  const change = (k) => (e) => {
    setFilters({ ...filters, [k]: e.target.value });
    setPage(1);
  };

  return (
    <>
      <h2>Audit log</h2>
      <p className="muted">Every create, update, delete, login and patient-record read. Entries cannot be edited or deleted.</p>
      <div className="row">
        <label className="inline">Entity
          <select value={filters.entity} onChange={change('entity')}>
            <option value="">All</option>
            {['Patient', 'Doctor', 'Visit', 'User'].map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label className="inline">Action
          <select value={filters.action} onChange={change('action')}>
            <option value="">All</option>
            {['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT'].map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <Alert>{error}</Alert>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Changed fields</th><th>IP</th></tr></thead>
          <tbody>
            {(data?.data || []).map((a) => (
              <tr key={a._id}>
                <td>{fmtDateTime(a.timestamp)}</td>
                <td>{a.user ? `${a.user.name} (${a.userRole})` : <span className="muted">system / anonymous</span>}</td>
                <td><span className="pill">{a.action}</span></td>
                <td>{a.entity}<br /><span className="muted small-text">{a.entityId}</span></td>
                <td>{a.changedFields?.join(', ') || '—'}</td>
                <td>{a.ip}</td>
              </tr>
            ))}
            {!loading && data?.data.length === 0 && <tr><td colSpan="6" className="muted">No entries.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager meta={data?.meta} onPage={setPage} />
    </>
  );
}
