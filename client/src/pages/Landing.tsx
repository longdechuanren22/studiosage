import { useNavigate } from 'react-router-dom';
import { t, translations, getLang } from '../i18n';

function landing() {
  const lang = getLang();
  return (translations[lang] as any).landing;
}

export default function Landing() {
  const navigate = useNavigate();
  const L = landing();

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #e8e6f0 0%, #f0eff5 20%, #f5f5f7 50%, #f0eef4 80%, #e4e2ec 100%)', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Hero */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '80px 20px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#007AFF', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 16 }}>{t('landing.hero.tagline')}</div>
        <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-1.5px', margin: '0 0 16px', color: '#1D1D1F', lineHeight: 1.15, whiteSpace: 'pre-line' }}>
          {t('landing.hero.title')}
        </h1>
        <p style={{ fontSize: 18, color: '#86868B', margin: '0 0 8px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {t('landing.hero.subtitle')}
        </p>
        <p style={{ fontSize: 14, color: '#AEAEB2', margin: '0 0 32px' }}>
          {t('landing.hero.subSubtitle')}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => navigate('/register')}
            style={{ padding: '14px 32px', borderRadius: 12, border: 'none', background: '#007AFF', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            {t('landing.hero.cta')}
          </button>
          <button onClick={() => navigate('/login')}
            style={{ padding: '14px 32px', borderRadius: 12, border: '1px solid #E5E5EA', background: '#fff', color: '#1D1D1F', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
            {t('landing.hero.signIn')}
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#AEAEB2', marginTop: 12 }}>{t('landing.hero.trialHint')}</p>
      </div>

      {/* Pain → Solution */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {[
          { emoji: '🤖', title: t('landing.features.item1.title'), desc: t('landing.features.item1.desc'), color: '#007AFF' },
          { emoji: '🔒', title: t('landing.features.item2.title'), desc: t('landing.features.item2.desc'), color: '#FF3B30' },
          { emoji: '📸', title: t('landing.features.item3.title'), desc: t('landing.features.item3.desc'), color: '#34C759' },
          { emoji: '💰', title: t('landing.features.item4.title'), desc: t('landing.features.item4.desc'), color: '#5856D6' },
        ].map(item => (
          <div key={item.title} style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #F0F0F2' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{item.emoji}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', marginBottom: 6 }}>{item.title}</div>
            <div style={{ fontSize: 13, color: '#86868B', lineHeight: 1.5 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Pricing */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px 80px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 24, fontWeight: 700, marginBottom: 24 }}>{t('landing.pricing.title')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { planKey: 'free', highlight: false },
            { planKey: 'starter', highlight: false },
            { planKey: 'pro', highlight: true },
            { planKey: 'proAnnual', highlight: false },
          ].map(p => {
            const plan = L.pricing[p.planKey];
            return (
              <div key={p.planKey} style={{
                background: p.highlight ? '#1D1D1F' : '#fff',
                color: p.highlight ? '#fff' : '#1D1D1F',
                borderRadius: 14, padding: 20, border: p.highlight ? 'none' : '1px solid #F0F0F2',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{plan.name}</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>{plan.price}</div>
                {(plan.features as string[]).map((f: string) => (
                  <div key={f} style={{ fontSize: 12, color: p.highlight ? '#AEAEB2' : '#86868B', marginBottom: 6 }}>{f}</div>
                ))}
                {plan.sub && (
                  <div style={{ fontSize: 11, color: p.highlight ? '#86868B' : '#AEAEB2', marginTop: 8 }}>{plan.sub}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '20px', fontSize: 12, color: '#AEAEB2' }}>
        {t('landing.footer.copyright')}
      </div>
    </div>
  );
}
