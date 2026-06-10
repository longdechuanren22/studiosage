import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Inbox from './pages/Inbox';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import Onboarding from './pages/Onboarding';
import Connect from './pages/Connect';

export default function App() {
  return (
    <ErrorBoundary>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/connect" element={<Connect />} />
        </Routes>
      </Layout>
    </ErrorBoundary>
  );
}
