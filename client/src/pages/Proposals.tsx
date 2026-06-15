import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';

interface Client { id: string; name: string; email: string; stage: string; }

interface Proposal {
  id: string; title: string; client_id: string; client_name: string; client_email: string;
  packages: any[]; pricing: any; contract_terms: string; share_token: string;
  status: string; created_at: string;
}

const STATUS_FLOW = [
  { key: 'draft', label: '草稿', icon: '📝', desc: '编辑中，尚未发送' },
  { key: 'sent', label: '已发送', icon: '📤', desc: '已分享给客户查看' },
  { key: 'viewed', label: '已查看', icon: '👁', desc: '客户已打开提案' },
  { key: 'accepted', label: '已接受', icon: '✅', desc: '客户确认接受' },
  { key: 'declined', label: '已拒绝', icon: '❌', desc: '客户拒绝了提案' },
];

const PACKAGE_PRESETS = [
  { name: '白金套餐', price: 4500, desc: '全天跟拍 + 双机位 + 相册 + 精修200张' },
  { name: '黄金套餐', price: 2800, desc: '6小时跟拍 + 单机位 + 精修100张' },
  { name: '基础套餐', price: 1200, desc: '2小时拍摄 + 精修30张' },
  { name: '肖像套餐', price: 450, desc: '1小时拍摄 + 精修15张' },
  { name: '活动套餐', price: 1800, desc: '4小时活动跟拍 + 精修150张' },
];

