import { useState, useEffect } from 'react';
import { useDemo } from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useI18n } from '../i18n';

interface SetupStatus {
  ai: { configured: boolean }; pixieset: { configured: boolean };
  google: { configured: boolean }; stripe: { configured: boolean };
  email: { connected: boolean; email?: string; autoReply?: boolean };
  setupComplete: boolean;
}

export default function Settings() {
  const { demo, toggleDemo } = useDemo();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const { lang, setLang } = useI18n();
  const [autoReply, setAutoReply] = useState(true);
  const [toggles, setToggles] = useState({ desktopNotif: true, sound: false });

  useEffect(() => {
    if (demo) {
      setStatus({ ai: { configured: false }, pixieset: { configured: false }, google: { configured: false }, stripe: { configured: false }, email: { connected: false }, setupComplete: false });
      return;
    }
    api.get<SetupStatus>('/api/settings').then(s => {
      setStatus(s);
      if (s.email?.autoReply !== undefined) setAutoReply(s.email.autoReply);
    }).catch(() => setStatus(null));
  }, [demo]);

  const handleAutoReplyToggle = async () => {
    const next = !autoReply;
    setAutoReply(next);
    try { await api.patch('/api/settings/auto-reply', { enabled: next }); } catch {}
  };

  const connections = [
    {
      key: 'email', icon: '📧', label: 'Work Email',
      desc: 'AI reads emails, classifies clients, drafts replies',
      connected: status?.email?.connected,
      detail: status?.email?.email || '',
      action: 'Configure', actionLink: '/connect',
    },
    {
      key: 'ai', icon: '🤖', label: 'AI Engine (DeepSeek)',
      desc: 'Powers auto-classification, smart replies & proposal generation',
      connected: status?.ai?.configured,
      detail: status?.ai?.configured ? 'DEEPSEEK_API_KEY set' : 'Set DEEPSEEK_API_KEY in .env',
      action: status?.ai?.configured ? undefined : 'Setup Guide',
      actionLink: status?.ai?.configured ? undefined : 'https://platform.deepseek.com/api_keys',
    },
    {
      key: 'stripe', icon: '💳', label: 'Stripe Payments',
      desc: 'Online payments, invoices & automatic payment tracking',
      connected: status?.stripe?.configured,
      detail: status?.stripe?.configured ? 'STRIPE_SECRET_KEY set' : 'Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in .env',
      action: status?.stripe?.configured ? 'Stripe Dashboard' : 'Setup Guide',
      actionLink: status?.stripe?.configured ? 'https://dashboard.stripe.com' : 'https://docs.stripe.com/webhooks',
    },
    {
      key: 'pixieset', icon: '🖼', label: 'Pixieset Gallery',
      desc: 'Client gallery delivery, print sales & album proofing',
      connected: status?.pixieset?.configured,
      detail: status?.pixieset?.configured ? 'PIXIESET_API_KEY set' : 'Set PIXIESET_API_KEY in .env',
      action: 'Setup Guide',
      actionLink: 'https://pixieset.com/help/article/135-api-key/',
    },
    {
      key: 'google', icon: '📅', label: 'Google Calendar',
      desc: 'Sync shoots, appointments & availability. Auto-scheduling for clients.',
      connected: status?.google?.configured,
      detail: status?.google?.configured ? 'GOOGLE_CLIENT_ID + SECRET set' : 'Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env',
      action: 'Google Cloud Console',
      actionLink: 'https://console.cloud.google.com/apis/credentials',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>{lang === 'zh' ? '设置' : 'Settings'}</h2>
          <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>{lang === 'zh' ? '配置你的 StudioSage 工作区' : 'Configure your StudioSage workspace'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['en', 'zh'] as const).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: '6px 16px', borderRadius: 8, border: '1px solid',
              borderColor: lang === l ? '#007AFF' : 'rgba(0,0,0,.1)',
              background: lang === l ? '#007AFF' : '#fff',
              color: lang === l ? '#fff' : '#1D1D1F',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{l === 'en' ? 'EN' : '中文'}</button>
          ))}
        </div>
      </div>

      {/* Plan */}
      <div style={{ background: 'linear-gradient(135deg, rgba(0,122,255,.04), rgba(88,86,214,.04))', borderRadius: 16, padding: 24, border: '1px solid rgba(0,122,255,.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Pro Assistant</div>
            <div style={{ fontSize: 13, color: '#86868B', marginTop: 2 }}>{lang === 'zh' ? '14天免费试用 · 无需信用卡' : '14-day free trial · No credit card required'}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#86868B', flexWrap: 'wrap' }}>
              <span>✓ {lang === 'zh' ? 'AI自动分类+回复' : 'AI Auto-Reply'}</span>
              <span>✓ {lang === 'zh' ? '摄影专用发票' : 'Photo Invoices'}</span>
              <span>✓ {lang === 'zh' ? '客户管线' : 'Client Pipeline'}</span>
              <span>✓ {lang === 'zh' ? '无限消息' : 'Unlimited Messages'}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#007AFF' }}>$10<span style={{ fontSize: 15, fontWeight: 500, color: '#86868B' }}>/mo</span></div>
            <div style={{ fontSize: 12, color: '#86868B' }}>{lang === 'zh' ? '年付 $96 · $8/月' : 'Yearly $96 · $8/mo'}</div>
          </div>
        </div>
      </div>

      {/* Connections — main business tools */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: '-.1px' }}>{lang === 'zh' ? '业务连接' : 'Business Connections'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {connections.map(conn => (
            <div key={conn.key} style={{
              background: '#fff', borderRadius: 14, padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,.04)',
              display: 'flex', alignItems: 'center', gap: 16,
              opacity: conn.connected ? 1 : .85,
            }}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>{conn.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{conn.label}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                    background: conn.connected ? 'rgba(52,199,89,.1)' : 'rgba(142,142,147,.1)',
                    color: conn.connected ? '#34C759' : '#8E8E93',
                  }}>
                    {conn.connected ? (lang === 'zh' ? '● 已连接' : '● Connected') : (lang === 'zh' ? '○ 未连接' : '○ Not Connected')}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#86868B' }}>{conn.desc}</div>
                {conn.detail && <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 2 }}>{conn.detail}</div>}
              </div>
              {conn.action && conn.actionLink && (
                <a href={conn.actionLink} target="_blank" rel="noopener noreferrer" style={{
                  padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: conn.connected ? 'rgba(0,122,255,.06)' : '#007AFF',
                  color: conn.connected ? '#007AFF' : '#fff',
                  border: 'none', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
                }} onClick={e => { if (!conn.actionLink!.startsWith('http')) { e.preventDefault(); navigate(conn.actionLink!); } }}>
                  {conn.action}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Preferences */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: '-.1px' }}>{lang === 'zh' ? '偏好设置' : 'Preferences'}</h3>
        <div style={{ background: '#fff', borderRadius: 14, padding: '4px 0', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <PrefRow
            label={lang === 'zh' ? '自动回复' : 'Auto-Reply'}
            hint={lang === 'zh' ? 'AI自动处理客户邮件并发送回复' : 'AI automatically handles client emails and sends replies'}
            on={autoReply} onChange={handleAutoReplyToggle}
          />
          <PrefRow
            label={lang === 'zh' ? '桌面通知' : 'Desktop Notifications'}
            hint={lang === 'zh' ? '紧急消息时推送浏览器提醒' : 'Push browser alerts for urgent messages'}
            on={toggles.desktopNotif} onChange={() => setToggles(p => ({ ...p, desktopNotif: !p.desktopNotif }))}
          />
          <PrefRow
            label={lang === 'zh' ? '提示音' : 'Sound'}
            hint={lang === 'zh' ? '新消息时播放提示音' : 'Play a sound on new messages'}
            on={toggles.sound} onChange={() => setToggles(p => ({ ...p, sound: !p.sound }))} last
          />
        </div>
      </div>

      {/* Language */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: '-.1px' }}>{lang === 'zh' ? '语言 / Language' : 'Language'}</h3>
        <div style={{ background: '#fff', borderRadius: 14, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,.04)', display: 'flex', gap: 10 }}>
          {(['en', 'zh'] as const).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: '10px 24px', borderRadius: 10, border: '2px solid',
              borderColor: lang === l ? '#007AFF' : 'rgba(0,0,0,.08)',
              background: lang === l ? 'rgba(0,122,255,.06)' : '#fff',
              color: lang === l ? '#007AFF' : '#86868B',
              fontSize: 14, fontWeight: lang === l ? 700 : 500, cursor: 'pointer',
            }}>{l === 'en' ? '🇺🇸 English' : '🇨🇳 中文'}</button>
          ))}
        </div>
      </div>

      {/* Demo mode */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: '-.1px' }}>{lang === 'zh' ? '开发者' : 'Developer'}</h3>
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{lang === 'zh' ? '演示模式' : 'Demo Mode'}</div>
            <div style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>{lang === 'zh' ? '使用示例数据预览功能' : 'Preview StudioSage with sample data'}</div>
          </div>
          <button onClick={toggleDemo} style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: demo ? '#34C759' : 'rgba(0,0,0,.15)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', left: demo ? 21 : 3, transition: 'left .2s' }} />
          </button>
        </div>
      </div>

      {!status?.setupComplete && (
        <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,149,0,.06)', border: '1px solid rgba(255,149,0,.12)', fontSize: 13, color: '#FF9500' }}>
          ⚡ {lang === 'zh' ? '演示模式 — 数据为示例内容。连接真实工具后自动切换为生产模式。' : 'Demo mode — data is sample content. Connect real tools to switch to production.'}
        </div>
      )}
    </div>
  );
}

function PrefRow({ label, hint, on, onChange, last }: { label: string; hint: string; on: boolean; onChange: () => void; last?: boolean }) {
  return (
    <div onClick={onChange} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 20px', borderBottom: last ? 'none' : '1px solid rgba(0,0,0,.04)',
      cursor: 'pointer',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>{hint}</div>
      </div>
      <div style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: on ? '#34C759' : 'rgba(0,0,0,.15)', position: 'relative', transition: 'background .2s', flexShrink: 0 }} onClick={onChange}>
        <div style={{ position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', left: on ? 21 : 3, transition: 'left .2s' }} />
      </div>
    </div>
  );
}
