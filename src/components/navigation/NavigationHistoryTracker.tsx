'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function NavigationHistoryTracker() {
  const pathname = usePathname();
  const currentPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (currentPathRef.current && currentPathRef.current !== pathname) {
      try {
        sessionStorage.setItem('pk_prev_pathname', currentPathRef.current);
      } catch {
        // Abaikan jika storage dinonaktifkan di browser
      }
    }
    currentPathRef.current = pathname;
  }, [pathname]);

  return null;
}
