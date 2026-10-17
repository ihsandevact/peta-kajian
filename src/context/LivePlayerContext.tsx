'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { FEATURE_FLAGS } from '@/config/features';

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

export interface StoredLivePlayerSession {
  activeStream: ActiveLiveStream;
  isOpen: boolean;
  isMinimized: boolean;
  currentTime?: number;
  studySession?: ActiveStudySession | null;
  isStudyNotesOpen?: boolean;
  isStudyNotesMinimized?: boolean;
  updatedAt: number;
}

export const LIVE_PLAYER_SESSION_KEY = 'peta_kajian_live_player_session';

function saveSessionToStorage(partial: Partial<StoredLivePlayerSession>) {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(LIVE_PLAYER_SESSION_KEY);
    const existing: Partial<StoredLivePlayerSession> = raw ? JSON.parse(raw) : {};
    const updated: StoredLivePlayerSession = {
      activeStream: partial.activeStream ?? existing.activeStream!,
      isOpen: partial.isOpen ?? existing.isOpen ?? true,
      isMinimized: partial.isMinimized ?? existing.isMinimized ?? false,
      currentTime: partial.currentTime ?? existing.currentTime ?? 0,
      studySession: partial.studySession !== undefined ? partial.studySession : (existing.studySession ?? null),
      isStudyNotesOpen: partial.isStudyNotesOpen ?? existing.isStudyNotesOpen ?? false,
      isStudyNotesMinimized: partial.isStudyNotesMinimized ?? existing.isStudyNotesMinimized ?? false,
      updatedAt: Date.now(),
    };
    if (updated.activeStream) {
      sessionStorage.setItem(LIVE_PLAYER_SESSION_KEY, JSON.stringify(updated));
    }
  } catch {
    // Abaikan error kuota / storage jika dinonaktifkan browser
  }
}

function clearSessionFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(LIVE_PLAYER_SESSION_KEY);
  } catch {}
}

interface LivePlayerContextType {
  activeStream: ActiveLiveStream | null;
  isOpen: boolean;
  isMinimized: boolean;
  isPipActive: boolean;
  initialResumeTime: number;
  playStream: (stream: ActiveLiveStream) => void;
  closePlayer: () => void;
  toggleMinimize: () => void;
  minimizePlayer: () => void;
  maximizePlayer: () => void;
  setIsPipActive: (active: boolean) => void;
  updateStoredPlaybackTime: (time: number) => void;
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
  const [initialResumeTime, setInitialResumeTime] = useState<number>(0);

  const [studySession, setStudySession] = useState<ActiveStudySession | null>(null);
  const [isStudyNotesOpen, setIsStudyNotesOpen] = useState(false);
  const [isStudyNotesMinimized, setIsStudyNotesMinimized] = useState(false);

  // Pulihkan sesi player saat halaman dimuat (misal setelah return dari login Google OAuth)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = sessionStorage.getItem(LIVE_PLAYER_SESSION_KEY);
      if (!raw) return;
      const data: StoredLivePlayerSession = JSON.parse(raw);
      // Validasi kadaluarsa: abaikan jika data sesi lebih dari 30 menit
      const isExpired = Date.now() - (data.updatedAt || 0) > 30 * 60 * 1000;
      if (isExpired || !data.activeStream?.videoId) {
        clearSessionFromStorage();
        return;
      }

