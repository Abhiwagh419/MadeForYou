import { Component, type ErrorInfo, type ReactNode } from "react";

interface State { failed: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("A screen crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="wrap empty" role="alert">
        <h1>Something went wrong</h1>
        <p>This page could not be shown. Nothing you made has been lost. Please try again.</p>
        <p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload the page</button>{" "}
          <a className="btn btn-ghost" href="/#/">Go to the home page</a>
        </p>
      </main>
    );
  }
}
