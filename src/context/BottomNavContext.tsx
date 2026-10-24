'use client';

import React, { createContext, useContext, useState } from 'react';

interface BottomNavContextType {
  isHidden: boolean;
  setIsHidden: (val: boolean) => void;
  isDarkTheme: boolean;
  setIsDarkTheme: (val: boolean) => void;
}

const BottomNavContext = createContext<BottomNavContextType>({
  isHidden: false,
  setIsHidden: () => {},
  isDarkTheme: false,
  setIsDarkTheme: () => {},
});

export function BottomNavProvider({ children }: { children: React.ReactNode }) {
  const [isHidden, setIsHidden] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  return (
    <BottomNavContext.Provider value={{ isHidden, setIsHidden, isDarkTheme, setIsDarkTheme }}>
      {children}
    </BottomNavContext.Provider>
  );
}

export function useBottomNav() {
  return useContext(BottomNavContext);
}
