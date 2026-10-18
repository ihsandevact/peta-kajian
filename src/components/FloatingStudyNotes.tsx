'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useLivePlayer } from '@/context/LivePlayerContext';
import StudyLoginModal from '@/components/StudyLoginModal';
import {
  fetchStudyNoteByVideo,
  upsertStudyNote,
  formatNoteForWhatsApp,
  getLocalDraftNote,
  setLocalDraftNote,
  getPendingStudySession,
  clearPendingStudySession,
  type PendingStudySession,
} from '@/utils/studyNotes';
import { FEATURE_FLAGS } from '@/config/features';

export default function FloatingStudyNotes() {
  const {
    studySession,
    isStudyNotesOpen,
    isStudyNotesMinimized,
    closeStudyNotes,
    toggleMinimizeStudyNotes,
    maximizeStudyNotes,
    openStudyMode,
    isOpen: isPlayerOpen,
    isMinimized: isPlayerMinimized,
    activeStream,
    playStream,
    maximizePlayer,
  } = useLivePlayer();

  const pathname = usePathname();
  const isPipRoute = pathname === '/live/pip' || pathname?.startsWith('/live/pip');

  // Auth & Login Guard
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingLoginSession, setPendingLoginSession] = useState<PendingStudySession | null>(null);

  // Content & Sync State
  const [noteContent, setNoteContent] = useState('');
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [copiedToast, setCopiedToast] = useState(false);

  // Engine Undo / Redo
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const isHistoryActionRef = useRef<boolean>(false);
  const lastHistorySaveTimeRef = useRef<number>(0);

  // Floating Position & Size
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [notesWidth, setNotesWidth] = useState<number>(360);
  const [notesHeight, setNotesHeight] = useState<number>(440);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [activeCorner, setActiveCorner] = useState<'bottom-left' | 'bottom-right' | null>(null);
  const [zIndex, setZIndex] = useState(55);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Status apakah pemutar video sedang memutar video dari sesi catatan ini
  const isCurrentVideoPlaying = isPlayerOpen && activeStream?.videoId === studySession?.videoId;

  const handlePlayCurrentVideo = useCallback(() => {
    if (!studySession) return;
    playStream({
      videoId: studySession.videoId,
      title: studySession.title,
      speakerName: studySession.speakerName || '',
      channelName: studySession.channelName || '',
    });
    if (isPlayerMinimized) {
      maximizePlayer();
    }
  }, [studySession, playStream, isPlayerMinimized, maximizePlayer]);

  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialLeft: number;
    initialTop: number;
  } | null>(null);

  const resizeStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialWidth: number;
    initialHeight: number;
    initialLeft: number;
    initialTop: number;
    corner: 'bottom-left' | 'bottom-right';
  } | null>(null);

  // 1. Muat Preferensi Ukuran dari localStorage saat mount
  useEffect(() => {
    try {
      const savedW = localStorage.getItem('peta_kajian_study_notes_width');
      const savedH = localStorage.getItem('peta_kajian_study_notes_height');
      if (savedW) {
        const valW = parseInt(savedW, 10);
        if (!isNaN(valW) && valW >= 280 && valW <= 680) {
          const maxAllowed = typeof window !== 'undefined' ? Math.min(valW, window.innerWidth - 24) : valW;
          setNotesWidth(Math.max(280, maxAllowed));
        }
      }
      if (savedH) {
        const valH = parseInt(savedH, 10);
        if (!isNaN(valH) && valH >= 240 && valH <= 720) {
          const maxHAllowed = typeof window !== 'undefined' ? Math.min(valH, window.innerHeight - 100) : valH;
          setNotesHeight(Math.max(240, maxHAllowed));
        }
      }
    } catch {
      // Abaikan
    }
  }, []);

  // Simpan ukuran ke localStorage setelah resize selesai
  useEffect(() => {
    if (!isResizing && notesWidth && notesHeight) {
      try {
        localStorage.setItem('peta_kajian_study_notes_width', notesWidth.toString());
        localStorage.setItem('peta_kajian_study_notes_height', notesHeight.toString());
      } catch {
        // Abaikan
      }
    }
  }, [notesWidth, notesHeight, isResizing]);

  // 2. Auth State Check & Pulihkan Sesi Tertunda Setelah Login Google
  useEffect(() => {
    async function initAuthAndPendingSession() {
      const supabase = createClient();
      let foundUser: any = null;
      try {
        const { data } = await supabase.auth.getUser();
        foundUser = data?.user || null;
      } catch {}

      if (!foundUser) {
        try {
          const { data: sess } = await supabase.auth.getSession();
          foundUser = sess?.session?.user || null;
        } catch {}
      }

      setCurrentUser(foundUser);
      setAuthChecked(true);

      const pending = getPendingStudySession();
      if (foundUser && pending) {
        clearPendingStudySession();
        openStudyMode({
          videoId: pending.videoId,
          title: pending.title,
          speakerName: pending.speakerName,
          channelName: pending.channelName,
          sessionId: pending.sessionId,
        });
      }
    }

    initAuthAndPendingSession();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [openStudyMode]);

  // 3. Gerbang Login: Jika user belum login saat membuka Mode Belajar
  useEffect(() => {
    if (isPipRoute || !authChecked) return;

    if (isStudyNotesOpen && studySession && !currentUser) {
      setPendingLoginSession({
        videoId: studySession.videoId,
        title: studySession.title,
        speakerName: studySession.speakerName,
        channelName: studySession.channelName,
        sessionId: studySession.sessionId,
      });
      setIsLoginModalOpen(true);
      closeStudyNotes();
    }
  }, [isPipRoute, isStudyNotesOpen, studySession, currentUser, authChecked, closeStudyNotes]);

  // Inisialisasi Riwayat Histori
  const initHistory = useCallback((initialVal: string) => {
    historyRef.current = [initialVal];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  // Simpan Perubahan ke Supabase dan localStorage (Auto-save)
  const triggerAutoSave = useCallback(
    (val: string) => {
      if (!studySession || !currentUser) return;
      setSyncStatus('saving');
      setLocalDraftNote(studySession.videoId, val);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        const result = await upsertStudyNote({
          user_id: currentUser.id,
          video_id: studySession.videoId,
          session_id: studySession.sessionId || null,
          title: studySession.title,
          speaker_name: studySession.speakerName || null,
          channel_name: studySession.channelName || null,
          content: val,
        });

        if (result) {
          setSyncStatus('saved');
        } else {
          setSyncStatus('offline');
        }
      }, 450);
    },
    [studySession, currentUser]
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

    // Jika perubahan beruntun akibat mengetik (< 700ms) dan bukan klik tombol format langsung,
    // perbarui slot histori saat ini agar undo tidak berjalan karakter-per-karakter
    if (!immediate && now - lastHistorySaveTimeRef.current < 700 && currentIdx > 0) {
      currentHist[currentIdx] = newVal;
      return;
    }

    lastHistorySaveTimeRef.current = now;
    // Potong cabang masa depan jika ada perubahan baru setelah undo
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

  // 4. Muat Catatan Kajian Saat Sesi Dibuka
  useEffect(() => {
    if (!isStudyNotesOpen || !studySession || !currentUser) {
      return;
    }

    let isMounted = true;

    async function loadNote() {
      setSyncStatus('saving');
      // 1. Cek draft lokal terlebih dahulu
      const localDraft = getLocalDraftNote(studySession!.videoId);
      if (localDraft) {
        setNoteContent(localDraft);
        initHistory(localDraft);
      }

      // 2. Ambil dari cloud Supabase
      const cloudNote = await fetchStudyNoteByVideo(currentUser.id, studySession!.videoId);
      if (isMounted) {
        if (cloudNote?.content) {
          setNoteContent(cloudNote.content);
          initHistory(cloudNote.content);
          setSyncStatus('saved');
        } else if (!localDraft) {
          const defaultTemplate =
            `Tema: ${studySession!.title}\n` +
            (studySession!.speakerName ? `Pemateri: ${studySession!.speakerName}\n` : '') +
            `Tautan Rekaman: https://youtu.be/${studySession!.videoId}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `• [Faidah 1]: `;
          setNoteContent(defaultTemplate);
          initHistory(defaultTemplate);
          setSyncStatus('saved');
        } else {
          setSyncStatus('saved');
        }
      }
    }

    loadNote();

    return () => {
      isMounted = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isStudyNotesOpen, studySession, currentUser, initHistory]);

  // 5. Perubahan Konten Input oleh Pengguna
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNoteContent(val);
    pushToHistory(val, false);
    triggerAutoSave(val);
  };

  // 6. Clamp Posisi agar Sticky Note selalu berada di dalam batas layar
  const clampPosition = useCallback(
    (x: number, y: number, customWidth?: number, customHeight?: number) => {
      if (typeof window === 'undefined') return { x, y };
      const width = customWidth || (isStudyNotesMinimized ? 260 : notesWidth);
      const height = customHeight || (isStudyNotesMinimized ? 48 : notesHeight);

      const padding = 12;
      const isMobile = window.innerWidth < 768;
      const bottomPadding = isMobile ? 72 : 16;

      const minX = padding;
      const maxX = Math.max(padding, window.innerWidth - width - padding);
      const minY = padding;
      const maxY = Math.max(padding, window.innerHeight - height - bottomPadding);

      return {
        x: Math.min(Math.max(x, minX), maxX),
        y: Math.min(Math.max(y, minY), maxY),
      };
    },
    [isStudyNotesMinimized, notesWidth, notesHeight]
  );

  // Default posisi awal yang cerdas (berdampingan di sebelah kiri floating video player pada desktop)
  useEffect(() => {
    if (isStudyNotesOpen && !position && typeof window !== 'undefined') {
      const isDesktop = window.innerWidth >= 1024;
      const defaultW = Math.min(notesWidth, window.innerWidth - 24);
      const defaultH = Math.min(notesHeight, window.innerHeight - 100);

      if (isDesktop) {
        // Letakkan di sebelah kiri area default player (player ~360px di kanan)
        const targetX = Math.max(16, window.innerWidth - defaultW - 390);
        const targetY = Math.max(16, window.innerHeight - defaultH - 24);
        setPosition(clampPosition(targetX, targetY, defaultW, defaultH));
      } else {
        // Di mobile letakkan di paruh bawah
        const targetX = 12;
        const targetY = Math.max(12, window.innerHeight - defaultH - 80);
        setPosition(clampPosition(targetX, targetY, defaultW, defaultH));
      }
    }
  }, [isStudyNotesOpen, position, notesWidth, notesHeight, clampPosition]);

  // Handler Pointer Drag
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
    };

    setIsDragging(true);
    setZIndex(58); // Angkat z-index saat aktif
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Abaikan
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.pointerX;
    const deltaY = e.clientY - dragStartRef.current.pointerY;

    const newX = dragStartRef.current.initialLeft + deltaX;
    const newY = dragStartRef.current.initialTop + deltaY;

    setPosition(clampPosition(newX, newY));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    dragStartRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Abaikan
    }
  };

  // Handler Pointer Resize Bebas
  const handleResizeDown = (
    e: React.PointerEvent,
    corner: 'bottom-left' | 'bottom-right'
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentPos = position || { x: rect.left, y: rect.top };
    if (!position) {
      setPosition(currentPos);
    }

    resizeStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialWidth: notesWidth,
      initialHeight: notesHeight,
      initialLeft: currentPos.x,
      initialTop: currentPos.y,
      corner,
    };

    setIsResizing(true);
    setActiveCorner(corner);
    setZIndex(58);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Abaikan
    }
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!isResizing || !resizeStartRef.current) return;

    const { pointerX, pointerY, initialWidth, initialHeight, initialLeft, initialTop, corner } =
      resizeStartRef.current;
    const deltaX = e.clientX - pointerX;
    const deltaY = e.clientY - pointerY;

    const minW = 280;
    const maxW = Math.min(680, window.innerWidth - 24);
    const minH = 240;
    const maxH = Math.min(720, window.innerHeight - 100);

    let targetWidth = initialWidth;
    let targetHeight = Math.min(Math.max(initialHeight + deltaY, minH), maxH);
    let newX = initialLeft;
    let newY = initialTop;

    if (corner === 'bottom-left') {
      targetWidth = Math.min(Math.max(initialWidth - deltaX, minW), maxW);
      const diffW = targetWidth - initialWidth;
      newX = initialLeft - diffW;
    } else if (corner === 'bottom-right') {
      targetWidth = Math.min(Math.max(initialWidth + deltaX, minW), maxW);
      newX = initialLeft;
    }

    const roundedW = Math.round(targetWidth);
    const roundedH = Math.round(targetHeight);
    setNotesWidth(roundedW);
    setNotesHeight(roundedH);
    setPosition(clampPosition(newX, newY, roundedW, roundedH));
  };

  const handleResizeUp = (e: React.PointerEvent) => {
    if (!isResizing) return;
    setIsResizing(false);
    setActiveCorner(null);
    resizeStartRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Abaikan
    }
  };

  // Re-clamp saat ukuran layar jendela diubah
  useEffect(() => {
    const handleResize = () => {
      setNotesWidth((prev) => Math.min(prev, window.innerWidth - 24));
      setNotesHeight((prev) => Math.min(prev, window.innerHeight - 100));
      setPosition((prev) => (prev ? clampPosition(prev.x, prev.y) : null));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  // Helper Sisipkan atau Bungkus Teks Pada Kursor (Selection-Aware)
  const wrapOrInsertText = useCallback(
    (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const prev = textarea.value;
      const selected = prev.substring(start, end);

      if (selected.length > 0) {
        // Bungkus teks yang sedang diseleksi
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
        // Sisipkan teks / placeholder di posisi kursor
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

  const handleCopyWhatsApp = async () => {
    if (!studySession) return;
    const formatted = formatNoteForWhatsApp({
      title: studySession.title,
      speaker_name: studySession.speakerName,
      channel_name: studySession.channelName,
      video_id: studySession.videoId,
      content: noteContent,
    });

    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch {
      const el = document.createElement('textarea');
      el.value = formatted;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  const handleShareWhatsApp = () => {
    if (!studySession) return;
    const formatted = formatNoteForWhatsApp({
      title: studySession.title,
      speaker_name: studySession.speakerName,
      channel_name: studySession.channelName,
      video_id: studySession.videoId,
      content: noteContent,
    });
    const waUrl = `https://wa.me/?text=${encodeURIComponent(formatted)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadNote = () => {
    if (!studySession) return;
    const cleanTitle = studySession.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
    const headerPrefix = `Catatan Faidah: ${studySession.title}\n` +
      (studySession.speakerName ? `Pemateri: ${studySession.speakerName}\n` : '') +
      `Tautan Rekaman: https://youtu.be/${studySession.videoId}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n`;
    const fullText = noteContent.includes('youtu.be') ? noteContent : `${headerPrefix}${noteContent}`;
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Catatan_${cleanTitle}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isPipRoute) {
    return null;
  }

  if (!isStudyNotesOpen || !studySession || !currentUser) {
    return (
      <StudyLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        pendingSession={pendingLoginSession}
      />
    );
  }

  // Hitung jumlah kata & karakter
  const wordCount = noteContent.trim() ? noteContent.trim().split(/\s+/).length : 0;
  const charCount = noteContent.length;

  return (
    <>
      {/* Modal Ajakan Login Khusus Mode Belajar */}
      <StudyLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        pendingSession={pendingLoginSession}
      />

      {/* Overlay Drag / Resize Transparan untuk menangkap pointer */}
      {(isDragging || isResizing) && (
        <div
          className={`fixed inset-0 z-[70] select-none ${
            isResizing
              ? activeCorner === 'bottom-left'
                ? 'cursor-nesw-resize'
                : 'cursor-nwse-resize'
              : 'cursor-move'
          }`}
          style={{ touchAction: 'none' }}
        />
      )}

      {/* WADAH FLOATING STICKY NOTE */}
      <div
        ref={containerRef}
        onPointerDown={() => setZIndex(58)}
        style={{
          position: 'fixed',
          zIndex,
          left: position ? `${position.x}px` : undefined,
          top: position ? `${position.y}px` : undefined,
          right: !position ? '390px' : undefined,
          bottom: !position ? '20px' : undefined,
          width: isStudyNotesMinimized ? 'auto' : `${notesWidth}px`,
          height: isStudyNotesMinimized ? 'auto' : `${notesHeight}px`,
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100vh - 40px)',
          touchAction: 'none',
        }}
        className={`font-geist transition-shadow ${
          FEATURE_FLAGS.ENABLE_MOBILE_STUDY_NOTES ? '' : 'hidden md:block'
        }`}
      >
        {/* ========================================================
            KONDISI A: MINIMIZED FLOATING PILL (Pill Catatan Mengambang)
            ======================================================== */}
        {isStudyNotesMinimized ? (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: 'none' }}
            className="h-12 px-3.5 rounded-full bg-surface-container-lowest/95 dark:bg-neutral-900/95 backdrop-blur-md border border-amber-500/40 dark:border-amber-500/50 hover:border-amber-500/80 shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-2 duration-200 cursor-move hover:bg-surface-container-low transition-colors select-none"
            title="Klik dan tahan untuk menggeser catatan"
          >
            {/* Ikon Catatan & Status Sync */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                <span className="material-symbols-outlined text-[17px]">edit_note</span>
              </span>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  syncStatus === 'saving'
                    ? 'bg-amber-400 animate-ping'
                    : syncStatus === 'saved'
                    ? 'bg-emerald-500'
                    : 'bg-neutral-400'
                }`}
                title={syncStatus === 'saved' ? 'Tersimpan' : 'Menyimpan...'}
              />
            </div>

            {/* Judul Catatan */}
            <div className="min-w-0 max-w-[150px] sm:max-w-[200px]">
              <p className="text-[11px] font-bold text-on-surface truncate leading-tight">
                📝 Catatan Faidah
              </p>
              <p className="text-[10px] text-outline truncate leading-tight">
                {studySession.title}
              </p>
            </div>

            {/* Aksi Pill */}
            <div
              className="flex items-center gap-1 shrink-0 ml-1"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={maximizeStudyNotes}
                className="w-7 h-7 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 flex items-center justify-center transition-colors cursor-pointer"
                title="Buka Catatan Kembali"
                aria-label="Buka Catatan"
              >
                <span className="material-symbols-outlined text-[17px]">expand_less</span>
              </button>

              <button
                type="button"
                onClick={closeStudyNotes}
                className="w-7 h-7 rounded-full hover:bg-surface-container text-outline hover:text-red-500 flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup Catatan"
                aria-label="Tutup Catatan"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================
             KONDISI B: EXPANDED FLOATING STICKY NOTE (Sticky Card Penuh)
             ======================================================== */
          <div className="relative w-full h-full rounded-2xl bg-surface-container-lowest/98 dark:bg-neutral-900/98 backdrop-blur-md border border-amber-500/35 dark:border-amber-500/40 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-3 duration-250">
            {/* Pita Aksen Sticky Note di Atas */}
            <div className="h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-500 shrink-0" />

            {/* 1. HEADER STICKY NOTE (Pegangan Drag) */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{ touchAction: 'none' }}
              className="px-3 py-2 bg-amber-500/10 dark:bg-amber-500/15 hover:bg-amber-500/20 border-b border-surface-container-high/60 flex items-center justify-between gap-2 cursor-move transition-colors select-none shrink-0"
              title="Klik dan tahan di sini untuk menggeser posisi catatan"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="material-symbols-outlined text-[18px] text-amber-600 dark:text-amber-400 shrink-0">
                  edit_note
                </span>
                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-on-surface truncate">
                      Catatan Faidah
                    </span>
                    {/* Badge Sync Status */}
                    <span
                      className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.2 rounded-full shrink-0 ${
                        syncStatus === 'saving'
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          : syncStatus === 'saved'
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : 'bg-neutral-500/20 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          syncStatus === 'saving'
                            ? 'bg-amber-500 animate-ping'
                            : syncStatus === 'saved'
                            ? 'bg-emerald-500'
                            : 'bg-neutral-400'
                        }`}
                      />
                      {syncStatus === 'saving'
                        ? 'Menyimpan...'
                        : syncStatus === 'saved'
                        ? 'Tersimpan'
                        : 'Lokal'}
                    </span>
                  </div>
                  <span className="text-[10px] text-outline truncate max-w-[180px] sm:max-w-[240px]">
                    {studySession.title}
                  </span>
                </div>
              </div>

              {/* Kontrol Kanan */}
              <div
                className="flex items-center gap-1 shrink-0"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* SATU-SATUNYA TRIGGER: Buka/Putar Video di Floating Player jika sedang tidak aktif */}
                {!isCurrentVideoPlaying && (
                  <button
                    type="button"
                    onClick={handlePlayCurrentVideo}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
                    title="Buka kembali video kajian di Floating Player"
                  >
                    <span className="material-symbols-outlined text-[13px]">play_circle</span>
                    <span>Putar Video</span>
                  </button>
                )}

                {/* Tombol Minimize ke Floating Pill */}
                <button
                  type="button"
                  onClick={toggleMinimizeStudyNotes}
                  className="w-6 h-6 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
                  title="Kecilkan ke Pill Melayang"
                  aria-label="Kecilkan Catatan"
                >
                  <span className="material-symbols-outlined text-[16px]">expand_more</span>
                </button>

                {/* Tombol Tutup Catatan */}
                <button
                  type="button"
                  onClick={closeStudyNotes}
                  className="w-6 h-6 rounded-lg text-outline hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors cursor-pointer"
                  title="Tutup Catatan"
                  aria-label="Tutup Catatan"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>

            {/* 2. TOOLBAR FORMAT CEPAT */}
            <div
              className="px-2.5 py-1.5 bg-surface-container-low/70 dark:bg-neutral-800/60 border-b border-surface-container-high/40 flex items-center justify-between gap-1 overflow-x-auto shrink-0 select-none no-scrollbar"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-1 shrink-0">
                {/* Tombol Undo */}
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className={`w-6 h-5 rounded-md flex items-center justify-center transition-colors ${
                    canUndo
                      ? 'hover:bg-surface-container text-on-surface cursor-pointer'
                      : 'text-outline/30 cursor-not-allowed'
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
                      ? 'hover:bg-surface-container text-on-surface cursor-pointer'
                      : 'text-outline/30 cursor-not-allowed'
                  }`}
                  title="Ulangi (Ctrl+Y)"
                  aria-label="Redo"
                >
                  <span className="material-symbols-outlined text-[14px]">redo</span>
                </button>

                {/* Garis Pemisah */}
                <div className="w-[1px] h-3.5 bg-surface-container-high/80 mx-0.5 shrink-0" />

                {/* Bold */}
                <button
                  type="button"
                  onClick={handleInsertBold}
                  className="w-6 h-5 rounded-md hover:bg-surface-container text-outline hover:text-on-surface text-[11px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                  title="Teks Tebal (Ctrl+B)"
                >
                  B
                </button>

                {/* Italic */}
                <button
                  type="button"
                  onClick={handleInsertItalic}
                  className="w-6 h-5 rounded-md hover:bg-surface-container text-outline hover:text-on-surface text-[11px] font-serif italic font-bold flex items-center justify-center transition-colors cursor-pointer"
                  title="Teks Miring (Ctrl+I)"
                >
                  I
                </button>

                {/* Heading (Sub-judul) */}
                <button
                  type="button"
                  onClick={handleInsertHeading}
                  className="w-6 h-5 rounded-md hover:bg-surface-container text-outline hover:text-on-surface text-[11px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                  title="Sub-judul Bab (###)"
                >
                  H
                </button>

                {/* Nomor Urut (1.) */}
                <button
                  type="button"
                  onClick={handleInsertNumbered}
                  className="px-1.5 py-0.5 rounded-md hover:bg-surface-container text-outline hover:text-on-surface text-[10px] font-bold transition-colors cursor-pointer"
                  title="Daftar Nomor (1.)"
                >
                  1.
                </button>

                {/* Bullet Poin */}
                <button
                  type="button"
                  onClick={handleInsertPoint}
                  className="px-1.5 py-0.5 rounded-md hover:bg-surface-container text-outline hover:text-on-surface text-[11px] font-bold transition-colors cursor-pointer"
                  title="Sisipkan Poin Faidah (•)"
                >
                  • Poin
                </button>

                {/* Kutipan Dalil */}
                <button
                  type="button"
                  onClick={handleInsertDalil}
                  className="px-1.5 py-0.5 rounded-md hover:bg-surface-container text-outline hover:text-on-surface text-[10px] font-semibold flex items-center gap-0.5 transition-colors cursor-pointer"
                  title="Sisipkan Kutipan Dalil"
                >
                  <span>📖 Dalil</span>
                </button>

                {/* Stempel Waktu */}
                <button
                  type="button"
                  onClick={handleInsertTimestamp}
                  className="px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Sisipkan Stempel Waktu Saat Ini"
                >
                  <span className="material-symbols-outlined text-[12px]">schedule</span>
                  <span>+ Waktu</span>
                </button>
              </div>

              {/* Aksi Ekspor */}
              <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-surface-container-high/60">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="w-6 h-5 rounded-md text-emerald-600 hover:bg-emerald-500/15 flex items-center justify-center transition-colors cursor-pointer"
                  title="Bagikan ke WhatsApp"
                >
                  <span className="material-symbols-outlined text-[14px]">share</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="w-6 h-5 rounded-md hover:bg-surface-container text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                  title="Salin Catatan"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copiedToast ? 'check' : 'content_copy'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadNote}
                  className="w-6 h-5 rounded-md hover:bg-surface-container text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                  title="Unduh (.txt)"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                </button>
              </div>
            </div>

            {/* 3. AREA EDITOR TEKS CATATAN */}
            <div
              className="flex-1 relative min-h-0 p-2.5 flex flex-col bg-amber-50/20 dark:bg-neutral-900/30"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <textarea
                ref={textareaRef}
                value={noteContent}
                onChange={handleContentChange}
                onKeyDown={handleKeyDown}
                placeholder="Tuliskan faidah penting, ayat, hadits, atau amalan di sini... (Mendukung Markdown)"
                className="w-full h-full resize-none border-0 bg-transparent text-base md:text-xs text-on-surface placeholder:text-outline/50 focus:outline-hidden leading-relaxed font-sans"
                spellCheck={false}
              />

              {/* Toast Indikator Berhasil Disalin */}
              {copiedToast && (
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold shadow-lg animate-in fade-in duration-150 flex items-center gap-1 pointer-events-none">
                  <span className="material-symbols-outlined text-[13px]">check</span>
                  Catatan disalin!
                </div>
              )}
            </div>

            {/* 4. FOOTER INFO & RESIZE HANDLES */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{ touchAction: 'none' }}
              className="px-3 py-1.5 bg-surface-container-low/90 dark:bg-neutral-800/80 border-t border-surface-container-high/60 flex items-center justify-between text-[9px] text-outline select-none shrink-0 cursor-move relative"
            >
              {/* Gagang Resize Sudut Kiri-Bawah */}
              <div
                onPointerDown={(e) => handleResizeDown(e, 'bottom-left')}
                onPointerMove={handleResizeMove}
                onPointerUp={handleResizeUp}
                onPointerCancel={handleResizeUp}
                style={{ touchAction: 'none' }}
                className="absolute bottom-0 left-0 w-5 h-5 z-20 flex items-end justify-start p-1 cursor-nesw-resize text-outline/40 hover:text-amber-500 transition-colors group/bl"
                title="Tarik untuk mengubah ukuran catatan"
              >
                <svg className="w-2 h-2 text-outline/40 group-hover/bl:text-amber-500 transition-colors" viewBox="0 0 10 10" fill="currentColor">
                  <circle cx="2" cy="8" r="1.2" />
                  <circle cx="2" cy="4" r="1.2" />
                  <circle cx="6" cy="8" r="1.2" />
                </svg>
              </div>

              <div className="pl-3">
                <span>{wordCount} kata • {charCount} karakter</span>
              </div>

              <div className="flex items-center gap-1 pr-3">
                <span className="material-symbols-outlined text-[11px] text-emerald-600">cloud_done</span>
                <span>Tersimpan di Cloud</span>
              </div>

              {/* Gagang Resize Sudut Kanan-Bawah */}
              <div
                onPointerDown={(e) => handleResizeDown(e, 'bottom-right')}
                onPointerMove={handleResizeMove}
                onPointerUp={handleResizeUp}
                onPointerCancel={handleResizeUp}
                style={{ touchAction: 'none' }}
                className="absolute bottom-0 right-0 w-5 h-5 z-20 flex items-end justify-end p-1 cursor-nwse-resize text-outline/40 hover:text-amber-500 transition-colors group/br"
                title="Tarik untuk mengubah ukuran catatan"
              >
                <svg className="w-2 h-2 text-outline/40 group-hover/br:text-amber-500 transition-colors" viewBox="0 0 10 10" fill="currentColor">
                  <circle cx="8" cy="8" r="1.2" />
                  <circle cx="8" cy="4" r="1.2" />
                  <circle cx="4" cy="8" r="1.2" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
