"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-6 text-center text-gray-500 bg-gray-50 rounded-2xl border border-gray-200">
          <p className="font-medium">Something went wrong</p>
          <p className="text-sm mt-1">Try refreshing the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
