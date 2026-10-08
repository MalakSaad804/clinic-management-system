import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { addDays, endOfWeek, format, getDay, parse, startOfDay, startOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import api, { errorMessage } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert } from '../components/ui.jsx';
import BookingModal from '../components/BookingModal.jsx';

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { 'en-US': enUS } });
const DnDCalendar = withDragAndDrop(Calendar);
const MAX_SLOT_DAYS = 14;

function rangeOf(date, view) {
  if (view === 'day') return { start: startOfDay(date), end: addDays(startOfDay(date), 1) };
  if (view === 'week') {
    const start = startOfWeek(date);
    return { start, end: addDays(start, 7) };
  }
  // month / agenda: a generous window around the date
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return { start: addDays(startOfWeek(first), 0), end: addDays(endOfWeek(new Date(date.getFullYear(), date.getMonth() + 1, 0)), 1) };
}

function normalizeRange(r) {
  if (Array.isArray(r)) return { start: startOfDay(r[0]), end: addDays(startOfDay(r[r.length - 1]), 1) };
  return { start: r.start, end: r.end };
}

export default function CalendarPage() {
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState('week');
  const [date, setDate] = useState(new Date());
  const [range, setRange] = useState(() => rangeOf(new Date(), 'week'));
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState(user.role === 'doctor' ? user.doctor : '');
  const [visits, setVisits] = useState([]);
  const [slots, setSlots] = useState([]);
  const [booking, setBooking] = useState(null); // Date to prefill
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/doctors', { params: { limit: 100 } }).then((r) => {
      setDoctors(r.data.data);
      if (!doctorId && user.role === 'admin' && r.data.data[0]) setDoctorId(r.data.data[0]._id);
    }).catch((e) => setError(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadVisits = useCallback(async () => {
    try {
      const params = { from: range.start.toISOString(), to: range.end.toISOString(), limit: 500 };
      if (isStaff && doctorId) params.doctor = doctorId;
      const { data } = await api.get('/visits', { params });
      setVisits(data.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [range, doctorId, isStaff]);

  const loadSlots = useCallback(async () => {
    const days = Math.round((range.end - range.start) / 86400000);
    if (!isStaff || !doctorId || view === 'month' || view === 'agenda' || days > MAX_SLOT_DAYS) {
      setSlots([]);
      return;
    }
    try {
      const { data } = await api.get('/visits/slots', {
        params: { doctorId, from: format(range.start, 'yyyy-MM-dd'), to: format(addDays(range.end, -1), 'yyyy-MM-dd') },
      });
      setSlots(data.data.filter((s) => s.available));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [range, doctorId, view, isStaff]);

  useEffect(() => {
    loadVisits();
    loadSlots();
  }, [loadVisits, loadSlots]);

  const events = useMemo(() => {
    const visitEvents = visits.map((v) => ({
      id: v._id,
      type: 'visit',
      status: v.status,
      title: isStaff
        ? `${v.patient?.firstName || ''} ${v.patient?.lastName || ''} — ${v.reason}`
        : `Dr. ${v.doctor?.lastName || ''} — ${v.reason}`,
      start: new Date(v.scheduledAt),
      end: new Date(v.endsAt || new Date(v.scheduledAt).getTime() + v.durationMinutes * 60000),
    }));
    const slotEvents = slots.map((s) => ({
      id: `slot-${s.start}`,
      type: 'slot',
      title: 'Available',
      start: new Date(s.start),
      end: new Date(s.end),
    }));
    return [...slotEvents, ...visitEvents];
  }, [visits, slots, isStaff]);

  const patchVisit = async (event, changes) => {
    try {
      await api.patch(`/visits/${event.id}`, changes);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
    loadVisits();
    loadSlots();
  };

  const onMove = ({ event, start, end }) => {
    if (event.type !== 'visit') return;
    patchVisit(event, { scheduledAt: start.toISOString(), durationMinutes: Math.round((end - start) / 60000) });
  };

  const eventStyle = (event) => {
    if (event.type === 'slot') return { className: 'ev-slot' };
    return { className: `ev-${event.status}` };
  };

  const canDrag = (e) => isStaff && e.type === 'visit' && e.status === 'scheduled';

  return (
    <>
      <div className="row between">
        <h2>Appointment calendar</h2>
        {isStaff && (
          <div className="row">
            {user.role === 'admin' && (
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} aria-label="Doctor">
                <option value="">All doctors</option>
                {doctors.map((d) => <option key={d._id} value={d._id}>{d.fullName}</option>)}
              </select>
            )}
            <button className="btn" onClick={() => setBooking(new Date(Date.now() + 3600000))}>+ Schedule visit</button>
          </div>
        )}
      </div>
      {isStaff && (
        <p className="muted small-text">
          Green blocks are free slots (week/day view) — click one to book it. Drag a visit to reschedule it, or click it to open.
        </p>
      )}
      <Alert>{error}</Alert>
      <div className="card calendar-box">
        <DnDCalendar
          localizer={localizer}
          events={events}
          view={view}
          date={date}
          onView={(v) => { setView(v); setRange(rangeOf(date, v)); }}
          onNavigate={(d) => { setDate(d); setRange(rangeOf(d, view)); }}
          onRangeChange={(r) => setRange(normalizeRange(r))}
          views={['month', 'week', 'day', 'agenda']}
          step={30}
          timeslots={1}
          selectable={isStaff}
          resizable={isStaff}
          draggableAccessor={canDrag}
          resizableAccessor={canDrag}
          onEventDrop={onMove}
          onEventResize={onMove}
          onSelectSlot={({ start }) => isStaff && setBooking(start)}
          onSelectEvent={(e) => (e.type === 'slot' ? isStaff && setBooking(e.start) : navigate(`/visits/${e.id}`))}
          eventPropGetter={eventStyle}
          min={new Date(1970, 0, 1, 7, 0)}
          max={new Date(1970, 0, 1, 20, 0)}
          style={{ height: 680 }}
        />
      </div>

      {booking && (
        <BookingModal
          start={booking}
          doctors={doctors}
          defaultDoctorId={doctorId}
          onClose={() => setBooking(null)}
          onSaved={() => { setBooking(null); loadVisits(); loadSlots(); }}
        />
      )}
    </>
  );
}
