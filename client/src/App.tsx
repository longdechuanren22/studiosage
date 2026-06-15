import { Routes, Route, Navigate } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Settings from './pages/Settings';
import Onboarding from './pages/Onboarding';
import Connect from './pages/Connect';
import Invoices from './pages/Invoices';
import Proposals from './pages/Proposals';
import Login from './pages/Login';
import Register from './pages/Register';
import PortalProposal from './pages/PortalProposal';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public routes — full screen, no navigation chrome */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/portal/proposal/:shareToken" element={<PortalProposal />} />

        {/* Protected app routes — Layout + auth required */}
        <Route path="*" element={
          <AuthGuard>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/inbox" element={<Navigate to="/clients" replace />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/proposals" element={<Proposals />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/connect" element={<Connect />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </AuthGuard>
        } />
      </Routes>
    </ErrorBoundary>
  );
}
