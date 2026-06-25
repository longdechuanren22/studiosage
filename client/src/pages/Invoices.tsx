import { useState, useEffect } from 'react';
import { useDemo } from '../components/Layout';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { logError } from '../utils/error';
import { t, tf } from '../i18n';

interface Invoice {
  id: string; client_name: string; client_email: string;
  amount: number; currency: string; description: string;
  status: string; retainer_type?: string;
  payment_schedule: string; stripe_payment_link?: string;
  items?: any[]; created_at: string;
}

const DEMO_INVOICES: Invoice[] = [
  { id:'d-INV-042', client_name:'Sarah & Mike', client_email:'sarah@example.com', amount:4500, currency:'USD', description:'Wedding Full Package', status:'sent', retainer_type:'Non-refundable retainer', payment_schedule:'three-phase', stripe_payment_link:'https://buy.stripe.com/test_demo1', items:[{description:'Wedding coverage', unitPrice:3000, quantity:1},{description:'Album design', unitPrice:1500, quantity:1}], created_at:new Date().toISOString() },
  { id:'d-INV-041', client_name:'David L.', client_email:'david@example.com', amount:850, currency:'USD', description:'Portrait Session', status:'draft', payment_schedule:'single', created_at:new Date().toISOString() },
  { id:'d-INV-040', client_name:'Jennifer K.', client_email:'jennifer@example.com', amount:3400, currency:'USD', description:'Wedding Day Coverage', status:'paid', payment_schedule:'three-phase', stripe_payment_link:'https://buy.stripe.com/test_demo2', created_at:new Date(Date.now()-86400000*3).toISOString() },
];

