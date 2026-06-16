import { useState, useEffect } from 'react';
import { useDemo } from '../components/Layout';
import { api } from '../utils/api';

interface Message {
  id: string; from_address: string; subject: string; body: string;
  category: 'urgent' | 'normal' | 'spam'; status: 'pending' | 'replied' | 'archived';
  ai_reply: string; client_name?: string; client_stage?: string; created_at: string;
}

const AVATAR_COLORS = ['#FF3B30','#007AFF','#FF9500','#34C759','#AF52DE','#5856D6','#FF2D55','#30B0C7'];
function avatarColor(i: number) { return AVATAR_COLORS[i % AVATAR_COLORS.length]; }
function initial(name: string) { return (name || '?')[0].toUpperCase(); }

export default function Inbox() {
  const { demo } = useDemo();
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'normal'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchMessages = async () => {
    try { const data = await api.get<Message[]>('/api/messages/inbox'); setMessages(Array.isArray(data) ? data : []); }
    catch { setMessages([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchMessages(); }, []);
  const pendingCount = messages.filter(m => m.status === 'pending').length;
  const urgentCount = messages.filter(m => m.category === 'urgent' && m.status === 'pending').length;
  const handleSend = async (msg: Message) => {
    setSendingId(msg.id);
    try { await api.post(`/api/messages/${msg.id}/send`, { customText: editText || msg.ai_reply }); }
    catch(e: any) { alert('Send failed: ' + e.message); }
    setSendingId(null); setEditingId(null); fetchMessages();
  };
  const saveDraft = async (msg: Message) => {
    try { await api.patch(`/api/messages/${msg.id}/reply`, { ai_reply: editText }); }
    catch { /* offline */ }
    setEditingId(null); fetchMessages();
  };
  const filtered = filter === 'all' ? messages : messages.filter(m => m.category === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>Inbox</h2>
        <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>
          {loading ? 'Loading...' : (
            pendingCount > 0
              ? `${pendingCount} pending · ${urgentCount > 0 ? `${urgentCount} urgent · ` : ''}${messages.length} total`
              : messages.length > 0 ? 'All handled ✅' : 'Inbox empty · Connect email to start'
          )}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {(['all', 'urgent', 'normal'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: filter === f ? '#007AFF' : '#fff', color: filter === f ? '#fff' : '#86868B', borderColor: filter === f ? '#007AFF' : '#E5E5EA',
          }}>{f === 'all' ? 'All' : f === 'urgent' ? '🔴 Urgent' : '🟡 Normal'}</button>
        ))}
      </div>
      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#AEAEB2' }}>Loading…</div>}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, background: '#fff', borderRadius: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p style={{ fontSize: 15, fontWeight: 700 }}>Inbox empty</p>
          <p style={{ fontSize: 13, color: '#86868B' }}>
            {messages.length === 0 ? 'Connect your email and AI will read messages here.' : 'No messages match this filter. Try a different one.'}
          </p>
        </div>
      )}
    </div>
  );
}
