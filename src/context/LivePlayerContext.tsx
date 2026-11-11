'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useReducer, useRef } from 'react';
import { FEATURE_FLAGS } from '@/config/features';
import {
  livePlayerReducer,
  initialLivePlayerState,
  isPlayerOpen,
  isPlayerMinimized,
  isPlayerModal,
  isPlayerPip,
  serializeLivePlayerSession,
  hydrateLivePlayerSession,
  LIVE_PLAYER_SESSION_STORAGE_KEY,
  type LivePlayerMode,
  type LivePlayerState,
  type ActiveLiveStream,
} from '@/lib/domain/livePlayerMachine';

export type { LivePlayerMode, LivePlayerState, ActiveLiveStream };

export interface ActiveStudySession {
  videoId: string;
  title: string;
  speakerName?: string;
  channelName?: string;
  sessionId?: string;
}

export type StudyLayoutMode = 'free' | 'focus';

export const LIVE_PLAYER_SESSION_KEY = LIVE_PLAYER_SESSION_STORAGE_KEY;

interface LivePlayerContextType {
  // Deep state interface
  activeStream: ActiveLiveStream | null;
  mode: LivePlayerMode;
  setMode: (mode: LivePlayerMode) => void;
  // Facade getters for backward compatibility
  isOpen: boolean;
  isMinimized: boolean;
  isModalExpanded: boolean;
  isPipActive: boolean;
  initialResumeTime: number;
  playStream: (stream: ActiveLiveStream, startTime?: number) => void;
  closePlayer: () => void;
  toggleMinimize: () => void;
  minimizePlayer: () => void;
  maximizePlayer: () => void;
  expandToModal: () => void;
  collapseModal: () => void;
  setIsPipActive: (active: boolean) => void;
  updateStoredPlaybackTime: (time: number) => void;
  // Floating Study Sticky Notes & Focus Mode
  studySession: ActiveStudySession | null;
  isStudyModeOpen: boolean;
  isStudyNotesOpen: boolean;
  isStudyNotesMinimized: boolean;
  studyLayoutMode: StudyLayoutMode;
  setStudyLayoutMode: (mode: StudyLayoutMode) => void;
  toggleStudyLayoutMode: () => void;
  openStudyMode: (session: ActiveStudySession, options?: { autoPlayMiniPlayer?: boolean }) => void;
  closeStudyMode: () => void;
  closeStudyNotes: () => void;
  toggleMinimizeStudyNotes: () => void;
  minimizeStudyNotes: () => void;
  maximizeStudyNotes: () => void;
}

const LivePlayerContext = createContext<LivePlayerContextType | undefined>(undefined);

