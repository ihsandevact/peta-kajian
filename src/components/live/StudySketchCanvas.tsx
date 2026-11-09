'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  type DrawingShape,
  type ShapeStroke,
  type SketchStroke,
  type SketchPoint,
  convertStrokesToShapes,
} from '@/utils/studyNotes';
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
  // Coretan Props: Mendukung DrawingShape[] baru dan SketchStroke[] legacy
  shapes?: DrawingShape[];
  onChangeShapes?: (nextShapes: DrawingShape[]) => void;
  strokes?: SketchStroke[];
  onChangeStrokes?: (nextStrokes: SketchStroke[]) => void;
  className?: string;
}

type UnifiedMode = 'type' | 'draw';
type SketchTool = 'pen' | 'highlighter';
type PaperPattern = 'lines' | 'dots' | 'blank';
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

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

const TEXT_IBEAM_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round'%3E%3Cpath d='M9 4h6M9 20h6M12 4v16'/%3E%3C/g%3E%3Cg stroke='%23059669' stroke-width='1.8' stroke-linecap='round'%3E%3Cpath d='M9 4h6M9 20h6M12 4v16'/%3E%3C/g%3E%3C/svg%3E") 12 12, text`;
const PEN_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='3.5' fill='%2310b981' stroke='%23ffffff' stroke-width='2'/%3E%3Cpath d='M12 3v5M12 16v5M3 12h5M16 12h5' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/%3E%3Cpath d='M12 3v5M12 16v5M3 12h5M16 12h5' stroke='%230f172a' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") 12 12, pointer`;

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
  shapes: externalShapes,
  onChangeShapes,
  strokes: legacyStrokes,
  onChangeStrokes,
}: StudySketchCanvasProps) {
  const confirm = useConfirm();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textMirrorRef = useRef<HTMLDivElement | null>(null);

  // Mode: 'type' (Ketik), 'draw' (Coret Pena/Stabilo), 'select' (Pilih & Edit Shape ala Word)
  const [activeMode, setActiveMode] = useState<UnifiedMode>('type');
  const [activeTool, setActiveTool] = useState<SketchTool>('pen');
  const [activeColor, setActiveColor] = useState<string>('auto');
  const [activeSize, setActiveSize] = useState<number>(4.5);
  const [paperPattern, setPaperPattern] = useState<PaperPattern>('lines');
  const [paperHeight, setPaperHeight] = useState<number>(520);

  // Inisialisasi Shapes
  const [shapesList, setShapesList] = useState<DrawingShape[]>(() => {
    if (externalShapes && externalShapes.length > 0) return externalShapes;
    if (legacyStrokes && legacyStrokes.length > 0) return convertStrokesToShapes(legacyStrokes);
    return [];
  });

  useEffect(() => {
    if (externalShapes !== undefined) {
      setShapesList(externalShapes);
    } else if (legacyStrokes !== undefined) {
      setShapesList(convertStrokesToShapes(legacyStrokes));
    }
  }, [externalShapes, legacyStrokes]);

  const commitShapesChange = useCallback(
    (nextShapes: DrawingShape[]) => {
      setShapesList(nextShapes);
      if (onChangeShapes) {
        onChangeShapes(nextShapes);
      }
      if (onChangeStrokes) {
        // Fallback untuk backward compatibility
        const flatStrokes: SketchStroke[] = nextShapes.flatMap((shp) =>
          shp.strokes.map((stk) => ({
            id: stk.id,
            tool: stk.tool,
            color: stk.color,
            size: stk.size,
            points: stk.points.map((p) => ({
              x: shp.x + p.rx * shp.width,
              y: shp.y + p.ry * shp.height,
            })),
          }))
        );
        onChangeStrokes(flatStrokes);
      }
    },
    [onChangeShapes, onChangeStrokes]
  );

  // Selection & Manipulation State (Word Drawing Box)
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [hoverPointer, setHoverPointer] = useState<SketchPoint | null>(null);

  // Dragging & Resizing Refs
  const isInteractingRef = useRef<boolean>(false);
  const interactionTypeRef = useRef<'drawing' | 'moving' | 'resizing' | null>(null);
  const resizeHandleRef = useRef<ResizeHandle | null>(null);
  const activeShapeIdRef = useRef<string | null>(null);
  const startPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startShapeBoundsRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  // Current drawing stroke
  const currentDrawPointsRef = useRef<SketchPoint[]>([]);

  // Redo Stack
  const [redoShapesStack, setRedoShapesStack] = useState<DrawingShape[][]>([]);

  // Hitung tinggi kertas
  const updatePaperDimensions = useCallback(() => {
    const scrollEl = scrollContainerRef.current;
    const mirrorEl = textMirrorRef.current;
    if (!scrollEl) return;

    const viewportH = scrollEl.clientHeight || 400;
    const textH = mirrorEl ? mirrorEl.scrollHeight : 0;
    let maxShapeY = 0;
    for (const shp of shapesList) {
      const bottom = shp.y + shp.height;
      if (bottom > maxShapeY) maxShapeY = bottom;
    }

    const targetHeight = Math.max(viewportH, textH + EXTRA_BOTTOM_SPACE, maxShapeY + 140);
    setPaperHeight((prev) => (Math.abs(prev - targetHeight) > 4 ? targetHeight : prev));
  }, [shapesList]);

  useEffect(() => {
    updatePaperDimensions();
  }, [noteContent, shapesList, isFocusFullscreen, isMobileViewport, updatePaperDimensions]);

  const resolveStrokeColor = useCallback((colorCode: string, forExportLight = false) => {
    if (colorCode !== 'auto') return colorCode;
    if (forExportLight) return '#0f172a';
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return '#f8fafc';
    }
    return '#0f172a';
  }, []);

  // Gambar seluruh Shape ke dalam canvas 2D
  const redrawCanvas = useCallback(
    (liveStroke?: { tool: SketchTool; color: string; size: number; points: SketchPoint[] } | null) => {
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

      // Gambar semua shape
      for (const shp of shapesList) {
        for (const stk of shp.strokes) {
          if (!stk.points || stk.points.length === 0) continue;
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (stk.tool === 'highlighter') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = resolveStrokeColor(
              stk.color === 'auto' ? '#f59e0b' : stk.color,
              false
            );
            ctx.lineWidth = stk.size * 3.2;
            ctx.globalAlpha = 0.35;
          } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = resolveStrokeColor(stk.color, false);
            ctx.lineWidth = stk.size;
            ctx.globalAlpha = 1;
          }

          ctx.beginPath();
          const p0 = stk.points[0];
          const x0 = shp.x + p0.rx * shp.width;
          const y0 = shp.y + p0.ry * shp.height;

          if (stk.points.length === 1) {
            ctx.arc(x0, y0, ctx.lineWidth / 2, 0, Math.PI * 2);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();
          } else {
            ctx.moveTo(x0, y0);
            for (let i = 1; i < stk.points.length - 1; i++) {
              const cur = stk.points[i];
              const next = stk.points[i + 1];
              const curX = shp.x + cur.rx * shp.width;
              const curY = shp.y + cur.ry * shp.height;
              const nextX = shp.x + next.rx * shp.width;
              const nextY = shp.y + next.ry * shp.height;
              const midX = (curX + nextX) / 2;
              const midY = (curY + nextY) / 2;
              ctx.quadraticCurveTo(curX, curY, midX, midY);
            }
            const last = stk.points[stk.points.length - 1];
            ctx.lineTo(shp.x + last.rx * shp.width, shp.y + last.ry * shp.height);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // Live stroke saat user sedang mencoret
      if (liveStroke && liveStroke.points.length > 0) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (liveStroke.tool === 'highlighter') {
          ctx.strokeStyle = resolveStrokeColor(
            liveStroke.color === 'auto' ? '#f59e0b' : liveStroke.color,
            false
          );
          ctx.lineWidth = liveStroke.size * 3.2;
          ctx.globalAlpha = 0.35;
        } else {
          ctx.strokeStyle = resolveStrokeColor(liveStroke.color, false);
          ctx.lineWidth = liveStroke.size;
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        const pts = liveStroke.points;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    },
    [shapesList, paperHeight, resolveStrokeColor]
  );

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const getPointerCoords = (e: React.PointerEvent<HTMLCanvasElement | HTMLDivElement>): SketchPoint => {
    const paper = paperRef.current;
    if (!paper) return { x: 0, y: 0 };
    const rect = paper.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) * 10) / 10,
      y: Math.round((e.clientY - rect.top) * 10) / 10,
    };
  };

  // --- LOGIKA MENGGAMBAR PENA / STABILO ---
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeMode !== 'draw') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();

    // Jika user mulai mencoret di kanvas kosong, batalkan seleksi shape sebelumnya
    setSelectedShapeId(null);

    const pt = getPointerCoords(e);
    isInteractingRef.current = true;
    interactionTypeRef.current = 'drawing';
    currentDrawPointsRef.current = [pt];

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    redrawCanvas({
      tool: activeTool,
      color: activeColor,
      size: activeSize,
      points: [pt],
    });
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeMode !== 'draw') return;
    const pt = getPointerCoords(e);
    if (e.pointerType !== 'touch') {
      setHoverPointer(pt);
    }

    if (!isInteractingRef.current || interactionTypeRef.current !== 'drawing') return;
    e.stopPropagation();

    const pts = currentDrawPointsRef.current;
    const lastPt = pts[pts.length - 1];
    if (lastPt && Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) < 1.5) {
      return;
    }

    pts.push(pt);
    redrawCanvas({
      tool: activeTool,
      color: activeColor,
      size: activeSize,
      points: pts,
    });
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isInteractingRef.current || interactionTypeRef.current !== 'drawing') return;
    e.stopPropagation();
    isInteractingRef.current = false;
    interactionTypeRef.current = null;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const pts = currentDrawPointsRef.current;
    if (pts.length > 0) {
      // Hitung Bounding Box Coretan Baru secara otomatis (Auto-Shape ala Word)
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }

      const pad = Math.max(10, activeSize * 2);
      const x = Math.max(0, minX - pad);
      const y = Math.max(0, minY - pad);
      const width = Math.max(30, maxX - minX + pad * 2);
      const height = Math.max(30, maxY - minY + pad * 2);

      const newShape: DrawingShape = {
        id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        x,
        y,
        width,
        height,
        strokes: [
          {
            id: `stk-${Date.now()}`,
            tool: activeTool,
            color: activeColor,
            size: activeSize,
            points: pts.map((p) => ({
              rx: Math.max(0, Math.min(1, (p.x - x) / width)),
              ry: Math.max(0, Math.min(1, (p.y - y) / height)),
            })),
          },
        ],
        created_at: Date.now(),
      };

      const nextShapes = [...shapesList, newShape];
      setRedoShapesStack([]);
      commitShapesChange(nextShapes);
      setSelectedShapeId(newShape.id);
    }

    currentDrawPointsRef.current = [];
  };

  // --- LOGIKA MANIPULASI SHAPE (DRAG MOVE & RESIZE HANDLES) ---
  const handleShapeMoveStart = (e: React.PointerEvent, shape: DrawingShape) => {
    e.stopPropagation();
    setSelectedShapeId(shape.id);
    isInteractingRef.current = true;
    interactionTypeRef.current = 'moving';
    activeShapeIdRef.current = shape.id;
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    startShapeBoundsRef.current = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleResizeStart = (e: React.PointerEvent, shape: DrawingShape, handle: ResizeHandle) => {
    e.stopPropagation();
    setSelectedShapeId(shape.id);
    isInteractingRef.current = true;
    interactionTypeRef.current = 'resizing';
    resizeHandleRef.current = handle;
    activeShapeIdRef.current = shape.id;
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    startShapeBoundsRef.current = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleInteractionMove = (e: React.PointerEvent) => {
    if (!isInteractingRef.current) return;
    const currentShapeId = activeShapeIdRef.current;
    if (!currentShapeId) return;

    const dx = e.clientX - startPointerRef.current.x;
    const dy = e.clientY - startPointerRef.current.y;
    const start = startShapeBoundsRef.current;

    if (interactionTypeRef.current === 'moving') {
      const nextX = Math.max(0, Math.round(start.x + dx));
      const nextY = Math.max(0, Math.round(start.y + dy));

      setShapesList((prev) =>
        prev.map((s) => (s.id === currentShapeId ? { ...s, x: nextX, y: nextY } : s))
      );
    } else if (interactionTypeRef.current === 'resizing') {
      const h = resizeHandleRef.current;
      let newX = start.x;
      let newY = start.y;
      let newW = start.width;
      let newH = start.height;

      if (h?.includes('e')) newW = Math.max(30, start.width + dx);
      if (h?.includes('s')) newH = Math.max(30, start.height + dy);
      if (h?.includes('w')) {
        const potentialW = start.width - dx;
        if (potentialW >= 30) {
          newW = potentialW;
          newX = start.x + dx;
        }
      }
      if (h?.includes('n')) {
        const potentialH = start.height - dy;
        if (potentialH >= 30) {
          newH = potentialH;
          newY = start.y + dy;
        }
      }

      setShapesList((prev) =>
        prev.map((s) =>
          s.id === currentShapeId
            ? { ...s, x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) }
            : s
        )
      );
    }
  };

  const handleInteractionEnd = (e: React.PointerEvent) => {
    if (!isInteractingRef.current) return;
    isInteractingRef.current = false;
    interactionTypeRef.current = null;
    resizeHandleRef.current = null;
    activeShapeIdRef.current = null;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    commitShapesChange(shapesList);
  };

  const handleDeleteSelectedShape = () => {
    if (!selectedShapeId) return;
    const next = shapesList.filter((s) => s.id !== selectedShapeId);
    setSelectedShapeId(null);
    commitShapesChange(next);
  };

  const handleUndoShapes = () => {
    if (shapesList.length === 0) return;
    const prev = shapesList.slice(0, -1);
    setRedoShapesStack((old) => [shapesList, ...old]);
    commitShapesChange(prev);
    setSelectedShapeId(null);
  };

  const handleRedoShapes = () => {
    if (redoShapesStack.length === 0) return;
    const [next, ...rest] = redoShapesStack;
    setRedoShapesStack(rest);
    commitShapesChange(next);
    setSelectedShapeId(null);
  };

  const handleClearAllShapes = async () => {
    if (shapesList.length === 0) return;
    const ok = await confirm({
      title: 'Bersihkan Semua Coretan & Shape?',
      description: 'Seluruh coretan objek gambar pada catatan ini akan dihapus. Teks ketikan Anda tetap aman.',
      confirmText: 'Ya, Bersihkan Coretan',
      cancelText: 'Batal',
      variant: 'danger',
      icon: 'delete_sweep',
    });
    if (!ok) return;
    setRedoShapesStack((old) => [shapesList, ...old]);
    commitShapesChange([]);
    setSelectedShapeId(null);
  };

  // Ekspor Catatan Gabungan PNG
  const handleDownloadUnifiedPng = () => {
    const paper = paperRef.current;
    if (!paper) return;

    const rect = paper.getBoundingClientRect();
    const width = Math.max(640, Math.round(rect.width));
    const headerHeight = 68;
    const padX = 16;
    const padTop = 14;
    const maxTextWidth = width - padX * 2;

    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    const fontSize = isMobileViewport ? 16 : 14;
    const baseFont = `${fontSize}px sans-serif`;
    const boldFont = `bold ${fontSize}px sans-serif`;

    const wrappedLines: { text: string; isHeading: boolean; isQuote: boolean }[] = [];
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

    let maxShapeY = 0;
    for (const s of shapesList) {
      if (s.y + s.height > maxShapeY) maxShapeY = s.y + s.height;
    }

    const textTotalHeight = wrappedLines.length * LINE_HEIGHT_PX + padTop * 2 + 40;
    const bodyHeight = Math.max(420, Math.round(rect.height), textTotalHeight, maxShapeY + 60);
    const totalHeight = headerHeight + bodyHeight;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width * 2;
    exportCanvas.height = totalHeight * 2;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(2, 2);

    // Kertas Hangat
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(0, 0, width, totalHeight);

    // Garis Kertas
    if (paperPattern === 'lines') {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
      ctx.lineWidth = 1;
      for (let y = headerHeight + 14; y < totalHeight; y += LINE_HEIGHT_PX) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Header Kartu
    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, width, headerHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(title.slice(0, 52), padX, 28);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${speakerName ? `Pemateri: ${speakerName} • ` : ''}PetaKajian.id`, padX, 48);

    // Teks Catatan
    let curY = headerHeight + padTop + fontSize;
    ctx.fillStyle = '#0f172a';
    for (const l of wrappedLines) {
      if (l.text) {
        ctx.font = l.isHeading ? boldFont : baseFont;
        ctx.fillText(l.text, padX, curY);
      }
      curY += LINE_HEIGHT_PX;
    }

    // Gambar Seluruh Shapes
    for (const shp of shapesList) {
      for (const stk of shp.strokes) {
        if (!stk.points || stk.points.length === 0) continue;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (stk.tool === 'highlighter') {
          ctx.strokeStyle = resolveStrokeColor(
            stk.color === 'auto' ? '#f59e0b' : stk.color,
            true
          );
          ctx.lineWidth = stk.size * 3.2;
          ctx.globalAlpha = 0.35;
        } else {
          ctx.strokeStyle = resolveStrokeColor(stk.color, true);
          ctx.lineWidth = stk.size;
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        const p0 = stk.points[0];
        ctx.moveTo(shp.x + p0.rx * shp.width, headerHeight + shp.y + p0.ry * shp.height);
        for (let i = 1; i < stk.points.length; i++) {
          const pt = stk.points[i];
          ctx.lineTo(shp.x + pt.rx * shp.width, headerHeight + shp.y + pt.ry * shp.height);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // Unduh File
    const link = document.createElement('a');
    link.download = `Catatan_${title.replace(/[^a-z0-9]/gi, '_').slice(0, 30)}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  const selectedShape = shapesList.find((s) => s.id === selectedShapeId);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative select-none font-geist text-on-surface">
      {/* 1. TOOLBAR ATAS TERPADU */}
      <div className="px-3 py-1.5 bg-surface-container-low/90 dark:bg-neutral-900/90 border-b border-surface-container-high/60 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar shrink-0 select-none">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* TAB MODE: KETIK vs CORET (Shape otomatis aktif & bisa langsung diklik saat di mode Coret) */}
          <div className="flex items-center p-0.5 rounded-lg bg-surface-container border border-surface-container-high text-[11px] font-bold">
            <button
              type="button"
              onClick={() => {
                setActiveMode('type');
                setSelectedShapeId(null); // Otomatis hilangkan kotak seleksi resize saat beralih ke mode Ketik
                setTimeout(() => textareaRef.current?.focus(), 20);
              }}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                activeMode === 'type'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-outline hover:text-on-surface'
              }`}
              title="Mode Ketik Teks Catatan (Kotak seleksi shape disembunyikan)"
            >
              <span className="material-symbols-outlined text-[14px]">edit_note</span>
              <span>Ketik</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode('draw');
                textareaRef.current?.blur();
              }}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                activeMode === 'draw'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-outline hover:text-on-surface'
              }`}
              title="Mode Coretan: Coret dengan pena atau klik bentuk yang ada untuk menggeser & mengatur ukuran"
            >
              <span className="material-symbols-outlined text-[14px]">draw</span>
              <span>Coret</span>
            </button>
          </div>

          <div className="w-[1px] h-4 bg-surface-container-high shrink-0" />

          {/* ALAT KONTEKSTUAL */}
          {activeMode === 'type' ? (
            /* --- ALAT FORMAT TEKS --- */
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onUndoText}
                disabled={!canUndoText}
                className="w-6 h-6 rounded-md flex items-center justify-center text-outline hover:text-on-surface disabled:opacity-30 cursor-pointer"
                title="Undo Teks"
              >
                <span className="material-symbols-outlined text-[15px]">undo</span>
              </button>
              <button
                type="button"
                onClick={onRedoText}
                disabled={!canRedoText}
                className="w-6 h-6 rounded-md flex items-center justify-center text-outline hover:text-on-surface disabled:opacity-30 cursor-pointer"
                title="Redo Teks"
              >
                <span className="material-symbols-outlined text-[15px]">redo</span>
              </button>
              <button
                type="button"
                onClick={onInsertBold}
                className="w-6 h-6 rounded-md hover:bg-surface-container text-[11px] font-bold text-outline hover:text-on-surface cursor-pointer"
                title="Teks Tebal"
              >
                B
              </button>
              <button
                type="button"
                onClick={onInsertItalic}
                className="w-6 h-6 rounded-md hover:bg-surface-container text-[11px] font-serif italic font-bold text-outline hover:text-on-surface cursor-pointer"
                title="Teks Miring"
              >
                I
              </button>
              <button
                type="button"
                onClick={onInsertHeading}
                className="w-6 h-6 rounded-md hover:bg-surface-container text-[11px] font-bold text-outline hover:text-on-surface cursor-pointer"
                title="Sub-judul"
              >
                H
              </button>
              <button
                type="button"
                onClick={onInsertPoint}
                className="px-1.5 py-0.5 rounded-md hover:bg-surface-container text-[10px] font-bold text-outline hover:text-on-surface cursor-pointer"
                title="Poin Faidah"
              >
                • Poin
              </button>
              <button
                type="button"
                onClick={onInsertTimestamp}
                className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                title="Timestamp Video"
              >
                <span className="material-symbols-outlined text-[12px]">schedule</span>
                <span>+ Waktu</span>
              </button>
            </div>
          ) : (
            /* --- ALAT CORET / MANIPULASI SHAPE --- */
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTool('pen');
                  setActiveMode('draw');
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  activeTool === 'pen' && activeMode === 'draw'
                    ? 'bg-emerald-600 text-white'
                    : 'text-outline hover:bg-surface-container hover:text-on-surface'
                }`}
                title="Pena"
              >
                <span className="material-symbols-outlined text-[14px]">stylus</span>
                <span>Pena</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTool('highlighter');
                  setActiveMode('draw');
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  activeTool === 'highlighter' && activeMode === 'draw'
                    ? 'bg-amber-500 text-white'
                    : 'text-outline hover:bg-surface-container hover:text-on-surface'
                }`}
                title="Stabilo Penanda"
              >
                <span className="material-symbols-outlined text-[14px]">format_ink_highlighter</span>
                <span>Stabilo</span>
              </button>

              <div className="w-[1px] h-4 bg-surface-container-high mx-0.5 shrink-0" />

              {/* Pilihan Warna */}
              <div className="flex items-center gap-1 shrink-0">
                {COLOR_PALETTE.map((c) => {
                  const isSelected = activeColor === c.hex;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveColor(c.hex)}
                      className={`w-3.5 h-3.5 rounded-full ${c.previewClass} cursor-pointer transition-transform ${
                        isSelected ? 'scale-125 ring-2 ring-emerald-500' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={c.label}
                    />
                  );
                })}
              </div>

              <div className="w-[1px] h-4 bg-surface-container-high mx-0.5 shrink-0" />

              {/* Ukuran */}
              <div className="flex items-center gap-0.5 shrink-0">
                {STROKE_SIZES.map((sz) => (
                  <button
                    key={sz.label}
                    type="button"
                    onClick={() => setActiveSize(sz.value)}
                    className={`w-5 h-5 rounded flex items-center justify-center cursor-pointer ${
                      activeSize === sz.value ? 'bg-surface-container-highest text-on-surface' : 'text-outline'
                    }`}
                    title={sz.label}
                  >
                    <span className={`rounded-full bg-current ${sz.dotSize}`} />
                  </button>
                ))}
              </div>

              <div className="w-[1px] h-4 bg-surface-container-high mx-0.5 shrink-0" />

              {/* Undo / Redo / Clear Shape */}
              <button
                type="button"
                onClick={handleUndoShapes}
                disabled={shapesList.length === 0}
                className="w-6 h-6 rounded flex items-center justify-center text-outline hover:text-on-surface disabled:opacity-30 cursor-pointer"
                title="Undo Coretan Shape"
              >
                <span className="material-symbols-outlined text-[15px]">undo</span>
              </button>
              <button
                type="button"
                onClick={handleRedoShapes}
                disabled={redoShapesStack.length === 0}
                className="w-6 h-6 rounded flex items-center justify-center text-outline hover:text-on-surface disabled:opacity-30 cursor-pointer"
                title="Redo Coretan Shape"
              >
                <span className="material-symbols-outlined text-[15px]">redo</span>
              </button>
              <button
                type="button"
                onClick={handleClearAllShapes}
                disabled={shapesList.length === 0}
                className="w-6 h-6 rounded flex items-center justify-center text-outline hover:text-red-500 disabled:opacity-30 cursor-pointer"
                title="Bersihkan Semua Coretan"
              >
                <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
              </button>
            </div>
          )}
        </div>

        {/* ALAT EKSPOR KANAN */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onCopyWhatsApp}
            className="w-6 h-6 rounded hover:bg-surface-container text-outline hover:text-on-surface flex items-center justify-center cursor-pointer"
            title="Salin Teks"
          >
            <span className="material-symbols-outlined text-[14px]">
              {copiedToast ? 'check' : 'content_copy'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleDownloadUnifiedPng}
            className="w-6 h-6 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 flex items-center justify-center cursor-pointer"
            title="Unduh Gambar Catatan (PNG)"
          >
            <span className="material-symbols-outlined text-[14px]">image</span>
          </button>
          <button
            type="button"
            onClick={onDownloadTxt}
            className="w-6 h-6 rounded hover:bg-surface-container text-outline hover:text-on-surface flex items-center justify-center cursor-pointer"
            title="Unduh Teks (.txt)"
          >
            <span className="material-symbols-outlined text-[14px]">download</span>
          </button>
        </div>
      </div>

      {/* 2. LEMBAR KERTAS CATATAN TERPADU */}
      <div
        ref={scrollContainerRef}
        onPointerMove={handleInteractionMove}
        onPointerUp={handleInteractionEnd}
        onPointerCancel={handleInteractionEnd}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative bg-amber-50/35 dark:bg-neutral-950/60"
      >
        <div
          ref={paperRef}
          style={{
            height: `${paperHeight}px`,
            minHeight: '100%',
            backgroundImage:
              paperPattern === 'lines'
                ? `linear-gradient(to bottom, transparent 27px, rgba(148, 163, 184, 0.24) 28px)`
                : 'none',
            backgroundSize: `100% ${LINE_HEIGHT_PX}px`,
            backgroundPosition: '0 14px',
          }}
          className={`relative w-full ${isFocusFullscreen ? 'max-w-4xl mx-auto shadow-xs' : ''}`}
        >
          {/* Hidden Mirror Div */}
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

          {/* LAPISAN 1: TEXTAREA EDITOR */}
          <textarea
            ref={textareaRef}
            value={noteContent}
            onChange={onChangeText}
            onKeyDown={onKeyDownText}
            onClick={() => {
              // Jika user mengklik area teks kosong di luar shape, hilangkan seleksi shape
              setSelectedShapeId(null);
            }}
            readOnly={activeMode !== 'type'}
            placeholder="Tuliskan faidah penting di sini... (Pilih 'Coret' di atas untuk menggambar coretan/shape yang bisa di-drag & resize)"
            style={{
              fontSize: isMobileViewport ? '16px' : isFocusFullscreen ? '14px' : '13px',
              lineHeight: `${LINE_HEIGHT_PX}px`,
              height: `${paperHeight}px`,
              cursor: activeMode === 'type' ? TEXT_IBEAM_CURSOR : 'default',
            }}
            className={`w-full resize-none overflow-hidden border-0 bg-transparent px-4 pt-3.5 pb-12 text-on-surface caret-emerald-600 dark:caret-amber-400 placeholder:text-outline/45 focus:outline-hidden font-sans ${
              activeMode !== 'type' ? 'pointer-events-none select-none' : 'cursor-text select-text'
            }`}
            spellCheck={false}
          />

          {/* LAPISAN 2: CANVAS CORETAN (Render goresan) */}
          <canvas
            ref={canvasRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            onPointerLeave={() => setHoverPointer(null)}
            style={{
              touchAction: activeMode === 'draw' ? 'none' : 'auto',
              cursor: activeMode === 'draw' ? PEN_CURSOR : 'default',
            }}
            className={`absolute inset-0 w-full h-full z-10 ${
              activeMode === 'draw' ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          />

          {/* LAPISAN 3: OBJEK SHAPE INTERAKTIF (SELALU BISA DIKLIK, DIGESER & DIRESIZE BAHKAN DI MODE KETIK) */}
          {shapesList.map((shp) => {
            const isSelected = selectedShapeId === shp.id;
            return (
              <div
                key={shp.id}
                onPointerDown={(e) => {
                  handleShapeMoveStart(e, shp);
                }}
                style={{
                  left: `${shp.x}px`,
                  top: `${shp.y}px`,
                  width: `${shp.width}px`,
                  height: `${shp.height}px`,
                  touchAction: 'none',
                }}
                className={`absolute z-20 cursor-move pointer-events-auto transition-shadow ${
                  isSelected
                    ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-transparent border border-dashed border-emerald-400/80 bg-emerald-500/5'
                    : 'hover:border hover:border-dashed hover:border-emerald-500/50'
                }`}
              >
                {/* 8 RESIZE HANDLES & ACTION TOOLBAR SAAT SHAPE TERPILIH */}
                {isSelected && (
                  <>
                    {/* Toolbar Mini Aksi Shape */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-surface-container-lowest/95 dark:bg-neutral-900/95 backdrop-blur-md px-2 py-0.5 rounded-full border border-surface-container-high shadow-md pointer-events-auto z-30">
                      <span className="text-[9px] font-bold text-outline">Bentuk</span>
                      <button
                        type="button"
                        onClick={handleDeleteSelectedShape}
                        className="w-5 h-5 rounded hover:bg-red-500/10 text-red-500 flex items-center justify-center cursor-pointer"
                        title="Hapus Bentuk"
                      >
                        <span className="material-symbols-outlined text-[13px]">delete</span>
                      </button>
                    </div>

                    {/* 4 Sudut */}
                    <div
                      onPointerDown={(e) => handleResizeStart(e, shp, 'nw')}
                      className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-emerald-600 rounded-sm cursor-nwse-resize pointer-events-auto shadow-xs"
                    />
                    <div
                      onPointerDown={(e) => handleResizeStart(e, shp, 'ne')}
                      className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-emerald-600 rounded-sm cursor-nesw-resize pointer-events-auto shadow-xs"
                    />
                    <div
                      onPointerDown={(e) => handleResizeStart(e, shp, 'se')}
                      className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-emerald-600 rounded-sm cursor-nwse-resize pointer-events-auto shadow-xs"
                    />
                    <div
                      onPointerDown={(e) => handleResizeStart(e, shp, 'sw')}
                      className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-emerald-600 rounded-sm cursor-nesw-resize pointer-events-auto shadow-xs"
                    />

                    {/* 4 Tepi */}
                    <div
                      onPointerDown={(e) => handleResizeStart(e, shp, 'n')}
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-emerald-600 rounded-sm cursor-ns-resize pointer-events-auto shadow-xs"
                    />
                    <div
                      onPointerDown={(e) => handleResizeStart(e, shp, 's')}
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-emerald-600 rounded-sm cursor-ns-resize pointer-events-auto shadow-xs"
                    />
                    <div
                      onPointerDown={(e) => handleResizeStart(e, shp, 'w')}
                      className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-emerald-600 rounded-sm cursor-ew-resize pointer-events-auto shadow-xs"
                    />
                    <div
                      onPointerDown={(e) => handleResizeStart(e, shp, 'e')}
                      className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-emerald-600 rounded-sm cursor-ew-resize pointer-events-auto shadow-xs"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
