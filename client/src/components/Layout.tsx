import { ReactNode, createContext, useContext, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

// Demo mode context — provides sample data when no API keys are set
export const DemoContext = createContext<{ demo: boolean; toggleDemo: () => void }>({ demo: true, toggleDemo: () => {} });
export const useDemo = () => useContext(DemoContext);

interface NavItem { to: string; icon: string; label: string; labelEn: string; badge?: number; }

const navItems: NavItem[] = [
  { to: '/', icon: '◧', label: '面板', labelEn: 'Dashboard' },
  { to: '/clients', icon: '👥', label: '客户管理', labelEn: 'Clients' },
  { to: '/invoices', icon: '📄', label: '发票', labelEn: 'Invoices' },
  { to: '/proposals', icon: '📋', label: '提案', labelEn: 'Proposals' },
  { to: '/settings', icon: '⚙', label: '设置', labelEn: 'Settings' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const avatarChar = user?.name?.[0] || 'E';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <DemoContext.Provider value={{ demo, toggleDemo: () => setDemo(!demo) }}>
      <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #e8e6f0 0%, #f0eff5 20%, #f5f5f7 50%, #f0eef4 80%, #e4e2ec 100%)' }}>
        {/* Frosted glass header */}
        <header className="glass sticky top-0 z-50 border-b" style={{ borderColor: 'rgba(0,0,0,.06)' }}>
          <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #007AFF, #5856D6)' }} />
              <h1 className="text-lg font-bold tracking-tight" style={{ color: '#1D1D1F', letterSpacing: '-.3px' }}>StudioSage</h1>
            </div>
            <div className="flex items-center gap-3">
              {demo && (
                <span style={{ fontSize: 10, fontWeight: 600, color: '#007AFF', background: 'rgba(0,122,255,.08)', padding: '3px 10px', borderRadius: 10, letterSpacing: '.4px' }}>
                  演示模式
                </span>
              )}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setMenuOpen(!menuOpen)} style={{
                  width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 13, fontWeight: 700, padding: 0,
                }}>{avatarChar}</button>
                {menuOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setMenuOpen(false)} />
                    <div style={{
                      position: 'absolute', top: 38, right: 0, zIndex: 100,
                      background: '#fff', borderRadius: 14, padding: 6,
                      boxShadow: '0 4px 24px rgba(0,0,0,.12)', minWidth: 160,
                    }}>
                      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,.06)', marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F' }}>{user?.name || '用户'}</div>
                        <div style={{ fontSize: 11, color: '#AEAEB2' }}>{user?.email || ''}</div>
                      </div>
                      <button onClick={() => { setMenuOpen(false); navigate('/settings'); }} style={menuItemStyle}>
                        ⚙ 设置
                      </button>
                      <button onClick={() => { setMenuOpen(false); handleLogout(); }} style={{ ...menuItemStyle, color: '#FF3B30' }}>
                        ↩ 退出登录
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="pb-20 px-5 max-w-4xl mx-auto pt-6">
          <div className="page-enter" key={location.pathname}>{children}</div>
        </main>

        {/* iOS-style bottom nav */}
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
                <span style={{ fontSize: 10, letterSpacing: '-.1px' }}>{item.label}</span>
                {item.badge && (
                  <span className="absolute" style={{ top: -2, right: 2, background: '#FF3B30', color: '#fff', fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                    {item.badge}
                  </span>
                )}
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
