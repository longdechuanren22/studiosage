import { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { t, useI18n } from '../i18n';

// Tiny MD5 hash for Gravatar URLs (Gravatar requires MD5(email))
function md5(str: string): string {
  // MD5 round functions
  function F(x: number, y: number, z: number) { return (x & y) | (~x & z); }
  function G(x: number, y: number, z: number) { return (x & z) | (y & ~z); }
  function H(x: number, y: number, z: number) { return x ^ y ^ z; }
  function I(x: number, y: number, z: number) { return y ^ (x | ~z); }
  function rotl(n: number, s: number) { return (n << s) | (n >>> (32 - s)); }
  // Convert string to UTF-8 bytes
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 128) bytes.push(c);
    else if (c < 2048) bytes.push(192 | (c >> 6), 128 | (c & 63));
    else bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
  }
  const len = bytes.length;
  bytes.push(128);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  // Append length in bits as 64-bit little-endian
  const bitLen = len * 8;
  for (let i = 0; i < 4; i++) bytes.push((bitLen >>> (i * 8)) & 255);
  for (let i = 0; i < 4; i++) bytes.push(((bitLen / 4294967296) >>> (i * 8)) & 255);

  const T: number[] = [];
  for (let i = 0; i < 64; i++) T[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);

  let a = 1732584193, b = 4023233417, c = 2562383102, d = 271733878;
  for (let bi = 0; bi < bytes.length; bi += 64) {
    const X: number[] = [];
    for (let i = 0; i < 16; i++) {
      X[i] = bytes[bi + i * 4] | (bytes[bi + i * 4 + 1] << 8) | (bytes[bi + i * 4 + 2] << 16) | (bytes[bi + i * 4 + 3] << 24);
    }
    let A = a, B = b, C = c, D = d;
    for (let i = 0; i < 64; i++) {
      let fVal: number, g: number;
      if (i < 16) { fVal = F(B, C, D); g = i; }
      else if (i < 32) { fVal = G(B, C, D); g = (5 * i + 1) % 16; }
      else if (i < 48) { fVal = H(B, C, D); g = (3 * i + 5) % 16; }
      else { fVal = I(B, C, D); g = (7 * i) % 16; }
      fVal = (fVal + A + T[i] + X[g]) | 0;
      const S = [7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21][i % 4 * 4 + Math.floor(i / 16)];
      A = D; D = C; C = B; B = (B + rotl(fVal, S)) | 0;
    }
    a = (a + A) | 0; b = (b + B) | 0; c = (c + C) | 0; d = (d + D) | 0;
  }
  const hex = (n: number) => { const s = '0000000' + ((n >>> 0).toString(16)); return s.slice(-8); };
  return hex(a) + hex(b) + hex(c) + hex(d);
}

export const DemoContext = createContext<{ demo: boolean; toggleDemo: () => void }>({ demo: true, toggleDemo: () => {} });
export const useDemo = () => useContext(DemoContext);

interface NavItem { to: string; icon: string; labelKey: string; }

