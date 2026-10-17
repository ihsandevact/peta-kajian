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

  const [isMounted, setIsMounted] = useState(false);

  // State untuk Fitur Kustomisasi & Timestamp Resume
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [noteContent, setNoteContent] = useState('');
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [copiedToast, setCopiedToast] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const pipIframeRef = useRef<HTMLIFrameElement>(null);
  const pipPlaybackTimeRef = useRef<number>(initialStartSeconds);

  // Tandai sudah di-mount di browser client untuk mencegah React hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handshake berkala ke YouTube iframe agar secara kontinu mengirimkan telemetry infoDelivery (termasuk saat user seek)
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        if (pipIframeRef.current?.contentWindow) {
          pipIframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
            '*'
          );
        }
      } catch {}
    }, 600);

    return () => clearInterval(interval);
  }, []);

  // Pantau update waktu langsung dari iframe YouTube melalui postMessage API
  useEffect(() => {
    const handleYtMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        const time = data?.info?.currentTime ?? data?.currentTime;
        if (typeof time === 'number' && !isNaN(time)) {
          pipPlaybackTimeRef.current = Math.floor(time);
        }
      } catch {}
    };
    window.addEventListener('message', handleYtMessage);
    return () => window.removeEventListener('message', handleYtMessage);
  }, []);

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
          window.close();
        }
      };
    } catch {
      // Abaikan jika browser tidak mendukung BroadcastChannel
    }

    const notifyClose = () => {
      const currentTime = getCurrentTimestamp();
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
        }

        // Jika user login, ambil data tersimpan dari cloud
        if (user) {
          fetchStudyNoteByVideo(user.id, videoId).then((note) => {
            if (note?.content) {
              setNoteContent(note.content);
            }
          });
        }
      }
    });
  }, [videoId]);

  // 3. Debounced Auto-Save untuk Catatan Faidah
  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNoteContent(val);
    if (!videoId) return;

    // Backup ke localStorage
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
    }, 800);
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
      if (next && typeof window !== 'undefined' && window.innerWidth < 660) {
        try {
          window.resizeTo(window.outerWidth + 300, window.outerHeight);
        } catch {}
      }
      return next;
    });
  };

  // 6. Kembalikan Pemutaran ke Tab Web Utama
  const handleReturnToWeb = useCallback(() => {
    try {
      window.opener?.focus();
    } catch {}
    window.close();
  }, []);

  // Jangan render konten dinamis sebelum mount di browser untuk menghindari hydration mismatch
  if (!isMounted) {
    return <div className="fixed inset-0 w-screen h-screen bg-black" />;
  }

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

        {/* Sisi Kanan: Hanya Tombol Note, Ke Web, dan Tutup */}
        <div className="flex items-center gap-1.5 shrink-0">
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

          {/* Tombol Kembalikan ke Tab Utama Web */}
          <button
            type="button"
            onClick={handleReturnToWeb}
            className="px-2.5 py-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer border border-white/10 bg-white/5"
            title="Kembalikan pemutaran ke tab utama web"
          >
            <span className="material-symbols-outlined text-[15px]">tab</span>
            <span>Ke Web</span>
          </button>

          {/* Tombol Tutup Jendela */}
          <button
            type="button"
            onClick={() => window.close()}
            className="w-7 h-7 rounded-lg text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-0.5"
            title="Tutup Jendela"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>

      {/* 2. BODY KONTEN: SPLIT VIEW (YOUTUBE PLAYER + CATATAN FAIDAH) */}
      <div className="flex-1 w-full bg-black relative flex flex-row overflow-hidden">
        
        {/* Wadah YouTube Embed Player */}
        <div className="flex-1 h-full bg-black relative">
          <iframe
            ref={pipIframeRef}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0${initialStartSeconds > 0 ? `&start=${initialStartSeconds}` : ''}&enablejsapi=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => {
              try {
                pipIframeRef.current?.contentWindow?.postMessage(
                  JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
                  '*'
                );
              } catch {}
            }}
            className="w-full h-full border-0 absolute inset-0"
          />
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

            {/* Area Tulis Catatan Faidah */}
            <div className="flex-1 p-2.5 flex flex-col bg-neutral-950/60 relative">
              <textarea
                value={noteContent}
                onChange={handleNoteChange}
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
