import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import { t } from '../i18n';

interface Client {
  id: string; name: string; email: string; phone: string; wechat_id: string;
  type: string; stage: string; source: string; status: string; notes: string;
  message_count: number; pending_count: number;
  invoice_count: number; unpaid_invoice_count: number;
  last_message_at: string; last_message_subject: string;
  shoot_date: string; package_type: string;
}

interface Message {
  id: string; from_address: string; subject: string; body: string;
  category: string; status: string; ai_reply: string; channel: string;
  created_at: string;
}

interface Invoice {
  id: string; amount: number; currency: string; description: string;
  status: string; created_at: string;
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ messages: Message[]; invoices: Invoice[] } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active'>('all');
  const [sending, setSending] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', wechat_id: '', type: '', notes: '' });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchClients().then(() => {
      const openId = searchParams.get('open');
      if (openId) openClient(openId);
    }).catch(() => {});
  }, []);

  const fetchClients = async () => {
    try {
      const url = search ? `/api/clients?search=${encodeURIComponent(search)}` : '/api/clients';
      const data = await api.get<Client[]>(url); setClients(data);
    } catch { /* network */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchClients(); }, [search]);

  const openClient = async (id: string) => {
    setSelectedId(id);
    setSearchParams({ open: id });
    try {
      const data = await api.get<any>(`/api/clients/${id}`);
      setDetail({ messages: data.messages || [], invoices: data.invoices || [] });
    } catch { /* offline */ }
  };

  const closeClient = () => { setSelectedId(null); setDetail(null); setSearchParams({}); };

  const handleSend = async (msgId: string) => {
    setSending(msgId);
    try { await api.post(`/api/messages/${msgId}/send`); } catch {}
    setSending(null);
    if (selectedId) openClient(selectedId);
  };

  const startEdit = (msg: Message) => { setEditing(msg.id); setEditText(msg.ai_reply || ''); };

  const saveDraft = async (msgId: string) => {
    try { await api.patch(`/api/messages/${msgId}/reply`, { ai_reply: editText }); } catch {}
    setEditing(null);
    if (selectedId) openClient(selectedId);
  };

  const createClient = async () => {
    if (!newClient.name) return;
    try { await api.post('/api/clients', newClient); } catch {}
    setShowNewClient(false);
    setNewClient({ name: '', email: '', phone: '', wechat_id: '', type: '', notes: '' });
    fetchClients();
  };

  const channelIcon = (c?: string) => c === 'email' ? '📧' : c === 'wechat' ? '💬' : c === 'sms' ? '📱' : '💬';

  const stageLabel = (s: string) => t(`clients.stage.${s}`);

  const filtered = filter === 'all' ? clients
    : filter === 'pending' ? clients.filter(c => c.pending_count > 0 || c.unpaid_invoice_count > 0)
    : clients.filter(c => c.stage !== 'delivered' && c.stage !== 'inquiry');

  // ── Client Detail View ──
  if (selectedId && detail) {
    const client = clients.find(c => c.id === selectedId);
    if (!client) return null;

    return (
      <div>
        <button onClick={closeClient} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>
          {t('clients.back')}
        </button>

        {/* Client header */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-.3px' }}>{client.name}</h2>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {client.email && <span style={{ fontSize: 12, color: '#86868B' }}>📧 {client.email}</span>}
                {client.phone && <span style={{ fontSize: 12, color: '#86868B' }}>📱 {client.phone}</span>}
                {client.wechat_id && <span style={{ fontSize: 12, color: '#86868B' }}>💬 {client.wechat_id}</span>}
              </div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
              background: client.stage === 'delivered' ? 'rgba(52,199,89,.08)' : 'rgba(0,122,255,.08)',
              color: client.stage === 'delivered' ? '#34C759' : '#007AFF',
            }}>{stageLabel(client.stage)}</span>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Stat label={t('clients.stats.messages')} value={client.message_count} />
            <Stat label={t('clients.stats.pending')} value={client.pending_count} color={client.pending_count > 0 ? '#FF3B30' : undefined} />
            <Stat label={t('clients.stats.invoices')} value={client.invoice_count} />
            <Stat label={t('clients.stats.unpaid')} value={client.unpaid_invoice_count} color={client.unpaid_invoice_count > 0 ? '#FF9500' : undefined} />
          </div>
        </div>

        {/* Messages */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#86868B', marginBottom: 8 }}>📨 {t('clients.messages')}</div>
          {detail.messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#AEAEB2', fontSize: 13 }}>{t('clients.noMessages')}</div>
          ) : (
            detail.messages.map(msg => (
              <div key={msg.id} style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, boxShadow: '0 1px 2px rgba(0,0,0,.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{channelIcon(msg.channel)}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{msg.subject || '(no subject)'}</span>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 6,
                      background: (msg.category === 'urgent' ? '#FF3B30' : msg.category === 'important' ? '#FF9500' : '#86868B') + '14',
                      color: msg.category === 'urgent' ? '#FF3B30' : msg.category === 'important' ? '#FF9500' : '#86868B',
                      fontWeight: 600,
                    }}>
                      {msg.category === 'urgent' ? 'Urgent' : msg.category === 'important' ? 'Important' : 'Normal'}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: '#AEAEB2' }}>{formatTime(msg.created_at)}</span>
                </div>
                <p style={{ fontSize: 12, color: '#86868B', margin: '0 0 8px', lineHeight: 1.5, maxHeight: 60, overflow: 'hidden' }}>
                  {msg.body?.slice(0, 200)}
                </p>
                {msg.ai_reply && msg.status === 'pending' && (
                  <div style={{ background: 'rgba(0,122,255,.04)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#007AFF', marginBottom: 4 }}>🤖 {t('clients.aiDraft')}</div>
                    {editing === msg.id ? (
                      <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3}
                        style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 8, padding: 8, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                    ) : (
                      <p style={{ fontSize: 12, color: '#1D1D1F', margin: 0, lineHeight: 1.5 }}>{msg.ai_reply}</p>
                    )}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      {editing === msg.id ? (
                        <button onClick={() => saveDraft(msg.id)} style={btnSmall('#007AFF')}>💾 {t('clients.save')}</button>
                      ) : (
                        <button onClick={() => startEdit(msg)} style={btnSmallOutline}>✏️ {t('clients.edit')}</button>
                      )}
                      <button onClick={() => handleSend(msg.id)} disabled={sending === msg.id} style={btnSmall('#34C759', sending === msg.id)}>
                        {sending === msg.id ? '⏳' : '✅'} {t('clients.send')}
                      </button>
                    </div>
                  </div>
                )}
                {msg.status === 'replied' && (
                  <div style={{ fontSize: 11, color: '#34C759', fontWeight: 600 }}>✅ {t('clients.replied')}</div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Invoices */}
        {detail.invoices.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#86868B', marginBottom: 8 }}>💰 {t('clients.invoices')}</div>
            {detail.invoices.map(inv => (
              <div key={inv.id} style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, boxShadow: '0 1px 2px rgba(0,0,0,.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.description || 'Invoice'}</div>
                  <div style={{ fontSize: 11, color: '#AEAEB2' }}>{formatTime(inv.created_at)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>${inv.amount?.toFixed(2)}</div>
                  <span style={invBadgeStyle(inv.status)}>{invStatus(inv.status)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Client List View ──
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-.3px' }}>👥 {t('clients.title')}</h2>
        <div style={{ display: 'flex', gap: 8, flex: 1, maxWidth: 360 }}>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search clients…"
            style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', fontSize: 13, outline: 'none', background: '#fff' }}
          />
          <button onClick={() => setShowNewClient(true)}
            style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#007AFF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t('clients.newClient')}
          </button>
        </div>
      </div>

      {/* New client modal */}
      {showNewClient && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)' }} onClick={() => setShowNewClient(false)} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: 24, width: 380, maxWidth: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>{t('clients.createTitle')}</h3>
            <Field label={t('clients.name')} value={newClient.name} onChange={v => setNewClient(p => ({ ...p, name: v }))} placeholder="Client name" />
            <Field label={t('clients.email')} value={newClient.email} onChange={v => setNewClient(p => ({ ...p, email: v }))} placeholder="client@example.com" />
            <Field label={t('clients.phone')} value={newClient.phone} onChange={v => setNewClient(p => ({ ...p, phone: v }))} placeholder="Phone number" />
            <Field label={t('clients.wechat')} value={newClient.wechat_id} onChange={v => setNewClient(p => ({ ...p, wechat_id: v }))} placeholder="WeChat ID" />
            <Field label={t('clients.type')} value={newClient.type} onChange={v => setNewClient(p => ({ ...p, type: v }))} placeholder={t('clients.typePlaceholder')} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={createClient} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#007AFF', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {t('clients.create')}
              </button>
              <button onClick={() => setShowNewClient(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #E5E5EA', background: '#fff', color: '#86868B', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {t('clients.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'pending', 'active'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filter === f ? '#007AFF' : '#fff', color: filter === f ? '#fff' : '#86868B',
              borderColor: filter === f ? '#007AFF' : '#E5E5EA',
            }}>
            {f === 'all' ? t('clients.all') : f === 'pending' ? t('clients.pending') : t('clients.active')}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#AEAEB2', alignSelf: 'center' }}>{filtered.length} clients</span>
      </div>

      {/* Client cards */}
      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#AEAEB2' }}>{t('shared.loading')}</div>
      )}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#AEAEB2' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
          <p style={{ fontSize: 14, margin: 0 }}>{t('clients.noClients')}</p>
          <p style={{ fontSize: 12, margin: '4px 0 0' }}>{t('clients.noClientsHint')}</p>
        </div>
      )}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(client => (
            <button key={client.id} onClick={() => openClient(client.id)}
              style={{ width: '100%', background: '#fff', borderRadius: 14, padding: '16px', border: 'none', textAlign: 'left', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${client.source === 'email' ? '#007AFF' : client.source === 'wechat' ? '#34C759' : '#5856D6'}, ${client.source === 'email' ? '#5856D6' : client.source === 'wechat' ? '#007AFF' : '#007AFF'})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 15, fontWeight: 700,
                  }}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{client.name}</div>
                    <div style={{ fontSize: 11, color: '#AEAEB2' }}>
                      {client.email || client.phone || client.wechat_id || '—'}
                      {client.source === 'email' && ' · Email'}
                      {client.source === 'wechat' && ' · WeChat'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {client.pending_count > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#FF3B30', minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {client.pending_count}
                    </span>
                  )}
                  {client.unpaid_invoice_count > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#FF9500', background: 'rgba(255,149,0,.1)', padding: '2px 6px', borderRadius: 6 }}>
                      {client.unpaid_invoice_count} unpaid
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: '#C7C7CC' }}>›</span>
                </div>
              </div>
              {client.last_message_subject && (
                <div style={{ fontSize: 11, color: '#AEAEB2' }}>
                  {client.last_message_at ? formatTime(client.last_message_at) + ' · ' : ''}
                  {client.last_message_subject}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || '#1D1D1F', letterSpacing: '-.2px' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#AEAEB2' }}>{label}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#86868B', marginBottom: 4 }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E5EA', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  );
}

function formatTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString('en-US');
}

const btnSmall = (color: string, disabled?: boolean): React.CSSProperties => ({
  padding: '4px 12px', borderRadius: 6, border: 'none',
  background: disabled ? '#E5E5EA' : color, color: '#fff',
  fontSize: 11, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
});

const btnSmallOutline: React.CSSProperties = {
  padding: '4px 12px', borderRadius: 6, border: '1px solid #E5E5EA',
  background: '#fff', color: '#007AFF', fontSize: 11, fontWeight: 600, cursor: 'pointer',
};

function invBadgeStyle(s: string) {
  const color = s === 'paid' ? '#34C759' : s === 'sent' ? '#FF9500' : '#AEAEB2';
  return { fontSize: 10, fontWeight: 600, color, background: color + '14', padding: '1px 6px', borderRadius: 6 };
}

function invStatus(s: string) {
  switch (s) { case 'draft': return 'Draft'; case 'sent': return 'Unpaid'; case 'paid': return 'Paid'; case 'overdue': return 'Overdue'; default: return s; }
}
