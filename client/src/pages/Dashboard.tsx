import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useDemo } from '../components/Layout';
import { api } from '../utils/api';
import { t, tf } from '../i18n';

interface DashboardData {
  stats: { pendingClients: number; newMessages: number; urgentCount: number; activeProjects: number; revenueThisMonth: number; };
  pipeline: Record<string, number>;
  recentActivity: { client_id: string; client_name: string; stage: string; type: string; pending: number; needsAction: boolean; actionLabel: string; pending_proposals: number; unpaid_invoices: number; last_subject: string; last_message_at: string; last_msg_status: string; client_updated_at: string; }[];
}

const pipelineStages = ['inquiry', 'engaged', 'booked', 'shooting', 'production', 'delivered'];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useUser();
  const { demo } = useDemo();
  const displayName = user?.name || 'friend';

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15000);
    return () => clearInterval(t);
  }, []);

  const fetchData = async () => {
    try { const res = await api.get<DashboardData>('/api/dashboard'); setData(res); } catch {}
    setLoading(false);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#AEAEB2' }}>{t('shared.loading')}</div>;

  const d = data;
  const totalInPipeline = d ? Object.values(d.pipeline).reduce((a, b) => a + b, 0) : 0;
  const maxPipeline = d ? Math.max(...Object.values(d.pipeline), 1) : 1;

  const attentionItems: { label: string; count: number; nav: string; color: string; detail: string }[] = [];
  if (d) {
    if (d.stats.urgentCount > 0) attentionItems.push({ label: `${d.stats.urgentCount} ${t('dash.urgent')}`, count: d.stats.urgentCount, nav: '/clients', color: '#FF3B30', detail: t('dash.needImmediate') });
    if (d.stats.pendingClients > 0) attentionItems.push({ label: `${d.stats.pendingClients} ${t('dash.pendingClients')}`, count: d.stats.pendingClients, nav: '/clients', color: '#FF9500', detail: t('dash.needReply') });
    if (d.stats.newMessages > 0 && d.stats.urgentCount === 0 && d.stats.pendingClients === 0) attentionItems.push({ label: `${d.stats.newMessages} ${t('dash.newMessages')}`, count: d.stats.newMessages, nav: '/clients', color: '#007AFF', detail: t('dash.viewNewMessages') });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>{greeting()}, {displayName}</h2>
        <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>
          {!d ? t('dash.connectPrompt') :
            attentionItems.length > 0 ? attentionItems.map(a => a.label).join(' · ') :
            d.stats.activeProjects > 0 ? `${d.stats.activeProjects} ${t('dash.activeProjects')} · ${t('dash.emptyState')}` :
            t('dash.emptyState')}
        </p>
      </div>

      {(!d || totalInPipeline === 0) && (
        <div onClick={() => navigate('/connect')} style={connectBannerStyle}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📬</div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.1px', marginBottom: 4 }}>{t('dash.connectPrompt')}</div>
          <div style={{ fontSize: 12, color: '#86868B' }}>{t('dash.connectFlow')}</div>
        </div>
      )}

      {attentionItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {attentionItems.map(item => (
            <button key={item.label} onClick={() => navigate(item.nav)} style={alertItemStyle}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: item.color + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {item.color === '#FF3B30' ? '🔴' : item.color === '#FF9500' ? '📨' : '✉️'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.1px' }}>{item.label}</div>
                <div style={{ fontSize: 12, color: '#86868B' }}>{item.detail}</div>
              </div>
              <span style={{ color: '#AEAEB2', fontSize: 14 }}>→</span>
            </button>
          ))}
        </div>
      )}

      {d && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          <StatCard value={d.stats.pendingClients} label={t('dash.pendingReply')} color={d.stats.pendingClients > 0 ? '#FF9500' : '#AEAEB2'} onClick={() => navigate('/clients')} />
          <StatCard value={d.stats.activeProjects} label={t('dash.activeProjects')} color="#007AFF" onClick={() => navigate('/clients')} />
          <StatCard value={d.stats.newMessages} label={t('dash.newMsgs')} color={d.stats.newMessages > 0 ? '#007AFF' : '#AEAEB2'} onClick={() => navigate('/clients')} />
          <StatCard value={d.stats.revenueThisMonth > 0 ? `$${d.stats.revenueThisMonth.toLocaleString()}` : '$0'} label={t('dash.revenueMonth')} color={d.stats.revenueThisMonth > 0 ? '#34C759' : '#AEAEB2'} onClick={() => navigate('/invoices')} />
        </div>
      )}

      {d && totalInPipeline > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F', marginBottom: 12, letterSpacing: '-.1px' }}>
            📊 {t('dash.pipeline')} — {tf('dash.pipelineClients', { clients: totalInPipeline })}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            {pipelineStages.map(stage => {
              const count = d.pipeline[stage] || 0;
              const height = Math.max(4, (count / maxPipeline) * 80);
              return (
                <button key={stage} onClick={() => navigate('/clients')} style={{ flex: 1, textAlign: 'center', border: 'none', background: 'none', cursor: count > 0 ? 'pointer' : 'default', padding: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: count > 0 ? '#1D1D1F' : '#C7C7CC' }}>{count}</div>
                  <div style={{ height, borderRadius: '6px 6px 0 0', background: count > 0 ? stage === 'delivered' ? 'rgba(52,199,89,.35)' : 'rgba(0,122,255,.5)' : 'rgba(0,0,0,.05)' }} />
                  <div style={{ fontSize: 10, color: '#AEAEB2', marginTop: 6 }}>{t(`dash.stage.${stage}`)}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {d && d.recentActivity.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F', marginBottom: 10, letterSpacing: '-.1px' }}>
            🕐 {t('dash.recentActivity')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.recentActivity.map((item, i) => {
              const isPending = item.pending > 0;
              const isReplied = item.last_msg_status === 'replied';
              const actionColor = isPending ? '#FF9500' : isReplied ? '#34C759' : '#007AFF';
              const actionIcon = isPending ? '📨' : isReplied ? '✅' : '💬';
              const actionText = isPending ? `${item.pending} pending` : isReplied ? 'Replied' : 'Active';
              return (
              <button key={item.client_id} onClick={() => navigate(`/clients?open=${item.client_id}`)} style={clientRowStyle}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: `hsl(${i * 50 + 200}, 50%, 55%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>
                  {item.client_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.1px', marginBottom: 2 }}>
                    {item.client_name}
                    {item.type && <span style={{ fontSize: 10, fontWeight: 500, marginLeft: 6, padding: '2px 6px', borderRadius: 6, background: 'rgba(175,82,222,.08)', color: '#AF52DE' }}>{item.type}</span>}
                    <span style={{ fontSize: 10, fontWeight: 500, marginLeft: 6, padding: '2px 6px', borderRadius: 6, background: actionColor + '14', color: actionColor }}>{actionIcon} {actionText}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#86868B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.last_subject || '(no subject)'}
                    <span style={{ color: '#AEAEB2', marginLeft: 8 }}>{timeAgo(item.last_message_at)}</span>
                  </div>
                </div>
                {item.unpaid_invoices > 0 && <span style={{ background: '#FF3B30', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 6, flexShrink: 0 }}>${item.unpaid_invoices} unpaid</span>}
                <span style={{ color: '#AEAEB2', fontSize: 14, flexShrink: 0 }}>→</span>
              </button>
              );
            })}
          </div>
        </div>
      )}

      {d && d.recentActivity.length === 0 && totalInPipeline === 0 && (
        <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', marginBottom: 4 }}>{t('dash.noClients')}</p>
          <p style={{ fontSize: 12, color: '#AEAEB2', marginBottom: 16 }}>{t('dash.noClientsHint')}</p>
          <button onClick={() => navigate('/connect')} style={{ padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', background: '#007AFF', color: '#fff', cursor: 'pointer' }}>{t('dash.connectEmail')}</button>
        </div>
      )}

      {d && (
        <div style={{ display: 'flex', gap: 10 }}>
          <QuickBtn icon="➕" label={t('dash.addClient')} onClick={() => navigate('/clients')} />
          <QuickBtn icon="📬" label={t('dash.connectEmail')} onClick={() => navigate('/connect')} />
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label, color, onClick }: { value: string | number; label: string; color: string; onClick?: () => void }) {
  return <button onClick={onClick} style={{ background: '#fff', borderRadius: 14, padding: '14px 10px', textAlign: 'center', border: 'none', cursor: onClick ? 'pointer' : 'default', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
    <div style={{ fontSize: typeof value === 'number' ? 28 : 18, fontWeight: 800, letterSpacing: '-.3px', color, marginBottom: 2 }}>{value}</div>
    <div style={{ fontSize: 11, fontWeight: 600, color: '#1D1D1F' }}>{label}</div>
  </button>;
}

function QuickBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return <button onClick={onClick} style={{ flex: 1, padding: '12px', borderRadius: 14, fontSize: 13, fontWeight: 600, border: '.5px solid rgba(0,0,0,.06)', background: '#fff', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><span>{icon}</span> {label}</button>;
}

function greeting(): string {
  const h = new Date().getHours();
  return t(`dash.greeting.${h < 12 ? 1 : h < 18 ? 2 : 3}`);
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

const connectBannerStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(0,122,255,.08), rgba(88,86,214,.06))', borderRadius: 16, padding: 24, cursor: 'pointer', border: '1px dashed rgba(0,122,255,.2)', textAlign: 'center',
};
const alertItemStyle: React.CSSProperties = {
  width: '100%', background: '#fff', borderRadius: 14, padding: '14px 16px', border: 'none', cursor: 'pointer', textAlign: 'left' as const, boxShadow: '0 1px 3px rgba(0,0,0,.04)', display: 'flex', alignItems: 'center', gap: 12,
};
const clientRowStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', textAlign: 'left' as const, boxShadow: '0 1px 3px rgba(0,0,0,.04)',
};
