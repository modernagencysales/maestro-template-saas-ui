import type { ReactNode } from "react";

export function PublicFunnelShell({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <div className="idea-public-shell">
      <header className="idea-public-header">
        <a className="idea-wordmark" href="/" aria-label="Idea Check home">
          <span aria-hidden="true" className="idea-wordmark-mark">
            M
          </span>
          <span>Idea Check</span>
        </a>
        <nav aria-label="Public navigation" className="idea-public-nav">
          <a href="/library">My reports</a>
          <a href="/support">Support</a>
        </nav>
      </header>
      {children}
      <footer className="idea-public-footer">
        <p>Clarity before code.</p>
        <nav aria-label="Legal">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/support">Support</a>
        </nav>
      </footer>
    </div>
  );
}
