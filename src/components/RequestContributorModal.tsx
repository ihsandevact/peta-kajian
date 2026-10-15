'use client';

import React, { useState } from 'react';
import { requestContributorAccess } from '@/app/actions/kajian';

interface RequestContributorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userEmail?: string;
}

export default function RequestContributorModal({
  isOpen,
  onClose,
  onSuccess,
  userEmail,
}: RequestContributorModalProps) {
  const [communityName, setCommunityName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await requestContributorAccess({
        communityName: communityName.trim() || undefined,
        whatsappNumber: whatsappNumber.trim() || undefined,
        note: note.trim() || undefined,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || 'Gagal mengirim permohonan.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-surface-container-lowest border border-surface-container-high rounded-3xl shadow-2xl overflow-hidden flex flex-col font-geist max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-surface-container-high/60 flex items-center justify-between bg-surface-container-low/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold shrink-0">
              <span className="material-symbols-outlined text-[20px]">volunteer_activism</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Ajukan Jadi Kontributor Dakwah</h2>
              <p className="text-[11px] text-on-surface-variant">Bantu sebarluaskan jadwal kajian ke seluruh umat</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs text-on-surface-variant leading-relaxed">
            <span className="font-semibold text-primary block mb-0.5">Keutamaan Menjadi Relawan Kontributor</span>
            Sebagai Relawan Kontributor Dakwah, Anda dapat menambahkan dan memperbarui jadwal kajian dari masjid atau majelis taklim di daerah Anda agar langsung dapat ditemukan oleh ribuan jamaah di peta.
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Nomor WhatsApp untuk Koordinasi
            </label>
            <input
              type="tel"
              required
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="Contoh: 081234567890"
              className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary placeholder:text-outline/70 transition-all"
            />
            <p className="text-[10px] text-outline mt-1">
              Digunakan oleh Administrator untuk verifikasi identitas relawan jika diperlukan.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Catatan / Motivasi Singkat <span className="text-outline font-normal">(Opsional)</span>
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ceritakan singkat tentang kegiatan dakwah atau kajian rutin di wilayah Anda..."
              className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary placeholder:text-outline/70 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Nama Masjid / Majelis Taklim / Komunitas <span className="text-outline font-normal">(Opsional)</span>
            </label>
            <input
              type="text"
              value={communityName}
              onChange={(e) => setCommunityName(e.target.value)}
              placeholder="Contoh: Masjid Al-Ikhlas Tebet / DKM As-Salam (Boleh dikosongkan)"
              className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary placeholder:text-outline/70 transition-all"
            />
            <p className="text-[10px] text-outline mt-1">
              Jika Anda berafiliasi atau mewakili DKM masjid/komunitas dakwah tertentu.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary/90 shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>Mengirim Permohonan...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>Kirim Permohonan Relawan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
