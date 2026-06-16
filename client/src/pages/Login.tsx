import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { t } from '../i18n';

export default function Login() {
  const { user, token, loading, login } = useUser();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && token && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError(t('auth.fillEmailPassword'));
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || t('auth.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #e8e6f0 0%, #f0eff5 20%, #f5f5f7 50%, #f0eef4 80%, #e4e2ec 100%)',
      padding: 20, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #007AFF, #5856D6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: '#fff', fontWeight: 700,
          }}>S</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.3px', margin: 0, color: '#1D1D1F' }}>
            {t('app.name')}
          </h1>
          <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>{t('auth.loginSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(24px)',
          borderRadius: 20, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,.04), 0 4px 20px rgba(0,0,0,.06)',
        }}>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(255,59,48,.08)', color: '#FF3B30',
              fontSize: 13, fontWeight: 500,
            }}>{error}</div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{t('auth.email')}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="hello@studiosage.com" autoComplete="email" autoFocus style={inputStyle} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>{t('auth.password')}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" style={inputStyle} />
          </div>

          <button type="submit" disabled={submitting} style={{
            width: '100%', padding: '13px', borderRadius: 14, border: 'none',
            background: submitting ? '#AEAEB2' : '#007AFF', color: '#fff',
            fontSize: 16, fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
            letterSpacing: '-.1px', transition: 'background .15s',
          }}>
            {submitting ? t('auth.loggingIn') : t('auth.login')}
          </button>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#86868B' }}>
            {t('auth.noAccount')}{' '}
            <Link to="/register" style={{ color: '#007AFF', fontWeight: 600, textDecoration: 'none' }}>
              {t('auth.registerLink')}
            </Link>
          </p>
          <p style={{ textAlign: 'center', marginTop: 8, fontSize: 12 }}>
            <Link to="/forgot-password" style={{ color: '#AEAEB2', textDecoration: 'none' }}>Forgot password?</Link>
          </p>
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#C7C7CC' }}>
            By signing in you agree to our{' '}
            <Link to="/terms" style={{ color: '#AEAEB2' }}>Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" style={{ color: '#AEAEB2' }}>Privacy Policy</Link>
          </p>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: '#AEAEB2' }}>
          {t('auth.terms')}
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#86868B', marginBottom: 6, letterSpacing: '.2px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,.1)',
  fontSize: 15, outline: 'none', boxSizing: 'border-box', background: 'rgba(0,0,0,.02)',
};
