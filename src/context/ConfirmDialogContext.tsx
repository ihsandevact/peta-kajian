'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  icon?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmFn | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [dialogOptions, setDialogOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeDialog = useCallback((result: boolean) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setDialogOptions(null);
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    // Jika masih ada dialog aktif sebelumnya, batalkan dulu
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }

    setDialogOptions(options);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  // Tutup dengan tombol Escape
  useEffect(() => {
    if (!dialogOptions) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogOptions, closeDialog]);

  const variant = dialogOptions?.variant || 'danger';

  const iconBadgeClass =
    variant === 'danger'
      ? 'bg-red-500/15 text-red-600 dark:text-red-400 ring-4 ring-red-500/10'
      : variant === 'warning'
      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/10'
      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-4 ring-emerald-500/10';

  const confirmButtonClass =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20'
      : variant === 'warning'
      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20';

  const defaultIcon =
    variant === 'danger'
      ? 'warning'
      : variant === 'warning'
      ? 'help'
      : 'task_alt';

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {mounted &&
        dialogOptions &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150 font-geist"
            onClick={() => closeDialog(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-surface border border-outline-variant/60 p-5 sm:p-6 shadow-2xl relative animate-in zoom-in-95 duration-150 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Ikon Header */}
              <div
                className={`w-13 h-13 rounded-2xl flex items-center justify-center mx-auto mb-3.5 ${iconBadgeClass}`}
              >
                <span className="material-symbols-outlined text-[26px]">
                  {dialogOptions.icon || defaultIcon}
                </span>
              </div>

              {/* Judul & Deskripsi */}
              <h3
                id="confirm-dialog-title"
                className="text-base sm:text-lg font-extrabold text-on-surface tracking-tight"
              >
                {dialogOptions.title}
              </h3>
              <p
                id="confirm-dialog-description"
                className="text-xs sm:text-sm text-on-surface-variant mt-1.5 leading-relaxed"
              >
                {dialogOptions.description}
              </p>

              {/* Tombol Aksi */}
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => closeDialog(false)}
                  className="py-2.5 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-on-surface text-xs sm:text-sm font-bold transition-colors cursor-pointer active:scale-98"
                >
                  {dialogOptions.cancelText || 'Batal'}
                </button>
                <button
                  type="button"
                  onClick={() => closeDialog(true)}
                  autoFocus
                  className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold shadow-sm transition-all cursor-pointer active:scale-98 ${confirmButtonClass}`}
                >
                  {dialogOptions.confirmText || 'Ya, Lanjutkan'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error('useConfirm harus digunakan di dalam ConfirmDialogProvider');
  }
  return ctx;
}
