'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface ActiveLiveStream {
  videoId: string;
  title: string;
  speakerName: string;
  channelName: string;
  handle?: string;
}

export interface ActiveStudySession {
  videoId: string;
  title: string;
  speakerName?: string;
  channelName?: string;
  sessionId?: string;
}

interface LivePlayerContextType {
  activeStream: ActiveLiveStream | null;
  isOpen: boolean;
  isMinimized: boolean;
  isPipActive: boolean;
  playStream: (stream: ActiveLiveStream) => void;
  closePlayer: () => void;
  toggleMinimize: () => void;
  minimizePlayer: () => void;
  maximizePlayer: () => void;
  setIsPipActive: (active: boolean) => void;
  // Floating Study Sticky Notes
  studySession: ActiveStudySession | null;
  isStudyModeOpen: boolean;
  isStudyNotesOpen: boolean;
  isStudyNotesMinimized: boolean;
  openStudyMode: (session: ActiveStudySession) => void;
  closeStudyMode: () => void;
  closeStudyNotes: () => void;
  toggleMinimizeStudyNotes: () => void;
  minimizeStudyNotes: () => void;
  maximizeStudyNotes: () => void;
}

const LivePlayerContext = createContext<LivePlayerContextType | undefined>(undefined);

export function LivePlayerProvider({ children }: { children: React.ReactNode }) {
  const [activeStream, setActiveStream] = useState<ActiveLiveStream | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);

  const [studySession, setStudySession] = useState<ActiveStudySession | null>(null);
  const [isStudyNotesOpen, setIsStudyNotesOpen] = useState(false);
  const [isStudyNotesMinimized, setIsStudyNotesMinimized] = useState(false);

  const playStream = useCallback((stream: ActiveLiveStream) => {
    setActiveStream(stream);
    setIsOpen(true);
    setIsMinimized(false);
    setIsPipActive(false);
  }, []);

  const closePlayer = useCallback(() => {
    setIsOpen(false);
    setActiveStream(null);
    setIsPipActive(false);
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

  const openStudyMode = useCallback((session: ActiveStudySession) => {
    setStudySession(session);
    setIsStudyNotesOpen(true);
    setIsStudyNotesMinimized(false);

    // Otomatis nyalakan floating video player jika belum memutar video ini
    setActiveStream((current) => {
      if (!current || current.videoId !== session.videoId) {
        return {
          videoId: session.videoId,
          title: session.title,
          speakerName: session.speakerName || '',
          channelName: session.channelName || '',
        };
      }
      return current;
    });
    setIsOpen(true);
  }, []);

  const closeStudyMode = useCallback(() => {
    setIsStudyNotesOpen(false);
    setStudySession(null);
  }, []);

  const toggleMinimizeStudyNotes = useCallback(() => {
    setIsStudyNotesMinimized((prev) => !prev);
  }, []);

  const minimizeStudyNotes = useCallback(() => {
    setIsStudyNotesMinimized(true);
  }, []);

  const maximizeStudyNotes = useCallback(() => {
    setIsStudyNotesMinimized(false);
  }, []);

  const value = useMemo(
    () => ({
      activeStream,
      isOpen,
      isMinimized,
      isPipActive,
      playStream,
      closePlayer,
      toggleMinimize,
      minimizePlayer,
      maximizePlayer,
      setIsPipActive,
      studySession,
      isStudyModeOpen: isStudyNotesOpen,
      isStudyNotesOpen,
      isStudyNotesMinimized,
      openStudyMode,
      closeStudyMode,
      closeStudyNotes: closeStudyMode,
      toggleMinimizeStudyNotes,
      minimizeStudyNotes,
      maximizeStudyNotes,
    }),
    [
      activeStream,
      isOpen,
      isMinimized,
      isPipActive,
      playStream,
      closePlayer,
      toggleMinimize,
      minimizePlayer,
      maximizePlayer,
      setIsPipActive,
      studySession,
      isStudyNotesOpen,
      isStudyNotesMinimized,
      openStudyMode,
      closeStudyMode,
      toggleMinimizeStudyNotes,
      minimizeStudyNotes,
      maximizeStudyNotes,
    ]
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
