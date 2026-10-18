'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,          // Manual refresh only, no automatic stale expiration
            gcTime: 1000 * 60 * 60 * 24,  // Keep cached data in memory for 24 hours
            refetchOnWindowFocus: false,  // Do not refetch when switching tabs/windows
            refetchOnReconnect: false,    // Do not refetch unexpectedly on network fluctuations
            refetchInterval: false,       // No periodic background polling
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
