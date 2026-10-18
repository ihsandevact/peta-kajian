'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { StudySession } from '@/lib/services/kajian';
import { updateKajian } from '@/app/actions/kajian';
import RecurringRuleSelector from './RecurringRuleSelector';
import { RecurringRule, parseRecurringPattern } from '@/utils/recurring';
import VenueLocationPicker from './VenueLocationPicker';

interface EditSessionModalProps {
  session: StudySession | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditSessionModal({
  session,
  isOpen,
  onClose,
  onSuccess,
}: EditSessionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [audience, setAudience] = useState<'umum' | 'ikhwan' | 'akhwat'>('umum');
  const [status, setStatus] = useState<'confirmed' | 'pending' | 'rejected' | 'canceled' | 'postponed'>('confirmed');
  const [startDatetime, setStartDatetime] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [mode, setMode] = useState<'offline' | 'online' | 'hybrid'>('offline');
  const [venueName, setVenueName] = useState('');
  const [isTest, setIsTest] = useState(false);

  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringRule, setRecurringRule] = useState<RecurringRule>({
    dayOfWeek: 0,
    time: '05:00',
    timeCategory: 'subuh',
    weeks: [1, 2, 3, 4, 5],
  });

  // Map / Location state
  const [markerPos, setMarkerPos] = useState({ lat: -6.200000, lng: 106.816666 });