export default function Invoices() {
  const { demo } = useDemo();
  const { token } = useUser();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchInvoices = () => {
    setLoading(true);
    if (demo) { setInvoices(DEMO_INVOICES); setLoading(false); return; }
    api.get<{ invoices: Invoice[] }>('/api/invoices')
      .then(data => setInvoices(Array.isArray(data?.invoices) ? data.invoices : Array.isArray(data) ? data : []))
      .catch((err) => { logError('Invoices.fetchInvoices', err); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchInvoices(); }, [demo, token]);
  useEffect(() => {
    if (demo) return;
    const t = setInterval(fetchInvoices, 30000);
    return () => clearInterval(t);
  }, [demo, token]);

  const handleSend = async (inv: Invoice) => {
    if (demo) {
      toast('Demo: Invoice sent! Payment link simulated', 'success');
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'sent', stripe_payment_link: 'https://buy.stripe.com/test_demo_sent' } : i));
      return;
    }
    setSendingId(inv.id);
    try {
      const data = await api.post<{ ok: boolean; invoice: Invoice }>(`/api/invoices/${inv.id}/send`);
      toast(t('invoices.sent'), 'success');
      if (data.invoice) setInvoices(prev => prev.map(i => i.id === inv.id ? data.invoice : i));
      else fetchInvoices();
    } catch (err: any) {
      toast(err.message || t('invoices.sendFail'), 'error');
    } finally { setSendingId(null); }
  };

  const handleDelete = async (inv: Invoice) => {
    if (demo) { setInvoices(prev => prev.filter(i => i.id !== inv.id)); toast(t('invoices.deleted'), 'info'); return; }
    try { await api.del(`/api/invoices/${inv.id}`); toast(t('invoices.deleted'), 'info'); fetchInvoices(); setSelectedId(null); }
    catch (err: any) { toast(err.message || t('invoices.networkErr'), 'error'); }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard?.writeText(link).then(
      () => toast(t('shared.copied'), 'success'),
      () => toast(t('shared.copy'), 'error')
    );
  };

  const handleDownloadPdf = async (inv: Invoice) => {
    if (demo) { toast(t('invoices.demoPdf'), 'info'); return; }
    try {
      const token = localStorage.getItem('studiosage_token');
      const res = await fetch(`/api/invoices/${inv.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `invoice-${inv.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast(t('invoices.pdfSuccess'), 'success');
    } catch (err) { logError('Invoices.handleDownloadPdf', err); toast(t('invoices.pdfFail'), 'error'); }
  };

  const paid = invoices.filter(i => i.status === 'paid');
  const totalRevenue = paid.reduce((s, i) => s + i.amount, 0);
  const pendingRevenue = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + i.amount, 0);

  if (selectedId) {
    const inv = invoices.find(i => i.id === selectedId);
    if (!inv) { setSelectedId(null); return null; }

    return (
      <div>
        <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>
          {t('invoices.back')}
        </button>
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', letterSpacing: '.4px', marginBottom: 4 }}>{t('invoices.detail.invoiceId').toUpperCase()} #{inv.id.slice(0, 8).toUpperCase()}</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.3px', margin: 0 }}>{inv.description}</h2>
              <p style={{ fontSize: 13, color: '#86868B', margin: '4px 0 0' }}>{inv.client_name}{inv.client_email ? ` · ${inv.client_email}` : ''}</p>
            </div>
            <StatusBadge status={inv.status} />
          </div>

          <div style={{ textAlign: 'center', padding: '20px 0', borderTop: '1px solid rgba(0,0,0,.06)', borderBottom: '1px solid rgba(0,0,0,.06)', marginBottom: 20 }}>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.5px', color: '#1D1D1F' }}>
              {inv.currency === 'CNY' ? '¥' : '$'}{inv.amount.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: '#AEAEB2', marginTop: 4 }}>
              {t(`invoices.detail.paymentSchedule.${inv.payment_schedule}`) || inv.payment_schedule}
              {inv.retainer_type && <span style={{ marginLeft: 8, color: '#FF9500', fontWeight: 600 }}> · {inv.retainer_type}</span>}
            </div>
          </div>

          {inv.items && inv.items.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#86868B', marginBottom: 8 }}>{t('invoices.detail.lineItems')}</div>
              {inv.items.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: i < inv.items!.length - 1 ? '1px solid rgba(0,0,0,.04)' : 'none' }}>
                  <span style={{ color: '#555' }}>{item.description || `Item ${i + 1}`}</span>
                  <span style={{ fontWeight: 600 }}>${(item.unitPrice || item.amount || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inv.status === 'draft' && (
              <button onClick={() => handleSend(inv)} disabled={sendingId === inv.id} style={primaryBtn}>
                {sendingId === inv.id ? `⏳ ${t('invoices.sending')}` : `📤 ${t('invoices.send')}`}
              </button>
            )}
            {(inv.status === 'sent' || inv.status === 'paid') && inv.stripe_payment_link && (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => window.open(inv.stripe_payment_link!, '_blank')} style={{ ...primaryBtn, flex: 1 }}>💳 {t('invoices.viewStripe')}</button>
                  <button onClick={() => handleCopyLink(inv.stripe_payment_link!)} style={{ ...secondaryBtn, flex: 1 }}>📋 {t('invoices.copyLink')}</button>
                </div>
                {inv.status === 'sent' && (
                  <button onClick={() => handleSend(inv)} disabled={sendingId === inv.id} style={{ ...secondaryBtn, color: '#8E8E93' }}>🔄 {t('invoices.regenLink')}</button>
                )}
              </>
            )}
            <button onClick={() => handleDownloadPdf(inv)} style={secondaryBtn}>🖨 {t('invoices.downloadPdf')}</button>
            {inv.status === 'draft' && (
              <button onClick={() => handleDelete(inv)} style={{ ...secondaryBtn, color: '#FF3B30' }}>🗑 {t('invoices.deleteDraft')}</button>
            )}
          </div>

          <div style={{ marginTop: 24, padding: '12px 16px', background: 'rgba(0,0,0,.02)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: '#AEAEB2' }}>
              {t('invoices.detail.createdAt')} {formatDate(inv.created_at)}
              {inv.stripe_payment_link && <span style={{ marginLeft: 12 }}>{t('invoices.detail.stripeConnected')}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>{t('invoices.title')}</h2>
          <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>
            {tf('invoices.summary', { count: invoices.length, revenue: totalRevenue.toLocaleString() })}
            {pendingRevenue > 0 && <><span style={{ margin: '0 4px' }}>·</span> Pending <strong style={{ color: '#FF9500' }}>${pendingRevenue.toLocaleString()}</strong></>}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#007AFF', color: '#fff', letterSpacing: '-.1px' }}>{t('invoices.new')}</button>
      </div>

      {showForm && <InvoiceForm onDone={() => { setShowForm(false); fetchInvoices(); }} toast={toast} />}

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#AEAEB2' }}>{t('shared.loading')}</div>}

      {!loading && invoices.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: 48, background: '#fff', borderRadius: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 8, opacity: .6 }}>📄</div>
          <p style={{ fontSize: 15, fontWeight: 700 }}>{t('invoices.noInvoices')}</p>
          <p style={{ fontSize: 13, color: '#86868B' }}>{t('invoices.noInvoicesHint')}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {invoices.map(inv => (
          <div key={inv.id} onClick={() => setSelectedId(inv.id)} style={{
            background: '#fff', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.04)', display: 'flex', alignItems: 'center', transition: 'all .15s', opacity: inv.status === 'paid' ? .75 : 1,
          }}>
            <div style={{ width: 80, flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#AEAEB2', letterSpacing: '.3px' }}>#{inv.id.slice(0, 8).toUpperCase()}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.1px' }}>{inv.client_name}</div>
              <div style={{ fontSize: 12, color: '#86868B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {inv.description}{inv.payment_schedule === 'three-phase' && ' · 3-Phase'}
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, marginRight: 10, letterSpacing: '-.2px', whiteSpace: 'nowrap' }}>
              {inv.currency === 'CNY' ? '¥' : '$'}{inv.amount.toLocaleString()}
            </div>
            <StatusBadge status={inv.status} />
            <div style={{ marginLeft: 8, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
              {inv.status === 'draft' && (
                <button onClick={() => handleSend(inv)} disabled={sendingId === inv.id} title="Send" style={iconBtn}>{sendingId === inv.id ? '⏳' : '📤'}</button>
              )}
              {inv.stripe_payment_link && (
                <button onClick={() => handleCopyLink(inv.stripe_payment_link!)} title="Copy link" style={iconBtn}>📋</button>
              )}
              <button onClick={() => handleDownloadPdf(inv)} title="Download PDF" style={iconBtn}>🖨</button>
            </div>
            <span style={{ fontSize: 14, color: '#C7C7CC', marginLeft: 4 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { bg: string; c: string }> = {
    draft: { bg: 'rgba(142,142,147,.1)', c: '#8E8E93' },
    sent: { bg: 'rgba(255,149,0,.1)', c: '#FF9500' },
    paid: { bg: 'rgba(52,199,89,.1)', c: '#34C759' },
    overdue: { bg: 'rgba(255,59,48,.1)', c: '#FF3B30' },
  };
  const s = m[status] || m.draft;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 12, background: s.bg, color: s.c, letterSpacing: '.4px', whiteSpace: 'nowrap' }}>{t(`invoices.status.${status}`) || t('invoices.status.draft')}</span>;
}

function InvoiceForm({ onDone, toast }: { onDone: () => void; toast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [form, setForm] = useState({ clientName: '', clientEmail: '', packageType: 'wedding', amount: '', paymentSchedule: 'three-phase' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName || !form.amount) { toast(t('invoices.form.fillRequired'), 'error'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/invoices/generate', { clientName: form.clientName, clientEmail: form.clientEmail, packageType: form.packageType, amount: Number(form.amount), paymentSchedule: form.paymentSchedule, currency: 'USD' });
      toast(t('invoices.form.draftCreated'), 'success'); onDone();
    } catch (err: any) { toast(err.message || t('invoices.networkErr'), 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,.04)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t('invoices.form.title')}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label={t('invoices.form.clientName')} value={form.clientName} onChange={v => setForm(p => ({ ...p, clientName: v }))} placeholder="Sarah & Mike" />
        <Field label={t('invoices.form.clientEmail')} value={form.clientEmail} onChange={v => setForm(p => ({ ...p, clientEmail: v }))} placeholder="client@example.com" type="email" />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>{t('invoices.form.packageType')}</label>
          <select value={form.packageType} onChange={e => setForm(p => ({ ...p, packageType: e.target.value }))} style={sel}>
            <option value="wedding">{t('invoices.form.packages.wedding')}</option>
            <option value="portrait">{t('invoices.form.packages.portrait')}</option>
            <option value="event">{t('invoices.form.packages.event')}</option>
            <option value="commercial">{t('invoices.form.packages.commercial')}</option>
            <option value="other">{t('invoices.form.packages.other')}</option>
          </select>
        </div>
        <Field label={t('invoices.form.amount')} value={form.amount} onChange={v => setForm(p => ({ ...p, amount: v }))} placeholder="4500" type="number" />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>{t('invoices.form.paymentSchedule')}</label>
          <select value={form.paymentSchedule} onChange={e => setForm(p => ({ ...p, paymentSchedule: e.target.value }))} style={sel}>
            <option value="three-phase">{t('invoices.form.schedules.three-phase')}</option>
            <option value="single">{t('invoices.form.schedules.single')}</option>
          </select>
        </div>
        <div style={{ flex: 1 }} />
      </div>
      <button type="submit" disabled={submitting} style={{ width: '100%', padding: '12px', borderRadius: 14, fontSize: 14, fontWeight: 600, background: submitting ? '#AEAEB2' : '#007AFF', color: '#fff', border: 'none', cursor: submitting ? 'default' : 'pointer', letterSpacing: '-.1px' }}>
        {submitting ? t('invoices.form.creating') : t('invoices.form.createBtn')}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return <div style={{ flex: 1 }}><label style={lbl}>{label}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inp} /></div>;
}

function formatDate(iso: string) { return iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''; }

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#86868B', marginBottom: 4, letterSpacing: '.2px' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'rgba(0,0,0,.02)' };
const sel: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'rgba(0,0,0,.02)' };
const primaryBtn: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: 14, border: 'none', background: '#007AFF', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: '-.1px' };
const secondaryBtn: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: 14, border: '1px solid rgba(0,0,0,.1)', background: '#fff', color: '#1D1D1F', fontSize: 14, fontWeight: 500, cursor: 'pointer', letterSpacing: '-.1px' };
const iconBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: 'none', background: 'rgba(0,0,0,.04)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 };
