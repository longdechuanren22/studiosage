import { useState, useEffect } from 'react';
import { useDemo } from '../components/Layout';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { t, tf } from '../i18n';

interface Invoice {
  id: string; client_name: string; client_email: string;
  amount: number; currency: string; description: string;
  status: string; retainer_type?: string;
  payment_schedule: string; stripe_payment_link?: string;
  items?: any[]; created_at: string;
}

const DEMO_INVOICES: Invoice[] = [
  { id:'d-INV-042', client_name:'Sarah & Mike', client_email:'sarah@example.com', amount:4500, currency:'USD', description:'婚礼全包套餐', status:'sent', retainer_type:'定金（不退）', payment_schedule:'three-phase', stripe_payment_link:'https://buy.stripe.com/test_demo1', items:[{description:'婚礼拍摄', unitPrice:3000, quantity:1},{description:'相册设计', unitPrice:1500, quantity:1}], created_at:new Date().toISOString() },
  { id:'d-INV-041', client_name:'David L.', client_email:'david@example.com', amount:850, currency:'USD', description:'肖像拍摄', status:'draft', payment_schedule:'single', created_at:new Date().toISOString() },
  { id:'d-INV-040', client_name:'Jennifer K.', client_email:'jennifer@example.com', amount:3400, currency:'USD', description:'婚礼当日跟拍', status:'paid', payment_schedule:'three-phase', stripe_payment_link:'https://buy.stripe.com/test_demo2', created_at:new Date(Date.now()-86400000*3).toISOString() },
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
    api.get<Invoice[]>('/api/invoices')
      .then(data => setInvoices(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchInvoices(); }, [demo, token]);

  // Poll every 30s in non-demo mode
  useEffect(() => {
    if (demo) return;
    const t = setInterval(fetchInvoices, 30000);
    return () => clearInterval(t);
  }, [demo, token]);

  const handleSend = async (inv: Invoice) => {
    if (demo) {
      toast('演示模式：模拟发送成功！Stripe 支付链接已生成', 'success');
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'sent', stripe_payment_link: 'https://buy.stripe.com/test_demo_sent' } : i));
      return;
    }
    setSendingId(inv.id);
    try {
      const data = await api.post<{ ok: boolean; invoice: Invoice }>(`/api/invoices/${inv.id}/send`);
      toast('发票已发送！支付链接已生成', 'success');
      if (data.invoice) {
        setInvoices(prev => prev.map(i => i.id === inv.id ? data.invoice : i));
      } else {
        fetchInvoices();
      }
    } catch (err: any) {
      toast(err.message || '发送失败', 'error');
    } finally {
      setSendingId(null);
    }
  };

  const handleDelete = async (inv: Invoice) => {
    if (demo) {
      setInvoices(prev => prev.filter(i => i.id !== inv.id));
      toast('已删除', 'info');
      return;
    }
    try {
      await api.del(`/api/invoices/${inv.id}`);
      toast('发票已删除', 'info');
      fetchInvoices();
      setSelectedId(null);
    } catch (err: any) {
      toast(err.message || '删除失败', 'error');
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard?.writeText(link).then(
      () => toast('支付链接已复制！', 'success'),
      () => toast('复制失败，请手动复制', 'error')
    );
  };

  const handleDownloadPdf = async (inv: Invoice) => {
    if (demo) { toast('演示模式：PDF 下载功能已就绪', 'info'); return; }
    try {
      const token = localStorage.getItem('studiosage_token');
      const res = await fetch(`/api/invoices/${inv.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${inv.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('PDF 下载中…', 'success');
    } catch {
      toast('PDF 下载失败，请重试', 'error');
    }
  };

  const paid = invoices.filter(i => i.status === 'paid');
  const totalRevenue = paid.reduce((s, i) => s + i.amount, 0);
  const pendingRevenue = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + i.amount, 0);

  // ── Invoice detail panel ──
  if (selectedId) {
    const inv = invoices.find(i => i.id === selectedId);
    if (!inv) { setSelectedId(null); return null; }

    return (
      <div>
        <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>
          ← 返回发票列表
        </button>

        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', letterSpacing: '.4px', marginBottom: 4 }}>发票 #{inv.id.slice(0, 8).toUpperCase()}</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.3px', margin: 0 }}>{inv.description}</h2>
              <p style={{ fontSize: 13, color: '#86868B', margin: '4px 0 0' }}>{inv.client_name} · {inv.client_email || '未填写邮箱'}</p>
            </div>
            <StatusBadge status={inv.status} />
          </div>

          {/* Amount */}
          <div style={{ textAlign: 'center', padding: '20px 0', borderTop: '1px solid rgba(0,0,0,.06)', borderBottom: '1px solid rgba(0,0,0,.06)', marginBottom: 20 }}>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.5px', color: '#1D1D1F' }}>
              {inv.currency === 'CNY' ? '¥' : '$'}{inv.amount.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: '#AEAEB2', marginTop: 4 }}>
              {inv.payment_schedule === 'three-phase' ? '三期付款 · 50/25/25' : '一次性付款'}
              {inv.retainer_type && <span style={{ marginLeft: 8, color: '#FF9500', fontWeight: 600 }}> · {inv.retainer_type}</span>}
            </div>
          </div>

          {/* Line items */}
          {inv.items && inv.items.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#86868B', marginBottom: 8 }}>明细</div>
              {inv.items.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: i < inv.items!.length - 1 ? '1px solid rgba(0,0,0,.04)' : 'none' }}>
                  <span style={{ color: '#555' }}>{item.description || `项目 ${i + 1}`}</span>
                  <span style={{ fontWeight: 600 }}>${(item.unitPrice || item.amount || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inv.status === 'draft' && (
              <button onClick={() => handleSend(inv)} disabled={sendingId === inv.id}
                style={primaryBtnStyle}>
                {sendingId === inv.id ? '⏳ 生成支付链接…' : '📤 发送给客户'}
              </button>
            )}
            {(inv.status === 'sent' || inv.status === 'paid') && inv.stripe_payment_link && (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => window.open(inv.stripe_payment_link!, '_blank')}
                    style={{ ...primaryBtnStyle, flex: 1 }}>
                    💳 在 Stripe 中查看
                  </button>
                  <button onClick={() => handleCopyLink(inv.stripe_payment_link!)}
                    style={{ ...secondaryBtnStyle, flex: 1 }}>
                    📋 复制链接
                  </button>
                </div>
                {inv.status === 'sent' && (
                  <button onClick={() => handleSend(inv)} disabled={sendingId === inv.id}
                    style={{ ...secondaryBtnStyle, color: '#8E8E93' }}>
                    🔄 重新生成支付链接
                  </button>
                )}
              </>
            )}
            <button onClick={() => handleDownloadPdf(inv)} style={secondaryBtnStyle}>
              🖨 下载 PDF
            </button>
            {inv.status === 'draft' && (
              <button onClick={() => { handleDelete(inv); }} style={{ ...secondaryBtnStyle, color: '#FF3B30' }}>
                🗑 删除草稿
              </button>
            )}
          </div>

          {/* Meta info */}
          <div style={{ marginTop: 24, padding: '12px 16px', background: 'rgba(0,0,0,.02)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: '#AEAEB2' }}>
              创建于 {formatDate(inv.created_at)}
              {inv.stripe_payment_link && <span style={{ marginLeft: 12 }}>Stripe 已连接</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Invoices list view ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>发票</h2>
          <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>
            {invoices.length} 张 · 已收 <strong style={{ color: '#34C759' }}>${totalRevenue.toLocaleString()}</strong>
            {pendingRevenue > 0 && <><span style={{ margin: '0 4px' }}>·</span> 待收 <strong style={{ color: '#FF9500' }}>${pendingRevenue.toLocaleString()}</strong></>}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
          background: '#007AFF', color: '#fff', letterSpacing: '-.1px',
        }}>+ 新建</button>
      </div>

      {showForm && (
        <InvoiceForm
          onDone={() => { setShowForm(false); fetchInvoices(); }}
          toast={toast}
        />
      )}

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#AEAEB2' }}>加载中…</div>
      )}

      {!loading && invoices.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: 48, background: '#fff', borderRadius: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 8, opacity: .6 }}>📄</div>
          <p style={{ fontSize: 15, fontWeight: 700 }}>还没有发票</p>
          <p style={{ fontSize: 13, color: '#86868B' }}>生成发票发给客户开始收款</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {invoices.map(inv => (
          <div key={inv.id}
            onClick={() => setSelectedId(inv.id)}
            style={{
              background: '#fff', borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,.04)', display: 'flex', alignItems: 'center',
              transition: 'all .15s', opacity: inv.status === 'paid' ? .75 : 1,
            }}>
            {/* ID */}
            <div style={{ width: 80, flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#AEAEB2', letterSpacing: '.3px' }}>
                #{inv.id.slice(0, 8).toUpperCase()}
              </div>
            </div>

            {/* Client + desc */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.1px' }}>{inv.client_name}</div>
              <div style={{ fontSize: 12, color: '#86868B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {inv.description}
                {inv.payment_schedule === 'three-phase' && ' · 三期付款'}
              </div>
            </div>

            {/* Amount */}
            <div style={{ fontSize: 16, fontWeight: 800, marginRight: 10, letterSpacing: '-.2px', whiteSpace: 'nowrap' }}>
              {inv.currency === 'CNY' ? '¥' : '$'}{inv.amount.toLocaleString()}
            </div>

            {/* Status badge */}
            <StatusBadge status={inv.status} />

            {/* Quick actions */}
            <div style={{ marginLeft: 8, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
              {inv.status === 'draft' && (
                <button onClick={() => handleSend(inv)} disabled={sendingId === inv.id}
                  title="发送"
                  style={iconBtnStyle}>
                  {sendingId === inv.id ? '⏳' : '📤'}
                </button>
              )}
              {inv.stripe_payment_link && (
                <button onClick={() => handleCopyLink(inv.stripe_payment_link!)}
                  title="复制支付链接"
                  style={iconBtnStyle}>📋</button>
              )}
              <button onClick={() => handleDownloadPdf(inv)}
                title="下载 PDF"
                style={iconBtnStyle}>🖨</button>
            </div>

            <span style={{ fontSize: 14, color: '#C7C7CC', marginLeft: 4 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sub-components ──

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    draft: { bg: 'rgba(142,142,147,.1)', color: '#8E8E93', label: '草稿' },
    sent: { bg: 'rgba(255,149,0,.1)', color: '#FF9500', label: '待付' },
    paid: { bg: 'rgba(52,199,89,.1)', color: '#34C759', label: '已付' },
    overdue: { bg: 'rgba(255,59,48,.1)', color: '#FF3B30', label: '逾期' },
  };
  const c = config[status] || config.draft;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 12,
      background: c.bg, color: c.color, letterSpacing: '.4px', whiteSpace: 'nowrap',
    }}>{c.label}</span>
  );
}

function InvoiceForm({ onDone, toast }: { onDone: () => void; toast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [form, setForm] = useState({
    clientName: '', clientEmail: '', packageType: 'wedding',
    amount: '', paymentSchedule: 'three-phase',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName || !form.amount) {
      toast('请填写客户名称和金额', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.post<{ id: string; stripePaymentLink?: string }>('/api/invoices/generate', {
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        packageType: form.packageType,
        amount: Number(form.amount),
        paymentSchedule: form.paymentSchedule,
        currency: 'USD',
      });
      toast('发票草稿已生成！', 'success');
      onDone();
    } catch (err: any) {
      toast(err.message || '网络错误', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{
      background: '#fff', borderRadius: 16, padding: 18,
      boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>新建发票</div>
      <Row>
        <Field label="客户名称 *" value={form.clientName} onChange={v => setForm(p => ({ ...p, clientName: v }))} placeholder="Sarah & Mike" />
        <Field label="客户邮箱" value={form.clientEmail} onChange={v => setForm(p => ({ ...p, clientEmail: v }))} placeholder="client@example.com" type="email" />
      </Row>
      <Row>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>套餐类型</label>
          <select value={form.packageType} onChange={e => setForm(p => ({ ...p, packageType: e.target.value }))} style={selectStyle}>
            <option value="wedding">婚礼</option>
            <option value="portrait">肖像</option>
            <option value="event">活动</option>
            <option value="commercial">商业</option>
            <option value="other">其他</option>
          </select>
        </div>
        <Field label="金额 (USD) *" value={form.amount} onChange={v => setForm(p => ({ ...p, amount: v }))} placeholder="4500" type="number" />
      </Row>
      <Row>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>付款方式</label>
          <select value={form.paymentSchedule} onChange={e => setForm(p => ({ ...p, paymentSchedule: e.target.value }))} style={selectStyle}>
            <option value="three-phase">三期付款 (50/25/25)</option>
            <option value="single">一次性付清</option>
          </select>
        </div>
        <div style={{ flex: 1 }} />
      </Row>
      <button type="submit" disabled={submitting} style={{
        width: '100%', padding: '12px', borderRadius: 14, fontSize: 14, fontWeight: 600,
        background: submitting ? '#AEAEB2' : '#007AFF', color: '#fff',
        border: 'none', cursor: submitting ? 'default' : 'pointer', letterSpacing: '-.1px',
      }}>
        {submitting ? '生成中…' : '生成草稿'}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div style={{ flex: 1 }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10 }}>{children}</div>;
}

function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Styles ──

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#86868B',
  marginBottom: 4, letterSpacing: '.2px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1px solid rgba(0,0,0,.1)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
  background: 'rgba(0,0,0,.02)',
};

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1px solid rgba(0,0,0,.1)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
  background: 'rgba(0,0,0,.02)',
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: 14, border: 'none',
  background: '#007AFF', color: '#fff', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', letterSpacing: '-.1px',
};

const secondaryBtnStyle: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: 14,
  border: '1px solid rgba(0,0,0,.1)', background: '#fff',
  color: '#1D1D1F', fontSize: 14, fontWeight: 500,
  cursor: 'pointer', letterSpacing: '-.1px',
};

const iconBtnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: 'none',
  background: 'rgba(0,0,0,.04)', fontSize: 14, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
};
