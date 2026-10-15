'use client';

import React, { useState } from 'react';
import { cleanTelegramUsername } from '@/lib/services/telegram';
import { proposeTelegramChannel } from '@/app/actions/telegram';

interface ProposeTelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ProposeTelegramModal({
  isOpen,
  onClose,
  onSuccess,
}: ProposeTelegramModalProps) {
  const [username, setUsername] = useState('');
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const cleanedUsername = cleanTelegramUsername(username);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!cleanedUsername) {
      setError('Masukkan username atau link channel Telegram yang valid.');
      return;
    }

    if (!title.trim()) {
      setError('Nama channel atau komunitas kajian wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const res = await proposeTelegramChannel({
        channelUsername: cleanedUsername,
        channelTitle: title.trim(),
        city: city.trim() || undefined,
        description: description.trim() || undefined,
      });

      if (res.success) {
        setSuccessMessage(res.message || 'Usulan channel berhasil dikirim!');
        setUsername('');
        setTitle('');
        setCity('');
        setDescription('');
        if (onSuccess) onSuccess();
        setTimeout(() => {
          setSuccessMessage(null);
          onClose();
        }, 2000);
      } else {
        setError(res.error || 'Gagal mengirim usulan channel.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 font-geist">
      <div className="bg-surface-container-lowest rounded-3xl max-w-md w-full border border-surface-container-high shadow-2xl p-6 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold shrink-0">
              <span className="material-symbols-outlined text-[20px]">send</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-on-surface">Usulkan Channel Telegram</h3>
              <p className="text-[11px] text-outline">Bantu bot AI memantau jadwal kajian baru</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-outline cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">check_circle</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form Usulan */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Username atau Tautan Channel Telegram <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: infokajianbdg atau t.me/infokajianbdg"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-surface-container border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-sky-500/30 text-on-surface placeholder:text-outline/70"
            />
            {cleanedUsername && (
              <div className="flex items-center justify-between text-[11px] mt-1.5 px-2 py-1 rounded-lg bg-surface-container/60 border border-surface-container-high/60">
                <span className="text-outline">
                  Format bersih: <strong className="text-sky-600 font-semibold">@{cleanedUsername}</strong>
                </span>
                <a
                  href={`https://t.me/s/${cleanedUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-sky-600 hover:underline font-medium"
                >
                  <span>Cek Channel</span>
                  <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                </a>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Nama Channel / Komunitas <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Info Kajian Bandung & Sekitarnya"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-surface-container border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-sky-500/30 text-on-surface placeholder:text-outline/70"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Cakupan Kota / Wilayah <span className="text-outline font-normal">(opsional)</span>
            </label>
            <input
              type="text"
              placeholder="Contoh: Bandung / Jabodetabek / Nasional"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-surface-container border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-sky-500/30 text-on-surface placeholder:text-outline/70"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Catatan Tambahan <span className="text-outline font-normal">(opsional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Channel resmi DKM Masjid Al-Lathif..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-surface-container border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-sky-500/30 text-on-surface placeholder:text-outline/70"
            />
          </div>

          <div className="p-3 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-800/40 text-[11px] text-sky-800 dark:text-sky-300">
            <p>
              💡 Channel yang Anda usulkan akan ditinjau oleh Admin terlebih dahulu. Setelah disetujui, AI Scraper akan memantau channel ini secara berkala untuk mengekstrak jadwal kajian.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-outline hover:bg-surface-container cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  <span>Mengirim...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>Kirim Usulan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
