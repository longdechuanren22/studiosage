import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary]', error.message, info?.componentStack?.slice(0, 300));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 40, textAlign: 'center', fontFamily: '-apple-system, sans-serif' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1D1D1F', marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: 13, color: '#FF3B30', marginBottom: 16, maxWidth: 500, wordBreak: 'break-all', background: 'rgba(255,59,48,.06)', padding: '10px 14px', borderRadius: 10 }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button onClick={() => { window.location.href = '/sage/'; }}
            style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: '#007AFF', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Back to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
