import React, { useState } from 'react';
import type { StudySession } from '@/lib/services/kajian';

interface VenueCardProps {
  session: StudySession;
  onClose?: () => void;
}

export default function VenueCard({ session, onClose }: VenueCardProps) {
  const timeStr = new Date(session.start_datetime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const [imgError, setImgError] = useState(false);

  return (
    <div className="w-64 bg-surface-container-lowest rounded-xl p-3 shadow-lg pointer-events-auto transition-all transform origin-bottom">
      
      {/* Tombol Tutup (Kecil di pojok) */}
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-surface-container-lowest shadow-md flex items-center justify-center text-on-surface hover:bg-surface-container-low z-10"
        >
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>
      )}

      {session.poster_url && !imgError && (
        <div className="w-full h-[140px] rounded-lg overflow-hidden bg-surface-container mb-2 shrink-0">
          <img 
            src={session.poster_url} 
            alt={`Poster ${session.title}`} 
            className="w-full h-full object-cover" 
            onError={() => setImgError(true)}
          />
        </div>
      )}

      <div className="flex items-center justify-between pb-1">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
          Dipilih
        </span>
        <span className="text-[11px] font-medium text-outline capitalize bg-surface-container-low px-1.5 py-0.5 rounded">
          {session.audience_type}
        </span>
      </div>
      
      <h3 className="text-base font-semibold text-on-surface line-clamp-1 mt-1" title={session.title}>
        {session.title}
      </h3>
      <p className="text-[12px] font-medium text-on-surface-variant mt-0.5 truncate">
        {session.speaker_name}
      </p>
      
      <div className="flex items-center gap-1 text-outline text-[11px] font-medium mt-1">
        <span className="material-symbols-outlined text-[13px]">schedule</span>
        <span className="truncate">{session.venues?.name} • {timeStr} WIB</span>
      </div>
      
      <div className="mt-2.5 pt-2 flex items-center gap-1.5 border-t border-surface-container-high/50">
        <a 
          href={`https://maps.google.com/?q=${session.venues?.lat},${session.venues?.lng}`} 
          target="_blank" 
          rel="noreferrer" 
          className="flex-1 bg-on-surface hover:bg-on-surface-variant text-on-primary rounded-md py-1.5 px-2.5 text-center text-[12px] font-medium transition-colors"
        >
          Buka Petunjuk Arah
        </a>
        <button className="w-7 h-7 flex items-center justify-center rounded-md bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors" title="Simpan Kajian">
          <span className="material-symbols-outlined text-[16px]">bookmark</span>
        </button>
      </div>

      {/* Arrow Pointer */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] w-3 h-3 bg-surface-container-lowest rotate-45 border-r border-b border-black/5 shadow-[2px_2px_2px_rgba(0,0,0,0.05)]"></div>
    </div>
  );
}
