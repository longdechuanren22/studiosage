import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, token, loading } = useUser();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: '#86868B' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #E5E5EA', borderTopColor: '#007AFF', borderRadius: '50%', animation: 'spin .6s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, margin: 0 }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
