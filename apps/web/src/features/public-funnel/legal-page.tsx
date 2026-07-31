import type { ReactNode } from "react";

import { PublicFunnelShell } from "./public-shell";

export function PublicInformationPage({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <PublicFunnelShell>
      <main className="idea-information" id="main-content">
        <h1>{title}</h1>
        {children}
      </main>
    </PublicFunnelShell>
  );
}
