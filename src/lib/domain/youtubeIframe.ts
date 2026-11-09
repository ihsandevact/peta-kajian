/**
 * YouTube Player Iframe Adapter
 *
 * Modul typed untuk enkapsulasi protokol komunikasi postMessage dengan iframe YouTube.
 * Menghilangkan repetisi stringified command dan parsing ad-hoc di komponen-komponen UI.
 */

export type YouTubeCommand =
  | { func: 'playVideo'; args?: [] }
  | { func: 'pauseVideo'; args?: [] }
  | { func: 'stopVideo'; args?: [] }
  | { func: 'mute'; args?: [] }
  | { func: 'unMute'; args?: [] }
  | { func: 'setVolume'; args: [volume: number] }
  | { func: 'seekTo'; args: [seconds: number, allowSeekAhead?: boolean] }
  | { func: 'listening'; args?: [] };

export interface YouTubePlayerInfo {
  playerState?: number;
  currentTime?: number;
  duration?: number;
  muted?: boolean;
  volume?: number;
  videoData?: {
    video_id?: string;
    title?: string;
    author?: string;
  };
}

export type YouTubeIframeEvent =
  | { type: 'ready' }
  | { type: 'stateChange'; state: number }
  | { type: 'info'; info: YouTubePlayerInfo }
  | { type: 'error'; code: number }
  | { type: 'unknown'; raw: any };

/**
 * Format payload perintah YouTube ke format string JSON yang dikenali player YouTube
 */
export function formatYouTubeCommand(command: YouTubeCommand): string {
  if (command.func === 'listening') {
    return JSON.stringify({ event: 'listening' });
  }

  return JSON.stringify({
    event: 'command',
    func: command.func,
    args: command.args || [],
  });
}

/**
 * Kirim perintah postMessage ke iframe YouTube dengan penanganan error dan pengecekan target
 */
export function sendYouTubeCommand(
  target: Window | HTMLIFrameElement | null | undefined,
  command: YouTubeCommand,
  targetOrigin = '*'
): boolean {
  if (!target) return false;

  try {
    const targetWindow: Window | null =
      'contentWindow' in target ? target.contentWindow : target;

    if (!targetWindow) return false;

    const message = formatYouTubeCommand(command);
    targetWindow.postMessage(message, targetOrigin);
    return true;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// SHORTCUT CONVENIENCE HELPERS
// -------------------------------------------------------------

export function sendPlayVideo(target: Window | HTMLIFrameElement | null | undefined): boolean {
  return sendYouTubeCommand(target, { func: 'playVideo' });
}

export function sendPauseVideo(target: Window | HTMLIFrameElement | null | undefined): boolean {
  return sendYouTubeCommand(target, { func: 'pauseVideo' });
}

export function sendStopVideo(target: Window | HTMLIFrameElement | null | undefined): boolean {
  return sendYouTubeCommand(target, { func: 'stopVideo' });
}

export function sendMute(target: Window | HTMLIFrameElement | null | undefined): boolean {
  return sendYouTubeCommand(target, { func: 'mute' });
}

export function sendUnmute(
  target: Window | HTMLIFrameElement | null | undefined,
  volume = 100
): boolean {
  const unmuted = sendYouTubeCommand(target, { func: 'unMute' });
  sendYouTubeCommand(target, { func: 'setVolume', args: [volume] });
  return unmuted;
}

export function sendSeekTo(
  target: Window | HTMLIFrameElement | null | undefined,
  seconds: number,
  allowSeekAhead = true
): boolean {
  return sendYouTubeCommand(target, { func: 'seekTo', args: [seconds, allowSeekAhead] });
}

export function sendListening(target: Window | HTMLIFrameElement | null | undefined): boolean {
  return sendYouTubeCommand(target, { func: 'listening' });
}

/**
 * Parse pesan masuk dari window.addEventListener('message') untuk mendeteksi event YouTube
 */
export function parseYouTubeIframeMessage(data: unknown): YouTubeIframeEvent | null {
  if (!data) return null;

  let parsed: any = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  // Pola event YouTube iframe
  if (parsed.event === 'onReady') {
    return { type: 'ready' };
  }

  if (parsed.event === 'onStateChange') {
    return {
      type: 'stateChange',
      state: typeof parsed.info === 'number' ? parsed.info : -1,
    };
  }

  if (parsed.event === 'onError') {
    return {
      type: 'error',
      code: typeof parsed.info === 'number' ? parsed.info : -1,
    };
  }

  if (parsed.event === 'infoDelivery' || parsed.event === 'initialDelivery') {
    if (parsed.info && typeof parsed.info === 'object') {
      return {
        type: 'info',
        info: parsed.info,
      };
    }
  }

  return null;
}
