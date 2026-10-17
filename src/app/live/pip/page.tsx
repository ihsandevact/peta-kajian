'use client';

import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
  fetchStudyNoteByVideo,
  upsertStudyNote,
  setLocalDraftNote,
  getLocalDraftNote,
  formatNoteForWhatsApp,
} from '@/utils/studyNotes';

function PipPlayerContent() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get('v');
  const title = searchParams.get('title') || 'Live Kajian';
  const channel = searchParams.get('channel') || 'Peta Kajian';
  const speaker = searchParams.get('speaker') || '';
  const startParam = searchParams.get('t') || searchParams.get('start') || '0';
  const initialStartSeconds = parseInt(startParam, 10) || 0;

  // State untuk Fitur Kustomisasi & Timestamp Resume
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [noteContent, setNoteContent] = useState('');
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [copiedToast, setCopiedToast] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Engine Undo / Redo & Textarea Ref
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const isHistoryActionRef = useRef<boolean>(false);
  const lastHistorySaveTimeRef = useRef<number>(0);

  const pipIframeRef = useRef<HTMLIFrameElement>(null);
  const pipPlaybackTimeRef = useRef<number>(initialStartSeconds);
  const autoPlayTriggeredRef = useRef(false);

  // Helper picu playVideo SAJA (JANGAN panggil unMute di sini agar browser tidak memblokir dan menjeda video!)
  const sendPlayVideo = useCallback(() => {
    try {
      if (pipIframeRef.current?.contentWindow) {
        pipIframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
          '*'
        );
      }
    } catch {}
  }, []);

  // Helper unMute (HANYA boleh dipanggil saat ada gesture/interaksi nyata pengguna!)
  const sendUnmuteAndPlay = useCallback(() => {
    try {
      if (pipIframeRef.current?.contentWindow) {
        pipIframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
          '*'
        );
        pipIframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
          '*'
        );
        pipIframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
          '*'
        );
      }
    } catch {}
    setIsMuted(false);
  }, []);

  // Pasang listener interaksi pengguna di jendela PiP (hanya event interaksi fisik nyata)
  useEffect(() => {
    window.addEventListener('pointerdown', sendUnmuteAndPlay);
    window.addEventListener('click', sendUnmuteAndPlay);
    window.addEventListener('keydown', sendUnmuteAndPlay);

    return () => {
      window.removeEventListener('pointerdown', sendUnmuteAndPlay);
      window.removeEventListener('click', sendUnmuteAndPlay);
      window.removeEventListener('keydown', sendUnmuteAndPlay);
    };
  }, [sendUnmuteAndPlay]);

  // Handshake berkala ke YouTube iframe agar secara kontinu mengirimkan telemetry infoDelivery & picu playVideo
  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(() => {
      try {
        if (pipIframeRef.current?.contentWindow) {
          pipIframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
            '*'
          );

          if (attempts < 6 && !autoPlayTriggeredRef.current) {
            sendPlayVideo();
            attempts++;
          }
        }
      } catch {}
    }, 500);

    return () => clearInterval(interval);
  }, [sendPlayVideo]);

  // Pantau update status pemutaran & waktu langsung dari iframe YouTube
  useEffect(() => {
    const handleYtMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;

        // Tangani event onReady dari YouTube widget -> segera putar video
        if (data?.event === 'onReady') {
          sendPlayVideo();
        }

        // Tangani info status mute jika terdeteksi dari YouTube
        if (typeof data?.info?.muted === 'boolean') {
          setIsMuted(data.info.muted);
        }

        const playerState = data?.info?.playerState;

        // Jika player dalam status CUED (5), UNSTARTED (-1), atau PAUSED (2) di awal
        if (playerState === 5 || playerState === -1 || (playerState === 2 && !autoPlayTriggeredRef.current)) {
          sendPlayVideo();
        } else if (playerState === 1) {
          // Status 1 = PLAYING (berhasil play)
          autoPlayTriggeredRef.current = true;
        }

        const time = data?.info?.currentTime ?? data?.currentTime;
        if (typeof time === 'number' && !isNaN(time)) {
          const floored = Math.floor(time);
          pipPlaybackTimeRef.current = floored;
          if (videoId && floored > 0) {
            try {
              localStorage.setItem(`peta_kajian_pip_time_${videoId}`, floored.toString());
            } catch {}
          }
        }
      } catch {}
    };
    window.addEventListener('message', handleYtMessage);
    return () => window.removeEventListener('message', handleYtMessage);
  }, [videoId, sendPlayVideo]);

  const getCurrentTimestamp = useCallback(() => {
    if (pipPlaybackTimeRef.current > 0) {
      return pipPlaybackTimeRef.current;
    }
    return initialStartSeconds;
  }, [initialStartSeconds]);

  // 1. Sinkronisasi Status & Detik Terakhir PiP dengan Jendela Utama (Cross-Window Sync)
  useEffect(() => {
    let broadcast: BroadcastChannel | null = null;
    try {
      broadcast = new BroadcastChannel('peta_kajian_pip_channel');
      broadcast.postMessage({ type: 'PIP_OPENED', videoId });

      broadcast.onmessage = (event) => {
        if (event.data?.type === 'PIP_PULL_BACK') {
          try {
            if (window.parent && window.parent !== window) {
              window.parent.close();
            }
          } catch {}
          window.close();
        }
      };
    } catch {
      // Abaikan jika browser tidak mendukung BroadcastChannel
    }

    const notifyClose = () => {
      const currentTime = getCurrentTimestamp();
      if (videoId && currentTime > 0) {
        try {
          localStorage.setItem(`peta_kajian_pip_time_${videoId}`, currentTime.toString());
        } catch {}
      }
      try {
        broadcast?.postMessage({ type: 'PIP_CLOSED', videoId, currentTime });
      } catch {}
      try {
        window.opener?.postMessage({ type: 'PIP_CLOSED', videoId, currentTime }, '*');
      } catch {}
    };

    window.addEventListener('beforeunload', notifyClose);
    window.addEventListener('pagehide', notifyClose);

    return () => {
      notifyClose();
      window.removeEventListener('beforeunload', notifyClose);
      window.removeEventListener('pagehide', notifyClose);
      try {
        broadcast?.close();
      } catch {}
    };
  }, [videoId, getCurrentTimestamp]);

  // Inisialisasi Riwayat Histori
  const initHistory = useCallback((initialVal: string) => {
    historyRef.current = [initialVal];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  // Simpan Otomatis Catatan
  const triggerAutoSave = useCallback(
    (val: string) => {
      if (!videoId) return;
      setLocalDraftNote(videoId, val);
      setSyncStatus('saving');

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (currentUser?.id) {
          try {
            await upsertStudyNote({
              user_id: currentUser.id,
              video_id: videoId,
              title,
              channel_name: channel,
              speaker_name: speaker,
              content: val,
            });
            setSyncStatus('saved');
          } catch {
            setSyncStatus('offline');
          }
        } else {
          setSyncStatus('offline');
        }
      }, 600);
    },
    [videoId, currentUser, title, channel, speaker]
  );

  // Catat Snapshot Riwayat untuk Undo & Redo
  const pushToHistory = useCallback((newVal: string, immediate: boolean = false) => {
    if (isHistoryActionRef.current) {
      isHistoryActionRef.current = false;
      return;
    }

    const now = Date.now();
    const currentHist = historyRef.current;
    const currentIdx = historyIndexRef.current;

    if (currentIdx >= 0 && currentHist[currentIdx] === newVal) {
      return;
    }

    if (!immediate && now - lastHistorySaveTimeRef.current < 700 && currentIdx > 0) {
      currentHist[currentIdx] = newVal;
      return;
    }

    lastHistorySaveTimeRef.current = now;
    const branch = currentHist.slice(0, currentIdx + 1);
    branch.push(newVal);
    if (branch.length > 60) {
      branch.shift();
    }
    historyRef.current = branch;
    historyIndexRef.current = branch.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  // Aksi Undo
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const prevVal = historyRef.current[historyIndexRef.current];
      isHistoryActionRef.current = true;
      setNoteContent(prevVal);
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(true);
      triggerAutoSave(prevVal);
    }
  }, [triggerAutoSave]);

  // Aksi Redo
  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const nextVal = historyRef.current[historyIndexRef.current];
      isHistoryActionRef.current = true;
      setNoteContent(nextVal);
      setCanUndo(true);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
      triggerAutoSave(nextVal);
    }
  }, [triggerAutoSave]);

  // Helper Sisipkan atau Bungkus Teks Pada Kursor (Selection-Aware)
  const wrapOrInsertText = useCallback(
    (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
      const textarea = noteTextareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const prev = textarea.value;
      const selected = prev.substring(start, end);

      if (selected.length > 0) {
        const insertStr = `${prefix}${selected}${suffix}`;
        const nextValue = prev.substring(0, start) + insertStr + prev.substring(end);
        setNoteContent(nextValue);
        pushToHistory(nextValue, true);
        triggerAutoSave(nextValue);

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
        }, 10);
      } else {
        const insertStr = `${prefix}${defaultPlaceholder}${suffix}`;
        const nextValue = prev.substring(0, start) + insertStr + prev.substring(end);
        setNoteContent(nextValue);
        pushToHistory(nextValue, true);
        triggerAutoSave(nextValue);

        setTimeout(() => {
          textarea.focus();
          if (defaultPlaceholder.length > 0) {
            textarea.setSelectionRange(start + prefix.length, start + prefix.length + defaultPlaceholder.length);
          } else {
            textarea.setSelectionRange(start + insertStr.length, start + insertStr.length);
          }
        }, 10);
      }
    },
    [pushToHistory, triggerAutoSave]
  );

  const handleInsertTimestamp = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    wrapOrInsertText(`\n[${timeStr} WIB] `, '', '');
  };

  const handleInsertPoint = () => {
    wrapOrInsertText('\n• ', '', '');
  };

  const handleInsertNumbered = () => {
    wrapOrInsertText('\n1. ', '', '');
  };

  const handleInsertHeading = () => {
    wrapOrInsertText('\n### ', '', 'Judul Bab / Topik');
  };

  const handleInsertDalil = () => {
    wrapOrInsertText('\n> 📖 "', '"\n', 'Tuliskan dalil / hadits di sini');
  };

  const handleInsertBold = () => {
    wrapOrInsertText('**', '**', 'teks tebal');
  };

  const handleInsertItalic = () => {
    wrapOrInsertText('*', '*', 'teks miring');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else {
        e.preventDefault();
        handleUndo();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      handleRedo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      handleInsertBold();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      handleInsertItalic();
    }
  };

  // 2. Muat Status User & Catatan Faidah Tersimpan
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user || null;
      setCurrentUser(user);

      if (videoId) {
        // Cek draft lokal terlebih dahulu
        const localDraft = getLocalDraftNote(videoId);
        if (localDraft) {
          setNoteContent(localDraft);
          initHistory(localDraft);
        }

        // Jika user login, ambil data tersimpan dari cloud
        if (user) {
          fetchStudyNoteByVideo(user.id, videoId).then((note) => {
            if (note?.content) {
              setNoteContent(note.content);
              initHistory(note.content);
            }
          });
        }
      }
    });
  }, [videoId, initHistory]);

  // 3. Debounced Auto-Save untuk Catatan Faidah
  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNoteContent(val);
    pushToHistory(val, false);
    triggerAutoSave(val);
  };

  // 4. Salin Catatan Faidah ke Clipboard / Format WhatsApp
  const handleCopyNote = useCallback(() => {
    if (!noteContent.trim()) return;

    const formatted = formatNoteForWhatsApp({
      title,
      speaker_name: speaker,
      channel_name: channel,
      video_id: videoId,
      content: noteContent,
    });

    navigator.clipboard.writeText(formatted).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    });
  }, [noteContent, title, speaker, channel, videoId]);

  // 5. Toggle Panel Catatan Faidah dengan Auto-Expand Lebar Jendela
  const handleToggleNotes = () => {
    setIsNotesOpen((prev) => {
      const next = !prev;
      if (next && typeof window !== 'undefined') {
        try {
          if (window.parent && window.parent !== window && window.parent.resizeTo) {
            window.parent.resizeTo(window.parent.outerWidth + 300, window.parent.outerHeight);
          } else if (window.innerWidth < 660) {
            window.resizeTo(window.outerWidth + 300, window.outerHeight);
          }
        } catch {}
      }
      return next;
    });
  };

  // 6. Kembalikan Pemutaran ke Tab Web Utama (Auto-Focus Back to Web)
  const handleReturnToWeb = useCallback(() => {
    const currentTimestamp = getCurrentTimestamp();
    if (videoId && currentTimestamp > 0) {
      try {
        localStorage.setItem(`peta_kajian_pip_time_${videoId}`, currentTimestamp.toString());
      } catch {}
    }

    try {
      window.opener?.focus();
    } catch {}

    try {
      if (window.parent && window.parent !== window) {
        try {
          (window.parent as any).opener?.focus();
        } catch {}
        try {
          window.parent.focus();
        } catch {}
        window.parent.close();
      }
    } catch {}

    try {
      const broadcast = new BroadcastChannel('peta_kajian_pip_channel');
      broadcast.postMessage({ type: 'PIP_PULL_BACK', videoId, currentTime: currentTimestamp });
      broadcast.close();
    } catch {}

    try {
      window.close();
    } catch {}
  }, [videoId, getCurrentTimestamp]);

  if (!videoId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 text-xs font-sans">
        Video ID tidak valid.
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black text-white flex flex-col font-sans select-none overflow-hidden">
      {/* 1. CUSTOM TOP CONTROL HEADER */}
      <div className="px-3 py-2 bg-neutral-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
        
        {/* Sisi Kiri: Live Badge & Info Kanal */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-600 text-white shrink-0">
            LIVE
          </span>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-bold text-white/95 truncate">
              {channel}
            </span>
            <span className="text-xs text-white/40 truncate hidden sm:inline" title={title}>
              • {title}
            </span>
          </div>
        </div>

        {/* Sisi Kanan: Tombol Suara (jika audio terhalang browser) & Tombol Catatan Faidah */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Tombol Suara (Aktifkan Suara jika diblokir Autoplay Policy) */}
          {isMuted && (
            <button
              type="button"
              onClick={sendUnmuteAndPlay}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[10px] sm:text-[11px] shadow-xs animate-pulse transition-all cursor-pointer"
              title="Klik untuk mengaktifkan audio kajian"
            >
              <span className="material-symbols-outlined text-[14px]">volume_off</span>
              <span>Aktifkan Suara</span>
            </button>
          )}

          {/* Tombol Toggle Catatan Faidah (Sticky Notes) */}
          <button
            type="button"
            onClick={handleToggleNotes}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer border ${
              isNotesOpen
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                : 'bg-white/5 border-white/10 text-white/80 hover:text-white hover:bg-white/10'
            }`}
            title={isNotesOpen ? 'Sembunyikan Catatan Faidah' : 'Buka Catatan Faidah'}
          >
            <span className="material-symbols-outlined text-[15px]">edit_note</span>
            <span>Catatan</span>
          </button>
        </div>
      </div>

      {/* 2. BODY KONTEN: SPLIT VIEW (YOUTUBE PLAYER + CATATAN FAIDAH) */}
      <div className="flex-1 w-full bg-black relative flex flex-row overflow-hidden">
        
        {/* Wadah YouTube Embed Player */}
        <div className="flex-1 h-full bg-black relative">
          <iframe
            ref={pipIframeRef}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0${initialStartSeconds > 0 ? `&start=${initialStartSeconds}` : ''}&enablejsapi=1&playsinline=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => {
              sendPlayVideo();
            }}
            className="w-full h-full border-0 absolute inset-0"
          />

          {/* Overlay Ringan Sekali Sentuh/Klik untuk Mengaktifkan Suara */}
          {isMuted && (
            <div
              onClick={sendUnmuteAndPlay}
              className="absolute inset-0 z-20 cursor-pointer flex flex-col items-center justify-center bg-black/15 hover:bg-black/25 transition-all select-none group"
              title="Klik di sini untuk mengaktifkan suara kajian"
            >
              <div className="px-3.5 py-1.5 rounded-full bg-neutral-900/90 hover:bg-neutral-900 text-amber-400 border border-amber-400/40 flex items-center gap-2 shadow-2xl backdrop-blur-md transition-transform group-hover:scale-105 active:scale-95 animate-pulse">
                <span className="material-symbols-outlined text-[18px]">volume_off</span>
                <span className="text-xs font-semibold text-white">Ketuk untuk Mengaktifkan Suara</span>
              </div>
            </div>
          )}
        </div>

        {/* Panel Samping Catatan Faidah (Sticky Notes) */}
        {isNotesOpen && (
          <div className="w-[280px] sm:w-[320px] shrink-0 h-full bg-neutral-900 border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-200">
            
            {/* Header Panel Catatan */}
            <div className="px-3 py-2 bg-neutral-800/90 border-b border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">edit_note</span>
                <span className="text-xs font-bold text-white">Catatan Faidah</span>
              </div>

              {/* Status Sync & Aksi Salin */}
              <div className="flex items-center gap-1">
                {syncStatus === 'saving' ? (
                  <span className="text-[10px] text-amber-400 flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Menyimpan...
                  </span>
                ) : syncStatus === 'saved' ? (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">done</span>
                    Tersimpan
                  </span>
                ) : (
                  <span className="text-[10px] text-blue-400">Lokal</span>
                )}

                {/* Tombol Salin Format WA */}
                <button
                  type="button"
                  onClick={handleCopyNote}
                  className="w-6 h-6 rounded-md hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer ml-1"
                  title="Salin Catatan Faidah (Format WhatsApp)"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                </button>

                {/* Tombol Sembunyikan Panel */}
                <button
                  type="button"
                  onClick={() => setIsNotesOpen(false)}
                  className="w-6 h-6 rounded-md hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Sembunyikan Panel Catatan"
                >
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Sub-toolbar Format Cepat Catatan Faidah */}
            <div className="px-2 py-1 bg-neutral-950/90 border-b border-white/10 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 select-none">
              {/* Tombol Undo */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                className={`w-6 h-5 rounded-md flex items-center justify-center transition-colors ${
                  canUndo
                    ? 'hover:bg-white/10 text-white/90 cursor-pointer'
                    : 'text-white/20 cursor-not-allowed'
                }`}
                title="Urungkan (Ctrl+Z)"
                aria-label="Undo"
              >
                <span className="material-symbols-outlined text-[14px]">undo</span>
              </button>

              {/* Tombol Redo */}
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                className={`w-6 h-5 rounded-md flex items-center justify-center transition-colors ${
                  canRedo
                    ? 'hover:bg-white/10 text-white/90 cursor-pointer'
                    : 'text-white/20 cursor-not-allowed'
                }`}
                title="Ulangi (Ctrl+Y)"
                aria-label="Redo"
              >
                <span className="material-symbols-outlined text-[14px]">redo</span>
              </button>

              {/* Garis Pemisah */}
              <div className="w-[1px] h-3.5 bg-white/20 mx-0.5 shrink-0" />

              {/* Bold */}
              <button
                type="button"
                onClick={handleInsertBold}
                className="w-6 h-5 rounded-md hover:bg-white/10 text-white/70 hover:text-white text-[11px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                title="Teks Tebal (Ctrl+B)"
              >
                B
              </button>

              {/* Italic */}
              <button
                type="button"
                onClick={handleInsertItalic}
                className="w-6 h-5 rounded-md hover:bg-white/10 text-white/70 hover:text-white text-[11px] font-serif italic font-bold flex items-center justify-center transition-colors cursor-pointer"
                title="Teks Miring (Ctrl+I)"
              >
                I
              </button>

              {/* Heading */}
              <button
                type="button"
                onClick={handleInsertHeading}
                className="w-6 h-5 rounded-md hover:bg-white/10 text-white/70 hover:text-white text-[11px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                title="Sub-judul Bab (###)"
              >
                H
              </button>

              {/* Nomor Urut (1.) */}
              <button
                type="button"
                onClick={handleInsertNumbered}
                className="px-1.5 py-0.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white text-[10px] font-bold transition-colors cursor-pointer"
                title="Daftar Nomor (1.)"
              >
                1.
              </button>

              {/* Bullet Poin */}
              <button
                type="button"
                onClick={handleInsertPoint}
                className="px-1.5 py-0.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
                title="Sisipkan Poin Faidah (•)"
              >
                • Poin
              </button>

              {/* Kutipan Dalil */}
              <button
                type="button"
                onClick={handleInsertDalil}
                className="px-1.5 py-0.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white text-[10px] font-semibold flex items-center gap-0.5 transition-colors cursor-pointer"
                title="Sisipkan Kutipan Dalil"
              >
                <span>📖 Dalil</span>
              </button>

              {/* Stempel Waktu */}
              <button
                type="button"
                onClick={handleInsertTimestamp}
                className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                title="Sisipkan Stempel Waktu Saat Ini"
              >
                <span className="material-symbols-outlined text-[12px]">schedule</span>
                <span>+ Waktu</span>
              </button>
            </div>

            {/* Area Tulis Catatan Faidah */}
            <div className="flex-1 p-2.5 flex flex-col bg-neutral-950/60 relative">
              <textarea
                ref={noteTextareaRef}
                value={noteContent}
                onChange={handleNoteChange}
                onKeyDown={handleKeyDown}
                placeholder="Tulis faidah kajian, dalil, poin nasihat asatidzah di sini... (Otomatis tersimpan)"
                className="w-full flex-1 bg-transparent text-white/95 placeholder-white/30 text-xs leading-relaxed font-sans resize-none outline-none focus:ring-0 p-1"
                autoFocus
              />

              {/* Toast Berhasil Salin */}
              {copiedToast && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-semibold shadow-lg animate-in fade-in zoom-in-95 duration-150 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  <span>Tersalin ke Clipboard!</span>
                </div>
              )}
            </div>

            {/* Footer Panel Catatan */}
            <div className="px-3 py-1.5 bg-neutral-800/60 border-t border-white/5 flex items-center justify-between text-[10px] text-white/50">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] text-emerald-400">cloud_done</span>
                Buku Saku Faidah
              </span>
              <span>{noteContent.length} karakter</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LivePipPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <PipPlayerContent />
    </Suspense>
  );
}