export function LivePlayerProvider({ children }: { children: React.ReactNode }) {
  const [playerState, dispatch] = useReducer(livePlayerReducer, initialLivePlayerState);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);

  const [studySession, setStudySession] = useState<ActiveStudySession | null>(null);
  const [isStudyNotesOpen, setIsStudyNotesOpen] = useState(false);
  const [isStudyNotesMinimized, setIsStudyNotesMinimized] = useState(false);
  const [studyLayoutMode, setStudyLayoutModeState] = useState<StudyLayoutMode>('free');

  const studySessionRef = useRef(studySession);
  studySessionRef.current = studySession;
  const isStudyNotesOpenRef = useRef(isStudyNotesOpen);
  isStudyNotesOpenRef.current = isStudyNotesOpen;
  const isStudyNotesMinimizedRef = useRef(isStudyNotesMinimized);
  isStudyNotesMinimizedRef.current = isStudyNotesMinimized;
  const studyLayoutModeRef = useRef(studyLayoutMode);
  studyLayoutModeRef.current = studyLayoutMode;

  // Persist state perubahan player ke sessionStorage
  const syncToStorage = useCallback((stateToPersist: LivePlayerState) => {
    if (typeof window === 'undefined') return;
    try {
      if (stateToPersist.activeStream) {
        const serialized = serializeLivePlayerSession(stateToPersist, {
          studySession: studySessionRef.current,
          isStudyNotesOpen: isStudyNotesOpenRef.current,
          isStudyNotesMinimized: isStudyNotesMinimizedRef.current,
          studyLayoutMode: studyLayoutModeRef.current,
        });
        if (serialized) {
          sessionStorage.setItem(LIVE_PLAYER_SESSION_STORAGE_KEY, serialized);
        }
      } else {
        sessionStorage.removeItem(LIVE_PLAYER_SESSION_STORAGE_KEY);
      }
    } catch {}
  }, []);

  // Pulihkan sesi player saat halaman dimuat (misal setelah return dari login Google OAuth)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = sessionStorage.getItem(LIVE_PLAYER_SESSION_STORAGE_KEY);
      const hydrated = hydrateLivePlayerSession(raw);
      if (hydrated) {
        dispatch({ type: 'RESTORE', state: hydrated.playerState });
        setSessionStartTime(hydrated.playerState.currentTime ?? 0);
        if (hydrated.studySession) {
          setStudySession(hydrated.studySession);
          setIsStudyNotesOpen(hydrated.isStudyNotesOpen);
          setIsStudyNotesMinimized(hydrated.isStudyNotesMinimized);
        }
        if (hydrated.studyLayoutMode) {
          setStudyLayoutModeState(hydrated.studyLayoutMode);
        }
      } else if (raw) {
        sessionStorage.removeItem(LIVE_PLAYER_SESSION_STORAGE_KEY);
      }
    } catch {
      sessionStorage.removeItem(LIVE_PLAYER_SESSION_STORAGE_KEY);
    }

    // Bersihkan flag auth redirect jika sudah berada di halaman tujuan (bukan beranda atau login)
    try {
      if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
        sessionStorage.removeItem('peta_kajian_auth_in_progress');
        sessionStorage.removeItem('peta_kajian_auth_next');
      }
    } catch {}
  }, []);

  // Sinkronisasi otomatis playerState ke storage saat berubah
  useEffect(() => {
    syncToStorage(playerState);
  }, [playerState, syncToStorage]);

  const playStream = useCallback((stream: ActiveLiveStream, startTime?: number) => {
    setSessionStartTime(startTime ?? 0);
    dispatch({ type: 'PLAY', stream, startTime });
  }, []);

  const closePlayer = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('peta-kajian:stop-mini-player'));
      }
    } catch {}
    setSessionStartTime(0);
    dispatch({ type: 'CLOSE' });
    try {
      sessionStorage.removeItem(LIVE_PLAYER_SESSION_STORAGE_KEY);
    } catch {}
  }, []);

  const setMode = useCallback((mode: LivePlayerMode) => {
    dispatch({ type: 'SET_MODE', mode });
  }, []);

  const toggleMinimize = useCallback(() => {
    dispatch({ type: 'TOGGLE_MINIMIZE' });
  }, []);

  const minimizePlayer = useCallback(() => {
    dispatch({ type: 'MINIMIZE' });
  }, []);

  const maximizePlayer = useCallback(() => {
    dispatch({ type: 'MAXIMIZE' });
  }, []);

  const expandToModal = useCallback(() => {
    dispatch({ type: 'EXPAND_MODAL' });
  }, []);

  const collapseModal = useCallback(() => {
    dispatch({ type: 'COLLAPSE_MODAL' });
  }, []);

  const setIsPipActive = useCallback((active: boolean) => {
    dispatch({ type: 'SET_PIP', active });
  }, []);

  const updateStoredPlaybackTime = useCallback((time: number) => {
    dispatch({ type: 'UPDATE_TIME', currentTime: time });
  }, []);

  const setStudyLayoutMode = useCallback((mode: StudyLayoutMode) => {
    setStudyLayoutModeState(mode);
    if (mode === 'focus') {
      dispatch({ type: 'COLLAPSE_MODAL' });
    }
  }, []);

  const toggleStudyLayoutMode = useCallback(() => {
    setStudyLayoutModeState((prev) => {
      const next: StudyLayoutMode = prev === 'focus' ? 'free' : 'focus';
      if (next === 'focus') {
        dispatch({ type: 'COLLAPSE_MODAL' });
      }
      return next;
    });
  }, []);

  const openStudyMode = useCallback(
    (session: ActiveStudySession, options?: { autoPlayMiniPlayer?: boolean }) => {
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

      const shouldOpenMiniPlayer = options?.autoPlayMiniPlayer ?? true;
      if (shouldOpenMiniPlayer) {
        playStream(streamData);
      }
    },
    [playStream]
  );

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

  // Derived boolean getters for backward compatibility
  const isOpen = useMemo(() => isPlayerOpen(playerState), [playerState]);
  const isMinimized = useMemo(() => isPlayerMinimized(playerState), [playerState]);
  const isModalExpanded = useMemo(() => isPlayerModal(playerState), [playerState]);
  const isPipActive = useMemo(() => isPlayerPip(playerState), [playerState]);

  const value = useMemo(
    () => ({
      activeStream: playerState.activeStream,
      mode: playerState.mode,
      setMode,
      isOpen,
      isMinimized,
      isModalExpanded,
      isPipActive,
      initialResumeTime: sessionStartTime,
      playStream,
      closePlayer,
      toggleMinimize,
      minimizePlayer,
      maximizePlayer,
      expandToModal,
      collapseModal,
      setIsPipActive,
      updateStoredPlaybackTime,
      studySession,
      isStudyModeOpen: isStudyNotesOpen,
      isStudyNotesOpen,
      isStudyNotesMinimized,
      studyLayoutMode,
      setStudyLayoutMode,
      toggleStudyLayoutMode,
      openStudyMode,
      closeStudyMode,
      closeStudyNotes: closeStudyMode,
      toggleMinimizeStudyNotes,
      minimizeStudyNotes,
      maximizeStudyNotes,
    }),
    [
      playerState.activeStream,
      playerState.mode,
      sessionStartTime,
      setMode,
      isOpen,
      isMinimized,
      isModalExpanded,
      isPipActive,
      playStream,
      closePlayer,
      toggleMinimize,
      minimizePlayer,
      maximizePlayer,
      expandToModal,
      collapseModal,
      setIsPipActive,
      updateStoredPlaybackTime,
      studySession,
      isStudyNotesOpen,
      isStudyNotesMinimized,
      studyLayoutMode,
      setStudyLayoutMode,
      toggleStudyLayoutMode,
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
