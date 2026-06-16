import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { t, tf } from '../i18n';

interface Client { id: string; name: string; email: string; stage: string; }

interface Proposal {
  id: string; title: string; client_id: string; client_name: string; client_email: string;
  packages: any[]; pricing: any; contract_terms: string; share_token: string;
  status: string; created_at: string;
}

const FLOW_KEYS = ['draft', 'sent', 'viewed', 'accepted', 'declined'] as const;
const FLOW_ICONS: Record<string, string> = { draft: '📝', sent: '📤', viewed: '👁', accepted: '✅', declined: '❌' };

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
        api.get<any[]>('/api/proposals'), api.get<any[]>('/api/clients'),
      ]);
      setProposals(Array.isArray(pData) ? pData : []);
      setClients(Array.isArray(cData) ? cData : []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [token]);

  const currentStep = (s: string) => Math.max(0, FLOW_KEYS.indexOf(s as any));

  const handleCopyLink = (p: Proposal) => {
    if (!p.share_token) { toast(t('proposals.unsentWarning'), 'error'); return; }
    const url = `${window.location.origin}/sage/portal/proposal/${p.share_token}`;
    navigator.clipboard?.writeText(url).then(
      () => toast(t('proposals.linkCopied'), 'success'),
      () => toast(t('proposals.copyFail'), 'error')
    );
  };

  const handleShare = async (p: Proposal) => {
    try {
      const data = await api.post<{ shareToken: string }>(`/api/proposals/${p.id}/share`);
      toast(t('proposals.sent'), 'success');
      const url = `${window.location.origin}/sage/portal/proposal/${data.shareToken}`;
      navigator.clipboard?.writeText(url).then(() => toast(t('proposals.linkCopied'), 'info'));
      fetchAll();
    } catch { toast(t('proposals.sendFail'), 'error'); }
  };

  const [aiClientId, setAiClientId] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerateFromChat = async () => {
    const targetId = aiClientId || clients[0]?.id;
    if (!targetId) { toast('No clients with chat history. Connect email first.', 'error'); return; }
    setGenerating(true);
    try {
      const result = await api.post<{ id: string; shareToken: string; generated: boolean }>('/api/proposals/generate-from-chat', {
        clientId: targetId,
      });
      toast(result.generated ? 'AI proposal generated from chat history!' : 'Proposal created from template.', 'success');
      if (result.shareToken) {
        const url = `${window.location.origin}/sage/portal/proposal/${result.shareToken}`;
        navigator.clipboard?.writeText(url).then(() => toast(t('proposals.linkCopied'), 'info'));
      }
      fetchAll();
    } catch (err: any) {
      toast(err.message || 'Failed to generate proposal', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const acceptedCount = proposals.filter(p => p.status === 'accepted').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>📋 {t('proposals.title')}</h2>
          <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>
            {proposals.length > 0
              ? tf('proposals.subtitle', { count: proposals.length, accepted: acceptedCount })
              : t('proposals.subtitleEmpty')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {clients.length > 0 && (
            <>
              <select value={aiClientId} onChange={e => setAiClientId(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: 20, fontSize: 12, border: '1px solid rgba(0,0,0,.1)', background: '#fff', color: '#1D1D1F', cursor: 'pointer', maxWidth: 160 }}>
                <option value="">AI: pick client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={handleGenerateFromChat} disabled={generating}
                style={{ padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: '1px solid rgba(0,0,0,.1)', cursor: generating ? 'default' : 'pointer', background: generating ? '#f5f5f5' : '#fff', color: generating ? '#AEAEB2' : '#007AFF', letterSpacing: '-.1px', whiteSpace: 'nowrap' }}>
                {generating ? '⏳' : '🤖'} AI Generate
              </button>
            </>
          )}
          <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#007AFF', color: '#fff', letterSpacing: '-.1px' }}>{t('proposals.new')}</button>
        </div>
      </div>

      {proposals.length === 0 && !showForm && (
        <div style={{ background: 'rgba(0,122,255,.04)', borderRadius: 14, padding: 16, border: '1px solid rgba(0,122,255,.08)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#007AFF' }}>{t('proposals.flow')}</span>
          {FLOW_KEYS.map((k, i) => (
            <span key={k} style={{ fontSize: 12, color: '#86868B' }}>
              {FLOW_ICONS[k]} {t(`proposals.flowSteps.${i}`)}{i < FLOW_KEYS.length - 1 ? ' →' : ''}
            </span>
          ))}
        </div>
      )}

      {showForm && <ProposalForm clients={clients} toast={toast} onDone={() => { setShowForm(false); fetchAll(); }} />}

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#AEAEB2' }}>{t('shared.loading')}</div>}

      {!loading && proposals.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: 48, background: '#fff', borderRadius: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: 15, fontWeight: 700 }}>{t('proposals.noProposals')}</p>
          <p style={{ fontSize: 13, color: '#86868B', marginBottom: 16, whiteSpace: 'pre-line' }}>{t('proposals.noProposalsHint')}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {proposals.map(p => {
          const step = currentStep(p.status);
          return (
            <div key={p.id} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.04)', opacity: p.status === 'declined' ? .6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.2px', marginBottom: 2 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: '#86868B' }}>
                    {p.client_name ? `👤 ${p.client_name}` : `⚠️ ${t('proposals.clientUnspecified')}`}
                    {p.client_email ? ` · ${p.client_email}` : ''}
                    {p.packages && Array.isArray(p.packages) && p.packages.length > 0 && (
                      <span style={{ marginLeft: 8, fontWeight: 600, color: '#007AFF' }}>
                        {p.packages.length} package{p.packages.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <span style={{ marginLeft: 8 }}>{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {p.status === 'draft' && (
                    <button onClick={() => handleShare(p)} style={actionBtn('#007AFF')}>📤 {t('proposals.send')}</button>
                  )}
                  {(p.status === 'sent' || p.status === 'viewed' || p.status === 'accepted') && (
                    <button onClick={() => handleCopyLink(p)} style={actionBtn('#34C759')}>📋 {t('proposals.copyLink')}</button>
                  )}
                </div>
              </div>

              {/* Status flow bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {FLOW_KEYS.map((k, i) => (
                  <div key={k} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: i <= step ? (p.status === 'declined' ? '#FF3B30' : p.status === 'accepted' ? '#34C759' : '#007AFF') : '#E5E5EA',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: i <= step ? '#fff' : '#AEAEB2', flexShrink: 0,
                    }}>{i < step ? '✓' : FLOW_ICONS[k]}</div>
                    {i < FLOW_KEYS.length - 1 && (
                      <div style={{ flex: 1, height: 2, minWidth: 8, background: i < step ? (p.status === 'declined' ? '#FF3B30' : '#34C759') : '#E5E5EA' }} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', marginTop: 4 }}>
                {FLOW_KEYS.map((k, i) => (
                  <div key={k} style={{ flex: 1, fontSize: 9, color: i <= step ? '#1D1D1F' : '#AEAEB2', fontWeight: i === step ? 700 : 400, textAlign: 'center' }}>
                    {t(`proposals.flowSteps.${i}`)}
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

interface PackageItem { name: string; price: string; includes: string; }

function ProposalForm({ clients, toast, onDone }: { clients: Client[]; toast: (msg: string, type?: 'success' | 'error' | 'info') => void; onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ title: '', clientId: '' });
  const [packages, setPackages] = useState<PackageItem[]>([
    { name: 'Platinum', price: '4500', includes: 'Full day + 2 photographers + Album + 200 edits' },
    { name: 'Gold', price: '2800', includes: '6 hours + 1 photographer + 100 edits' },
  ]);
  const [contractTerms, setContractTerms] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const selectedClient = clients.find(c => c.id === form.clientId);

  const addPackage = () => setPackages(p => [...p, { name: '', price: '', includes: '' }]);
  const removePackage = (i: number) => setPackages(p => p.filter((_, j) => j !== i));
  const updatePackage = (i: number, f: Partial<PackageItem>) => setPackages(p => p.map((pkg, j) => j === i ? { ...pkg, ...f } : pkg));

  const goNext = () => {
    if (!form.title.trim()) { toast('Please enter a proposal title', 'error'); return; }
    if (!packages.some(p => p.name.trim() && p.price)) { toast('Add at least one package with name and price', 'error'); return; }
    setStep(2);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const pkgData = packages.filter(p => p.name.trim() && p.price).map(p => ({
        name: p.name, price: Number(p.price),
        includes: p.includes.split(/[,+]/).map(s => s.trim()).filter(Boolean),
      }));
      const pricing: Record<string, number> = {};
      pkgData.forEach(p => { pricing[p.name] = p.price; });
      const data = await api.post<{ id: string; shareToken: string }>('/api/proposals', {
        title: form.title, clientId: form.clientId || null,
        packages: pkgData, pricing, contractTerms,
      });
      toast(t('proposals.created'), 'success');
      if (data.shareToken) {
        const url = `${window.location.origin}/sage/portal/proposal/${data.shareToken}`;
        navigator.clipboard?.writeText(url).then(() => toast(t('proposals.linkCopied'), 'info'));
      }
      onDone();
    } catch { toast(t('proposals.networkErr'), 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, letterSpacing: '-.1px' }}>{step === 1 ? '① Packages' : '② Contract & Send'}</div>
      {step === 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Client</label>
            <select value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))} style={selectStyle}>
              <option value="">— Select client —</option>
              {clients.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <Field label="Proposal Title *" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))}
            placeholder={selectedClient ? `${selectedClient.name} Photography` : 'Wedding Photography Package'} />

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Package Options</label>
              <button onClick={addPackage} style={{ padding: '4px 12px', borderRadius: 8, border: '1px dashed rgba(0,0,0,.15)', background: 'none', fontSize: 12, cursor: 'pointer', color: '#007AFF' }}>+ Add Package</button>
            </div>
            {packages.map((pkg, i) => (
              <div key={i} style={{ background: 'rgba(0,0,0,.02)', borderRadius: 10, padding: 12, marginBottom: 8, position: 'relative' }}>
                {packages.length > 1 && (
                  <button onClick={() => removePackage(i)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#FF3B30', cursor: 'pointer', fontSize: 14 }}>✕</button>
                )}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={pkg.name} onChange={e => updatePackage(i, { name: e.target.value })} placeholder="Package name" style={{ flex: 2, ...inp }} />
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: 9, color: '#86868B', fontSize: 13 }}>$</span>
                    <input value={pkg.price} onChange={e => updatePackage(i, { price: e.target.value })} placeholder="Price" type="number" style={{ ...inp, paddingLeft: 22 }} />
                  </div>
                </div>
                <input value={pkg.includes} onChange={e => updatePackage(i, { includes: e.target.value })}
                  placeholder="What's included? (comma separated)  e.g. Full day, 2 photographers, Album"
                  style={inp} />
              </div>
            ))}
          </div>

          <button onClick={goNext} style={primaryBtn}>Next →</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Contract Terms (optional)</label>
            <textarea value={contractTerms} onChange={e => setContractTerms(e.target.value)}
              placeholder="1. 50% retainer confirms the date.\n2. 25% due on shoot day.\n3. 25% due before delivery."
              rows={6} style={{ ...inp, resize: 'vertical' }} />
          </div>

          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(0,0,0,.02)', fontSize: 13, lineHeight: 2 }}>
            <div><strong>Proposal:</strong> {form.title || '(untitled)'}</div>
            <div><strong>Client:</strong> {selectedClient?.name || 'None'}</div>
            <div><strong>Packages:</strong></div>
            {packages.filter(p => p.name.trim()).map((p, i) => (
              <div key={i} style={{ paddingLeft: 12, fontSize: 12 }}>• {p.name} — ${Number(p.price).toLocaleString()}</div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(1)} style={secondaryBtn}>← Back</button>
            <button onClick={handleSubmit} disabled={submitting} style={{ ...primaryBtn, flex: 2, background: submitting ? '#AEAEB2' : '#34C759' }}>
              {submitting ? 'Creating…' : '✅ Create Proposal'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return <div style={{ flex: 1 }}><label style={labelStyle}>{label}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} /></div>;
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#86868B', marginBottom: 4, letterSpacing: '.2px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'rgba(0,0,0,.02)' };
const inp: React.CSSProperties = inputStyle;
const selectStyle: React.CSSProperties = { ...inputStyle };
const primaryBtn: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: 14, border: 'none', background: '#007AFF', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const secondaryBtn: React.CSSProperties = { flex: 1, padding: '12px', borderRadius: 14, border: '1px solid rgba(0,0,0,.1)', background: '#fff', color: '#1D1D1F', fontSize: 14, fontWeight: 500, cursor: 'pointer' };
const actionBtn = (color: string): React.CSSProperties => ({ padding: '6px 14px', borderRadius: 8, border: 'none', background: color + '14', color, fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '-.1px' });
