'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { type SketchStroke, type SketchPoint } from '@/utils/studyNotes';
import { useConfirm } from '@/context/ConfirmDialogContext';

export interface StudySketchCanvasProps {
  videoId: string;
  title: string;
  speakerName?: string;
  // Teks Catatan Props
  noteContent: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChangeText: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDownText: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  canUndoText: boolean;
  canRedoText: boolean;
  onUndoText: () => void;
  onRedoText: () => void;
  onInsertBold: () => void;
  onInsertItalic: () => void;
  onInsertHeading: () => void;
  onInsertNumbered: () => void;
  onInsertPoint: () => void;
  onInsertDalil: () => void;
  onInsertTimestamp: () => void;
  onShareWhatsApp: () => void;
  onCopyWhatsApp: () => void;
  onDownloadTxt: () => void;
  copiedToast: boolean;
  isMobileViewport: boolean;
  isFocusFullscreen: boolean;
  // Coretan Props
  strokes: SketchStroke[];
  onChangeStrokes: (nextStrokes: SketchStroke[]) => void;
  className?: string;
}

type UnifiedMode = 'type' | 'draw';
type SketchTool = 'pen' | 'highlighter' | 'eraser';
type PaperPattern = 'lines' | 'dots' | 'blank';

const COLOR_PALETTE = [
  { id: 'auto', label: 'Tinta Utama', hex: 'auto', previewClass: 'bg-slate-900 dark:bg-slate-100' },
  { id: 'emerald', label: 'Hijau Emerald', hex: '#059669', previewClass: 'bg-emerald-600' },
  { id: 'amber', label: 'Kuning Amber', hex: '#d97706', previewClass: 'bg-amber-600' },
  { id: 'rose', label: 'Merah Rose', hex: '#e11d48', previewClass: 'bg-rose-600' },
  { id: 'blue', label: 'Biru', hex: '#2563eb', previewClass: 'bg-blue-600' },
  { id: 'purple', label: 'Ungu', hex: '#7c3aed', previewClass: 'bg-purple-600' },
] as const;

const STROKE_SIZES = [
  { label: 'Tipis', value: 2.5, dotSize: 'w-1.5 h-1.5' },
  { label: 'Sedang', value: 4.5, dotSize: 'w-2.5 h-2.5' },
  { label: 'Tebal', value: 8, dotSize: 'w-3.5 h-3.5' },
] as const;

const LINE_HEIGHT_PX = 28;
const EXTRA_BOTTOM_SPACE = 240;

// Custom High-Contrast SVG Cursors (Memiliki halo putih + inti gelap/berwarna agar tidak pernah hilang di mode gelap maupun terang)
const TEXT_IBEAM_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round'%3E%3Cpath d='M9 4h6M9 20h6M12 4v16'/%3E%3C/g%3E%3Cg stroke='%23059669' stroke-width='1.8' stroke-linecap='round'%3E%3Cpath d='M9 4h6M9 20h6M12 4v16'/%3E%3C/g%3E%3C/svg%3E") 12 12, text`;

const PEN_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='3.5' fill='%2310b981' stroke='%23ffffff' stroke-width='2'/%3E%3Cpath d='M12 3v5M12 16v5M3 12h5M16 12h5' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/%3E%3Cpath d='M12 3v5M12 16v5M3 12h5M16 12h5' stroke='%230f172a' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") 12 12, pointer`;

const ERASER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='7' fill='rgba(244,63,94,0.25)' stroke='%23ffffff' stroke-width='2.5'/%3E%3Ccircle cx='12' cy='12' r='7' fill='none' stroke='%23e11d48' stroke-width='1.5'/%3E%3C/svg%3E") 12 12, pointer`;

