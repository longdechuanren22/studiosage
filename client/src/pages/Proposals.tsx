import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';

interface Proposal {
  id: string; title: string; client_id: string; client_name: string; client_email: string;
  packages: any[]; pricing: any; contract_terms: string; share_token: string;
  status: string; created_at: string;
}

export default function Proposals() {
  const { token } = useUser();
  const { toast } = useToast();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchProposals = async () => {
    try {
      const d = await api.get<any[]>('/api/proposals');
      setProposals(Array.isArray(d) ? d : []);
    } catch { /* network error — proposals remain empty */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProposals(); }, [token]);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { draft: '草稿', sent: '已发送', viewed: '已查看', accepted: '已接受', declined: '已拒绝' };
    return map[s] || s;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>提案</h2>
          <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>
            {proposals.length} 个提案 · {proposals.filter(p => p.status === 'accepted').length} 已接受
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
          background: '#007AFF', color: '#fff', letterSpacing: '-.1px',
        }}>+ 新建</button>
      </div>

      {showForm && <ProposalForm toast={toast} onDone={() => { setShowForm(false); fetchProposals(); }} />}

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#AEAEB2' }}>加载中…</div>}

      {!loading && proposals.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: 48, background: '#fff', borderRadius: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 8, opacity: .6 }}>📋</div>
          <p style={{ fontSize: 15, fontWeight: 700 }}>还没有提案</p>
          <p style={{ fontSize: 13, color: '#86868B' }}>创建提案发送给客户确认套餐和报价</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {proposals.map(p => (
          <div key={p.id} style={{
            background: '#fff', borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,.04)', display: 'flex', alignItems: 'center',
            transition: 'all .15s',
          }} onClick={() => {
            if (p.share_token) {
              const url = `${window.location.origin}/sage/portal/proposal/${p.share_token}`;
              navigator.clipboard?.writeText(url).then(() => toast('分享链接已复制！', 'success'));
            }
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.2px' }}>{p.title}</div>
              <div style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>
                {p.client_name || '未指定客户'} · {new Date(p.created_at).toLocaleDateString('zh-CN')}
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 12, letterSpacing: '.4px',
              background: p.status === 'accepted' ? 'rgba(52,199,89,.1)' : p.status === 'sent' ? 'rgba(0,122,255,.1)' : 'rgba(142,142,147,.1)',
              color: p.status === 'accepted' ? '#34C759' : p.status === 'sent' ? '#007AFF' : '#8E8E93',
            }}>{statusLabel(p.status)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProposalForm({ onDone, toast }: { onDone: () => void; toast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [form, setForm] = useState({ title: '', clientId: '', packages: '[]', pricing: '{}', contractTerms: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await api.post('/api/proposals', {
        ...form, packages: JSON.parse(form.packages || '[]'), pricing: JSON.parse(form.pricing || '{}'),
      });
      toast('提案已创建！', 'success');
      if (data.shareToken) {
        const url = `${window.location.origin}/sage/portal/proposal/${data.shareToken}`;
        navigator.clipboard?.writeText(url).then(() => toast('分享链接已复制！', 'info'));
      }
      onDone();
    } catch { toast('网络错误', 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,.04)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input style={{ width: '100%', border: '1px solid rgba(0,0,0,.1)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }} placeholder="提案标题 (如: Sarah & Mike 婚礼套餐)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
      <textarea style={{ width: '100%', border: '1px solid rgba(0,0,0,.1)', borderRadius: 10, padding: '10px 14px', fontSize: 13, minHeight: 80 }} placeholder="合同条款 (可选)" value={form.contractTerms} onChange={e => setForm({ ...form, contractTerms: e.target.value })} />
      <button type="submit" disabled={submitting} style={{ width: '100%', padding: '12px', borderRadius: 20, fontSize: 14, fontWeight: 600, background: submitting ? '#AEAEB2' : '#007AFF', color: '#fff', border: 'none', cursor: submitting ? 'default' : 'pointer' }}>
        {submitting ? '创建中…' : '创建提案'}
      </button>
    </form>
  );
}
