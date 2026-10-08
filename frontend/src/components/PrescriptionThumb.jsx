import { useEffect, useState } from 'react';
import api from '../api.js';

// Prescriptions are private, so <img src> cannot be used (it cannot send the login token).
// We download the image with the token and show it from a temporary blob URL instead.
export default function PrescriptionThumb({ rx, canDelete, onDelete }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = '';
    let alive = true;
    api
      .get(rx.url.replace(/^\/api/, ''), { responseType: 'blob' })
      .then((res) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [rx.url]);

  return (
    <figure className="thumb">
      {failed && <div className="thumb-fail">Could not load</div>}
      {!failed && !src && <div className="thumb-fail">Loading…</div>}
      {src && (
        <a href={src} target="_blank" rel="noreferrer" title="Open full size">
          <img src={src} alt={`Prescription ${rx.originalName}`} />
        </a>
      )}
      <figcaption>{rx.originalName}</figcaption>
      {canDelete && <button className="btn small danger" onClick={() => onDelete(rx)}>Remove</button>}
    </figure>
  );
}