export default function StudySketchCanvas({
  title,
  speakerName,
  noteContent,
  textareaRef,
  onChangeText,
  onKeyDownText,
  canUndoText,
  canRedoText,
  onUndoText,
  onRedoText,
  onInsertBold,
  onInsertItalic,
  onInsertHeading,
  onInsertNumbered,
  onInsertPoint,
  onInsertDalil,
  onInsertTimestamp,
  onShareWhatsApp,
  onCopyWhatsApp,
  onDownloadTxt,
  copiedToast,
  isMobileViewport,
  isFocusFullscreen,
  strokes,
  onChangeStrokes,
  className = '',
}: StudySketchCanvasProps) {
  const confirm = useConfirm();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textMirrorRef = useRef<HTMLDivElement | null>(null);

  // Mode Terpadu: 'type' (Ketik Teks) atau 'draw' (Coret / Stabilo di atas lembar yang sama)
  const [activeMode, setActiveMode] = useState<UnifiedMode>('type');
  const [activeTool, setActiveTool] = useState<SketchTool>('pen');
  const [activeColor, setActiveColor] = useState<string>('auto');
  const [activeSize, setActiveSize] = useState<number>(4.5);
  const [paperPattern, setPaperPattern] = useState<PaperPattern>('lines');
  const [redoStack, setRedoStack] = useState<SketchStroke[][]>([]);
  const [paperHeight, setPaperHeight] = useState<number>(520);

  // State posisi kursor live di atas kanvas agar selalu terlihat jelas (tidak hilang di background gelap/terang)
  const [hoverPointer, setHoverPointer] = useState<SketchPoint | null>(null);

  const isDrawingRef = useRef<boolean>(false);
  const currentPointsRef = useRef<SketchPoint[]>([]);
  const strokesRef = useRef<SketchStroke[]>(strokes);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  // Hitung titik Y terdalam dari coretan agar kertas tidak pernah memotong coretan yang ada di bawah
  const getMaxStrokeY = useCallback((strokeList: SketchStroke[]): number => {
    let maxY = 0;
    for (const s of strokeList) {
      for (const pt of s.points) {
        if (pt.y > maxY) maxY = pt.y;
      }
    }
    return maxY;
  }, []);

  // Sesuaikan tinggi kertas otomatis mengikuti panjang teks + coretan + ruang ekstra bawah
  const updatePaperDimensions = useCallback(() => {
    const scrollEl = scrollContainerRef.current;
    const mirrorEl = textMirrorRef.current;
    if (!scrollEl) return;

    const viewportH = scrollEl.clientHeight || 400;
    const textH = mirrorEl ? mirrorEl.scrollHeight : 0;
    const maxStrokeY = getMaxStrokeY(strokesRef.current);

    const targetHeight = Math.max(
      viewportH,
      textH + EXTRA_BOTTOM_SPACE,
      maxStrokeY + 140
    );

    setPaperHeight((prev) => (Math.abs(prev - targetHeight) > 4 ? targetHeight : prev));
  }, [getMaxStrokeY]);

  useEffect(() => {
    updatePaperDimensions();
  }, [noteContent, strokes, isFocusFullscreen, isMobileViewport, updatePaperDimensions]);

  // Deteksi apakah tema sedang dark mode untuk warna tinta 'auto'
  const resolveStrokeColor = useCallback((colorCode: string, forExportLight = false) => {
    if (colorCode !== 'auto') return colorCode;
    if (forExportLight) return '#0f172a';
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return '#f8fafc';
    }
    return '#0f172a';
  }, []);

  // Fungsi menggambar satu stroke secara mulus dengan kurva kuadratik
  const drawSingleStroke = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      stroke: SketchStroke,
      forExportLight = false
    ) => {
      const pts = stroke.points;
      if (!pts || pts.length === 0) return;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = stroke.size * 3.5;
        ctx.globalAlpha = 1;
      } else if (stroke.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = resolveStrokeColor(
          stroke.color === 'auto' ? '#f59e0b' : stroke.color,
          forExportLight
        );
        ctx.lineWidth = stroke.size * 3.2;
        ctx.globalAlpha = 0.32;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = resolveStrokeColor(stroke.color, forExportLight);
        ctx.lineWidth = stroke.size;
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      if (pts.length === 1) {
        ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      } else {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const midX = (pts[i].x + pts[i + 1].x) / 2;
          const midY = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
      }
      ctx.restore();
    },
    [resolveStrokeColor]
  );

  // Render ulang seluruh kanvas di atas lembar kertas
  const redrawCanvas = useCallback(
    (activeStroke?: SketchStroke | null) => {
      const canvas = canvasRef.current;
      const paper = paperRef.current;
      if (!canvas || !paper) return;

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const rect = paper.getBoundingClientRect();
      const targetW = Math.max(1, Math.floor(rect.width * dpr));
      const targetH = Math.max(1, Math.floor(paperHeight * dpr));

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, paperHeight);

      for (const s of strokesRef.current) {
        drawSingleStroke(ctx, s, false);
      }

      if (activeStroke) {
        drawSingleStroke(ctx, activeStroke, false);
      }
      ctx.restore();
    },
    [drawSingleStroke, paperHeight]
  );

  useEffect(() => {
    redrawCanvas();
  }, [strokes, paperHeight, redrawCanvas]);

  // Pantau perubahan ukuran wadah & perubahan tema dark/light
  useEffect(() => {
    const paper = paperRef.current;
    const scrollEl = scrollContainerRef.current;
    if (!paper || !scrollEl) return;

    const resizeObserver = new ResizeObserver(() => {
      updatePaperDimensions();
      redrawCanvas();
    });
    resizeObserver.observe(paper);
    resizeObserver.observe(scrollEl);

    const mutationObserver = new MutationObserver(() => {
      redrawCanvas();
    });
    if (typeof document !== 'undefined') {
      mutationObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [redrawCanvas, updatePaperDimensions]);

  const switchToMode = (nextMode: UnifiedMode) => {
    setActiveMode(nextMode);
    if (nextMode === 'draw') {
      // Tutup keyboard virtual saat beralih ke mode Coret-Coret
      textareaRef.current?.blur();
    } else {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 20);
    }
  };

  const getPointerCoords = (e: React.PointerEvent<HTMLCanvasElement>): SketchPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) * 10) / 10,
      y: Math.round((e.clientY - rect.top) * 10) / 10,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeMode !== 'draw') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();

    const pt = getPointerCoords(e);
    isDrawingRef.current = true;
    currentPointsRef.current = [pt];

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const previewStroke: SketchStroke = {
      id: `live-${Date.now()}`,
      tool: activeTool,
      color: activeColor,
      size: activeSize,
      points: [pt],
    };
    redrawCanvas(previewStroke);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeMode !== 'draw') return;
    const pt = getPointerCoords(e);
    if (e.pointerType !== 'touch') {
      setHoverPointer(pt);
    }

    if (!isDrawingRef.current) return;
    e.stopPropagation();

    const pts = currentPointsRef.current;
    const lastPt = pts[pts.length - 1];
    if (lastPt && Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) < 1.5) {
      return;
    }

    pts.push(pt);
    const previewStroke: SketchStroke = {
      id: 'preview',
      tool: activeTool,
      color: activeColor,
      size: activeSize,
      points: pts,
    };
    redrawCanvas(previewStroke);
  };

  const finishStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.stopPropagation();
    isDrawingRef.current = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (currentPointsRef.current.length > 0) {
      const newStroke: SketchStroke = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tool: activeTool,
        color: activeColor,
        size: activeSize,
        points: [...currentPointsRef.current],
      };
      const nextStrokes = [...strokesRef.current, newStroke];
      setRedoStack([]);
      onChangeStrokes(nextStrokes);
    }
    currentPointsRef.current = [];
  };

  const handleUndoSketch = () => {
    if (strokes.length === 0) return;
    const prevStrokes = strokes.slice(0, -1);
    setRedoStack((prev) => [strokes, ...prev]);
    onChangeStrokes(prevStrokes);
  };

  const handleRedoSketch = () => {
    if (redoStack.length === 0) return;
    const [nextStrokes, ...rest] = redoStack;
    setRedoStack(rest);
    onChangeStrokes(nextStrokes);
  };

  const handleClearCanvas = async () => {
    if (strokes.length === 0) return;
    const ok = await confirm({
      title: 'Bersihkan Semua Coretan?',
      description: 'Seluruh coretan & stabilo pada lembar catatan ini akan dihapus (teks ketikan Anda tetap aman).',
      confirmText: 'Ya, Bersihkan Coretan',
      cancelText: 'Batal',
      variant: 'danger',
      icon: 'delete_sweep',
    });
    if (!ok) return;
    setRedoStack((prev) => [strokes, ...prev]);
    onChangeStrokes([]);
  };

  const handleScrollByStep = (deltaY: number) => {
    scrollContainerRef.current?.scrollBy({ top: deltaY, behavior: 'smooth' });
  };

  // Ekspor Gabungan Teks + Coretan menjadi 1 Gambar Catatan Utuh (.PNG)
  const handleDownloadUnifiedPng = () => {
    const paper = paperRef.current;
    if (!paper) return;

    const rect = paper.getBoundingClientRect();
    const width = Math.max(640, Math.round(rect.width));
    const headerHeight = 68;
    const padX = 16;
    const padTop = 14;
    const maxTextWidth = width - padX * 2;

    // Siapkan offscreen canvas untuk mengukur tinggi teks yang di-wrap
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    const fontSize = isMobileViewport ? 16 : 14;
    const baseFont = `${fontSize}px sans-serif`;
    const boldFont = `bold ${fontSize}px sans-serif`;

    interface WrappedLine {
      text: string;
      isHeading: boolean;
      isQuote: boolean;
    }

    const wrappedLines: WrappedLine[] = [];
    if (measureCtx && noteContent.trim().length > 0) {
      const rawParagraphs = noteContent.split('\n');
      for (const rawLine of rawParagraphs) {
        const isHeading = rawLine.startsWith('### ');
        const isQuote = rawLine.startsWith('> ');
        const cleanLine = isHeading
          ? rawLine.replace(/^###\s+/, '')
          : rawLine.replace(/\*\*(.*?)\*\*/g, '$1');

        measureCtx.font = isHeading ? boldFont : baseFont;

        if (!cleanLine.trim()) {
          wrappedLines.push({ text: '', isHeading: false, isQuote: false });
          continue;
        }

        const words = cleanLine.split(' ');
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = measureCtx.measureText(testLine);
          if (metrics.width > maxTextWidth && currentLine) {
            wrappedLines.push({ text: currentLine, isHeading, isQuote });
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          wrappedLines.push({ text: currentLine, isHeading, isQuote });
        }
      }
    }

    const textTotalHeight = wrappedLines.length * LINE_HEIGHT_PX + padTop * 2 + 40;
    const strokeMaxY = getMaxStrokeY(strokes) + 60;
    const bodyHeight = Math.max(420, Math.round(rect.height), textTotalHeight, strokeMaxY);
    const totalHeight = headerHeight + bodyHeight;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width * 2;
    exportCanvas.height = totalHeight * 2;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(2, 2);

    // 1. Background Kertas Hangat
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(0, 0, width, totalHeight);

    // 2. Motif Kertas (Garis / Titik)
    if (paperPattern === 'dots') {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.38)';
      for (let x = 20; x < width; x += 20) {
        for (let y = headerHeight + 20; y < totalHeight; y += 20) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (paperPattern === 'lines') {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = 1;
      for (let y = headerHeight + padTop + LINE_HEIGHT_PX - 4; y < totalHeight; y += LINE_HEIGHT_PX) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // 3. Render Teks Catatan di Atas Kertas
    ctx.textBaseline = 'alphabetic';
    wrappedLines.forEach((lineObj, idx) => {
      const yPos = headerHeight + padTop + (idx + 1) * LINE_HEIGHT_PX - 7;
      if (lineObj.isHeading) {
        ctx.font = boldFont;
        ctx.fillStyle = '#065f46';
      } else if (lineObj.isQuote) {
        ctx.font = `italic ${fontSize}px sans-serif`;
        ctx.fillStyle = '#92400e';
      } else {
        ctx.font = baseFont;
        ctx.fillStyle = '#1e293b';
      }
      ctx.fillText(lineObj.text, padX, yPos);
    });

    // 4. Gambar Coretan & Stabilo pada Offscreen Layer (agar Eraser hanya menghapus coretan)
    const inkCanvas = document.createElement('canvas');
    inkCanvas.width = width * 2;
    inkCanvas.height = bodyHeight * 2;
    const inkCtx = inkCanvas.getContext('2d');
    if (inkCtx) {
      inkCtx.scale(2, 2);
      for (const s of strokes) {
        drawSingleStroke(inkCtx, s, true);
      }
      ctx.drawImage(inkCanvas, 0, headerHeight, width, bodyHeight);
    }

    // 5. Header Banner Kajian
    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, width, headerHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(title.slice(0, 75), 16, 28);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = '11px sans-serif';
    ctx.fillText(
      `${speakerName ? `${speakerName} • ` : ''}Catatan Faidah & Coretan — Peta Kajian`,
      16,
      48
    );

    const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 35);
    const dataUrl = exportCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `Catatan_Kajian_${cleanTitle}.png`;
    a.click();
  };

  return (
    <div
      className={`flex flex-col flex-1 min-h-0 h-full ${className}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* =================================================================
          1. BARIS KONTROL TERPADU (SWITCH KETIK/CORET + ALAT KONTEKSTUAL + EKSPOR)
          ================================================================= */}
      <div className="px-2.5 py-1.5 bg-surface-container-low/90 dark:bg-neutral-800/85 border-b border-surface-container-high/50 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar shrink-0 select-none">
        {/* KIRI: Toggle Alat Utama [Ketik] vs [Coret] */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-0.5 bg-surface-container/90 dark:bg-neutral-900/80 p-0.5 rounded-xl border border-surface-container-high/70 shrink-0">
            <button
              type="button"
              onClick={() => switchToMode('type')}
              className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                activeMode === 'type'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Mode Ketik Teks & Gulir Halaman"
            >
              <span className="material-symbols-outlined text-[14px]">keyboard</span>
              <span>Ketik</span>
            </button>

            <button
              type="button"
              onClick={() => switchToMode('draw')}
              className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                activeMode === 'draw'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Mode Coret-Coret & Stabilo langsung di atas lembar catatan"
            >
              <span className="material-symbols-outlined text-[14px]">draw</span>
              <span>Coret</span>
              {strokes.length > 0 && (
                <span
                  className={`px-1 py-0.1 rounded-full text-[9px] font-extrabold ${
                    activeMode === 'draw'
                      ? 'bg-white/25 text-white'
                      : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {strokes.length}
                </span>
              )}
            </button>
          </div>

          <div className="w-[1px] h-4 bg-surface-container-high/80 shrink-0" />

          {/* TENGAH: ALAT KONTEKSTUAL (Otomatis menyesuaikan mode Ketik atau Coret) */}
          {activeMode === 'type' ? (
            /* --- ALAT FORMAT TEKS --- */
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onUndoText}
                disabled={!canUndoText}
                className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                  canUndoText
                    ? 'hover:bg-surface-container text-on-surface cursor-pointer'
                    : 'text-outline/30 cursor-not-allowed'
                }`}
                title="Urungkan Ketikan (Ctrl+Z)"
              >
                <span className="material-symbols-outlined text-[15px]">undo</span>
              </button>

              <button
                type="button"
                onClick={onRedoText}
                disabled={!canRedoText}
                className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                  canRedoText
                    ? 'hover:bg-surface-container text-on-surface cursor-pointer'
                    : 'text-outline/30 cursor-not-allowed'
                }`}
                title="Ulangi Ketikan (Ctrl+Y)"
              >
                <span className="material-symbols-outlined text-[15px]">redo</span>
              </button>

              <div className="w-[1px] h-3.5 bg-surface-container-high/80 mx-0.5 shrink-0" />

              <button
                type="button"
                onClick={onInsertBold}
                className="w-6 h-6 rounded-md hover:bg-surface-container text-outline hover:text-on-surface text-[11px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                title="Teks Tebal (Ctrl+B)"
              >
                B
              </button>

              <button
                type="button"
                onClick={onInsertItalic}
                className="w-6 h-6 rounded-md hover:bg-surface-container text-outline hover:text-on-surface text-[11px] font-serif italic font-bold flex items-center justify-center transition-colors cursor-pointer"
                title="Teks Miring (Ctrl+I)"
              >
                I
              </button>

              <button
                type="button"
                onClick={onInsertHeading}
                className="w-6 h-6 rounded-md hover:bg-surface-container text-outline hover:text-on-surface text-[11px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                title="Sub-judul Bab (###)"
              >
                H
              </button>

              <button
                type="button"
                onClick={onInsertNumbered}
                className="px-1.5 py-0.5 rounded-md hover:bg-surface-container text-outline hover:text-on-surface text-[10px] font-bold transition-colors cursor-pointer"
                title="Daftar Nomor (1.)"
              >
                1.
              </button>

              <button
                type="button"
                onClick={onInsertPoint}
                className="px-1.5 py-0.5 rounded-md hover:bg-surface-container text-outline hover:text-on-surface text-[10px] font-bold transition-colors cursor-pointer shrink-0"
                title="Sisipkan Poin Faidah (•)"
              >
                • Poin
              </button>

              <button
                type="button"
                onClick={onInsertDalil}
                className="px-1.5 py-0.5 rounded-md hover:bg-surface-container text-outline hover:text-on-surface text-[10px] font-semibold flex items-center gap-0.5 transition-colors cursor-pointer shrink-0"
                title="Sisipkan Kutipan Dalil"
              >
                <span>📖 Dalil</span>
              </button>

              <button
                type="button"
                onClick={onInsertTimestamp}
                className="px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                title="Sisipkan Stempel Waktu Saat Ini"
              >
                <span className="material-symbols-outlined text-[12px]">schedule</span>
                <span>+ Waktu</span>
              </button>
            </div>
          ) : (
            /* --- ALAT GAMBAR & STABILO --- */
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTool('pen')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  activeTool === 'pen'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-outline hover:bg-surface-container hover:text-on-surface'
                }`}
                title="Pena Tulis"
              >
                <span className="material-symbols-outlined text-[14px]">stylus</span>
                <span>Pena</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('highlighter')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  activeTool === 'highlighter'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-outline hover:bg-surface-container hover:text-on-surface'
                }`}
                title="Stabilo Penanda Teks"
              >
                <span className="material-symbols-outlined text-[14px]">format_ink_highlighter</span>
                <span>Stabilo</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('eraser')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  activeTool === 'eraser'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-outline hover:bg-surface-container hover:text-on-surface'
                }`}
                title="Penghapus Coretan"
              >
                <span className="material-symbols-outlined text-[14px]">ink_eraser</span>
                <span className="hidden xs:inline">Hapus</span>
              </button>

              <div className="w-[1px] h-4 bg-surface-container-high mx-0.5 shrink-0" />

              {/* Pilihan Warna */}
              <div className="flex items-center gap-1 shrink-0">
                {COLOR_PALETTE.map((c) => {
                  const isSelected = activeColor === c.hex && activeTool !== 'eraser';
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setActiveColor(c.hex);
                        if (activeTool === 'eraser') setActiveTool('pen');
                      }}
                      className={`w-4 h-4 rounded-full ${c.previewClass} transition-transform cursor-pointer ${
                        isSelected
                          ? 'scale-125 ring-2 ring-emerald-500 ring-offset-1 ring-offset-surface'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                      title={c.label}
                      aria-label={c.label}
                    />
                  );
                })}
              </div>

              <div className="w-[1px] h-4 bg-surface-container-high mx-0.5 shrink-0" />

              {/* Pilihan Ketebalan Garis */}
              <div className="flex items-center gap-0.5 shrink-0">
                {STROKE_SIZES.map((sz) => (
                  <button
                    key={sz.label}
                    type="button"
                    onClick={() => setActiveSize(sz.value)}
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                      activeSize === sz.value
                        ? 'bg-surface-container-highest text-on-surface ring-1 ring-emerald-500/60'
                        : 'text-outline hover:bg-surface-container'
                    }`}
                    title={`Ukuran ${sz.label}`}
                  >
                    <span className={`rounded-full bg-current ${sz.dotSize}`} />
                  </button>
                ))}
              </div>

              <div className="w-[1px] h-4 bg-surface-container-high mx-0.5 shrink-0" />

              {/* Undo / Redo / Clear Coretan */}
              <button
                type="button"
                onClick={handleUndoSketch}
                disabled={strokes.length === 0}
                className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                  strokes.length > 0
                    ? 'hover:bg-surface-container text-on-surface cursor-pointer'
                    : 'text-outline/30 cursor-not-allowed'
                }`}
                title="Urungkan Coretan"
              >
                <span className="material-symbols-outlined text-[15px]">undo</span>
              </button>

              <button
                type="button"
                onClick={handleRedoSketch}
                disabled={redoStack.length === 0}
                className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                  redoStack.length > 0
                    ? 'hover:bg-surface-container text-on-surface cursor-pointer'
                    : 'text-outline/30 cursor-not-allowed'
                }`}
                title="Ulangi Coretan"
              >
                <span className="material-symbols-outlined text-[15px]">redo</span>
              </button>

              <button
                type="button"
                onClick={handleClearCanvas}
                disabled={strokes.length === 0}
                className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                  strokes.length > 0
                    ? 'hover:bg-rose-500/15 text-rose-500 cursor-pointer'
                    : 'text-outline/30 cursor-not-allowed'
                }`}
                title="Bersihkan Semua Coretan"
              >
                <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
              </button>
            </div>
          )}
        </div>

        {/* KANAN: Motif Kertas & Ekspor (WA, Salin, Unduh PNG Gabungan, Unduh TXT) */}
        <div className="flex items-center gap-1 shrink-0 pl-1.5 border-l border-surface-container-high/60">
          {/* Toggle Motif Kertas */}
          <button
            type="button"
            onClick={() =>
              setPaperPattern((prev) =>
                prev === 'lines' ? 'dots' : prev === 'dots' ? 'blank' : 'lines'
              )
            }
            className="w-6 h-6 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
            title={`Ganti Motif Kertas (Saat ini: ${
              paperPattern === 'lines' ? 'Bergaris' : paperPattern === 'dots' ? 'Titik-titik' : 'Polos'
            })`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {paperPattern === 'lines'
                ? 'subject'
                : paperPattern === 'dots'
                ? 'grid_4x4'
                : 'check_box_outline_blank'}
            </span>
          </button>

          <button
            type="button"
            onClick={onShareWhatsApp}
            className="px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center gap-1 transition-colors cursor-pointer"
            title="Bagikan Catatan ke WhatsApp"
          >
            <span className="material-symbols-outlined text-[13px]">share</span>
            <span className="hidden sm:inline">WA</span>
          </button>

          <button
            type="button"
            onClick={onCopyWhatsApp}
            className="w-6 h-6 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
            title="Salin Teks Catatan"
          >
            <span className="material-symbols-outlined text-[14px]">
              {copiedToast ? 'check' : 'content_copy'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadUnifiedPng}
            className="w-6 h-6 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 flex items-center justify-center transition-colors cursor-pointer"
            title="Unduh Gambar Catatan Utuh (Teks + Coretan .PNG)"
          >
            <span className="material-symbols-outlined text-[14px]">image</span>
          </button>

          <button
            type="button"
            onClick={onDownloadTxt}
            className="w-6 h-6 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
            title="Unduh File Teks (.txt)"
          >
            <span className="material-symbols-outlined text-[14px]">download</span>
          </button>
        </div>
      </div>

      {/* =================================================================
          2. LEMBAR KERTAS CATATAN TERPADU (TEKS + OVERLAY KANVAS IKUT TER-SCROLL)
          ================================================================= */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative bg-amber-50/35 dark:bg-neutral-950/60"
      >
        <div
          ref={paperRef}
          style={{
            height: `${paperHeight}px`,
            minHeight: '100%',
            backgroundImage:
              paperPattern === 'dots'
                ? 'radial-gradient(rgba(148, 163, 184, 0.42) 1px, transparent 1px)'
                : paperPattern === 'lines'
                ? 'linear-gradient(to bottom, transparent 27px, rgba(148, 163, 184, 0.24) 28px)'
                : 'none',
            backgroundSize:
              paperPattern === 'dots'
                ? '20px 20px'
                : paperPattern === 'lines'
                ? `100% ${LINE_HEIGHT_PX}px`
                : 'auto',
            backgroundPosition: paperPattern === 'lines' ? '0 14px' : '0 0',
          }}
          className={`relative w-full ${
            isFocusFullscreen ? 'max-w-4xl mx-auto shadow-xs' : ''
          }`}
        >
          {/* Hidden Mirror Div untuk mengukur tinggi teks secara presisi tanpa scrollbar ganda */}
          <div
            ref={textMirrorRef}
            aria-hidden="true"
            style={{
              fontSize: isMobileViewport ? '16px' : isFocusFullscreen ? '14px' : '13px',
              lineHeight: `${LINE_HEIGHT_PX}px`,
            }}
            className="invisible pointer-events-none absolute inset-x-0 top-0 px-4 pt-3.5 pb-12 whitespace-pre-wrap break-words font-sans"
          >
            {noteContent || ' '}
            {'\n'}
          </div>

          {/* LAPISAN 1: TEXTAREA EDITOR CATATAN */}
          <textarea
            ref={textareaRef}
            value={noteContent}
            onChange={onChangeText}
            onKeyDown={onKeyDownText}
            readOnly={activeMode === 'draw'}
            placeholder="Tuliskan faidah penting, ayat, hadits, atau kesimpulan kajian di sini... (Pilih 'Coret' di atas untuk memberi stabilo atau menggambar skema di lembar ini)"
            style={{
              fontSize: isMobileViewport ? '16px' : isFocusFullscreen ? '14px' : '13px',
              lineHeight: `${LINE_HEIGHT_PX}px`,
              height: `${paperHeight}px`,
              cursor: activeMode === 'type' ? TEXT_IBEAM_CURSOR : 'default',
            }}
            className={`w-full resize-none overflow-hidden border-0 bg-transparent px-4 pt-3.5 pb-12 text-on-surface caret-emerald-600 dark:caret-amber-400 placeholder:text-outline/45 focus:outline-hidden font-sans ${
              activeMode === 'draw' ? 'pointer-events-none select-none' : 'cursor-text select-text'
            }`}
            spellCheck={false}
          />

          {/* LAPISAN 2: OVERLAY KANVAS CORETAN & STABILO (Menempel pada kertas & ikut ter-scroll) */}
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
            onPointerLeave={() => setHoverPointer(null)}
            style={{
              touchAction: activeMode === 'draw' ? 'none' : 'auto',
              cursor:
                activeMode === 'draw'
                  ? activeTool === 'eraser'
                    ? ERASER_CURSOR
                    : PEN_CURSOR
                  : 'default',
            }}
            className={`absolute inset-0 w-full h-full z-10 ${
              activeMode === 'draw' ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          />

          {/* Indikator Visual Ujung Pena / Stabilo / Penghapus saat Hover di atas Kanvas */}
          {activeMode === 'draw' && hoverPointer && (
            <div
              aria-hidden="true"
              style={{
                left: `${hoverPointer.x}px`,
                top: `${hoverPointer.y}px`,
                width: `${
                  activeTool === 'eraser'
                    ? activeSize * 3.5
                    : activeTool === 'highlighter'
                    ? activeSize * 3.2
                    : Math.max(10, activeSize * 2)
                }px`,
                height: `${
                  activeTool === 'eraser'
                    ? activeSize * 3.5
                    : activeTool === 'highlighter'
                    ? activeSize * 3.2
                    : Math.max(10, activeSize * 2)
                }px`,
                borderColor:
                  activeTool === 'eraser'
                    ? '#e11d48'
                    : activeColor === 'auto'
                    ? '#10b981'
                    : activeColor,
                backgroundColor:
                  activeTool === 'highlighter'
                    ? activeColor === 'auto'
                      ? 'rgba(245, 158, 11, 0.35)'
                      : `${activeColor}40`
                    : activeTool === 'eraser'
                    ? 'rgba(225, 29, 72, 0.15)'
                    : 'transparent',
              }}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-[0_0_0_1.5px_rgba(255,255,255,0.9)] z-20 transition-transform duration-75"
            />
          )}
        </div>

        {/* Toast Salin Catatan */}
        {copiedToast && (
          <div className="sticky bottom-3 left-1/2 -translate-x-1/2 w-fit px-3 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold shadow-lg animate-in fade-in duration-150 flex items-center gap-1 pointer-events-none z-20">
            <span className="material-symbols-outlined text-[13px]">check</span>
            Catatan berhasil disalin!
          </div>
        )}

        {/* Tombol Bantu Scroll Cepat Saat Mode Coret-Coret Aktif */}
        {activeMode === 'draw' && (
          <div className="sticky bottom-2.5 right-2.5 ml-auto mr-2.5 w-fit flex items-center gap-1 bg-surface-container-lowest/90 dark:bg-neutral-900/90 backdrop-blur-md px-2 py-1 rounded-full border border-amber-500/40 shadow-md z-20">
            <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-300 pl-1">
              Mode Coret Aktif
            </span>
            <button
              type="button"
              onClick={() => handleScrollByStep(-180)}
              className="w-6 h-6 rounded-full hover:bg-surface-container text-on-surface flex items-center justify-center cursor-pointer"
              title="Geser Kertas ke Atas"
            >
              <span className="material-symbols-outlined text-[14px]">keyboard_arrow_up</span>
            </button>
            <button
              type="button"
              onClick={() => handleScrollByStep(180)}
              className="w-6 h-6 rounded-full hover:bg-surface-container text-on-surface flex items-center justify-center cursor-pointer"
              title="Geser Kertas ke Bawah (Tambah Ruang Gambar)"
            >
              <span className="material-symbols-outlined text-[14px]">keyboard_arrow_down</span>
            </button>
            <button
              type="button"
              onClick={() => switchToMode('type')}
              className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold cursor-pointer hover:bg-emerald-700 transition-colors"
              title="Kembali ke Mode Ketik"
            >
              Selesai Coret
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
