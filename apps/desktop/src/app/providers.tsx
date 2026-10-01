"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAutoPullSync } from "@/shared/cloud-sync/use-pull-sync";

function CloudSyncBootstrap() {
  useAutoPullSync();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <CloudSyncBootstrap />
      {children}
    </QueryClientProvider>
  );
}
