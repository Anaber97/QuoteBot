import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI Error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center p-6 text-slate-200">
          <div className="max-w-md w-full bg-[#161b26] border border-red-800/50 rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-12 h-12 bg-red-950/60 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-800/50 text-xl font-bold">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Something Went Wrong</h2>
            <p className="text-xs text-slate-400 mb-6">
              An unexpected UI error occurred. Click below to reload cleanly.
            </p>
            <button
              onClick={this.handleReset}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}