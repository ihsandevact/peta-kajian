/**
 * Live Stream Presentation Controller - Pure Finite State Machine
 *
 * Mengelola siklus hidup tampilan pemutar siaran langsung secara deterministik
 * dengan 5 mode diskrit: 'closed' | 'floating' | 'minimized' | 'modal' | 'pip'.
 * Menggantikan multi-boolean flag (isOpen, isMinimized, isModalExpanded, isPipActive)
 * yang rentan desinkronisasi.
 */

export type LivePlayerMode = 'closed' | 'floating' | 'minimized' | 'modal' | 'pip';

export interface ActiveLiveStream {
  videoId: string;
  title: string;
  speakerName: string;
  channelName: string;
  handle?: string;
  isLive?: boolean;
}

export interface LivePlayerState {
  activeStream: ActiveLiveStream | null;
  mode: LivePlayerMode;
  currentTime: number;
  isMuted: boolean;
}

export const initialLivePlayerState: LivePlayerState = {
  activeStream: null,
  mode: 'closed',
  currentTime: 0,
  isMuted: false,
};

export type LivePlayerAction =
  | { type: 'PLAY'; stream: ActiveLiveStream; startTime?: number }
  | { type: 'SET_MODE'; mode: LivePlayerMode }
  | { type: 'TOGGLE_MINIMIZE' }
  | { type: 'MINIMIZE' }
  | { type: 'MAXIMIZE' }
  | { type: 'EXPAND_MODAL' }
  | { type: 'COLLAPSE_MODAL' }
  | { type: 'SET_PIP'; active: boolean }
  | { type: 'UPDATE_TIME'; currentTime: number }
  | { type: 'SET_MUTED'; muted: boolean }
  | { type: 'CLOSE' }
  | { type: 'RESTORE'; state: LivePlayerState };

/**
 * Pure Reducer untuk transisi state pemutar siaran langsung
 */
export function livePlayerReducer(
  state: LivePlayerState,
  action: LivePlayerAction
): LivePlayerState {
  switch (action.type) {
    case 'PLAY': {
      const isSameVideo = state.activeStream?.videoId === action.stream.videoId;
      const nextMode: LivePlayerMode = state.mode === 'closed' ? 'floating' : state.mode;
      return {
        ...state,
        activeStream: action.stream,
        mode: nextMode,
        currentTime: action.startTime !== undefined ? action.startTime : isSameVideo ? state.currentTime : 0,
      };
    }

    case 'SET_MODE': {
      if (action.mode === 'closed') {
        return initialLivePlayerState;
      }
      // Mode aktif hanya valid jika ada activeStream
      if (!state.activeStream) {
        return state;
      }
      return {
        ...state,
        mode: action.mode,
      };
    }

    case 'TOGGLE_MINIMIZE': {
      if (state.mode === 'closed' || !state.activeStream) {
        return state;
      }
      return {
        ...state,
        mode: state.mode === 'minimized' ? 'floating' : 'minimized',
      };
    }

    case 'MINIMIZE': {
      if (state.mode === 'closed' || !state.activeStream) {
        return state;
      }
      return {
        ...state,
        mode: 'minimized',
      };
    }

    case 'MAXIMIZE': {
      if (state.mode === 'minimized') {
        return {
          ...state,
          mode: 'floating',
        };
      }
      return state;
    }

    case 'EXPAND_MODAL': {
      if (state.mode === 'closed' || !state.activeStream) {
        return state;
      }
      return {
        ...state,
        mode: 'modal',
      };
    }

    case 'COLLAPSE_MODAL': {
      if (state.mode === 'modal') {
        return {
          ...state,
          mode: 'floating',
        };
      }
      return state;
    }

    case 'SET_PIP': {
      if (action.active) {
        if (!state.activeStream || state.mode === 'closed') return state;
        return { ...state, mode: 'pip' };
      }
      if (state.mode === 'pip') {
        return { ...state, mode: 'floating' };
      }
      return state;
    }

    case 'UPDATE_TIME': {
      return {
        ...state,
        currentTime: Math.max(0, Math.floor(action.currentTime)),
      };
    }

    case 'SET_MUTED': {
      return {
        ...state,
        isMuted: action.muted,
      };
    }

    case 'CLOSE': {
      return initialLivePlayerState;
    }

    case 'RESTORE': {
      return action.state;
    }

    default:
      return state;
  }
}

