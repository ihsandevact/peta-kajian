import React, { useState, useEffect } from 'react';
import { type StudySession, hasPhysicalLocation } from '@/lib/services/kajian';
import { getEffectiveSessionInfo } from '@/utils/recurring';

interface VenueCardProps {
  session: StudySession;
  onClose?: () => void;
}

export default function VenueCard({ session, onClose }: VenueCardProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [session.id, session.poster_url]);

  const now = new Date();
  const info = getEffectiveSessionInfo(session, now);
  const dateObj = info.effectiveDate;
  const hasDate = !!dateObj;

  // Format Tanggal
  const dateStr = dateObj
    ? dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
    : session.recurring_pattern || 'Waktu Rutin Belum Ditentukan';

  // Format Waktu
  const timeStr = dateObj
    ? dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '';

  const hasPoster = Boolean(
    session.poster_url &&
    session.poster_url.trim() !== '' &&
    session.poster_url.toLowerCase() !== 'null' &&
    !imgError
  );

  const hasRoute = hasPhysicalLocation(session);
  const hasLive = Boolean(
    session.stream_url &&
    session.stream_url.trim() !== '' &&
    session.stream_url.toLowerCase() !== 'null'
  );
  const hasCalendar = hasDate;

  // --- GOOGLE CALENDAR GENERATOR ---
  const gCalUrl = new URL('https://calendar.google.com/calendar/render');
  if (hasDate && dateObj) {
    const endDateObj = new Date(dateObj.getTime() + 2 * 60 * 60 * 1000);
    const formatGoogleDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    gCalUrl.searchParams.append('action', 'TEMPLATE');
    gCalUrl.searchParams.append('text', session.title);
    gCalUrl.searchParams.append('dates', `${formatGoogleDate(dateObj)}/${formatGoogleDate(endDateObj)}`);
    gCalUrl.searchParams.append(
      'details',
      `Pemateri: ${session.speaker_name}\nKitab: ${session.book_title && session.book_title !== 'null' ? session.book_title : '-'}\n\nDitemukan via Peta Kajian Seluruh Indonesia.`
    );
    gCalUrl.searchParams.append('location', `${session.venues?.name || ''}, ${session.venues?.address || ''}`);
  }

  return (
    <div className="relative font-geist pointer-events-auto filter drop-shadow-xl">
      <div className="w-[290px] sm:w-[310px] max-h-[min(520px,calc(100vh-90px))] overflow-y-auto bg-surface-container-lowest rounded-2xl border border-surface-container-high/80 transition-all transform origin-bottom flex flex-col relative overflow-x-hidden">
        {/* Gambar Poster Header */}
        {hasPoster && (
          <div className="w-full h-[135px] sm:h-[145px] bg-surface-container shrink-0 relative overflow-hidden">
            <img
              src={session.poster_url}
              alt={`Poster ${session.title}`}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
            {/* Vignette Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

            {/* Tombol Close Absolute (Jika ada gambar) */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/75 z-10 transition-all shadow-md active:scale-95 cursor-pointer"
                title="Tutup"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        )}

        <div className="p-3 sm:p-3.5">
          {/* Header Badges & Inline Close Button */}
          <div className="flex items-center justify-between pb-2 border-b border-surface-container-high/60 mb-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              Kajian Aktif
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container px-2 py-0.5 rounded-full border border-surface-container-high">
                {session.audience_type}
              </span>
              {/* Tombol Close Inline (Jika TIDAK ADA gambar) */}
              {!hasPoster && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
          </div>

          {/* Konten Utama */}
          <h3 className="text-[14px] sm:text-[15px] font-bold text-on-surface line-clamp-2 leading-snug" title={session.title}>
            {session.title}
          </h3>
          <p className="text-xs font-semibold text-primary mt-0.5 truncate">
            {session.speaker_name}
          </p>

          {/* Baris Kitab (Jika Ada) */}
          {session.book_title && session.book_title.trim() !== '' && session.book_title.toLowerCase() !== 'null' && (
            <div className="flex items-center gap-1.5 text-xs text-outline mt-1 font-medium truncate">
              <span className="material-symbols-outlined text-[15px] shrink-0">menu_book</span>
              <span className="truncate">{session.book_title}</span>
            </div>
          )}

          {/* Informasi Detail Box */}
          <div className="mt-2.5 flex flex-col gap-1.5 p-2 sm:p-2.5 rounded-xl bg-surface-container-low/60 border border-surface-container-high/50 text-xs">
            {/* Baris Waktu */}
            <div className="flex items-start gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[15px] text-outline mt-0.5 shrink-0">
                {hasDate ? 'calendar_month' : 'event_repeat'}
              </span>
              <span className="leading-tight font-medium text-on-surface">
                {hasDate ? `${dateStr} • ${timeStr} WIB` : dateStr}
              </span>
            </div>

            {/* Baris Lokasi */}
            {session.venues && (
              <div className="flex items-start gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[15px] text-outline mt-0.5 shrink-0">location_on</span>
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-on-surface">{session.venues.name}</span>
                  {session.venues.address && (
                    <span className="text-[11px] text-outline line-clamp-1 mt-0.5">{session.venues.address}</span>
                  )}
                </div>
              </div>
            )}

            {/* Baris Live Streaming (Online / Hybrid) */}
            {session.is_online && (
              <div className="flex items-center gap-2 text-red-600 font-semibold text-[11px]">
                <span className="material-symbols-outlined text-[15px] shrink-0">videocam</span>
                <span>Disiarkan secara live</span>
              </div>
            )}
          </div>

          {/* Aksi Bawah */}
          <div className="mt-2.5 pt-2.5 border-t border-surface-container-high/60 flex flex-col gap-2">
          {/* Skenario 1: Hybrid (Ada Rute Maps DAN Ada Tonton Live) */}
          {hasRoute && hasLive ? (
            <>
              <div className="grid grid-cols-2 gap-2 w-full">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${session.venues?.lat},${session.venues?.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary bg-surface-container hover:bg-surface-container-high border border-surface-container-high py-2 px-2 rounded-xl transition-all active:scale-95 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[15px]">directions_car</span>
                  <span>Rute Maps</span>
                </a>

                <a
                  href={session.stream_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 py-2 px-2 rounded-xl transition-all active:scale-95 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px] text-red-600">play_circle</span>
                  <span>Tonton Live</span>
                </a>
              </div>

              {hasCalendar && (
                <a
                  href={gCalUrl.toString()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-on-primary bg-primary/10 hover:bg-primary border border-primary/20 py-2 px-3 rounded-xl transition-all active:scale-95 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px]">event_available</span>
                  <span>Simpan ke Kalender</span>
                </a>
              )}
            </>
          ) : hasRoute && hasCalendar ? (
            /* Skenario 2: Offline di Masjid (Ada Rute + Kalender, Tanpa Stream) */
            <div className="grid grid-cols-2 gap-2 w-full">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${session.venues?.lat},${session.venues?.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary bg-surface-container hover:bg-surface-container-high border border-surface-container-high py-2 px-2 rounded-xl transition-all active:scale-95 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[15px]">directions_car</span>
                <span>Rute Maps</span>
              </a>

              <a
                href={gCalUrl.toString()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-on-primary bg-primary/10 hover:bg-primary border border-primary/20 py-2 px-2 rounded-xl transition-all active:scale-95 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px]">event_available</span>
                <span>Simpan Kalender</span>
              </a>
            </div>
          ) : hasLive && hasCalendar ? (
            /* Skenario 3: Murni Online Streaming (Ada Live + Kalender, Tanpa Masjid Fisik) */
            <div className="grid grid-cols-2 gap-2 w-full">
              <a
                href={session.stream_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 py-2 px-2 rounded-xl transition-all active:scale-95 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px] text-red-600">play_circle</span>
                <span>Tonton Live</span>
              </a>

              <a
                href={gCalUrl.toString()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-on-primary bg-primary/10 hover:bg-primary border border-primary/20 py-2 px-2 rounded-xl transition-all active:scale-95 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px]">event_available</span>
                <span>Simpan Kalender</span>
              </a>
            </div>
          ) : (
            /* Skenario 4: Sisa tombol tunggal jika yang lain tidak tersedia */
            <div className="flex flex-col gap-2 w-full">
              {hasRoute && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${session.venues?.lat},${session.venues?.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary bg-surface-container hover:bg-surface-container-high border border-surface-container-high py-2 px-3 rounded-xl transition-all active:scale-95 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[15px]">directions_car</span>
                  <span>Petunjuk Rute Maps</span>
                </a>
              )}
              {hasLive && (
                <a
                  href={session.stream_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 py-2 px-3 rounded-xl transition-all active:scale-95 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px] text-red-600">play_circle</span>
                  <span>Tonton Siaran Live</span>
                </a>
              )}
              {hasCalendar && (
                <a
                  href={gCalUrl.toString()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-on-primary bg-primary/10 hover:bg-primary border border-primary/20 py-2 px-3 rounded-xl transition-all active:scale-95 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px]">event_available</span>
                  <span>Simpan ke Google Calendar</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Segitiga Penunjuk (Pointer Tip) */}
      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-surface-container-lowest rotate-45 transform origin-center border-r border-b border-surface-container-high/80 shadow-xs pointer-events-none z-10"></div>
    </div>
  );
}
