import { useState, useEffect } from 'react';
import { api } from '../utils/api';

interface Client { id: string; name: string; stage: string; }
interface Shoot { id: string; name: string; shoot_date: string; package_type: string; }

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ clientId: '', title: '', date: '', timeStart: '09:00', timeEnd: '10:00', notes: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Shoot[]>('/api/calendar/shoots').catch(() => []),
      api.get<Client[]>('/api/clients').catch(() => []),
    ]).then(([s, c]) => {
      setShoots(Array.isArray(s) ? s : []);
      setClients(Array.isArray(c) ? c : []);
    }).finally(() => setLoading(false));
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 0).getDay(); // Sunday=0
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Build shoot date lookup
  const shootMap = new Map<string, Shoot[]>();
  for (const s of shoots) {
    if (!s.shoot_date) continue;
    const key = s.shoot_date.slice(0, 10); // YYYY-MM-DD
    if (!shootMap.has(key)) shootMap.set(key, []);
    shootMap.get(key)!.push(s);
  }

  const handleDateClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setForm(p => ({ ...p, date: dateStr }));
    setShowForm(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date) return;
    try {
      await api.post('/api/calendar/appointments', form);
      setShowForm(false);
      setForm({ clientId: '', title: '', date: '', timeStart: '09:00', timeEnd: '10:00', notes: '' });
      // Refresh
      const s = await api.get<Shoot[]>('/api/calendar/shoots').catch(() => []);
      setShoots(Array.isArray(s) ? s : []);
    } catch { /* offline */ }
  };

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#AEAEB2' }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>📅 Calendar</h2>
        <button onClick={() => { setForm(p => ({ ...p, date: '', title: '' })); setShowForm(!showForm); }}
          style={{ padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#007AFF', color: '#fff' }}>+ New Shoot</button>
      </div>

      {/* Month nav */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <button onClick={prevMonth} style={navBtn}>←</button>
        <span style={{ fontSize: 18, fontWeight: 700 }}>{monthName}</span>
        <button onClick={nextMonth} style={navBtn}>→</button>
      </div>

      {/* Calendar grid */}
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ padding: '10px 4px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#86868B' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((day, i) => {
            if (day === null) return <div key={`e${i}`} style={{ aspectRatio: '1' }} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayShoots = shootMap.get(dateStr) || [];
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
            return (
              <button key={day} onClick={() => handleDateClick(day)} style={{
                aspectRatio: '1', border: 'none', background: isToday ? 'rgba(0,122,255,.04)' : '#fff',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'flex-start', padding: '4px 2px', gap: 2,
                borderTop: '1px solid rgba(0,0,0,.03)', borderRight: '1px solid rgba(0,0,0,.03)',
              }}>
                <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? '#007AFF' : '#1D1D1F' }}>{day}</span>
                {dayShoots.slice(0, 2).map((s, j) => (
                  <span key={j} style={{ fontSize: 9, color: '#007AFF', background: 'rgba(0,122,255,.08)', padding: '1px 4px', borderRadius: 4, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </span>
                ))}
                {dayShoots.length > 2 && <span style={{ fontSize: 9, color: '#AEAEB2' }}>+{dayShoots.length - 2}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* New shoot form (modal) */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)' }} onClick={() => setShowForm(false)} />
          <form onSubmit={handleCreate} style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: 24, width: 380, maxWidth: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>New Shoot</h3>
            <div>
              <label style={lbl}>Client</label>
              <select value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))} style={sel}>
                <option value="">— Select client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name} · {c.stage}</option>)}
              </select>
            </div>
            <Field label="Title" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} placeholder="e.g. Sarah & Mike Wedding" />
            <Field label="Date" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} placeholder="YYYY-MM-DD" />
            <div style={{ display: 'flex', gap: 10 }}>
              <Field label="Start" value={form.timeStart} onChange={v => setForm(p => ({ ...p, timeStart: v }))} placeholder="09:00" />
              <Field label="End" value={form.timeEnd} onChange={v => setForm(p => ({ ...p, timeEnd: v }))} placeholder="10:00" />
            </div>
            <Field label="Notes (optional)" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} placeholder="Venue, special instructions…" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: '#007AFF', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Create</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #E5E5EA', background: '#fff', color: '#86868B', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Upcoming shoots list */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Upcoming Shoots</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shoots.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#AEAEB2', fontSize: 13, background: '#fff', borderRadius: 12 }}>No shoots scheduled yet</div>}
          {shoots.map(s => (
            <div key={s.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,.03)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,122,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📅</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#86868B' }}>{s.shoot_date} {s.package_type ? `· ${s.package_type}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ flex: 1 }}>
      <label style={lbl}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inp} />
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#86868B', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'rgba(0,0,0,.02)' };
const sel: React.CSSProperties = { ...inp };
const navBtn: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(0,0,0,.1)', background: '#fff', cursor: 'pointer', fontSize: 14 };
