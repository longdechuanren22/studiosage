import { useState, useEffect } from 'react';
import { useDemo } from '../components/Layout';

interface DashboardData {
  today: { newMessages: number; autoReplied: number; urgent: number; pendingReview: number; draftInvoices: number; };
  clientsByStage: { stage: string; count: number }[];
}

const DEMO_DATA: DashboardData = {
  today: { newMessages: 3, autoReplied: 8, urgent: 1, pendingReview: 2, draftInvoices: 2 },
  clientsByStage: [
    { stage: 'inquiry', count: 4 }, { stage: 'booking', count: 3 }, { stage: 'pre_shoot', count: 2 },
    { stage: 'shoot_day', count: 1 }, { stage: 'editing', count: 5 }, { stage: 'delivery', count: 3 }, { stage: 'completed', count: 12 },
  ],
};

const stageLabels: Record<string, string> = {
  inquiry: '咨询', booking: '已定', pre_shoot: '拍前', shoot_day: '拍摄',
  editing: '修图', delivery: '交付', completed: '完成',
};

export default function Dashboard() {
  const { demo } = useDemo();
  const [data, setData] = useState<DashboardData | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (demo) { setData(DEMO_DATA); return; }
    fetch('/api/dashboard').then(r => r.json()).then(setData).catch(() => setData(DEMO_DATA));
  }, [demo]);

  if (!data) return <div className="text-center py-20" style={{ color: '#AEAEB2' }}>Loading...</div>;

  const { today } = data;

  const handleAction = (action: string) => {
    const messages: Record<string, string> = {
      sendUrgent: '✓ 已发送至 Sarah & Mike',
      sendNormal: '✓ 已发送至 David L.',
      manual: '👤 已标记为自己处理',
      seedDemo: '📩 演示数据已加载',
    };
    setMsg(messages[action] || '');
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Greeting */}
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0, color: '#1D1D1F' }}>早上好，Emma</h2>
        <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0', letterSpacing: '-.1px' }}>
          {today.newMessages === 0 ? '全部处理完毕 ✓' : `今日 ${today.newMessages} 条新消息，${today.urgent} 条紧急`}
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <StatCard value={today.newMessages} label="新消息" color="#007AFF" />
        <StatCard value={today.autoReplied} label="已回复" color="#34C759" />
        <StatCard value={today.urgent} label="紧急" color="#FF3B30" />
        <StatCard value={today.draftInvoices} label="发票" color="#FF9500" />
      </div>

      {/* Messages section */}
      {today.newMessages > 0 ? (
        <>
          {/* Urgent */}
          {today.urgent > 0 && (
            <>
              <SectionLabel>需要你处理</SectionLabel>
              <MessageCard urgent>
                <MsgHeader from="Sarah & Mike" stage="Wedding" time="2 分钟前" />
                <MsgBody>"Emma 你好！想问一下——婚礼当天可以多加 2 个小时吗？还有你们提供冲印服务吗？"</MsgBody>
                <AiBlock>
                  "Sarah & Mike，很高兴收到你们的消息！当然可以多加 2 小时，额外费用 $400。冲印 8×10 每张 $25 起。需要我把冲印目录发给你们吗？"
                </AiBlock>
                <div style={{ display: 'flex', gap: 8 }}>
                  <PillBtn primary onClick={() => handleAction('sendUrgent')}>发送回复</PillBtn>
                  <PillBtn onClick={() => setMsg('✏️ 编辑中...')}>编辑</PillBtn>
                  <PillBtn onClick={() => handleAction('manual')}>我自己回</PillBtn>
                </div>
              </MessageCard>
            </>
          )}

          {/* Normal */}
          <SectionLabel>待审核</SectionLabel>
          <MessageCard>
            <MsgHeader from="David L." stage="Portrait" time="1 小时前" />
            <MsgBody>"相册还要多久能好？"</MsgBody>
            <AiBlock>"David 你好，你的相册将在 2–3 周内准备好。要不要先给你发几张抢先看？"</AiBlock>
            <div style={{ display: 'flex', gap: 8 }}>
              <PillBtn primary onClick={() => handleAction('sendNormal')}>发送回复</PillBtn>
              <PillBtn onClick={() => setMsg('✏️ 编辑中...')}>编辑</PillBtn>
            </div>
          </MessageCard>

          {/* Auto-replied */}
          <SectionLabel>今日自动回复 · {today.autoReplied}</SectionLabel>
          <MessageCard muted>
            <MsgHeader from="Jennifer K." stage="Wedding" time="3 小时前" />
            <MsgBody>"照片好了吗？"</MsgBody>
            <div style={{ fontSize: 13, color: '#34C759', fontWeight: 500 }}>✓ 已自动回复："您的照片将在 3–5 个工作日内准备好……"</div>
          </MessageCard>
        </>
      ) : (
        /* Empty state */
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: 40, marginBottom: 8, opacity: .6 }}>📭</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F', marginBottom: 4 }}>还没有消息</p>
          <p style={{ fontSize: 13, color: '#86868B' }}>连接 Gmail 或加载演示数据开始体验</p>
        </div>
      )}

      {/* Toast */}
      {msg && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,.82)', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600, zIndex: 200, backdropFilter: 'blur(10px)' }}>
          {msg}
        </div>
      )}
    </div>
  );
}

// Sub-components
function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '16px 12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.04)', cursor: 'pointer' }}>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.3px', color, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#86868B' }}>{label}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '.6px' }}>{children}</div>;
}

function MessageCard({ children, urgent, muted }: { children: React.ReactNode; urgent?: boolean; muted?: boolean }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      borderLeft: urgent ? '3px solid #FF3B30' : '1px solid rgba(0,0,0,.04)',
      opacity: muted ? .5 : 1,
    }}>
      {children}
    </div>
  );
}

function MsgHeader({ from, stage, time }: { from: string; stage: string; time: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
      <div><span style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-.1px' }}>{from}</span><span style={{ fontSize: 11, fontWeight: 500, color: '#AEAEB2', marginLeft: 8 }}>{stage}</span></div>
      <span style={{ fontSize: 12, color: '#AEAEB2', whiteSpace: 'nowrap' }}>{time}</span>
    </div>
  );
}

function MsgBody({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: '#86868B', lineHeight: 1.6, marginBottom: 12 }}>{children}</p>;
}

function AiBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(0,122,255,.04)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'rgba(0,122,255,.9)', lineHeight: 1.5, marginBottom: 12, border: '.5px solid rgba(0,122,255,.08)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'rgba(0,122,255,.5)', marginBottom: 4 }}>AI 建议回复</div>
      {children}
    </div>
  );
}

function PillBtn({ children, primary, onClick }: { children: React.ReactNode; primary?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
        background: primary ? '#007AFF' : 'rgba(0,0,0,.04)', color: primary ? '#fff' : '#1D1D1F',
        letterSpacing: '-.1px', transition: 'all .12s',
      }}
    >
      {children}
    </button>
  );
}
