'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface ActiveLiveStream {
  videoId: string;
  title: string;
  speakerName: string;
  channelName: string;
  handle?: string;
}

interface LivePlayerContextType {
  activeStream: ActiveLiveStream | null;
  isOpen: boolean;
  isMinimized: boolean;
  playStream: (stream: ActiveLiveStream) => void;
  closePlayer: () => void;
  toggleMinimize: () => void;
  minimizePlayer: () => void;
  maximizePlayer: () => void;
}

const LivePlayerContext = createContext<LivePlayerContextType | undefined>(undefined);

export function LivePlayerProvider({ children }: { children: React.ReactNode }) {
  const [activeStream, setActiveStream] = useState<ActiveLiveStream | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const playStream = useCallback((stream: ActiveLiveStream) => {
    setActiveStream(stream);
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  const closePlayer = useCallback(() => {
    setIsOpen(false);
    setActiveStream(null);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const minimizePlayer = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const maximizePlayer = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const value = useMemo(
    () => ({
      activeStream,
      isOpen,
      isMinimized,
      playStream,
      closePlayer,
      toggleMinimize,
      minimizePlayer,
      maximizePlayer,
    }),
    [activeStream, isOpen, isMinimized, playStream, closePlayer, toggleMinimize, minimizePlayer, maximizePlayer]
  );

  return <LivePlayerContext.Provider value={value}>{children}</LivePlayerContext.Provider>;
}

export function useLivePlayer() {
  const context = useContext(LivePlayerContext);
  if (!context) {
    throw new Error('useLivePlayer must be used within a LivePlayerProvider');
  }
  return context;
}
