import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { t } from '../i18n';

interface ProviderInfo {
  key: string; name: string; helpUrl: string; setupGuide: string;
  needsAppPassword: boolean; oauthAvailable: boolean;
}

interface DetectResult {
  provider: ProviderInfo | null;
  imapHost: string; imapPort: number; smtpHost: string; smtpPort: number;
}

type Step = 'start' | 'oauth' | 'authcode' | 'password' | 'done';

export default function Connect() {
  const [status, setStatus] = useState<Record<string, any>>({});
  const [step, setStep] = useState<Step>('start');
  const [email, setEmail] = useState('');
  const [credential, setCredential] = useState('');
  const [detected, setDetected] = useState<DetectResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/settings').then((s: any) => {
      setStatus(s);
      if (s.email?.connected) setStep('done');
    });
  }, []);

  const handleDetect = async (overrideEmail?: string) => {
    const targetEmail = overrideEmail || email;
    if (!targetEmail.includes('@')) return;
    if (!overrideEmail) setEmail(targetEmail);
    const data = await api.post('/api/email/detect', { email: targetEmail });
    setDetected(data);

    // Smart routing based on provider
    const p = data.provider;
    if (p?.oauthAvailable) {
      setStep('oauth');
    } else if (p?.needsAppPassword) {
      setStep('authcode');  // QQ/163/Yahoo → skip password, go straight to auth code
    } else {
      setStep('password');  // Custom IMAP → try password
    }
    setError('');
    setCredential('');
  };

  // Shared connect logic
  const doConnect = async (password: string) => {
    if (!detected) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/api/email/connect', {
        email, password,
        imapHost: detected.imapHost, imapPort: detected.imapPort,
        smtpHost: detected.smtpHost, smtpPort: detected.smtpPort,
      });
      if (data.ok) {
        setStep('done');
      } else {
        setError(data.error || '连接失败');
      }
    } catch {
      setError('网络错误，请确认邮箱地址和授权码正确');
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    await api.post('/api/email/disconnect');
    setStep('start'); setEmail(''); setCredential(''); setDetected(null); setError('');
  };

  const providerEmoji = (key?: string) => {
    switch (key) { case 'gmail': return '📧'; case '163': case '126': return '🔴'; case 'qq': return '🐧'; case 'outlook': return '📬'; case 'yahoo': return '🟣'; default: return '📬'; }
  };

  const providerColor = (key?: string) => {
    switch (key) { case 'gmail': return '#EA4335'; case 'outlook': return '#0078D4'; case 'qq': return '#12B7F5'; case '163': return '#D32F2F'; default: return '#007AFF'; }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 10, border: '.5px solid rgba(0,0,0,.1)',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };

  const btnStyle = (enabled: boolean): React.CSSProperties => ({
    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
    background: enabled ? '#007AFF' : '#E5E5EA',
    color: enabled ? '#fff' : '#AEAEB2', fontSize: 15, fontWeight: 600,
    cursor: enabled ? 'pointer' : 'default',
  });

  // ── Step 1: Enter email ──
  if (step === 'start') {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📬</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px', margin: '0 0 4px' }}>{t('connect.title')}</h2>
          <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>{t('connect.subtitle')}</p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>{t('connect.emailLabel')}</label>
          <input type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && email.includes('@') && handleDetect()}
            placeholder="you@company.com" style={inputStyle} autoFocus
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#86868B', marginBottom: 8 }}>{t('connect.supported')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {quickProviders.map(qp => (
              <button key={qp.domain} onClick={() => { setEmail(qp.sample); handleDetect(qp.sample); }}
                style={{
                  padding: '8px 12px', borderRadius: 8, border: '.5px solid rgba(0,0,0,.06)',
                  background: '#fff', cursor: 'pointer', textAlign: 'left',
                  fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <span>{qp.icon}</span> {qp.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => handleDetect()} disabled={!email.includes('@')} style={btnStyle(email.includes('@'))}>
          {t('connect.next')}
        </button>

        {status.email?.connected && <ConnectedBanner email={status.email.email} onDisconnect={handleDisconnect} />}
      </div>
    );
  }

  // ── Step: OAuth (Gmail / Outlook) ──
  if (step === 'oauth' && detected?.provider) {
    const p = detected.provider;
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 16px' }}>
        <BackBtn onClick={() => setStep('start')} />
        <ProviderHeader {...{p, email, providerEmoji, providerColor}} />

        <div style={cardStyle}>
          <p style={{ fontSize: 14, color: '#1D1D1F', lineHeight: 1.6, marginBottom: 16 }}>
            {t('connect.oauth').replace('{provider}', p.name)}
          </p>

          <button disabled style={{ ...btnStyle(true), background: providerColor(p.key) }}>
            🚧 {t('connect.oauthDev')}
          </button>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '.5px solid rgba(0,0,0,.06)', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#AEAEB2', marginBottom: 8 }}>
              {t('connect.oauthFallback')}
            </p>
            <button onClick={() => setStep('authcode')} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {t('connect.useAppPassword')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Auth Code (QQ / 163 / Yahoo / fallback from OAuth) ──
  if (step === 'authcode' && detected?.provider) {
    const p = detected.provider;
    const steps = (p.setupGuide || '').split('\n').filter(s => s.trim());

    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 16px' }}>
        <BackBtn onClick={() => setStep('start')} />
        <ProviderHeader {...{p, email, providerEmoji, providerColor}} />

        <div style={cardStyle}>
          {/* Instructions */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t('connect.howTo')}</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#86868B', lineHeight: 2 }}>
              {steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            {p.helpUrl && (
              <a href={p.helpUrl} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-block', marginTop: 12, padding: '8px 16px', borderRadius: 8,
                background: 'rgba(0,122,255,.06)', color: '#007AFF', fontSize: 12, fontWeight: 600,
                textDecoration: 'none',
              }}>
                {t('connect.openSettings').replace('{provider}', p.name)}
              </a>
            )}
          </div>

          {/* Auth code input */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{t('connect.pasteCode')}</label>
            <input type="text" value={credential}
              onChange={e => setCredential(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && credential.length >= 6 && doConnect(credential)}
              placeholder={t('connect.codePlaceholder')} style={inputStyle} autoFocus
            />
            <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 4 }}>
              {t('connect.codeHint')}
            </div>
          </div>

          {error && <ErrorBox msg={error} />}

          <button onClick={() => doConnect(credential)}
            disabled={credential.length < 6 || loading}
            style={btnStyle(credential.length >= 6 && !loading)}>
            {loading ? t('connect.connecting') : t('connect.connect')}
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Password (Custom IMAP / SMTP) ──
  if (step === 'password' && detected) {
    const isCustom = !detected.provider || detected.provider.key === 'custom';
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 16px' }}>
        <BackBtn onClick={() => setStep('start')} />

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,122,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              {isCustom ? '🔧' : providerEmoji(detected.provider?.key)}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{isCustom ? t('connect.customTitle') : detected.provider?.name}</div>
              <div style={{ fontSize: 12, color: '#86868B' }}>{email}</div>
            </div>
          </div>

          {isCustom && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'rgba(0,122,255,.04)', fontSize: 12, color: '#86868B', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, color: '#1D1D1F', marginBottom: 4 }}>{t('connect.customConfig')}</div>
              {t('connect.imapSmtp').replace('{host}', detected.imapHost || '(unknown)').replace('{port}', String(detected.imapPort)).replace('{host2}', detected.smtpHost || '(unknown)').replace('{port2}', String(detected.smtpPort))}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{isCustom ? t('connect.passwordCustom') : t('connect.passwordLabel').replace('{provider}', detected.provider?.name || 'Email')}</label>
            <input type="password" value={credential}
              onChange={e => setCredential(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && credential && doConnect(credential)}
              placeholder={t('connect.passwordPlaceholder')}
              style={inputStyle} autoFocus
            />
          </div>

          {error && <ErrorBox msg={error} />}

          <button onClick={() => doConnect(credential)} disabled={!credential || loading}
            style={btnStyle(!!credential && !loading)}>
            {loading ? t('connect.connecting') : t('connect.connect')}
          </button>

          {error && (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <button onClick={() => setStep('authcode')}
                style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: 12, cursor: 'pointer' }}>
                {t('connect.wrongPassword')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Done ──
  if (step === 'done') {
    const connectedEmail = status.email?.email || email;
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>{t('connect.done.title')}</h2>
        <p style={{ fontSize: 14, color: '#86868B', margin: '0 0 24px', whiteSpace: 'pre-line' }}>
          {t('connect.done.desc').replace('{email}', connectedEmail)}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <a href="/" style={{ padding: '10px 24px', borderRadius: 12, background: '#007AFF', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            {t('connect.done.dashboard')}
          </a>
          <button onClick={handleDisconnect} style={{ padding: '10px 24px', borderRadius: 12, border: '.5px solid rgba(0,0,0,.1)', background: '#fff', color: '#FF3B30', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {t('connect.disconnect')}
          </button>
        </div>

        {/* Other integrations */}
        <div style={{ marginTop: 40, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#86868B', marginBottom: 12, letterSpacing: '.5px', textTransform: 'uppercase' }}>{t('connect.otherIntegrations')}</div>
          {otherIntegrations.map(item => (
            <div key={item.key} style={{
              background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 1px 2px rgba(0,0,0,.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: '#AEAEB2' }}>{item.desc}</div>
                </div>
              </div>
              <span style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 8, fontWeight: 600,
                background: status[item.key]?.configured ? 'rgba(52,199,89,.08)' : 'rgba(0,122,255,.06)',
                color: status[item.key]?.configured ? '#34C759' : '#007AFF',
              }}>
                {status[item.key]?.configured ? t('settings.tools.connected') : t('settings.tools.notConnected')}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

/* ── Sub-components ── */

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16 }}>
      {t('shared.back')}
    </button>
  );
}

function ProviderHeader({ p, email, providerEmoji, providerColor }: { p: any; email: string; providerEmoji: (k?: string) => string; providerColor: (k?: string) => string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: providerColor(p.key) + '14',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
      }}>
        {providerEmoji(p.key)}
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{p.name}</div>
        <div style={{ fontSize: 12, color: '#86868B' }}>{email}</div>
      </div>
    </div>
  );
}

function ConnectedBanner({ email, onDisconnect }: { email: string; onDisconnect: () => void }) {
  return (
    <div style={{ marginTop: 24, padding: 16, background: 'rgba(52,199,89,.06)', borderRadius: 12, border: '.5px solid rgba(52,199,89,.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span>✅</span><span style={{ fontSize: 14, fontWeight: 600 }}>{email}</span>
      </div>
      <p style={{ fontSize: 12, color: '#86868B', margin: 0 }}>{t('connect.connected')}</p>
      <button onClick={onDisconnect} style={{ marginTop: 8, background: 'none', border: 'none', color: '#FF3B30', fontSize: 12, cursor: 'pointer', padding: 0 }}>{t('connect.disconnect')}</button>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: 'rgba(255,59,48,.06)', border: '.5px solid rgba(255,59,48,.12)', fontSize: 13, color: '#FF3B30', lineHeight: 1.5 }}>
      {msg}
    </div>
  );
}

/* ── Data ── */

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#86868B',
  textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6, display: 'block',
};

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.04)',
};

const quickProviders = [
  { domain: 'gmail.com', sample: 'you@gmail.com', label: 'Gmail', icon: '📧' },
  { domain: 'outlook.com', sample: 'you@outlook.com', label: 'Outlook', icon: '📬' },
  { domain: 'qq.com', sample: 'you@qq.com', label: 'QQ邮箱', icon: '🐧' },
  { domain: '163.com', sample: 'you@163.com', label: '163邮箱', icon: '🔴' },
  { domain: 'yahoo.com', sample: 'you@yahoo.com', label: 'Yahoo', icon: '🟣' },
  { domain: 'aliyun.com', sample: 'you@aliyun.com', label: '阿里邮箱', icon: '☁️' },
];

const otherIntegrations = [
  { key: 'ai', icon: '🤖', label: 'AI 引擎', desc: 'DeepSeek / Claude' },
  { key: 'stripe', icon: '💳', label: 'Stripe', desc: '在线收款 + 发票' },
];
