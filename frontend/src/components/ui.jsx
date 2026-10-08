import { useEffect, useState } from 'react';

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  return <div className={`alert ${kind}`}>{children}</div>;
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn small ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pager({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn small ghost" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>← Prev</button>
      <span>Page {meta.page} of {meta.pages} ({meta.total} total)</span>
      <button className="btn small ghost" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next →</button>
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`pill ${status}`}>{status}</span>;
}

// Small helper hook for "load data from API" with loading + error state.
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    fn()
      .then((data) => alive && setState({ data, error: '', loading: false }))
      .catch((e) => alive && setState({ data: null, error: e.response?.data?.message || e.message, loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export const fmtDateTime = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
export const fmtDate = (d) => new Date(d).toLocaleDateString([], { dateStyle: 'medium' });
