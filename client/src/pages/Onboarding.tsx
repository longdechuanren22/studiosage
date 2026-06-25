import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../i18n';

const STEPS = [
  {
    icon: '📸',
    titleKey: 'onboarding.step1.title',
    descKey: 'onboarding.step1.desc',
    bullets: [
      { icon:'🧠', key: 'onboarding.step1.bullet1' },
      { icon:'📄', key: 'onboarding.step1.bullet2' },
      { icon:'📊', key: 'onboarding.step1.bullet3' },
    ],
  },
  {
    icon: '🔗',
    titleKey: 'onboarding.step2.title',
    descKey: 'onboarding.step2.desc',
    bullets: [
      { icon:'📧', key: 'onboarding.step2.bullet1' },
      { icon:'💳', key: 'onboarding.step2.bullet2' },
      { icon:'🎭', key: 'onboarding.step2.bullet3' },
    ],
  },
  {
    icon: '🚀',
    titleKey: 'onboarding.step3.title',
    descKey: 'onboarding.step3.desc',
    bullets: [
      { icon:'📥', key: 'onboarding.step3.bullet1' },
      { icon:'🔴', key: 'onboarding.step3.bullet2' },
      { icon:'📤', key: 'onboarding.step3.bullet3' },
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
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.4px', margin: '0 0 8px' }}>{t(s.titleKey)}</h2>
        <p style={{ fontSize: 14, color: '#86868B', lineHeight: 1.5, margin: 0 }}>{t(s.descKey)}</p>
      </div>

      {/* Bullets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        {s.bullets.map((b, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.04)',
          }}>
            <span style={{ fontSize: 22 }}>{b.icon}</span>
            <span style={{ fontSize: 13, color: '#1D1D1F', letterSpacing: '-.1px', lineHeight: 1.4 }}>{t(b.key)}</span>
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
              {t('onboarding.continue')}
            </button>
            <button onClick={() => navigate('/')} style={{
              width: '100%', padding: '12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              background: 'transparent', color: '#86868B', border: 'none', cursor: 'pointer',
            }}>
              {t('onboarding.skip')}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/')} style={{
              width: '100%', padding: '14px', borderRadius: 20, fontSize: 15, fontWeight: 700,
              background: '#007AFF', color: '#fff', border: 'none', cursor: 'pointer',
              letterSpacing: '-.2px',
            }}>
              {t('onboarding.enterDashboard')}
            </button>
            <button onClick={() => navigate('/connect')} style={{
              width: '100%', padding: '12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              background: 'rgba(0,0,0,.03)', color: '#007AFF', border: 'none', cursor: 'pointer',
            }}>
              {t('onboarding.connectTools')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
