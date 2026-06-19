import { useState, useEffect } from 'react';
import { useDemo } from '../components/Layout';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useI18n } from '../i18n';

interface SetupStatus {
  ai: { configured: boolean }; stripe: { configured: boolean };
  email: { connected: boolean; email?: string; autoReply?: boolean };
  setupComplete: boolean;
}

export default function Settings() {
  const { demo, toggleDemo } = useDemo();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const { user } = useUser();
  const { toast } = useToast();
  const { lang, setLang } = useI18n();
  const [autoReply, setAutoReply] = useState(true);
  const [toggles, setToggles] = useState({ desktopNotif: true, sound: false });
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (demo) {
      setStatus({ ai: { configured: false }, stripe: { configured: false }, email: { connected: false }, setupComplete: false });
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

  // Platform services — managed by StudioSage, visible to customer as status
  const platformServices = [
    {
      key: 'ai', icon: '🤖', label: 'AI Assistant',
      desc: status?.ai?.configured
        ? 'Smart classification, auto-replies, and proposal generation are active.'
        : 'AI features are being set up. Offline mode active in the meantime.',
      active: status?.ai?.configured,
      activeLabel: 'Active', inactiveLabel: 'Offline Mode',
    },
    {
      key: 'subscription', icon: '💳', label: 'Subscription',
      desc: status?.stripe?.configured
        ? 'Manage your StudioSage plan and billing.'
        : 'Stripe is being configured.',
      active: status?.stripe?.configured,
      activeLabel: 'Active', inactiveLabel: 'Setup Required',
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

      {/* Profile */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: '-.1px' }}>{lang === 'zh' ? '个人资料' : 'Profile'}</h3>
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#86868B', marginBottom: 4 }}>{lang === 'zh' ? '姓名' : 'Name'}</label>
              <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#86868B', marginBottom: 4 }}>Email</label>
              <input value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <button onClick={async () => {
            setProfileSaving(true);
            try { await api.patch('/api/auth/profile', { name: profile.name, email: profile.email }); toast(lang === 'zh' ? '资料已更新' : 'Profile updated', 'success'); }
            catch (err: any) { toast(err.message || 'Failed', 'error'); }
            finally { setProfileSaving(false); }
          }} disabled={profileSaving}
            style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: profileSaving ? '#AEAEB2' : '#007AFF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
            {profileSaving ? 'Saving…' : (lang === 'zh' ? '保存' : 'Save')}
          </button>
          <div style={{ borderTop: '1px solid rgba(0,0,0,.06)', paddingTop: 12, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#86868B', marginBottom: 4 }}>{lang === 'zh' ? '当前密码' : 'Current Password'}</label>
              <input type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#86868B', marginBottom: 4 }}>{lang === 'zh' ? '新密码' : 'New Password'}</label>
              <input type="password" value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={async () => {
              try { await api.post('/api/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.newPw }); toast(lang === 'zh' ? '密码已更改' : 'Password changed', 'success'); setPwForm({ current: '', newPw: '' }); }
              catch (err: any) { toast(err.message || 'Failed', 'error'); }
            }} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', background: '#fff', color: '#1D1D1F', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {lang === 'zh' ? '修改密码' : 'Change'}
            </button>
          </div>
        </div>
      </div>

      {/* Customer connection — email is the only thing customer configures */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: '-.1px' }}>{lang === 'zh' ? '你的连接' : 'Your Connection'}</h3>
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 28, flexShrink: 0 }}>📧</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Work Email</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                background: status?.email?.connected ? 'rgba(52,199,89,.1)' : 'rgba(255,149,0,.1)',
                color: status?.email?.connected ? '#34C759' : '#FF9500',
              }}>
                {status?.email?.connected
                  ? (lang === 'zh' ? '● 已连接' : '● Connected')
                  : (lang === 'zh' ? '○ 未连接' : '○ Not Connected')}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#86868B' }}>
              {status?.email?.connected
                ? `${status.email.email} · AI monitoring every 60s`
                : 'Connect your work email to enable AI auto-classification and replies.'}
            </div>
          </div>
          <button onClick={() => navigate('/connect')} style={{
            padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            background: status?.email?.connected ? 'rgba(0,122,255,.06)' : '#007AFF',
            color: status?.email?.connected ? '#007AFF' : '#fff',
            border: 'none', cursor: 'pointer',
          }}>
            {status?.email?.connected ? (lang === 'zh' ? '管理' : 'Manage') : (lang === 'zh' ? '连接' : 'Connect')}
          </button>
        </div>
      </div>

      {/* Platform services — managed by StudioSage, status-only for customer */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: '-.1px' }}>{lang === 'zh' ? '平台服务' : 'Platform Services'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {platformServices.map(svc => (
            <div key={svc.key} style={{
              background: '#fff', borderRadius: 14, padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,.04)',
              display: 'flex', alignItems: 'center', gap: 16,
              opacity: svc.active ? 1 : .7,
            }}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>{svc.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{svc.label}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                    background: svc.active ? 'rgba(52,199,89,.1)' : 'rgba(142,142,147,.1)',
                    color: svc.active ? '#34C759' : '#8E8E93',
                  }}>
                    {svc.active ? svc.activeLabel : svc.inactiveLabel}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#86868B' }}>{svc.desc}</div>
              </div>
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
