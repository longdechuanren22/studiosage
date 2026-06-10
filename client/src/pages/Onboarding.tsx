import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  {
    icon: '📸', title: '欢迎使用 StudioSage', titleEn: 'Welcome to StudioSage',
    desc: '你的 AI 摄影助手。叠在你现有工具之上，不替换任何一个。',
    descEn: 'Your AI photography assistant. Layers on top of your existing tools.',
    bullets: [
      { icon:'🧠', text:'AI 自动分类消息 · 识别客户阶段 · 草拟回复', textEn:'AI classifies messages by client stage and drafts replies' },
      { icon:'📄', text:'自动生成摄影专用发票 · retainer + 三期付款', textEn:'Auto-generates photo invoices with retainer + 3-phase payment' },
      { icon:'📊', text:'客户管线可视化 · 一眼知道每个客户在哪个阶段', textEn:'Visual pipeline — know every client\'s stage at a glance' },
    ],
  },
  {
    icon: '🔗', title: '连接你的工具', titleEn: 'Connect Your Tools',
    desc: 'StudioSage 读取你的 Gmail 和 Stripe，不做新的收件箱。',
    descEn: 'StudioSage reads your Gmail and Stripe. No new inbox to check.',
    bullets: [
      { icon:'📧', text:'连接 Gmail → 自动导入客户消息', textEn:'Connect Gmail → auto-import client messages' },
      { icon:'💳', text:'连接 Stripe → 发票 + 收款自动追踪', textEn:'Connect Stripe → auto-track invoices + payments' },
      { icon:'🎭', text:'或先用演示模式体验 → 稍后连接', textEn:'Or try demo mode first → connect later' },
    ],
  },
  {
    icon: '🚀', title: '开始使用', titleEn: 'You\'re Ready',
    desc: 'AI 已在后台工作。你只需要审核和发送。',
    descEn: 'AI is already working. You just review and send.',
    bullets: [
      { icon:'📥', text:'新消息自动出现在收件箱 · 带 AI 建议回复', textEn:'New messages appear in Inbox with AI suggestions' },
      { icon:'🔴', text:'紧急消息优先标记 · 附带分类依据', textEn:'Urgent messages flagged with reasoning' },
      { icon:'📤', text:'一键发送 · 已发送自动追踪', textEn:'One-tap send with delivery tracking' },
    ],
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const s = STEPS[step];

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', paddingTop: 24 }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 24 : 8, height: 8, borderRadius: 4,
            background: i <= step ? '#007AFF' : 'rgba(0,0,0,.1)',
            transition: 'all .3s cubic-bezier(.4,0,.2,1)',
          }} />
        ))}
      </div>

      {/* Content */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{s.icon}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.4px', margin: '0 0 8px' }}>{s.title}</h2>
        <p style={{ fontSize: 14, color: '#86868B', lineHeight: 1.5, margin: 0 }}>{s.desc}</p>
      </div>

      {/* Bullets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        {s.bullets.map((b, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.04)',
          }}>
            <span style={{ fontSize: 22 }}>{b.icon}</span>
            <span style={{ fontSize: 13, color: '#1D1D1F', letterSpacing: '-.1px', lineHeight: 1.4 }}>{b.text}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {step < 2 ? (
          <>
            <button onClick={() => setStep(step + 1)} style={{
              width: '100%', padding: '14px', borderRadius: 20, fontSize: 15, fontWeight: 700,
              background: '#007AFF', color: '#fff', border: 'none', cursor: 'pointer',
              letterSpacing: '-.2px',
            }}>
              继续
            </button>
            <button onClick={() => navigate('/')} style={{
              width: '100%', padding: '12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              background: 'transparent', color: '#86868B', border: 'none', cursor: 'pointer',
            }}>
              跳过，直接看演示 →
            </button>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/')} style={{
              width: '100%', padding: '14px', borderRadius: 20, fontSize: 15, fontWeight: 700,
              background: '#007AFF', color: '#fff', border: 'none', cursor: 'pointer',
              letterSpacing: '-.2px',
            }}>
              进入面板
            </button>
            <button onClick={() => navigate('/connect')} style={{
              width: '100%', padding: '12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              background: 'rgba(0,0,0,.03)', color: '#007AFF', border: 'none', cursor: 'pointer',
            }}>
              连接真实工具 →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
