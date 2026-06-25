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
import Plans from './pages/Plans';
import Login from './pages/Login';
import Register from './pages/Register';
import PortalSelection from './pages/PortalSelection';
import PortalReview from './pages/PortalReview';
import Projects from './pages/Projects';
import Landing from './pages/Landing';
import ForgotPassword from './pages/ForgotPassword';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public routes — full screen, no navigation chrome */}
        <Route path="/welcome" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        {/* Client portal — selection & review (public, token-based) */}
        <Route path="/portal/selection/:shareToken" element={<PortalSelection />} />
        <Route path="/portal/review/:shareToken" element={<PortalReview />} />

        {/* Protected app routes — Layout + auth required */}
        <Route path="*" element={
          <AuthGuard>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/plans" element={<Plans />} />
                <Route path="/connect" element={<Connect />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </AuthGuard>
        } />
      </Routes>
    </ErrorBoundary>
  );
}
