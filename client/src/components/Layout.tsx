import { ReactNode, createContext, useContext, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

// Demo mode context — provides sample data when no API keys are set
export const DemoContext = createContext<{ demo: boolean; toggleDemo: () => void }>({ demo: true, toggleDemo: () => {} });
export const useDemo = () => useContext(DemoContext);

const navItems = [
  { to: '/', icon: '◧', label: '面板', labelEn: 'Dashboard' },
  { to: '/inbox', icon: '↓', label: '收件箱', labelEn: 'Inbox', badge: 3 },
  { to: '/invoices', icon: '⏐', label: '发票', labelEn: 'Invoices', badge: 2 },
  { to: '/settings', icon: '⚙', label: '设置', labelEn: 'Settings' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState(true);
  const location = useLocation();

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
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #007AFF, #5856D6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>E</div>
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
