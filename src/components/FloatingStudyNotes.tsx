'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useLivePlayer } from '@/context/LivePlayerContext';
import StudyLoginModal from '@/components/StudyLoginModal';
import StudySketchCanvas from '@/components/live/StudySketchCanvas';
import {
  fetchStudyNoteByVideo,
  upsertStudyNote,
  formatNoteForWhatsApp,
  getLocalDraftNote,
  setLocalDraftNote,
  getLocalSketchData,
  setLocalSketchData,
  decodeNoteWithSketch,
  encodeNoteWithSketch,
  getPendingStudySession,
  clearPendingStudySession,
  type PendingStudySession,
  type SketchStroke,
} from '@/utils/studyNotes';
import { FEATURE_FLAGS } from '@/config/features';

export default function FloatingStudyNotes() {
  const {
    studySession,
    isStudyNotesOpen,
    isStudyNotesMinimized,
    studyLayoutMode,
    toggleStudyLayoutMode,
    closeStudyNotes,
    toggleMinimizeStudyNotes,
    maximizeStudyNotes,
    openStudyMode,
    isOpen: isPlayerOpen,
    isMinimized: isPlayerMinimized,
    activeStream,
    playStream,
    maximizePlayer,
    minimizePlayer,
  } = useLivePlayer();

  const pathname = usePathname();
  const isPipRoute = pathname === '/live/pip' || pathname?.startsWith('/live/pip');

  // Deteksi ukuran layar Mobile (< 768px)
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(false);
  useEffect(() => {
    const checkViewport = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Auth & Login Guard
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingLoginSession, setPendingLoginSession] = useState<PendingStudySession | null>(null);

  // Content, Sketch & Sync State
  const [noteContent, setNoteContent] = useState('');
  const [sketchStrokes, setSketchStrokes] = useState<SketchStroke[]>([]);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [copiedToast, setCopiedToast] = useState(false);

  // Ref terbaru agar auto-save selalu menggabungkan teks + coretan terkini
  const noteContentRef = useRef<string>('');
  const sketchStrokesRef = useRef<SketchStroke[]>([]);
  useEffect(() => {
    noteContentRef.current = noteContent;
  }, [noteContent]);
  useEffect(() => {
    sketchStrokesRef.current = sketchStrokes;
  }, [sketchStrokes]);

  // Engine Undo / Redo Teks
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const isHistoryActionRef = useRef<boolean>(false);
  const lastHistorySaveTimeRef = useRef<number>(0);

  // Floating Position & Size (Digunakan pada Desktop Mode Free)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [notesWidth, setNotesWidth] = useState<number>(380);
  const [notesHeight, setNotesHeight] = useState<number>(460);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [activeCorner, setActiveCorner] = useState<'bottom-left' | 'bottom-right' | null>(null);
  const [zIndex, setZIndex] = useState(55);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Status apakah pemutar video sedang memutar video dari sesi catatan ini
  const isCurrentVideoPlaying = isPlayerOpen && activeStream?.videoId === studySession?.videoId;

  // Apakah sedang dalam mode Mobile Split Atas-Bawah ala YouTube (Selalu aktif di mobile saat tidak diminimize)
  const isMobileSplitMode = isMobileViewport && !isStudyNotesMinimized;

  // Apakah sedang dalam Mode Fokus Desktop (Fullscreen Notes + Floating Mini Video di atasnya)
  const isFocusFullscreen =
    !isMobileViewport && !isStudyNotesMinimized && studyLayoutMode === 'focus';

  // Kunci scroll halaman latar belakang saat Mode Fokus atau Mobile Split Mode aktif
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isStudyNotesOpen && !isStudyNotesMinimized && (isFocusFullscreen || isMobileSplitMode)) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isStudyNotesOpen, isStudyNotesMinimized, isFocusFullscreen, isMobileSplitMode]);

  // iOS Safari Visual Viewport Keyboard Tracking:
  // Mencegah halaman ikut tergeser ke atas dan menyesuaikan tinggi area catatan di atas keyboard virtual
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !isMobileViewport || !isStudyNotesOpen || isStudyNotesMinimized) {
      setKeyboardOffset(0);
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    const handleVisualViewportChange = () => {
      const offsetBottom = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      setKeyboardOffset(offsetBottom > 40 ? offsetBottom : 0);

      // Cegah iOS Safari menggeser posisi scroll body saat keyboard terbuka pada elemen fixed
      if (vv.offsetTop > 0) {
        window.scrollTo(0, 0);
      }
    };

    vv.addEventListener('resize', handleVisualViewportChange);
    vv.addEventListener('scroll', handleVisualViewportChange);
    handleVisualViewportChange();

    return () => {
      vv.removeEventListener('resize', handleVisualViewportChange);
      vv.removeEventListener('scroll', handleVisualViewportChange);
    };
  }, [isMobileViewport, isStudyNotesOpen, isStudyNotesMinimized]);

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
        if (!isNaN(valW) && valW >= 280 && valW <= 760) {
          const maxAllowed = typeof window !== 'undefined' ? Math.min(valW, window.innerWidth - 24) : valW;
          setNotesWidth(Math.max(280, maxAllowed));
        }
      }
      if (savedH) {
        const valH = parseInt(savedH, 10);
        if (!isNaN(valH) && valH >= 240 && valH <= 780) {
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

  // Simpan Perubahan Teks & Coretan ke Supabase dan localStorage (Auto-save)
  const triggerAutoSave = useCallback(
    (textVal: string, strokesVal?: SketchStroke[]) => {
      if (!studySession || !currentUser) return;
      const activeStrokes = strokesVal !== undefined ? strokesVal : sketchStrokesRef.current;
      const combinedPayload = encodeNoteWithSketch(textVal, activeStrokes);

      setSyncStatus('saving');
      setLocalDraftNote(studySession.videoId, combinedPayload);
      setLocalSketchData(studySession.videoId, activeStrokes);

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
          content: combinedPayload,
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

  // Handler saat coretan (sketch) berubah
  const handleChangeSketchStrokes = useCallback(
    (nextStrokes: SketchStroke[]) => {
      setSketchStrokes(nextStrokes);
      sketchStrokesRef.current = nextStrokes;
      triggerAutoSave(noteContentRef.current, nextStrokes);
    },
    [triggerAutoSave]
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

  // 4. Muat Catatan Kajian & Coretan Saat Sesi Dibuka
  useEffect(() => {
    if (!isStudyNotesOpen || !studySession || !currentUser) {
      return;
    }

    let isMounted = true;

    async function loadNote() {
      setSyncStatus('saving');
      // 1. Cek draft lokal & sketsa lokal terlebih dahulu
      const localDraftRaw = getLocalDraftNote(studySession!.videoId);
      const localSketch = getLocalSketchData(studySession!.videoId);
      if (localSketch.length > 0) {
        setSketchStrokes(localSketch);
      } else {
        setSketchStrokes([]);
      }

      if (localDraftRaw) {
        const { textContent, strokes } = decodeNoteWithSketch(localDraftRaw);
        setNoteContent(textContent);
        initHistory(textContent);
        if (strokes && strokes.length > 0) {
          setSketchStrokes(strokes);
        }
      }

      // 2. Ambil dari cloud Supabase
      const cloudNote = await fetchStudyNoteByVideo(currentUser.id, studySession!.videoId);
      if (isMounted) {
        if (cloudNote?.content) {
          const { textContent, strokes } = decodeNoteWithSketch(cloudNote.content);
          setNoteContent(textContent);
          initHistory(textContent);
          if (strokes && strokes.length > 0) {
            setSketchStrokes(strokes);
            setLocalSketchData(studySession!.videoId, strokes);
          }
          setSyncStatus('saved');
        } else if (!localDraftRaw) {
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

  // 6. Clamp Posisi agar Sticky Note selalu berada di dalam batas layar (Mode Free)
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

  // Default posisi awal yang cerdas pada Desktop Mode Free
  useEffect(() => {
    if (isStudyNotesOpen && !position && typeof window !== 'undefined') {
      const isDesktop = window.innerWidth >= 1024;
      const defaultW = Math.min(notesWidth, window.innerWidth - 24);
      const defaultH = Math.min(notesHeight, window.innerHeight - 100);

      if (isDesktop) {
        const targetX = Math.max(16, window.innerWidth - defaultW - 390);
        const targetY = Math.max(16, window.innerHeight - defaultH - 24);
        setPosition(clampPosition(targetX, targetY, defaultW, defaultH));
      } else {
        const targetX = 12;
        const targetY = Math.max(12, window.innerHeight - defaultH - 80);
        setPosition(clampPosition(targetX, targetY, defaultW, defaultH));
      }
    }
  }, [isStudyNotesOpen, position, notesWidth, notesHeight, clampPosition]);

  // Handler Pointer Drag (Hanya aktif saat Minimized Pill atau Desktop Mode Free)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isStudyNotesMinimized && (isFocusFullscreen || isMobileSplitMode)) return;
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
    setZIndex(58);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
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
    } catch {}
  };

  // Handler Pointer Resize Bebas (Desktop Mode Free)
  const handleResizeDown = (
    e: React.PointerEvent,
    corner: 'bottom-left' | 'bottom-right'
  ) => {
    if (isFocusFullscreen || isMobileSplitMode) return;
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
    } catch {}
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!isResizing || !resizeStartRef.current) return;

    const { pointerX, pointerY, initialWidth, initialHeight, initialLeft, initialTop, corner } =
      resizeStartRef.current;
    const deltaX = e.clientX - pointerX;
    const deltaY = e.clientY - pointerY;

    const minW = 280;
    const maxW = Math.min(760, window.innerWidth - 24);
    const minH = 240;
    const maxH = Math.min(780, window.innerHeight - 80);

    let targetWidth = initialWidth;
    let targetHeight = Math.min(Math.max(initialHeight + deltaY, minH), maxH);
    let newX = initialLeft;
    const newY = initialTop;

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
    } catch {}
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

  const handleInsertPoint = () => wrapOrInsertText('\n• ', '', '');
  const handleInsertNumbered = () => wrapOrInsertText('\n1. ', '', '');
  const handleInsertHeading = () => wrapOrInsertText('\n### ', '', 'Judul Bab / Topik');
  const handleInsertDalil = () => wrapOrInsertText('\n> 📖 "', '"\n', 'Tuliskan dalil / hadits di sini');
  const handleInsertBold = () => wrapOrInsertText('**', '**', 'teks tebal');
  const handleInsertItalic = () => wrapOrInsertText('*', '*', 'teks miring');

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
    const headerPrefix =
      `Catatan Faidah: ${studySession.title}\n` +
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

  // Hitung posisi top untuk Mobile Split Mode (di bawah video 16:9 + bar kontrol 38px)
  const isVideoDockedOnTopMobile =
    isMobileSplitMode && isPlayerOpen && !isPlayerMinimized;

  const containerStyle: React.CSSProperties = isStudyNotesMinimized
    ? {
        position: 'fixed',
        zIndex: 62,
        left: position ? `${position.x}px` : undefined,
        top: position ? `${position.y}px` : undefined,
        right: !position ? '16px' : undefined,
        bottom: !position ? (isMobileViewport ? '80px' : '20px') : undefined,
        width: 'auto',
        height: 'auto',
        maxWidth: 'calc(100vw - 24px)',
        touchAction: 'none',
      }
    : isFocusFullscreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: keyboardOffset > 0 ? `${keyboardOffset}px` : 0,
        zIndex: 52, // Di bawah PersistentFloatingLivePlayer (z-[60]) agar video mini melayang di atasnya!
        width: '100%',
        height: keyboardOffset > 0 ? `calc(100dvh - ${keyboardOffset}px)` : '100dvh',
      }
    : isMobileSplitMode
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: keyboardOffset > 0 ? `${keyboardOffset}px` : 0,
        top: isVideoDockedOnTopMobile ? '56.25vw' : '0px',
        zIndex: 55,
        width: '100%',
      }
    : {
        position: 'fixed',
        zIndex,
        left: position ? `${position.x}px` : undefined,
        top: position ? `${position.y}px` : undefined,
        right: !position ? '390px' : undefined,
        bottom: !position ? '20px' : undefined,
        width: `${notesWidth}px`,
        height: `${notesHeight}px`,
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100vh - 40px)',
        touchAction: 'none',
      };

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

      {/* WADAH UTAMA STUDY NOTES */}
      <div
        ref={containerRef}
        onPointerDown={() => {
          if (!isFocusFullscreen && !isMobileSplitMode) {
            setZIndex(58);
          }
        }}
        style={containerStyle}
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

            <div className="min-w-0 max-w-[150px] sm:max-w-[200px]">
              <p className="text-[11px] font-bold text-on-surface truncate leading-tight">
                📝 Catatan Faidah
              </p>
              <p className="text-[10px] text-outline truncate leading-tight">
                {studySession.title}
              </p>
            </div>

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
             KONDISI B: EXPANDED WORKSPACE (Mode Free, Mode Fokus Fullscreen, atau Mobile Split Atas-Bawah)
             ======================================================== */
          <div
            className={`relative w-full h-full bg-surface-container-lowest/98 dark:bg-neutral-900/98 backdrop-blur-md overflow-hidden flex flex-col ${
              isFocusFullscreen || isMobileSplitMode
                ? 'rounded-none border-t border-amber-500/35'
                : 'rounded-2xl border border-amber-500/35 dark:border-amber-500/40 shadow-2xl animate-in slide-in-from-bottom-3 duration-250'
            }`}
          >
            {/* Pita Aksen Sticky Note di Atas */}
            <div className="h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-500 shrink-0" />

            {/* 1. HEADER BAR CATATAN & SWITCHER MODE */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                touchAction: isFocusFullscreen || isMobileSplitMode ? 'auto' : 'none',
              }}
              className={`px-3 py-2 bg-amber-500/10 dark:bg-amber-500/15 border-b border-surface-container-high/60 flex items-center justify-between gap-2 select-none shrink-0 ${
                !isFocusFullscreen && !isMobileSplitMode
                  ? 'hover:bg-amber-500/20 cursor-move transition-colors'
                  : ''
              }`}
              title={
                !isFocusFullscreen && !isMobileSplitMode
                  ? 'Klik dan tahan di sini untuk menggeser posisi catatan'
                  : undefined
              }
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[18px] text-amber-600 dark:text-amber-400 shrink-0">
                  edit_note
                </span>
                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-on-surface truncate">
                      {isFocusFullscreen ? 'Ruang Fokus Belajar' : 'Catatan Faidah'}
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
                  <span className="text-[10px] text-outline truncate max-w-[160px] sm:max-w-[360px]">
                    {studySession.title}
                  </span>
                </div>
              </div>

              {/* Kontrol Kanan Header */}
              <div
                className="flex items-center gap-1 sm:gap-1.5 shrink-0"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Tombol Putar Video jika sedang tertutup / diminimize */}
                {(!isCurrentVideoPlaying || isPlayerMinimized) ? (
                  <button
                    type="button"
                    onClick={handlePlayCurrentVideo}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
                    title="Tampilkan pemutar video kajian"
                  >
                    <span className="material-symbols-outlined text-[13px]">play_circle</span>
                    <span className="hidden xs:inline">Video</span>
                  </button>
                ) : isMobileSplitMode ? (
                  <button
                    type="button"
                    onClick={minimizePlayer}
                    className="w-6 h-6 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title="Mode Audio Saja (Sembunyikan Video)"
                    aria-label="Mode Audio Saja"
                  >
                    <span className="material-symbols-outlined text-[15px]">headphones</span>
                  </button>
                ) : null}

                {/* TOMBOL SWITCH MODE FOKUS vs MODE FREE (Hanya di Desktop, karena UI Mobile sudah fokus penuh) */}
                {!isMobileViewport && (
                  <button
                    type="button"
                    onClick={toggleStudyLayoutMode}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer active:scale-95 shrink-0 border ${
                      isFocusFullscreen
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 shadow-xs'
                        : 'bg-surface-container hover:bg-surface-container-high text-on-surface border-outline-variant/60'
                    }`}
                    title={
                      isFocusFullscreen
                        ? 'Kembali ke Mode Free (Jendela Melayang)'
                        : 'Buka Mode Fokus (Catatan Fullscreen & Video Mini Melayang di Atasnya)'
                    }
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {isFocusFullscreen ? 'pip' : 'fullscreen'}
                    </span>
                    <span>{isFocusFullscreen ? 'Mode Free' : 'Mode Fokus'}</span>
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

            {/* 2. RUANG KERJA TERPADU (TEKS + CORETAN / STABILO MENYATU DALAM 1 LEMBAR KERTAS) */}
            <StudySketchCanvas
              videoId={studySession.videoId}
              title={studySession.title}
              speakerName={studySession.speakerName}
              noteContent={noteContent}
              textareaRef={textareaRef}
              onChangeText={handleContentChange}
              onKeyDownText={handleKeyDown}
              canUndoText={canUndo}
              canRedoText={canRedo}
              onUndoText={handleUndo}
              onRedoText={handleRedo}
              onInsertBold={handleInsertBold}
              onInsertItalic={handleInsertItalic}
              onInsertHeading={handleInsertHeading}
              onInsertNumbered={handleInsertNumbered}
              onInsertPoint={handleInsertPoint}
              onInsertDalil={handleInsertDalil}
              onInsertTimestamp={handleInsertTimestamp}
              onShareWhatsApp={handleShareWhatsApp}
              onCopyWhatsApp={handleCopyWhatsApp}
              onDownloadTxt={handleDownloadNote}
              copiedToast={copiedToast}
              isMobileViewport={isMobileViewport}
              isFocusFullscreen={isFocusFullscreen}
              strokes={sketchStrokes}
              onChangeStrokes={handleChangeSketchStrokes}
            />

            {/* 4. FOOTER INFO & RESIZE HANDLES */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                touchAction: isFocusFullscreen || isMobileSplitMode ? 'auto' : 'none',
              }}
              className={`px-3 py-1.5 bg-surface-container-low/90 dark:bg-neutral-800/80 border-t border-surface-container-high/60 flex items-center justify-between text-[9px] text-outline select-none shrink-0 relative ${
                !isFocusFullscreen && !isMobileSplitMode ? 'cursor-move' : ''
              }`}
            >
              {/* Gagang Resize Sudut Kiri-Bawah (Hanya tampil pada Desktop Mode Free) */}
              {!isFocusFullscreen && !isMobileSplitMode && (
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
              )}

              <div className={!isFocusFullscreen && !isMobileSplitMode ? 'pl-3' : ''}>
                <span>
                  {wordCount} kata • {charCount} karakter
                  {sketchStrokes.length > 0 ? ` • ${sketchStrokes.length} coretan` : ''}
                </span>
              </div>

              <div className={`flex items-center gap-1 ${!isFocusFullscreen && !isMobileSplitMode ? 'pr-3' : ''}`}>
                <span className="material-symbols-outlined text-[11px] text-emerald-600">cloud_done</span>
                <span>
                  {isFocusFullscreen
                    ? 'Mode Fokus Aktif (Video Melayang di Atas)'
                    : isMobileSplitMode
                    ? 'Tersimpan Otomatis'
                    : 'Tersimpan di Cloud'}
                </span>
              </div>

              {/* Gagang Resize Sudut Kanan-Bawah (Hanya tampil pada Desktop Mode Free) */}
              {!isFocusFullscreen && !isMobileSplitMode && (
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
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
