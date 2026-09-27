import React, { useState, useEffect } from 'react';
import type { StudySession } from '@/lib/services/kajian';

interface VenueCardProps {
  session: StudySession;
  onClose?: () => void;
}

export default function VenueCard({ session, onClose }: VenueCardProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [session.id, session.poster_url]);
  
  const hasDate = !!session.start_datetime;
  const dateObj = hasDate ? new Date(session.start_datetime!) : null;
  
  // Format Tanggal
  const dateStr = dateObj 
    ? dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
    : (session.recurring_pattern || 'Waktu Rutin Belum Ditentukan');
  
  // Format Waktu
  const timeStr = dateObj 
    ? dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '';

  const hasPoster = session.poster_url && !imgError;

  // --- GOOGLE CALENDAR GENERATOR ---
  const gCalUrl = new URL('https://calendar.google.com/calendar/render');
  if (hasDate) {
    const endDateObj = new Date(dateObj!.getTime() + 2 * 60 * 60 * 1000);
    const formatGoogleDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    gCalUrl.searchParams.append('action', 'TEMPLATE');
    gCalUrl.searchParams.append('text', session.title);
    gCalUrl.searchParams.append('dates', `${formatGoogleDate(dateObj!)}/${formatGoogleDate(endDateObj)}`);
    gCalUrl.searchParams.append('details', `Pemateri: ${session.speaker_name}\nKitab: ${session.book_title && session.book_title !== 'null' ? session.book_title : '-'}\n\nDitemukan via Peta Kajian Seluruh Indonesia.`);
    gCalUrl.searchParams.append('location', `${session.venues?.name || ''}, ${session.venues?.address || ''}`);
  }

  return (
    <div className="w-[280px] bg-surface-container-lowest rounded-xl shadow-lg pointer-events-auto transition-all transform origin-bottom flex flex-col relative overflow-hidden">
      
      {/* Gambar Poster Header */}
      {hasPoster && (
        <div className="w-full h-[140px] bg-surface-container shrink-0 relative">
          <img 
            src={session.poster_url} 
            alt={`Poster ${session.title}`} 
            className="w-full h-full object-cover" 
            onError={() => setImgError(true)}
          />
          {/* Tombol Close Absolute (Jika ada gambar) */}
          {onClose && (
            <button 
              onClick={onClose}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 z-10 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      )}

      <div className="p-3.5">
        
        {/* Header Badges & Inline Close Button */}
        <div className="flex items-center justify-between pb-2 border-b border-surface-container-low/50 mb-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
            Kajian Aktif
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider bg-surface-container-low px-1.5 py-0.5 rounded">
              {session.audience_type}
            </span>
            {/* Tombol Close Inline (Jika TIDAK ADA gambar) */}
            {!hasPoster && onClose && (
              <button 
                onClick={onClose}
                className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-highest transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Konten Utama */}
        <h3 className="text-[15px] font-semibold text-on-surface line-clamp-2 leading-snug" title={session.title}>
          {session.title}
        </h3>
        <p className="text-[13px] font-medium text-primary mt-0.5 truncate">
          {session.speaker_name}
        </p>
        
        {/* Informasi Detail */}
        <div className="mt-3 flex flex-col gap-2">
          
          {/* Baris Waktu */}
          <div className="flex items-start gap-1.5 text-[12px] text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-outline mt-0.5 shrink-0">
              {hasDate ? 'calendar_month' : 'event_repeat'}
            </span>
            <span className="leading-tight font-medium">
              {hasDate ? `${dateStr} • ${timeStr} WIB` : dateStr}
            </span>
          </div>

          {/* Baris Kitab (Jika Ada) */}
          {session.book_title && session.book_title !== 'null' && (
            <div className="flex items-start gap-1.5 text-[12px] text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] text-outline mt-0.5 shrink-0">menu_book</span>
              <span className="leading-tight line-clamp-2">{session.book_title}</span>
            </div>
          )}

          {/* Baris Lokasi */}
          <div className="flex items-start gap-1.5 text-[12px] text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-outline mt-0.5 shrink-0">location_on</span>
            <div className="flex flex-col">
              <span className="font-medium text-on-surface">{session.venues?.name}</span>
              {session.venues?.address && (
                <span className="text-[11px] opacity-80 line-clamp-2 mt-0.5">{session.venues?.address}</span>
              )}
            </div>
          </div>

        </div>
        
        {/* Aksi Bawah */}
        <div className="mt-4 pt-3 flex items-center justify-between border-t border-surface-container-high/50">
          
          {/* Tombol Rute Maps */}
          <a 
            href={`https://www.google.com/maps/dir/?api=1&destination=${session.venues?.lat},${session.venues?.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant hover:text-primary transition-colors bg-surface-container-low px-2 py-1.5 rounded-lg"
          >
            <span className="material-symbols-outlined text-[14px]">directions_car</span>
            Rute Maps
          </a>

          {/* Tombol Simpan Kalender */}
          {hasDate && (
            <a 
              href={gCalUrl.toString()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-on-primary hover:bg-primary transition-colors border border-primary/30 px-2 py-1.5 rounded-lg"
            >
              <span className="material-symbols-outlined text-[14px]">event_available</span>
              Simpan Kalender
            </a>
          )}
          
        </div>
      </div>

      {/* Segitiga Penunjuk (Pointer Tip) */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-surface-container-lowest rotate-45 transform origin-center shadow-lg -z-10 pointer-events-none"></div>
    </div>
  );
}
