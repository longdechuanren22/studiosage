import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function ForgotPassword() {
  const { t, tf } = useI18n();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError(t('auth.forgotFillEmail')); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.ok) setSent(true);
      else setError(data.error || t('auth.forgotSomethingWrong'));
    } catch { setError(t('auth.forgotNetworkError')); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #e8e6f0 0%, #f0eff5 20%, #f5f5f7 50%, #f0eef4 80%, #e4e2ec 100%)',
      padding: 20, fontFamily: '-apple-system, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px', background: 'linear-gradient(135deg, #007AFF, #5856D6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', fontWeight: 700 }}>S</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.3px', margin: 0, color: '#1D1D1F' }}>{t('auth.forgotTitle')}</h1>
          <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>{sent ? t('auth.forgotSent') : t('auth.forgotSubtitle')}</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,.72)', borderRadius: 20, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
            <p style={{ fontSize: 14, color: '#1D1D1F', marginBottom: 16 }}>{tf('auth.forgotSentHint', { email })}</p>
            <Link to="/login" style={{ color: '#007AFF', fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>{t('auth.forgotBack')}</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(24px)', borderRadius: 20, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,.04), 0 4px 20px rgba(0,0,0,.06)' }}>
            {error && <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, background: 'rgba(255,59,48,.08)', color: '#FF3B30', fontSize: 13 }}>{error}</div>}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#86868B', marginBottom: 6 }}>{t('auth.email')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('auth.forgotEmailPlaceholder')} autoFocus
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,.1)', fontSize: 15, outline: 'none', boxSizing: 'border-box', background: 'rgba(0,0,0,.02)' }} />
            </div>
            <button type="submit" disabled={submitting} style={{ width: '100%', padding: '13px', borderRadius: 14, border: 'none', background: submitting ? '#AEAEB2' : '#007AFF', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              {submitting ? t('auth.forgotSending') : t('auth.forgotSendBtn')}
            </button>
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#86868B' }}>
              <Link to="/login" style={{ color: '#007AFF', fontWeight: 600, textDecoration: 'none' }}>{t('auth.forgotBack')}</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
