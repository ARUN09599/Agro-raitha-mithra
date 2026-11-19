import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Unexpected application error.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F7F5] text-[#141A16] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E2E5E0] rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] text-[#991B1B] flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h1 className="text-base font-bold text-[#111814]">
                ತಾಂತ್ರಿಕ ದೋಷ ಉಂಟಾಗಿದೆ / Something went wrong
              </h1>
              <p className="text-xs text-[#5E6A62] leading-relaxed break-words">
                {this.state.errorMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-10 px-4 rounded-lg bg-[#166534] hover:bg-[#14532D] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>ಮತ್ತೆ ಲೋಡ್ ಮಾಡಿ / Reload App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
