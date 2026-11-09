import { describe, it, expect } from 'vitest';
import {
  livePlayerReducer,
  initialLivePlayerState,
  isPlayerOpen,
  isPlayerMinimized,
  isPlayerModal,
  isPlayerPip,
  serializeLivePlayerSession,
  hydrateLivePlayerSession,
  type ActiveLiveStream,
  type LivePlayerState,
} from '../livePlayerMachine';

const mockStreamA: ActiveLiveStream = {
  videoId: 'dQw4w9WgXcQ',
  title: 'Kajian Kitab Tauhid',
  speakerName: 'Ustadz Abdullah Roy',
  channelName: 'Kajian Sunnah TV',
  isLive: true,
};

const mockStreamB: ActiveLiveStream = {
  videoId: 'abc123xyz89',
  title: 'Kajian Bulughul Maram',
  speakerName: 'Ustadz Yazid Jawas',
  channelName: 'Rodja TV',
};

describe('Live Player Finite State Machine', () => {
  describe('Initial State', () => {
    it('starts in closed state with no active stream and 0 timestamp', () => {
      expect(initialLivePlayerState.mode).toBe('closed');
      expect(initialLivePlayerState.activeStream).toBeNull();
      expect(initialLivePlayerState.currentTime).toBe(0);
      expect(initialLivePlayerState.isMuted).toBe(false);

      expect(isPlayerOpen(initialLivePlayerState)).toBe(false);
      expect(isPlayerMinimized(initialLivePlayerState)).toBe(false);
      expect(isPlayerModal(initialLivePlayerState)).toBe(false);
      expect(isPlayerPip(initialLivePlayerState)).toBe(false);
    });
  });

  describe('PLAY transitions', () => {
    it('transitions from closed to floating when playing a stream', () => {
      const state = livePlayerReducer(initialLivePlayerState, {
        type: 'PLAY',
        stream: mockStreamA,
      });

      expect(state.mode).toBe('floating');
      expect(state.activeStream).toEqual(mockStreamA);
      expect(state.currentTime).toBe(0);
      expect(isPlayerOpen(state)).toBe(true);
      expect(isPlayerMinimized(state)).toBe(false);
    });

    it('sets specific startTime when provided in PLAY action', () => {
      const state = livePlayerReducer(initialLivePlayerState, {
        type: 'PLAY',
        stream: mockStreamA,
        startTime: 125,
      });

      expect(state.currentTime).toBe(125);
    });

    it('maintains existing active mode (e.g. minimized) when re-playing identical video without explicit startTime', () => {
      const minimizedState: LivePlayerState = {
        activeStream: mockStreamA,
        mode: 'minimized',
        currentTime: 45,
        isMuted: false,
      };

      const next = livePlayerReducer(minimizedState, {
        type: 'PLAY',
        stream: { ...mockStreamA, title: 'Updated Title' },
      });

      expect(next.mode).toBe('minimized');
      expect(next.currentTime).toBe(45);
      expect(next.activeStream?.title).toBe('Updated Title');
    });

    it('resets currentTime to 0 when playing a completely new stream without explicit startTime', () => {
      const playingA: LivePlayerState = {
        activeStream: mockStreamA,
        mode: 'floating',
        currentTime: 240,
        isMuted: false,
      };

      const playingB = livePlayerReducer(playingA, {
        type: 'PLAY',
        stream: mockStreamB,
      });

      expect(playingB.activeStream?.videoId).toBe(mockStreamB.videoId);
      expect(playingB.currentTime).toBe(0);
    });
  });

  describe('Mode Transitions & Guards', () => {
    it('prevents transitioning to active modes when activeStream is null', () => {
      const tryFloat = livePlayerReducer(initialLivePlayerState, { type: 'SET_MODE', mode: 'floating' });
      expect(tryFloat.mode).toBe('closed');

      const tryMin = livePlayerReducer(initialLivePlayerState, { type: 'MINIMIZE' });
      expect(tryMin.mode).toBe('closed');

      const tryModal = livePlayerReducer(initialLivePlayerState, { type: 'EXPAND_MODAL' });
      expect(tryModal.mode).toBe('closed');

      const tryPip = livePlayerReducer(initialLivePlayerState, { type: 'SET_PIP', active: true });
      expect(tryPip.mode).toBe('closed');
    });

    it('transitions between floating and minimized via TOGGLE_MINIMIZE', () => {
      const activeState: LivePlayerState = {
        activeStream: mockStreamA,
        mode: 'floating',
        currentTime: 10,
        isMuted: false,
      };

      const minimized = livePlayerReducer(activeState, { type: 'TOGGLE_MINIMIZE' });
      expect(minimized.mode).toBe('minimized');
      expect(isPlayerMinimized(minimized)).toBe(true);

      const restored = livePlayerReducer(minimized, { type: 'TOGGLE_MINIMIZE' });
      expect(restored.mode).toBe('floating');
      expect(isPlayerMinimized(restored)).toBe(false);
    });

    it('toggles minimize from modal directly to minimized', () => {
      const modalState: LivePlayerState = {
        activeStream: mockStreamA,
        mode: 'modal',
        currentTime: 10,
        isMuted: false,
      };

      const minimized = livePlayerReducer(modalState, { type: 'TOGGLE_MINIMIZE' });
      expect(minimized.mode).toBe('minimized');
    });

    it('transitions to modal via EXPAND_MODAL and restores via COLLAPSE_MODAL', () => {
      const activeState: LivePlayerState = {
        activeStream: mockStreamA,
        mode: 'floating',
        currentTime: 50,
        isMuted: false,
      };

      const modal = livePlayerReducer(activeState, { type: 'EXPAND_MODAL' });
      expect(modal.mode).toBe('modal');
      expect(isPlayerModal(modal)).toBe(true);

      const collapsed = livePlayerReducer(modal, { type: 'COLLAPSE_MODAL' });
      expect(collapsed.mode).toBe('floating');
      expect(isPlayerModal(collapsed)).toBe(false);
    });

    it('handles Picture-in-Picture mode activation and deactivation', () => {
      const activeState: LivePlayerState = {
        activeStream: mockStreamA,
        mode: 'floating',
        currentTime: 10,
        isMuted: false,
      };

      const pip = livePlayerReducer(activeState, { type: 'SET_PIP', active: true });
      expect(pip.mode).toBe('pip');
      expect(isPlayerPip(pip)).toBe(true);

      const unPip = livePlayerReducer(pip, { type: 'SET_PIP', active: false });
      expect(unPip.mode).toBe('floating');
      expect(isPlayerPip(unPip)).toBe(false);
    });

    it('resets completely back to initial state on CLOSE', () => {
      const activeState: LivePlayerState = {
        activeStream: mockStreamA,
        mode: 'modal',
        currentTime: 500,
        isMuted: true,
      };

      const closed = livePlayerReducer(activeState, { type: 'CLOSE' });
      expect(closed).toEqual(initialLivePlayerState);
      expect(isPlayerOpen(closed)).toBe(false);
    });

    it('updates playback time cleanly and handles negative timestamps', () => {
      const activeState: LivePlayerState = {
        activeStream: mockStreamA,
        mode: 'floating',
        currentTime: 0,
        isMuted: false,
      };

      const updated = livePlayerReducer(activeState, { type: 'UPDATE_TIME', currentTime: 73.8 });
      expect(updated.currentTime).toBe(73);

      const negativeHandled = livePlayerReducer(activeState, { type: 'UPDATE_TIME', currentTime: -5 });
      expect(negativeHandled.currentTime).toBe(0);
    });
  });

  describe('Session Storage Persistence & Hydration', () => {
    it('serializes active player state with study session metadata', () => {
      const activeState: LivePlayerState = {
        activeStream: mockStreamA,
        mode: 'minimized',
        currentTime: 120,
        isMuted: true,
      };

      const serialized = serializeLivePlayerSession(activeState, {
        studySession: { videoId: 'dQw4w9WgXcQ', title: 'Study Notes Test' },
        isStudyNotesOpen: true,
        studyLayoutMode: 'focus',
      });

      expect(serialized).not.toBeNull();
      const parsed = JSON.parse(serialized!);
      expect(parsed.activeStream.videoId).toBe(mockStreamA.videoId);
      expect(parsed.mode).toBe('minimized');
      expect(parsed.currentTime).toBe(120);
      expect(parsed.isOpen).toBe(true);
      expect(parsed.isMinimized).toBe(true);
      expect(parsed.studyLayoutMode).toBe('focus');
    });

    it('returns null when serializing a player with no activeStream', () => {
      expect(serializeLivePlayerSession(initialLivePlayerState)).toBeNull();
    });

    it('hydrates serialized modern session payload correctly', () => {
      const now = 1000000;
      const payload = {
        activeStream: mockStreamA,
        mode: 'modal' as const,
        currentTime: 85,
        isMuted: false,
        updatedAt: now - 5000, // 5 seconds ago
      };

      const hydrated = hydrateLivePlayerSession(JSON.stringify(payload), now);
      expect(hydrated).not.toBeNull();
      expect(hydrated?.playerState.mode).toBe('modal');
      expect(hydrated?.playerState.activeStream?.videoId).toBe(mockStreamA.videoId);
      expect(hydrated?.playerState.currentTime).toBe(85);
    });

    it('migrates legacy session payload with isOpen/isMinimized boolean flags', () => {
      const now = 1000000;
      const legacyPayload = {
        activeStream: mockStreamA,
        isOpen: true,
        isMinimized: true,
        currentTime: 30,
        updatedAt: now - 10000,
      };

      const hydrated = hydrateLivePlayerSession(JSON.stringify(legacyPayload), now);
      expect(hydrated).not.toBeNull();
      expect(hydrated?.playerState.mode).toBe('minimized');
      expect(hydrated?.playerState.currentTime).toBe(30);
    });

    it('rejects expired sessions older than 30 minutes', () => {
      const now = 100000000;
      const expiredPayload = {
        activeStream: mockStreamA,
        mode: 'floating' as const,
        updatedAt: now - (31 * 60 * 1000), // 31 minutes ago
      };

      const hydrated = hydrateLivePlayerSession(JSON.stringify(expiredPayload), now);
      expect(hydrated).toBeNull();
    });

    it('handles invalid or corrupted JSON gracefully without throwing', () => {
      expect(hydrateLivePlayerSession(null)).toBeNull();
      expect(hydrateLivePlayerSession('')).toBeNull();
      expect(hydrateLivePlayerSession('{invalid_json}')).toBeNull();
    });
  });
});