  // Synchronize when session prop changes
  useEffect(() => {
    if (!session) return;

    setTitle(session.title || '');
    setSpeakerName(session.speaker_name || '');
    setBookTitle(session.book_title && session.book_title.toLowerCase() !== 'null' ? session.book_title : '');
    setAudience(session.audience_type || 'umum');
    setStatus(session.status || 'confirmed');
    setPosterUrl(session.poster_url && session.poster_url.toLowerCase() !== 'null' ? session.poster_url : '');
    setStreamUrl(session.stream_url && session.stream_url.toLowerCase() !== 'null' ? session.stream_url : '');

    // Determine Mode
    if (session.is_online && session.venues) {
      setMode('hybrid');
    } else if (session.is_online && !session.venues) {
      setMode('online');
    } else {
      setMode('offline');
    }

    // Venue & Coordinates
    if (session.venues) {
      setVenueName(session.venues.name || '');
      const lat = session.venues.lat || -6.200000;
      const lng = session.venues.lng || 106.816666;
      setMarkerPos({ lat, lng });
    } else {
      setVenueName('');
    }

    // Start Datetime
    if (session.start_datetime) {
      const dt = new Date(session.start_datetime);
      // format to YYYY-MM-DDTHH:mm
      const pad = (n: number) => String(n).padStart(2, '0');
      const formatted = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
      setStartDatetime(formatted);
    } else {
      setStartDatetime('');
    }

    // Recurring Rule
    setIsRecurring(!!session.is_recurring);
    if (session.recurring_rule && typeof session.recurring_rule === 'object') {
      setRecurringRule(session.recurring_rule);
    } else if (session.recurring_pattern) {
      const parsed = parseRecurringPattern(session.recurring_pattern);
      if (parsed) setRecurringRule(parsed);
    }

    // Flag Data Testing Admin
    setIsTest(!!session.is_test);
  }, [session, isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.append('session_id', session.id);
    formData.append('mode', mode);
    formData.append('audience', audience);
    formData.append('status', status);
    formData.append('is_test', String(isTest));
    formData.append('lat', String(markerPos.lat));
    formData.append('lng', String(markerPos.lng));

    try {
      const res = await updateKajian(formData);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Gagal memperbarui kajian.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !session) return null;

  const needsVenue = mode !== 'online';
  const needsStream = mode !== 'offline';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-surface-container-lowest border border-surface-container-high rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-5 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">edit_calendar</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Edit Data Kajian</h2>
              <p className="text-xs text-on-surface-variant">Perbarui jadwal, materi, atau lokasi kajian</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-error/10 border border-error/20 text-error text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form id="edit-session-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Status Kajian */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-surface-container-high">
              <div>
                <span className="text-xs font-semibold text-on-surface block">Status Kajian</span>
                <span className="text-[11px] text-on-surface-variant">Ubah status jika kajian ditunda atau dibatalkan</span>
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="confirmed">✅ Aktif / Tayang di Peta</option>
                <option value="postponed">⏳ Ditunda (Postponed)</option>
                <option value="canceled">❌ Dibatalkan (Canceled)</option>
              </select>
            </div>

            {/* Judul & Pemateri */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-on-surface">
                  Judul Kajian <span className="text-error">*</span>
                </span>
                <input
                  type="text"
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-on-surface">
                  Nama Ustadz / Pemateri <span className="text-error">*</span>
                </span>
                <input
                  type="text"
                  name="speaker_name"
                  value={speakerName}
                  onChange={(e) => setSpeakerName(e.target.value)}
                  required
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                />
              </label>
            </div>

            {/* Kitab & Waktu Non-Rutin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-on-surface">Nama Kitab (Opsional)</span>
                <input
                  type="text"
                  name="book_title"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-on-surface">
                  Waktu Pelaksanaan {isRecurring ? '(Opsional jika rutin)' : <span className="text-error">*</span>}
                </span>
                <input
                  type="datetime-local"
                  name="start_datetime"
                  value={startDatetime}
                  onChange={(e) => setStartDatetime(e.target.value)}
                  required={!isRecurring}
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                />
              </label>
            </div>

            {/* Mode Kajian */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-on-surface">Mode Kajian</span>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'offline', label: 'Offline', icon: 'mosque' },
                  { value: 'online', label: 'Online', icon: 'videocam' },
                  { value: 'hybrid', label: 'Hybrid', icon: 'connected_tv' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMode(opt.value)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                      mode === opt.value
                        ? 'border-primary bg-primary-container/20 text-primary'
                        : 'border-surface-container-high bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Streaming URL */}
            {needsStream && (
              <label className="flex flex-col gap-1.5 animate-in fade-in duration-200">
                <span className="text-xs font-semibold text-on-surface">
                  Link Live Streaming <span className="text-error">*</span>
                </span>
                <input
                  type="url"
                  name="stream_url"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  required
                  placeholder="https://youtube.com/... atau https://zoom.us/..."
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                />
              </label>
            )}

            {/* Venue & Map Pin */}
            {needsVenue && (
              <div className="flex flex-col gap-3 p-4 border border-surface-container-high rounded-2xl bg-surface-container-low/40">
                <VenueLocationPicker
                  venueName={venueName}
                  onVenueNameChange={setVenueName}
                  markerPos={markerPos}
                  onMarkerPosChange={setMarkerPos}
                  required
                />
              </div>
            )}

            {/* Poster URL */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-on-surface">URL Poster (Opsional)</span>
              <input
                type="url"
                name="poster_url"
                value={posterUrl}
                onChange={(e) => setPosterUrl(e.target.value)}
                className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
              />
            </label>

            {/* Audience */}
            <div className="flex gap-4">
              {(['umum', 'ikhwan', 'akhwat'] as const).map((aud) => (
                <label key={aud} className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="audience_radio"
                    value={aud}
                    checked={audience === aud}
                    onChange={() => setAudience(aud)}
                    className="accent-primary"
                  />
                  <span className="capitalize text-on-surface">{aud}</span>
                </label>
              ))}
            </div>

            {/* Toggle Data Testing Khusus Admin */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <span className="material-symbols-outlined text-[16px]">science</span>
                  <span>Data Kajian Pengujian (Khusus Admin)</span>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                  Jika diaktifkan, kajian ini <strong>HANYA akan terlihat oleh akun Administrator</strong> di peta dan daftar kajian untuk keperluan pengujian. Jamaah umum tidak akan melihatnya.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  name="is_test_toggle"
                  checked={isTest}
                  onChange={(e) => setIsTest(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {/* Recurring Rule Selector */}
            <RecurringRuleSelector
              isRecurring={isRecurring}
              setIsRecurring={setIsRecurring}
              rule={recurringRule}
              setRule={setRecurringRule}
            />
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-surface-container-high bg-surface-container-low/50 flex items-center justify-end gap-2.5 shrink-0">
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
            form="edit-session-form"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">save</span>
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
