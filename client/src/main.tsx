import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { UserProvider } from './contexts/UserContext';
import { ToastProvider } from './contexts/ToastContext';
import { LanguageProvider } from './i18n';
import App from './App';
import './index.css';

// Global error guard — prevents white screen on refresh crashes
window.addEventListener('error', (e) => {
  console.error('[GlobalError]', e.error?.message || e.message);
  // Only catch render errors, not network errors
  if (e.error?.message?.includes('reading') || e.error?.message?.includes('undefined')) {
    localStorage.removeItem('studiosage_token');
    window.location.replace('/sage/login');
  }
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[UnhandledRejection]', e.reason?.message || e.reason);
});

// Global keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
  const key = (e.metaKey || e.ctrlKey) ? `Ctrl+${e.key}` : e.key;
  switch (key) {
    case 'g': if (e.ctrlKey || e.metaKey) { e.preventDefault(); window.location.href = '/sage/'; } break;
    case 'c': if (e.ctrlKey || e.metaKey) { e.preventDefault(); window.location.href = '/sage/clients'; } break;
    case 'p': if (e.ctrlKey || e.metaKey) { e.preventDefault(); window.location.href = '/sage/projects'; } break;
  }
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter basename="/sage">
      <LanguageProvider>
        <UserProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </UserProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
