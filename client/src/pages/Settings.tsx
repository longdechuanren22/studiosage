import { useState, useEffect } from 'react';
import { useDemo } from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useI18n } from '../i18n';

interface SetupStatus {
  ai: { configured: boolean }; pixieset: { configured: boolean };
  google: { configured: boolean }; stripe: { configured: boolean };
  email: { connected: boolean; email?: string }; setupComplete: boolean;
}

export default function Settings() {
  const { demo, toggleDemo } = useDemo();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const { lang, setLang } = useI18n();
  const [toggles, setToggles] = useState({ autoReply: true, desktopNotif: true, sound: false });

  useEffect(() => {
    if (demo) {
      setStatus({ ai: { configured: false }, pixieset: { configured: false }, google: { configured: false }, stripe: { configured: false }, email: { connected: false }, setupComplete: false });
      return;
    }
    api.get('/api/settings').then(setStatus).catch(() => setStatus(null));
  }, [demo]);

  const handleLangSwitch = (l: 'en' | 'zh') => setLang(l);

  const toggleStyle = (on: boolean) => ({
    width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
    background: on ? '#34C759' : 'rgba(0,0,0,.15)', position: 'relative' as const,
    transition: 'background .2s', flexShrink: 0,
  });

  const dotStyle = (on: boolean) => ({
    position: 'absolute' as const, top: 2, width: 18, height: 18, borderRadius: '50%',
    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
    left: on ? 20 : 2, transition: 'left .2s',
  });

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>Settings</h2>
        <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>Configure your StudioSage workspace.</p>
      </div>

      {/* Plan */}
      <Section title="Plan">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Pro Assistant</div>
            <div style={{ fontSize: 13, color: '#86868B' }}>14-day free trial · No credit card required</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#007AFF' }}>$10<span style={{ fontSize: 14, fontWeight: 500, color: '#86868B' }}>/mo</span></div>
            <div style={{ fontSize: 11, color: '#86868B' }}>$96/yr · $8/mo</div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 12, color: '#86868B', flexWrap: 'wrap' }}>
          <span>✓ AI Auto-Reply</span><span>✓ Photo Invoices</span><span>✓ Client Pipeline</span><span>✓ Unlimited Messages</span>
        </div>
        <button style={{ marginTop: 12, padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', background: '#007AFF', color: '#fff', cursor: 'pointer' }}>
          Start 14-Day Free Trial
        </button>
      </Section>

      {/* Language */}
      <Section title="Language">
        <div style={{ display: 'flex', gap: 10 }}>
          {(['en', 'zh'] as const).map(l => (
            <button key={l} onClick={() => handleLangSwitch(l)} style={{
              padding: '8px 20px', borderRadius: 10, border: '1px solid',
              borderColor: lang === l ? '#007AFF' : 'rgba(0,0,0,.1)',
              background: lang === l ? '#007AFF' : '#fff',
              color: lang === l ? '#fff' : '#1D1D1F',
              fontSize: 13, fontWeight: lang === l ? 600 : 400, cursor: 'pointer',
            }}>
              {l === 'en' ? '🇺🇸 English' : '🇨🇳 中文'}
            </button>
          ))}
        </div>
      </Section>

      {/* Connections */}
      <Section title="Connections">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <ConnRow icon="📧" label="Work Email" status={status?.email} detail={status?.email?.connected ? status.email.email : undefined} onClick={() => navigate('/connect')} />
          <ConnRow icon="🤖" label="AI Engine (DeepSeek)" status={status?.ai} last={false} />
          <ConnRow icon="💳" label="Stripe Payments" status={status?.stripe} last={false} />
          <ConnRow icon="🖼" label="Pixieset Gallery" status={status?.pixieset} last={false} />
          <ConnRow icon="📅" label="Google Calendar" status={status?.google} last={true} />
        </div>
      </Section>

      {/* Preferences */}
      <Section title="Preferences">
        <ToggleRow label="Auto-Reply" hint="AI drafts replies to common inquiries" on={toggles.autoReply} onChange={() => setToggles(p => ({ ...p, autoReply: !p.autoReply }))} />
        <ToggleRow label="Desktop Notifications" hint="Push alerts for urgent messages" on={toggles.desktopNotif} onChange={() => setToggles(p => ({ ...p, desktopNotif: !p.desktopNotif }))} />
        <ToggleRow label="Sound" hint="Play a sound on new messages" on={toggles.sound} onChange={() => setToggles(p => ({ ...p, sound: !p.sound }))} last />
      </Section>

      {/* Demo Mode */}
      <Section title="Developer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Demo Mode</div>
            <div style={{ fontSize: 12, color: '#86868B' }}>Preview StudioSage with sample data</div>
          </div>
          <button onClick={toggleDemo} style={toggleStyle(demo)}>
            <div style={dotStyle(demo)} />
          </button>
        </div>
      </Section>

      {!status?.setupComplete && (
        <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,149,0,.06)', border: '1px solid rgba(255,149,0,.12)', fontSize: 13, color: '#FF9500' }}>
          ⚡ Demo mode active — data is sample content. Connect real tools to switch to production.
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 12 }}>{title}</div>
      <div style={{ background: '#fff', borderRadius: 16, padding: '4px 0', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
        {children}
      </div>
    </div>
  );
}

function ConnRow({ icon, label, status, detail, last, onClick }: { icon: string; label: string; status?: { configured?: boolean; connected?: boolean }; detail?: string; last?: boolean; onClick?: () => void }) {
  const isConnected = status?.configured || status?.connected;
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
      borderBottom: last ? 'none' : '1px solid rgba(0,0,0,.04)',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        {detail && <div style={{ fontSize: 11, color: '#86868B' }}>{detail}</div>}
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
        background: isConnected ? 'rgba(52,199,89,.08)' : 'rgba(142,142,147,.08)',
        color: isConnected ? '#34C759' : '#8E8E93',
      }}>
        {isConnected ? '● Connected' : '○ Not connected'}
      </span>
      {onClick && <span style={{ color: '#AEAEB2', fontSize: 14 }}>→</span>}
    </div>
  );
}

function ToggleRow({ label, hint, on, onChange, last }: { label: string; hint: string; on: boolean; onChange: () => void; last?: boolean }) {
  return (
    <div onClick={onChange} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 16px', borderBottom: last ? 'none' : '1px solid rgba(0,0,0,.04)',
      cursor: 'pointer',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#86868B' }}>{hint}</div>
      </div>
      <button style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
        background: on ? '#34C759' : 'rgba(0,0,0,.15)', position: 'relative', transition: 'background .2s', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          left: on ? 20 : 2, transition: 'left .2s',
        }} />
      </button>
    </div>
  );
}
