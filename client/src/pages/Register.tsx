import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

export default function Register() {
  const { user, token, loading, register } = useUser();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already authenticated — redirect to dashboard
  if (!loading && token && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('请输入姓名'); return; }
    if (!email.trim()) { setError('请输入邮箱'); return; }
    if (password.length < 6) { setError('密码至少 6 个字符'); return; }
    setSubmitting(true);
    try {
      await register(email.trim(), password, name.trim());
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || '注册失败，请重试');
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
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #34C759, #007AFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: '#fff', fontWeight: 700,
          }}>S</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.3px', margin: 0, color: '#1D1D1F' }}>创建账号</h1>
          <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>开始 14 天免费试用</p>
        </div>

        {/* Card */}
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
            <label style={labelStyle}>姓名</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="你的名字" autoComplete="name" autoFocus
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>邮箱</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="hello@studiosage.cn" autoComplete="email"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>密码</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="至少 6 个字符" autoComplete="new-password"
              style={inputStyle}
            />
            <p style={{ fontSize: 10, color: '#AEAEB2', margin: '4px 0 0' }}>至少 6 个字符</p>
          </div>

          <button type="submit" disabled={submitting} style={{
            width: '100%', padding: '13px', borderRadius: 14, border: 'none',
            background: submitting ? '#AEAEB2' : '#34C759', color: '#fff',
            fontSize: 16, fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
            letterSpacing: '-.1px', transition: 'background .15s',
          }}>
            {submitting ? '创建中…' : '免费注册'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#86868B' }}>
            已有账号？{' '}
            <Link to="/login" style={{ color: '#007AFF', fontWeight: 600, textDecoration: 'none' }}>
              登录
            </Link>
          </p>
        </form>

        {/* Features */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
          {['🤖 AI 自动分类', '📧 IMAP 全覆盖', '📋 提案合同'].map(f => (
            <span key={f} style={{ fontSize: 11, color: '#86868B', background: 'rgba(255,255,255,.5)', padding: '4px 10px', borderRadius: 8 }}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#86868B',
  marginBottom: 6, letterSpacing: '.2px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '1px solid rgba(0,0,0,.1)', fontSize: 15,
  outline: 'none', boxSizing: 'border-box',
  background: 'rgba(0,0,0,.02)', transition: 'border .15s',
};