// -------------------------------------------------------------
// DERIVED STATE HELPERS (FACADE)
// -------------------------------------------------------------

export function isPlayerOpen(state: LivePlayerState): boolean {
  return state.mode !== 'closed' && state.activeStream !== null;
}

export function isPlayerMinimized(state: LivePlayerState): boolean {
  return state.mode === 'minimized';
}

export function isPlayerModal(state: LivePlayerState): boolean {
  return state.mode === 'modal';
}

export function isPlayerPip(state: LivePlayerState): boolean {
  return state.mode === 'pip';
}

// -------------------------------------------------------------
// SERIALIZATION & HYDRATION (WITH LEGACY SESSION BACK-COMPAT)
// -------------------------------------------------------------

export const LIVE_PLAYER_SESSION_STORAGE_KEY = 'peta_kajian_live_player_session';
const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30 Menit

export interface StoredLivePlayerPayload {
  activeStream: ActiveLiveStream;
  mode?: LivePlayerMode;
  currentTime?: number;
  isMuted?: boolean;
  studySession?: any;
  isStudyNotesOpen?: boolean;
  isStudyNotesMinimized?: boolean;
  studyLayoutMode?: 'free' | 'focus';
  updatedAt: number;
  // Legacy compatibility fields:
  isOpen?: boolean;
  isMinimized?: boolean;
}

/**
 * Serialisasi state pemutar siaran ke format JSON untuk disimpan di sessionStorage
 */
export function serializeLivePlayerSession(
  state: LivePlayerState,
  extra?: {
    studySession?: any;
    isStudyNotesOpen?: boolean;
    isStudyNotesMinimized?: boolean;
    studyLayoutMode?: 'free' | 'focus';
  }
): string | null {
  if (!state.activeStream) return null;

  const payload: StoredLivePlayerPayload = {
    activeStream: state.activeStream,
    mode: state.mode,
    currentTime: state.currentTime,
    isMuted: state.isMuted,
    isOpen: isPlayerOpen(state),
    isMinimized: isPlayerMinimized(state),
    studySession: extra?.studySession,
    isStudyNotesOpen: extra?.isStudyNotesOpen,
    isStudyNotesMinimized: extra?.isStudyNotesMinimized,
    studyLayoutMode: extra?.studyLayoutMode,
    updatedAt: Date.now(),
  };

  return JSON.stringify(payload);
}

/**
 * Hydrate state pemutar siaran dari JSON sessionStorage, termasuk migrasi format lama
 */
export function hydrateLivePlayerSession(
  rawJson: string | null,
  now = Date.now()
): {
  playerState: LivePlayerState;
  studySession: any;
  isStudyNotesOpen: boolean;
  isStudyNotesMinimized: boolean;
  studyLayoutMode: 'free' | 'focus';
} | null {
  if (!rawJson) return null;

  try {
    const data: StoredLivePlayerPayload = JSON.parse(rawJson);

    // Validasi kadaluarsa & kelengkapan data
    const isExpired = now - (data.updatedAt || 0) > SESSION_MAX_AGE_MS;
    if (isExpired || !data.activeStream?.videoId) {
      return null;
    }

    // Resolusi mode diskrit (dengan migrasi mundur dari format lama isOpen / isMinimized)
    let resolvedMode: LivePlayerMode = 'floating';
    if (data.mode) {
      resolvedMode = data.mode;
    } else if (data.isOpen === false) {
      resolvedMode = 'closed';
    } else if (data.isMinimized) {
      resolvedMode = 'minimized';
    }

    return {
      playerState: {
        activeStream: data.activeStream,
        mode: resolvedMode,
        currentTime: data.currentTime && data.currentTime > 0 ? data.currentTime : 0,
        isMuted: data.isMuted ?? false,
      },
      studySession: data.studySession ?? null,
      isStudyNotesOpen: data.isStudyNotesOpen ?? false,
      isStudyNotesMinimized: data.isStudyNotesMinimized ?? false,
      studyLayoutMode: data.studyLayoutMode ?? 'free',
    };
  } catch {
    return null;
  }
}