const navItems: NavItem[] = [
  { to: '/', icon: '◧', labelKey: 'nav.dashboard' },
  { to: '/clients', icon: '👥', labelKey: 'nav.clients' },
  { to: '/projects', icon: '🎬', labelKey: 'nav.projects' },
  { to: '/invoices', icon: '📄', labelKey: 'nav.invoices' },
  { to: '/connect', icon: '📬', labelKey: 'nav.connect' },
  { to: '/settings', icon: '⚙', labelKey: 'nav.settings' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState(() => localStorage.getItem('studiosage_demo') === '1');
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('studiosage_dark') === '1');
  const [offline, setOffline] = useState(!navigator.onLine);
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, setLang } = useI18n();
  const avatarChar = user?.name?.[0] || 'E';
  const avatarUrl = user?.email
    ? `https://www.gravatar.com/avatar/${md5(user.email.trim().toLowerCase())}?d=404&s=60`
    : null;
  const [avatarFailed, setAvatarFailed] = useState(false);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('studiosage_token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
      }
    } catch {}
    logout();
    navigate('/login', { replace: true });
  };

  const toggleLang = () => setLang(lang === 'en' ? 'zh' : 'en');
  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('studiosage_dark', next ? '1' : '0');
    document.body.classList.toggle('dark', next);
  };
  useEffect(() => { document.body.classList.toggle('dark', dark); }, []);
  useEffect(() => {
    const go = () => setOffline(false); const gone = () => setOffline(true);
    window.addEventListener('online', go); window.addEventListener('offline', gone);
    return () => { window.removeEventListener('online', go); window.removeEventListener('offline', gone); };
  }, []);

  return (
    <DemoContext.Provider value={{ demo, toggleDemo: () => setDemo(prev => { const next = !prev; localStorage.setItem('studiosage_demo', next ? '1' : '0'); return next; }) }}>
      <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #e8e6f0 0%, #f0eff5 20%, #f5f5f7 50%, #f0eef4 80%, #e4e2ec 100%)' }}>
        <header className="glass sticky top-0 z-50 border-b" style={{ borderColor: 'rgba(0,0,0,.06)' }}>
          <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #007AFF, #5856D6)' }} />
              <h1 className="text-lg font-bold tracking-tight" style={{ color: '#1D1D1F', letterSpacing: '-.3px' }}>{t('app.name')}</h1>
            </div>
            <div className="flex items-center gap-3">
              {demo && (
                <span style={{ fontSize: 10, fontWeight: 600, color: '#007AFF', background: 'rgba(0,122,255,.08)', padding: '3px 10px', borderRadius: 10, letterSpacing: '.4px' }}>
                  {t('app.demo')}
                </span>
              )}
              <button onClick={toggleDark} style={{
                background: 'none', border: 'none', fontSize: 14, cursor: 'pointer',
                color: '#86868B', padding: '2px 6px', borderRadius: 4,
              }} title="Dark mode">{dark ? '☀' : '🌙'}</button>
              <button onClick={toggleLang} style={{
                background: 'none', border: 'none', fontSize: 12, cursor: 'pointer',
                color: '#86868B', padding: '2px 6px', borderRadius: 4,
              }} title="Switch language">
                {lang === 'en' ? '中文' : 'EN'}
              </button>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setMenuOpen(!menuOpen)} style={{
                  width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: avatarUrl && !avatarFailed ? 'transparent' : 'linear-gradient(135deg, #007AFF, #5856D6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 13, fontWeight: 700, padding: 0, overflow: 'hidden',
                }}>
                  {avatarUrl && !avatarFailed ? (
                    <img src={avatarUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%' }}
                      onError={() => setAvatarFailed(true)} />
                  ) : avatarChar}
                </button>
                {menuOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setMenuOpen(false)} />
                    <div style={{
                      position: 'absolute', top: 38, right: 0, zIndex: 100,
                      background: '#fff', borderRadius: 14, padding: 6,
                      boxShadow: '0 4px 24px rgba(0,0,0,.12)', minWidth: 160,
                    }}>
                      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,.06)', marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F' }}>{user?.name || 'User'}</div>
                        <div style={{ fontSize: 11, color: '#AEAEB2' }}>{user?.email || ''}</div>
                      </div>
                      <button onClick={() => { setMenuOpen(false); navigate('/settings'); }} style={menuItemStyle}>
                        ⚙ {t('nav.settings')}
                      </button>
                      <button onClick={() => { setMenuOpen(false); toggleLang(); }} style={menuItemStyle}>
                        🌐 {lang === 'en' ? 'Switch to 中文' : 'Switch to English'}
                      </button>
                      <button onClick={() => { setMenuOpen(false); handleLogout(); }} style={{ ...menuItemStyle, color: '#FF3B30' }}>
                        ↩ {t('auth.logout')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="pb-20 px-5 max-w-4xl mx-auto pt-6">
          <div className="page-enter" key={location.pathname}>{children}</div>
        </main>

        <nav className="glass fixed bottom-0 left-0 right-0 z-50 border-t safe-area-bottom" style={{ borderColor: 'rgba(0,0,0,.06)' }}>
          <div className="flex justify-around max-w-4xl mx-auto py-2">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition relative ${isActive ? '' : 'opacity-50'}`
                }
                style={({ isActive }) => ({
                  color: isActive ? '#007AFF' : '#86868B',
                  fontWeight: isActive ? 600 : 400,
                })}
              >
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                <span style={{ fontSize: 10, letterSpacing: '-.1px' }}>{t(item.labelKey)}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </DemoContext.Provider>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '8px 12px', borderRadius: 8,
  border: 'none', background: 'none', fontSize: 13, fontWeight: 500,
  color: '#1D1D1F', cursor: 'pointer', textAlign: 'left' as const,
};