      setActiveStream(data.activeStream);
      setIsOpen(data.isOpen ?? true);
      setIsMinimized(data.isMinimized ?? false);
      if (data.currentTime && data.currentTime > 0) {
        setInitialResumeTime(data.currentTime);
      }
      if (data.studySession) {
        setStudySession(data.studySession);
        setIsStudyNotesOpen(data.isStudyNotesOpen ?? false);
        setIsStudyNotesMinimized(data.isStudyNotesMinimized ?? false);
      }
    } catch {
      clearSessionFromStorage();
    }

    // Bersihkan flag auth redirect jika sudah berada di halaman tujuan (bukan beranda atau login)
    try {
      if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
        sessionStorage.removeItem('peta_kajian_auth_in_progress');
        sessionStorage.removeItem('peta_kajian_auth_next');
      }
    } catch {}
  }, []);

  const playStream = useCallback((stream: ActiveLiveStream) => {
    setActiveStream(stream);
    setIsOpen(true);
    setIsMinimized(false);
    setIsPipActive(false);
    setInitialResumeTime(0);
    saveSessionToStorage({
      activeStream: stream,
      isOpen: true,
      isMinimized: false,
      currentTime: 0,
    });
  }, []);

  const closePlayer = useCallback(() => {
    setIsOpen(false);
    setActiveStream(null);
    setIsPipActive(false);
    setInitialResumeTime(0);
    clearSessionFromStorage();
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => {
      const next = !prev;
      saveSessionToStorage({ isMinimized: next });
      return next;
    });
  }, []);

  const minimizePlayer = useCallback(() => {
    setIsMinimized(true);
    saveSessionToStorage({ isMinimized: true });
  }, []);

  const maximizePlayer = useCallback(() => {
    setIsMinimized(false);
    saveSessionToStorage({ isMinimized: false });
  }, []);

  const updateStoredPlaybackTime = useCallback((time: number) => {
    saveSessionToStorage({ currentTime: Math.floor(time) });
  }, []);

  const openStudyMode = useCallback((session: ActiveStudySession) => {
    // Jika fitur catatan di mobile dinonaktifkan sementara, di layar mobile cukup putar videonya saja
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (!FEATURE_FLAGS.ENABLE_MOBILE_STUDY_NOTES && isMobile) {
      playStream({
        videoId: session.videoId,
        title: session.title,
        speakerName: session.speakerName || '',
        channelName: session.channelName || '',
      });
      return;
    }

    setStudySession(session);
    setIsStudyNotesOpen(true);
    setIsStudyNotesMinimized(false);

    const streamData: ActiveLiveStream = {
      videoId: session.videoId,
      title: session.title,
      speakerName: session.speakerName || '',
      channelName: session.channelName || '',
    };

    // Otomatis nyalakan floating video player jika belum memutar video ini
    setActiveStream((current) => {
      if (!current || current.videoId !== session.videoId) {
        return streamData;
      }
      return current;
    });
    setIsOpen(true);

    saveSessionToStorage({
      studySession: session,
      isStudyNotesOpen: true,
      isStudyNotesMinimized: false,
      isOpen: true,
      activeStream: streamData,
    });
  }, [playStream]);

  const closeStudyMode = useCallback(() => {
    setIsStudyNotesOpen(false);
    setStudySession(null);
    saveSessionToStorage({
      studySession: null,
      isStudyNotesOpen: false,
      isStudyNotesMinimized: false,
    });
  }, []);

  const toggleMinimizeStudyNotes = useCallback(() => {
    setIsStudyNotesMinimized((prev) => {
      const next = !prev;
      saveSessionToStorage({ isStudyNotesMinimized: next });
      return next;
    });
  }, []);

  const minimizeStudyNotes = useCallback(() => {
    setIsStudyNotesMinimized(true);
    saveSessionToStorage({ isStudyNotesMinimized: true });
  }, []);

  const maximizeStudyNotes = useCallback(() => {
    setIsStudyNotesMinimized(false);
    saveSessionToStorage({ isStudyNotesMinimized: false });
  }, []);

  const value = useMemo(
    () => ({
      activeStream,
      isOpen,
      isMinimized,
      isPipActive,
      initialResumeTime,
      playStream,
      closePlayer,
      toggleMinimize,
      minimizePlayer,
      maximizePlayer,
      setIsPipActive,
      updateStoredPlaybackTime,
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
      initialResumeTime,
      playStream,
      closePlayer,
      toggleMinimize,
      minimizePlayer,
      maximizePlayer,
      setIsPipActive,
      updateStoredPlaybackTime,
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
