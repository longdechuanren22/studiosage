import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { api } from '../utils/api';

interface DashboardData {
  stats: {
    pendingClients: number; newMessages: number; urgentCount: number;
    activeProjects: number; revenueThisMonth: number;
  };
  pipeline: Record<string, number>;
  recentActivity: {
    client_id: string; client_name: string; stage: string;
    last_subject: string; last_message_at: string; pending: number;
  }[];
}

const stageNames: Record<string, string> = {
  inquiry: '新咨询', engaged: '沟通中', booked: '已预定',
  shooting: '拍摄中', production: '后期中', delivered: '已交付',
};
const pipelineStages = ['inquiry', 'engaged', 'booked', 'shooting', 'production', 'delivered'];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useUser();
  const displayName = user?.name || 'Emma';

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get<DashboardData>('/api/dashboard');
      setData(res);
    } catch { /* offline */ }
    setLoading(false);
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#AEAEB2' }}>加载中…</div>;
  }

  const d = data;
  const totalInPipeline = d ? Object.values(d.pipeline).reduce((a, b) => a + b, 0) : 0;
  const maxPipeline = d ? Math.max(...Object.values(d.pipeline), 1) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>
          {greeting()}, {displayName}
        </h2>
        <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>
          {!d ? '连接邮箱后自动显示业务总览' :
            d.stats.pendingClients > 0
              ? `${d.stats.pendingClients} 个客户待处理 · ${d.stats.newMessages} 条新消息${
                  d.stats.urgentCount > 0 ? ` · ${d.stats.urgentCount} 条紧急` : ''}`
              : d.stats.activeProjects > 0
                ? `${d.stats.activeProjects} 个进行中项目 · ${totalInPipeline} 个客户`
                : '暂无待处理事项 ✓'}
        </p>
      </div>

      {/* Email not connected prompt */}
      {!d && (
        <a href="/connect" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,122,255,.08), rgba(88,86,214,.06))',
            borderRadius: 16, padding: 24, cursor: 'pointer',
            border: '1px dashed rgba(0,122,255,.2)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📬</div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.1px', marginBottom: 4 }}>连接你的工作邮箱</div>
            <div style={{ fontSize: 12, color: '#86868B' }}>连接后 AI 自动读取邮件、分类客户、起草回复</div>
          </div>
        </a>
      )}

      {/* Stats row — client-centric */}
      {d && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          <StatCard
            value={d.stats.pendingClients}
            label="待处理客户"
            color={d.stats.pendingClients > 0 ? '#FF3B30' : '#AEAEB2'}
          />
          <StatCard
            value={d.stats.newMessages}
            label="新消息"
            color={d.stats.newMessages > 0 ? '#FF9500' : '#AEAEB2'}
          />
          <StatCard
            value={d.stats.activeProjects}
            label="进行中"
            color="#007AFF"
          />
          <StatCard
            value={`¥${(d.stats.revenueThisMonth || 0).toLocaleString()}`}
            label="本月收入"
            color={d.stats.revenueThisMonth > 0 ? '#34C759' : '#AEAEB2'}
          />
        </div>
      )}

      {/* Pipeline bar */}
      {d && totalInPipeline > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F', marginBottom: 12, letterSpacing: '-.1px' }}>
            📊 业务阶段
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            {pipelineStages.map(stage => {
              const count = d.pipeline[stage] || 0;
              const height = Math.max(4, (count / maxPipeline) * 80);
              return (
                <div key={stage} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: stage === 'delivered' ? '#34C759' : '#1D1D1F' }}>
                    {count}
                  </div>
                  <div style={{
                    height, borderRadius: '6px 6px 0 0',
                    background: stage === 'delivered' ? 'rgba(52,199,89,.3)'
                      : stage === 'inquiry' ? 'rgba(0,122,255,.25)'
                      : 'rgba(0,122,255,.5)',
                  }} />
                  <div style={{ fontSize: 10, color: '#AEAEB2', marginTop: 6 }}>{stageNames[stage]}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      {d && (
        <div style={{ display: 'flex', gap: 10 }}>
          <QuickBtn icon="➕" label="新建客户" onClick={() => navigate('/clients')} />
          <QuickBtn icon="📬" label="连接邮箱" onClick={() => navigate('/connect')} />
        </div>
      )}

      {/* Recent client activity */}
      {d && d.recentActivity.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F', marginBottom: 10, letterSpacing: '-.1px' }}>
            🕐 最近客户动态
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.recentActivity.map((item, i) => (
              <button
                key={item.client_id}
                onClick={() => navigate(`/clients?open=${item.client_id}`)}
                style={{
                  background: '#fff', borderRadius: 14, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  boxShadow: '0 1px 3px rgba(0,0,0,.04)',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `hsl(${i * 50}, 60%, 55%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
                }}>
                  {item.client_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, letterSpacing: '-.1px' }}>
                    {item.client_name}
                    <span style={{
                      fontSize: 10, fontWeight: 500, marginLeft: 8, padding: '1px 6px', borderRadius: 6,
                      background: 'rgba(0,122,255,.06)', color: '#007AFF',
                    }}>
                      {stageNames[item.stage] || item.stage}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#86868B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.last_subject || '(无主题)'}
                    <span style={{ color: '#AEAEB2', marginLeft: 8 }}>{timeAgo(item.last_message_at)}</span>
                  </div>
                </div>
                {item.pending > 0 && (
                  <span style={{
                    background: '#FF3B30', color: '#fff', fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 10, flexShrink: 0,
                  }}>
                    {item.pending}
                  </span>
                )}
                <span style={{ color: '#AEAEB2', fontSize: 14, flexShrink: 0 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {d && d.recentActivity.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', marginBottom: 4 }}>暂无客户动态</p>
          <p style={{ fontSize: 12, color: '#AEAEB2', marginBottom: 16 }}>连接邮箱后，AI 会自动创建客户并分类消息</p>
          <button
            onClick={() => navigate('/connect')}
            style={{
              padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              border: 'none', background: '#007AFF', color: '#fff', cursor: 'pointer',
            }}
          >
            连接邮箱 →
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Components ── */

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '14px 10px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize: typeof value === 'number' ? 28 : 18, fontWeight: 800, letterSpacing: '-.3px', color, marginBottom: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#1D1D1F' }}>{label}</div>
    </div>
  );
}

function QuickBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '12px', borderRadius: 14, fontSize: 13, fontWeight: 600,
        border: '.5px solid rgba(0,0,0,.06)', background: '#fff', cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,.03)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: 6,
      }}
    >
      <span>{icon}</span> {label}
    </button>
  );
}

/* ── Helpers ── */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return '刚刚';
  if (sec < 3600) return `${Math.floor(sec / 60)}分钟前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}小时前`;
  return `${Math.floor(sec / 86400)}天前`;
}
