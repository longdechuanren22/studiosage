import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <header className="bg-sage-500 text-white px-4 py-3 flex items-center justify-between shadow">
        <h1 className="text-lg font-semibold tracking-tight">StudioSage</h1>
        <span className="text-sm opacity-80">👤 Emma</span>
      </header>

      <main className="pb-16 px-4 pt-4 max-w-4xl mx-auto">{children}</main>

      {/* Bottom Nav (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 safe-area-bottom">
        <NavItem to="/" icon="📊" label="Dashboard" />
        <NavItem to="/inbox" icon="📥" label="Inbox" />
        <NavItem to="/invoices" icon="📄" label="Invoices" />
        <NavItem to="/settings" icon="⚙️" label="Settings" />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center text-xs px-3 py-1 rounded-lg transition ${
          isActive ? 'text-sage-500 font-semibold' : 'text-gray-400'
        }`
      }
    >
      <span className="text-xl">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}
