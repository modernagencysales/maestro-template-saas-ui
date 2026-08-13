import { QueryClientProvider } from "@tanstack/react-query";

import { ColorModeProvider } from "#components/color-mode";
import { AuthProvider } from "#features/auth/auth-provider";
import { AppProvider } from "#features/common/providers/app-provider";
import { getQueryClient } from "#lib/react-query";
import { TRPCReactProvider } from "#lib/trpc/react";

export function Provider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <AuthProvider>
      <TRPCReactProvider>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <ColorModeProvider>{props.children}</ColorModeProvider>
          </AppProvider>
        </QueryClientProvider>
      </TRPCReactProvider>
    </AuthProvider>
  );
}
