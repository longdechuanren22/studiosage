import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #e8e6f0 0%, #f0eff5 20%, #f5f5f7 50%, #f0eef4 80%, #e4e2ec 100%)', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Hero */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '80px 20px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1px', margin: '0 0 12px', color: '#1D1D1F' }}>
          Stop chasing revisions.<br />Start delivering.
        </h1>
        <p style={{ fontSize: 18, color: '#86868B', margin: '0 0 32px', lineHeight: 1.6 }}>
          The first AI-powered photo delivery tool built for photographers<br />
          who are tired of "make it warmer → too warm → go back."
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => navigate('/register')}
            style={{ padding: '14px 32px', borderRadius: 12, border: 'none', background: '#007AFF', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            Start Free Trial
          </button>
          <button onClick={() => navigate('/login')}
            style={{ padding: '14px 32px', borderRadius: 12, border: '1px solid #E5E5EA', background: '#fff', color: '#1D1D1F', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
            Sign In
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#AEAEB2', marginTop: 12 }}>14-day free trial · No credit card required</p>
      </div>

      {/* Pain → Solution */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {[
          { emoji: '🔄', title: 'Revision Hell', desc: 'AI blocks vague "make it better" requests. Clients must describe EXACTLY what they want.', color: '#FF3B30' },
          { emoji: '💬', title: 'WeChat/Email Chaos', desc: 'One link. Client selects, marks revisions, approves. No more 47 message threads.', color: '#FF9500' },
          { emoji: '💰', title: 'Awkward Payment Chasing', desc: 'Auto-generates polite payment reminders. Never sound like a debt collector again.', color: '#5856D6' },
          { emoji: '📅', title: 'Schedule Crashes', desc: 'Hard deadlines. Auto-advance on overdue. Your calendar doesn\'t wait on client indecision.', color: '#007AFF' },
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
        <h2 style={{ textAlign: 'center', fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Simple Pricing</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { name: 'Free', price: '$0', features: ['1 active project', '500 photos', 'Basic workflow'] },
            { name: 'Pro', price: '$19/mo', features: ['Unlimited projects', 'Unlimited photos', 'AI revision guard', 'Payment reminders', 'Email support'], highlight: true },
            { name: 'Pro Annual', price: '$15/mo', features: ['Everything in Pro', 'Billed $180/year', 'Save $48', 'Priority support'], sub: 'Best value' },
          ].map(p => (
            <div key={p.name} style={{
              background: p.highlight ? '#1D1D1F' : '#fff',
              color: p.highlight ? '#fff' : '#1D1D1F',
              borderRadius: 14, padding: 20, border: p.highlight ? 'none' : '1px solid #F0F0F2',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>{p.price}</div>
              {p.features.map(f => (
                <div key={f} style={{ fontSize: 12, color: p.highlight ? '#AEAEB2' : '#86868B', marginBottom: 6 }}>{f}</div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '20px', fontSize: 12, color: '#AEAEB2' }}>
        © 2026 StudioSage · Built for photographers who want to shoot, not admin.
      </div>
    </div>
  );
}
