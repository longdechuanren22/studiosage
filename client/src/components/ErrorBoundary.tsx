import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <span className="text-4xl mb-4">📸</span>
          <h2 className="text-lg font-semibold text-gray-700">Something went wrong</h2>
          <p className="text-sm text-gray-400 mt-1 mb-4">We're on it. Try refreshing the page.</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-sage-500 text-white text-sm rounded-full">
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