export default function Proposals() {
  const { token } = useUser();
  const { toast } = useToast();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchAll = async () => {
    try {
      const [pData, cData] = await Promise.all([
        api.get<any[]>('/api/proposals'),
        api.get<any[]>('/api/clients'),
      ]);
      setProposals(Array.isArray(pData) ? pData : []);
      setClients(Array.isArray(cData) ? cData : []);
    } catch { /* offline */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [token]);

  const statusInfo = (s: string) => STATUS_FLOW.find(f => f.key === s) || STATUS_FLOW[0];
  const currentStep = (s: string) => Math.max(0, STATUS_FLOW.findIndex(f => f.key === s));

  const handleCopyLink = (p: Proposal) => {
    if (!p.share_token) { toast('请先发送提案生成分享链接', 'error'); return; }
    const url = `${window.location.origin}/sage/portal/proposal/${p.share_token}`;
    navigator.clipboard?.writeText(url).then(
      () => toast('链接已复制！发送给客户即可', 'success'),
      () => toast('复制失败', 'error')
    );
  };

  const handleShare = async (p: Proposal) => {
    try {
      const data = await api.post<{ shareToken: string; shareUrl: string }>(`/api/proposals/${p.id}/share`);
      toast('提案已发送！', 'success');
      const url = `${window.location.origin}/sage/portal/proposal/${data.shareToken}`;
      navigator.clipboard?.writeText(url).then(() => toast('分享链接已复制！', 'info'));
      fetchAll();
    } catch { toast('发送失败', 'error'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>📋 提案</h2>
          <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>
            {proposals.length} 个提案 · {proposals.filter(p => p.status === 'accepted').length} 已接受
            {proposals.length === 0 && ' — 创建提案发给客户确认套餐和报价'}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
          background: '#007AFF', color: '#fff', letterSpacing: '-.1px',
        }}>+ 新建</button>
      </div>

      {/* How it works — terse explanation */}
      {proposals.length === 0 && !showForm && (
        <div style={{
          background: 'rgba(0,122,255,.04)', borderRadius: 14, padding: 16,
          border: '1px solid rgba(0,122,255,.08)',
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#007AFF' }}>流程：</span>
          {STATUS_FLOW.map((s, i) => (
            <span key={s.key} style={{ fontSize: 12, color: '#86868B' }}>
              {s.icon} {s.label}{i < STATUS_FLOW.length - 1 ? ' →' : ''}
            </span>
          ))}
        </div>
      )}

      {showForm && (
        <ProposalForm
          clients={clients}
          toast={toast}
          onDone={() => { setShowForm(false); fetchAll(); }}
        />
      )}

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#AEAEB2' }}>加载中…</div>}

      {!loading && proposals.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: 48, background: '#fff', borderRadius: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: 15, fontWeight: 700 }}>还没有提案</p>
          <p style={{ fontSize: 13, color: '#86868B', marginBottom: 16 }}>
            为客户创建包含套餐、报价和合同条款的提案，<br/>一键分享让客户在线查看和接受
          </p>
        </div>
      )}

      {/* Proposal cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {proposals.map(p => {
          const si = statusInfo(p.status);
          const step = currentStep(p.status);
          return (
            <div key={p.id} style={{
              background: '#fff', borderRadius: 14, padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,.04)',
              opacity: p.status === 'declined' ? .6 : 1,
            }}>
              {/* Top row: title + actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.2px', marginBottom: 2 }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#86868B' }}>
                    {p.client_name ? `👤 ${p.client_name}` : '⚠️ 未指定客户'}
                    {p.client_email ? ` · ${p.client_email}` : ''}
                    <span style={{ marginLeft: 8 }}>{new Date(p.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                  {p.status === 'draft' && (
                    <button onClick={() => handleShare(p)} style={actionBtnStyle('#007AFF')}>
                      📤 发送
                    </button>
                  )}
                  {(p.status === 'sent' || p.status === 'viewed' || p.status === 'accepted') && (
                    <button onClick={() => handleCopyLink(p)} style={actionBtnStyle('#34C759')}>
                      📋 复制链接
                    </button>
                  )}
                </div>
              </div>

              {/* Status flow bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {STATUS_FLOW.map((s, i) => (
                  <div key={s.key} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    {/* Step dot */}
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: i <= step
                        ? p.status === 'declined' ? '#FF3B30' : p.status === 'accepted' ? '#34C759' : '#007AFF'
                        : '#E5E5EA',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: i <= step ? '#fff' : '#AEAEB2',
                      flexShrink: 0,
                    }}>
                      {i < step ? '✓' : s.icon}
                    </div>
                    {/* Connector line */}
                    {i < STATUS_FLOW.length - 1 && (
                      <div style={{
                        flex: 1, height: 2, minWidth: 8,
                        background: i < step ? (p.status === 'declined' ? '#FF3B30' : '#34C759') : '#E5E5EA',
                      }} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', marginTop: 4 }}>
                {STATUS_FLOW.map((s, i) => (
                  <div key={s.key} style={{ flex: 1, fontSize: 9, color: i <= step ? '#1D1D1F' : '#AEAEB2', fontWeight: i === step ? 700 : 400, textAlign: 'center' }}>
                    {s.label}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Proposal Form ── */

function ProposalForm({ clients, toast, onDone }: {
  clients: Client[];
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    title: '', clientId: '', packageName: '白金套餐', packagePrice: '4500',
    customPackageDesc: '', contractTerms: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const selectedPreset = PACKAGE_PRESETS.find(p => p.name === form.packageName);
  const selectedClient = clients.find(c => c.id === form.clientId);

  const goNext = () => {
    if (!form.title.trim()) { toast('请输入提案标题', 'error'); return; }
    setStep(2);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const pkg = {
        name: form.packageName,
        price: Number(form.packagePrice),
        includes: (selectedPreset?.desc || form.customPackageDesc || '').split('+').map(s => s.trim()),
      };
      const data = await api.post<{ id: string; shareToken: string }>('/api/proposals', {
        title: form.title,
        clientId: form.clientId || null,
        packages: [pkg],
        pricing: { [form.packageName]: Number(form.packagePrice) },
        contractTerms: form.contractTerms,
      });
      toast('提案已创建！', 'success');
      if (data.shareToken) {
        const url = `${window.location.origin}/sage/portal/proposal/${data.shareToken}`;
        navigator.clipboard?.writeText(url).then(() => toast('分享链接已复制！发送给客户即可', 'info'));
      }
      onDone();
    } catch { toast('网络错误', 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, letterSpacing: '-.1px' }}>
        {step === 1 ? '① 基本信息' : '② 合同条款'}
      </div>

      {step === 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Client selector */}
          <div>
            <label style={labelStyle}>客户（可选）</label>
            <select
              value={form.clientId}
              onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
              style={selectStyle}
            >
              <option value="">— 选择已有客户 —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name} · {c.email || c.stage}</option>
              ))}
            </select>
            {clients.length === 0 && (
              <p style={{ fontSize: 11, color: '#AEAEB2', margin: '4px 0 0' }}>还没有客户，可先去"客户管理"添加或留空</p>
            )}
          </div>

          {/* Title */}
          <Field label="提案标题 *" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))}
            placeholder={`${selectedClient ? selectedClient.name + ' ' : ''}婚礼全包套餐`} />

          {/* Package preset selector */}
          <div>
            <label style={labelStyle}>套餐模板</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {PACKAGE_PRESETS.map(pkg => (
                <button key={pkg.name} onClick={() => setForm(p => ({ ...p, packageName: pkg.name, packagePrice: String(pkg.price) }))}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: '1px solid',
                    borderColor: form.packageName === pkg.name ? '#007AFF' : 'rgba(0,0,0,.1)',
                    background: form.packageName === pkg.name ? 'rgba(0,122,255,.06)' : '#fff',
                    color: form.packageName === pkg.name ? '#007AFF' : '#86868B',
                    fontSize: 12, fontWeight: form.packageName === pkg.name ? 600 : 400,
                    cursor: 'pointer',
                  }}>
                  {pkg.name}<br/><span style={{ fontSize: 10 }}>${pkg.price}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Package price */}
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="套餐价格 (USD)" value={form.packagePrice} onChange={v => setForm(p => ({ ...p, packagePrice: v }))}
              placeholder="4500" type="number" />
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>包含内容</label>
              <div style={{ fontSize: 12, color: '#86868B', padding: '9px 0' }}>
                {selectedPreset?.desc || '—'}
              </div>
            </div>
          </div>

          <button onClick={goNext} style={{
            width: '100%', padding: '12px', borderRadius: 14, border: 'none',
            background: '#007AFF', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>下一步 →</button>
        </div>
      ) : (
        /* Step 2: Contract terms */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>合同条款（可选）</label>
            <textarea
              value={form.contractTerms}
              onChange={e => setForm(p => ({ ...p, contractTerms: e.target.value }))}
              placeholder={`1. 定金50%确认档期，不退。\n2. 拍摄日支付25%。\n3. 交付前支付剩余25%。\n4. 如因天气原因改期，定金保留。`}
              rows={6}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Summary */}
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(0,0,0,.02)', fontSize: 12, lineHeight: 1.8 }}>
            <div><strong>提案：</strong>{form.title || '(未填)'}</div>
            <div><strong>客户：</strong>{selectedClient?.name || '未指定'}</div>
            <div><strong>套餐：</strong>{form.packageName} · ${Number(form.packagePrice).toLocaleString()}</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(1)} style={{
              flex: 1, padding: '12px', borderRadius: 14, border: '1px solid rgba(0,0,0,.1)',
              background: '#fff', color: '#1D1D1F', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}>← 返回</button>
            <button onClick={handleSubmit} disabled={submitting} style={{
              flex: 2, padding: '12px', borderRadius: 14, border: 'none',
              background: submitting ? '#AEAEB2' : '#34C759', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: submitting ? 'default' : 'pointer',
            }}>
              {submitting ? '创建中…' : '✅ 创建提案'}
            </button>
          </div>

          <p style={{ fontSize: 11, color: '#AEAEB2', textAlign: 'center' }}>
            创建后可复制分享链接发送给客户，客户无需登录即可查看和接受
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Shared components ── */

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

/* ── Styles ── */

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

const actionBtnStyle = (color: string): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 8, border: 'none',
  background: color + '14', color, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', letterSpacing: '-.1px',
});
