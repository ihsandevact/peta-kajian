'use client';

import React, { createContext, useContext, useState } from 'react';

interface BottomNavContextType {
  isHidden: boolean;
  setIsHidden: (val: boolean) => void;
}

const BottomNavContext = createContext<BottomNavContextType>({
  isHidden: false,
  setIsHidden: () => {},
});

export function BottomNavProvider({ children }: { children: React.ReactNode }) {
  const [isHidden, setIsHidden] = useState(false);
  return (
    <BottomNavContext.Provider value={{ isHidden, setIsHidden }}>
      {children}
    </BottomNavContext.Provider>
  );
}

export function useBottomNav() {
  return useContext(BottomNavContext);
}
