'use client';

import React, { useState } from 'react';
import { isPushSupported } from '@/utils/webPushClient';
import { useSessionReminder } from '@/utils/reminders';

interface NotificationReminderToggleProps {
  sessionId?: string;
  className?: string;
  compact?: boolean;
  variant?: 'pill' | 'compact' | 'floating' | 'inline';
}

export default function NotificationReminderToggle({
  sessionId,
  className = '',
  compact = false,
  variant,
}: NotificationReminderToggleProps) {
  const resolvedVariant = variant || (compact ? 'compact' : 'pill');
  const { isReminded, toggle } = useSessionReminder(sessionId);
  const [isLoading, setIsLoading] = useState(false);

  const supported = isPushSupported();

  const handleToggle = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (!supported) {
      alert('Browser Anda belum mendukung fitur Web Push Notifications.');
      return;
    }

    setIsLoading(true);
    try {
      await toggle(sessionId);
    } catch (err: any) {
      console.error('Notification toggle error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!supported) return null;

  const tooltipText = isReminded
    ? 'Pengingat H-2 Jam aktif (klik untuk matikan)'
    : 'Aktifkan pengingat notifikasi H-2 jam';

  // 1. VARIAN INLINE (Untuk samping kategori di VenueCard, Online Card, dan Sidebar)
  if (resolvedVariant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
          isReminded
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-highest'
        } ${className}`}
        title={tooltipText}
      >
        <span
          className={`material-symbols-outlined text-[13px] ${isLoading ? 'animate-spin' : ''}`}
          style={{ fontVariationSettings: isReminded ? "'FILL' 1" : "'FILL' 0" }}
        >
          {isLoading ? 'progress_activity' : isReminded ? 'notifications_active' : 'notifications'}
        </span>
      </button>
    );
  }

  // 2. VARIAN FLOATING
  if (resolvedVariant === 'floating') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        className={`w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center transition-all shadow-md active:scale-90 cursor-pointer shrink-0 ${
          isReminded
            ? 'bg-amber-500 text-white'
            : 'bg-black/50 text-white hover:bg-black/75'
        } ${className}`}
        title={tooltipText}
      >
        <span
          className={`material-symbols-outlined text-[15px] ${isLoading ? 'animate-spin' : ''}`}
          style={{ fontVariationSettings: isReminded ? "'FILL' 1" : "'FILL' 0" }}
        >
          {isLoading ? 'progress_activity' : isReminded ? 'notifications_active' : 'notifications'}
        </span>
      </button>
    );
  }

  // 3. VARIAN COMPACT
  if (resolvedVariant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0 ${
          isReminded
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
            : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
        } ${className}`}
        title={tooltipText}
      >
        <span
          className={`material-symbols-outlined text-[18px] ${isLoading ? 'animate-spin' : ''}`}
          style={{ fontVariationSettings: isReminded ? "'FILL' 1" : "'FILL' 0" }}
        >
          {isLoading ? 'progress_activity' : isReminded ? 'notifications_active' : 'notifications'}
        </span>
      </button>
    );
  }

  // 4. VARIAN PILL / DEFAULT (Tombol penuh teks untuk di dalam KajianPreviewModal)
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isLoading}
      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-2xs ${
        isReminded
          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
          : 'bg-surface-container text-on-surface hover:bg-surface-container-high border border-surface-container-high'
      } ${className}`}
      title={tooltipText}
    >
      <span
        className={`material-symbols-outlined text-[18px] text-amber-600 ${
          isLoading ? 'animate-spin' : ''
        }`}
        style={{ fontVariationSettings: isReminded ? "'FILL' 1" : "'FILL' 0" }}
      >
        {isLoading ? 'progress_activity' : isReminded ? 'notifications_active' : 'notifications'}
      </span>
      <span>
        {isLoading
          ? 'Memproses...'
          : isReminded
          ? 'Pengingat Aktif (H-2 Jam)'
          : 'Ingatkan via Notifikasi (H-2 Jam)'}
      </span>
    </button>
  );
}
