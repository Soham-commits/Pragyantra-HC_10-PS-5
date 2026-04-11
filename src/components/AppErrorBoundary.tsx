import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep this for local debugging; it will show up in the browser console.
    console.error("[AppErrorBoundary] Uncaught error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="w-full max-w-2xl border border-rose-200 bg-rose-50 rounded-2xl p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-rose-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-rose-800">
            The app hit a runtime error. Open the browser console to see the stack trace.
          </p>
          <div className="mt-4 rounded-xl border border-rose-200 bg-white p-4">
            <p className="text-xs font-semibold text-rose-700">Error</p>
            <pre className="mt-2 text-xs text-gray-800 whitespace-pre-wrap break-words">
              {this.state.error?.message || "Unknown error"}
            </pre>
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

