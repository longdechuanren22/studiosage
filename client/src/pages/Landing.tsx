import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #e8e6f0 0%, #f0eff5 20%, #f5f5f7 50%, #f0eef4 80%, #e4e2ec 100%)', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Hero */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '80px 20px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#007AFF', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 16 }}>AI-Powered Photography CRM</div>
        <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-1.5px', margin: '0 0 16px', color: '#1D1D1F', lineHeight: 1.15 }}>
          Your inbox runs itself.<br />Your revisions stop there.
        </h1>
        <p style={{ fontSize: 18, color: '#86868B', margin: '0 0 8px', lineHeight: 1.6 }}>
          AI auto-replies to client emails, builds profiles from conversations,<br />
          and blocks vague "make it better" revision requests — before they start.
        </p>
        <p style={{ fontSize: 14, color: '#AEAEB2', margin: '0 0 32px' }}>
          The only tool that handles email AND delivery. Half the price of HoneyBook.
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
          { emoji: '🤖', title: 'AI Auto-Replies', desc: 'Inbox reads itself. AI classifies client emails, drafts replies, extracts dates and budgets. You review, approve, send. Never type "how much?" again.', color: '#007AFF' },
          { emoji: '🔒', title: 'AI Revision Guard', desc: 'Clients must describe revisions specifically. "Make it better" gets blocked. "Brighten the background, remove the tree on left" goes through. Unlimited revision loops end here.', color: '#FF3B30' },
          { emoji: '📸', title: 'Selection + Delivery', desc: 'Upload proofs → client picks favorites → you edit → deliver for review. One link. No 47 messages. Overdue auto-advances.', color: '#34C759' },
          { emoji: '💰', title: 'Polite Payment Reminders', desc: 'AI generates payment messages that sound like you, not a debt collector. Three tones: friendly reminder, gentle nudge, professional request.', color: '#5856D6' },
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
            { name: 'Starter', price: '$9/mo', features: ['5 active projects', '5,000 photos', 'AI auto-replies'], sub: 'For part-time pros' },
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
