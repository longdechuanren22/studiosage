import { useState, useEffect } from 'react';
import { useDemo } from '../components/Layout';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useI18n } from '../i18n';
import { logError } from '../utils/error';

interface PlanInfo {
  plan: string; planName: string;
  limits: { projects: number; photos: number };
  usage: { projects: number; photos: number };
  hasAI: boolean;
  stripeSubscriptionId: string | null;
}

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
  const { lang, setLang, t, tf } = useI18n();
  const [autoReply, setAutoReply] = useState(true);
  const [toggles, setToggles] = useState(() => ({
    desktopNotif: localStorage.getItem('studiosage_desktop_notif') !== '0',
    sound: localStorage.getItem('studiosage_sound') === '1',
  }));
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  // Check for Stripe checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      toast('Subscription activated! 🎉', 'success');
      window.history.replaceState({}, '', '/sage/settings');
    } else if (params.get('checkout') === 'cancelled') {
      toast('Upgrade cancelled — your current plan is unchanged', 'info');
      window.history.replaceState({}, '', '/sage/settings');
    }
  }, []);

  useEffect(() => {
    if (demo) {
      setStatus({ ai: { configured: false }, stripe: { configured: false }, email: { connected: false }, setupComplete: false });
      setPlanInfo(null);
      return;
    }
    api.get<SetupStatus>('/api/settings').then(s => {
      setStatus(s);
      if (s.email?.autoReply !== undefined) setAutoReply(s.email.autoReply);
    }).catch((err) => { logError('Settings.fetchStatus', err); setStatus(null); });
    api.get<PlanInfo>('/api/billing/plan').then(setPlanInfo).catch(() => {});
  }, [demo]);

  const handleAutoReplyToggle = async () => {
    const next = !autoReply;
    setAutoReply(next);
    try { await api.patch('/api/settings/auto-reply', { enabled: next }); } catch { /* best effort */ }
  };

  const updateToggle = (key: string, value: boolean) => {
    setToggles(p => ({ ...p, [key]: value }));
    localStorage.setItem(`studiosage_${key}`, value ? '1' : '0');
  };

  // Platform services — live status from API
  const platformServices = [
    {
      key: 'ai', icon: '🤖', label: 'AI Engine',
      desc: status?.ai?.configured
        ? (status.ai.model === 'offline'
          ? `Offline mode — ${status.ai.providers?.claude ? 'Claude' : ''}${status.ai.providers?.claude && status.ai.providers?.deepseek ? ' + ' : ''}${status.ai.providers?.deepseek ? 'DeepSeek' : ''} configured, using offline rules`
          : `Online — ${status.ai.model || 'AI'} active`)
        : t('settings.aiDescInactive'),
      active: status?.ai?.configured && status?.ai?.model !== 'offline',
      activeLabel: 'Online', inactiveLabel: status?.ai?.configured ? 'Offline' : t('settings.setupRequired'),
    },
    {
      key: 'subscription', icon: '💳', label: 'Stripe',
      desc: planInfo
        ? `${planInfo.planName} plan · ${planInfo.usage.projects}/${planInfo.limits.projects === Infinity ? '∞' : planInfo.limits.projects} projects · ${planInfo.usage.photos}/${planInfo.limits.photos === Infinity ? '∞' : planInfo.limits.photos} photos${planInfo.hasAI ? ' · AI included' : ' · AI not included'}`
        : (status?.stripe?.configured ? 'Stripe connected' : 'Stripe not configured'),
      active: status?.stripe?.configured,
      activeLabel: t('settings.connected'), inactiveLabel: t('settings.notConnected'),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>{t('settings.title')}</h2>
          <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>{t('settings.subtitle')}</p>
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
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {planInfo ? planInfo.planName : t('settings.plan.title')}
            </div>
            <div style={{ fontSize: 13, color: '#86868B', marginTop: 2 }}>
              {planInfo && planInfo.plan !== 'trial'
                ? `Projects: ${planInfo.usage.projects} / ${planInfo.limits.projects === Infinity ? '∞' : planInfo.limits.projects} · Photos: ${planInfo.usage.photos} / ${planInfo.limits.photos === Infinity ? '∞' : planInfo.limits.photos}`
                : t('settings.plan.trial')
              }
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#86868B', flexWrap: 'wrap' }}>
              <span>✓ {planInfo?.hasAI ? 'AI Auto-Reply' : 'Manual Classification'}</span>
              <span>✓ Stripe Payments</span>
              <span>✓ Email Integration</span>
              <span>✓ Client Pipeline</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {planInfo ? (
              <>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#007AFF' }}>
                  {planInfo.plan === 'trial' ? '$0' : planInfo.plan === 'starter' ? '$9' : planInfo.plan === 'pro_annual' ? '$15' : '$19'}
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#86868B' }}>/mo</span>
                </div>
                {planInfo.plan !== 'pro_annual' && (
                  <div style={{ fontSize: 12, color: '#86868B' }}>{t('settings.plan.yearly')}</div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#007AFF' }}>$10<span style={{ fontSize: 15, fontWeight: 500, color: '#86868B' }}>/mo</span></div>
                <div style={{ fontSize: 12, color: '#86868B' }}>{t('settings.plan.yearly')}</div>
              </>
            )}
          </div>
        </div>
        <button onClick={() => navigate('/plans')} style={{
          marginTop: 12, width: '100%', padding: '8px', borderRadius: 10,
          background: '#007AFF', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          {planInfo?.plan === 'trial' ? 'Upgrade Plan →' : 'Manage Plan →'}
        </button>
      </div>

      {/* Profile */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: '-.1px' }}>{t('settings.profile')}</h3>
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#86868B', marginBottom: 4 }}>{t('settings.profileName')}</label>
              <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#86868B', marginBottom: 4 }}>{t('settings.profileEmail')}</label>
              <input value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <button onClick={async () => {
            setProfileSaving(true);
            try { await api.patch('/api/auth/profile', { name: profile.name, email: profile.email }); toast(t('settings.profileUpdated'), 'success'); }
            catch (err: any) { toast(err.message || 'Failed', 'error'); }
            finally { setProfileSaving(false); }
          }} disabled={profileSaving}
            style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: profileSaving ? '#AEAEB2' : '#007AFF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
            {profileSaving ? t('settings.saving') : t('settings.save')}
          </button>
          <div style={{ borderTop: '1px solid rgba(0,0,0,.06)', paddingTop: 12, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#86868B', marginBottom: 4 }}>{t('settings.currentPassword')}</label>
              <input type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#86868B', marginBottom: 4 }}>{t('settings.newPassword')}</label>
              <input type="password" value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={async () => {
              try { await api.post('/api/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.newPw }); toast(t('settings.passwordChanged'), 'success'); setPwForm({ current: '', newPw: '' }); }
              catch (err: any) { toast(err.message || 'Failed', 'error'); }
            }} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,.1)', background: '#fff', color: '#1D1D1F', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {t('settings.changePassword')}
            </button>
          </div>
        </div>
      </div>

      {/* Customer connection */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: '-.1px' }}>{t('settings.yourConnection')}</h3>
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 28, flexShrink: 0 }}>📧</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Work Email</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                background: status?.email?.connected ? 'rgba(52,199,89,.1)' : 'rgba(255,149,0,.1)',
                color: status?.email?.connected ? '#34C759' : '#FF9500',
              }}>
                {status?.email?.connected ? t('settings.connected') : t('settings.notConnected')}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#86868B' }}>
              {status?.email?.connected
                ? tf('settings.connectedEmailDesc', { email: status.email.email || '' })
                : t('settings.notConnectedDesc')}
            </div>
          </div>
          <button onClick={() => navigate('/connect')} style={{
            padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            background: status?.email?.connected ? 'rgba(0,122,255,.06)' : '#007AFF',
            color: status?.email?.connected ? '#007AFF' : '#fff',
            border: 'none', cursor: 'pointer',
          }}>
            {status?.email?.connected ? t('settings.manage') : t('settings.connectBtn')}
          </button>
        </div>
      </div>

      {/* Platform services */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: '-.1px' }}>{t('settings.platformServices')}</h3>
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
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: '-.1px' }}>{t('settings.preferences')}</h3>
        <div style={{ background: '#fff', borderRadius: 14, padding: '4px 0', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <PrefRow
            label={t('settings.toggles.autoReply')}
            hint={t('settings.toggles.autoReplyHint')}
            on={autoReply} onChange={handleAutoReplyToggle}
          />
          <PrefRow
            label={t('settings.toggles.desktopNotif')}
            hint={t('settings.toggles.desktopNotifHint')}
            on={toggles.desktopNotif} onChange={() => updateToggle('desktopNotif', !toggles.desktopNotif)}
          />
          <PrefRow
            label={t('settings.toggles.sound')}
            hint={t('settings.toggles.soundHint')}
            on={toggles.sound} onChange={() => updateToggle('sound', !toggles.sound)} last
          />
        </div>
      </div>

      {/* Language */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: '-.1px' }}>{t('settings.language')}</h3>
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
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: '-.1px' }}>{t('settings.developer')}</h3>
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t('settings.demoMode')}</div>
            <div style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>{t('settings.demoModeDesc')}</div>
          </div>
          <button onClick={toggleDemo} style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: demo ? '#34C759' : 'rgba(0,0,0,.15)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', left: demo ? 21 : 3, transition: 'left .2s' }} />
          </button>
        </div>
      </div>

      {!status?.setupComplete && (
        <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,149,0,.06)', border: '1px solid rgba(255,149,0,.12)', fontSize: 13, color: '#FF9500' }}>
          ⚡ {t('settings.demoHintDesc')}
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
      <div style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: on ? '#34C759' : 'rgba(0,0,0,.15)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', left: on ? 21 : 3, transition: 'left .2s' }} />
      </div>
    </div>
  );
}
