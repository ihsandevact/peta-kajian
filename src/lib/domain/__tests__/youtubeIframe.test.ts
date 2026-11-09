import { describe, it, expect, vi } from 'vitest';
import {
  formatYouTubeCommand,
  sendYouTubeCommand,
  sendPlayVideo,
  sendPauseVideo,
  sendStopVideo,
  sendMute,
  sendUnmute,
  sendSeekTo,
  sendListening,
  parseYouTubeIframeMessage,
} from '../youtubeIframe';

describe('YouTube Player Iframe Adapter', () => {
  describe('Command Formatting', () => {
    it('formats playVideo command', () => {
      const formatted = formatYouTubeCommand({ func: 'playVideo' });
      expect(JSON.parse(formatted)).toEqual({
        event: 'command',
        func: 'playVideo',
        args: [],
      });
    });

    it('formats seekTo command with arguments', () => {
      const formatted = formatYouTubeCommand({ func: 'seekTo', args: [120, true] });
      expect(JSON.parse(formatted)).toEqual({
        event: 'command',
        func: 'seekTo',
        args: [120, true],
      });
    });

    it('formats listening event correctly', () => {
      const formatted = formatYouTubeCommand({ func: 'listening' });
      expect(JSON.parse(formatted)).toEqual({
        event: 'listening',
      });
    });
  });

  describe('Sending Commands to Targets', () => {
    it('returns false when target is null or undefined', () => {
      expect(sendYouTubeCommand(null, { func: 'playVideo' })).toBe(false);
      expect(sendYouTubeCommand(undefined, { func: 'playVideo' })).toBe(false);
    });

    it('dispatches postMessage to a target Window', () => {
      const postMessageMock = vi.fn();
      const mockWindow = { postMessage: postMessageMock } as unknown as Window;

      const success = sendYouTubeCommand(mockWindow, { func: 'playVideo' }, '*');
      expect(success).toBe(true);
      expect(postMessageMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(postMessageMock.mock.calls[0][0])).toEqual({
        event: 'command',
        func: 'playVideo',
        args: [],
      });
    });

    it('dispatches postMessage to an HTMLIFrameElement with contentWindow', () => {
      const postMessageMock = vi.fn();
      const mockIframe = {
        contentWindow: { postMessage: postMessageMock },
      } as unknown as HTMLIFrameElement;

      const success = sendPlayVideo(mockIframe);
      expect(success).toBe(true);
      expect(postMessageMock).toHaveBeenCalledWith(
        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
        '*'
      );
    });

    it('sendUnmute sends unMute, setVolume, and play commands', () => {
      const postMessageMock = vi.fn();
      const mockWindow = { postMessage: postMessageMock } as unknown as Window;

      sendUnmute(mockWindow, 80);
      expect(postMessageMock).toHaveBeenCalledTimes(2);
      expect(JSON.parse(postMessageMock.mock.calls[0][0])).toEqual({
        event: 'command',
        func: 'unMute',
        args: [],
      });
      expect(JSON.parse(postMessageMock.mock.calls[1][0])).toEqual({
        event: 'command',
        func: 'setVolume',
        args: [80],
      });
    });

    it('handles exceptions in postMessage gracefully and returns false', () => {
      const throwingWindow = {
        postMessage: () => {
          throw new Error('SecurityError: Blocked cross-origin');
        },
      } as unknown as Window;

      expect(sendYouTubeCommand(throwingWindow, { func: 'playVideo' })).toBe(false);
    });
  });

  describe('Message Parsing', () => {
    it('returns null for null, undefined, or empty payloads', () => {
      expect(parseYouTubeIframeMessage(null)).toBeNull();
      expect(parseYouTubeIframeMessage(undefined)).toBeNull();
      expect(parseYouTubeIframeMessage('')).toBeNull();
    });

    it('parses onReady event from JSON string or object', () => {
      expect(parseYouTubeIframeMessage('{"event":"onReady"}')).toEqual({ type: 'ready' });
      expect(parseYouTubeIframeMessage({ event: 'onReady' })).toEqual({ type: 'ready' });
    });

    it('parses onStateChange event with numeric state', () => {
      const result = parseYouTubeIframeMessage('{"event":"onStateChange","info":1}');
      expect(result).toEqual({ type: 'stateChange', state: 1 });
    });

    it('parses onError event with error code', () => {
      const result = parseYouTubeIframeMessage('{"event":"onError","info":101}');
      expect(result).toEqual({ type: 'error', code: 101 });
    });

    it('parses infoDelivery event with player state, currentTime, and duration', () => {
      const payload = {
        event: 'infoDelivery',
        info: {
          currentTime: 142.5,
          duration: 3600,
          playerState: 1,
          muted: false,
        },
      };

      const result = parseYouTubeIframeMessage(JSON.stringify(payload));
      expect(result).toEqual({
        type: 'info',
        info: {
          currentTime: 142.5,
          duration: 3600,
          playerState: 1,
          muted: false,
        },
      });
    });

    it('returns null for non-YouTube / arbitrary JSON objects', () => {
      expect(parseYouTubeIframeMessage('{"type":"webpackOk"}')).toBeNull();
      expect(parseYouTubeIframeMessage({ otherPlugin: 123 })).toBeNull();
    });
  });
});
