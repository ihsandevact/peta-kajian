import React, { useRef, useEffect } from 'react';
import type { FilterState } from '@/app/page';
import type { StudySession } from '@/lib/services/kajian';

interface SidebarFilterProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  sessions: StudySession[];
  selectedSession: StudySession | null;
  onSelectSession: (s: StudySession | null) => void;
}

export default function SidebarFilter({ filters, setFilters, sessions, selectedSession, onSelectSession }: SidebarFilterProps) {
  const listRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll ke elemen terpilih
  useEffect(() => {
    if (selectedSession && listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-id="${selectedSession.id}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedSession]);

  const Pill = ({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors shadow-sm
        ${active 
          ? 'bg-on-surface text-on-primary' 
          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
    >
      {label}
    </button>
  );

  const toggleAudience = (val: string) => {
    setFilters(p => {
      let newAudience = [...p.audience];
      if (val === 'semua') {
        newAudience = ['umum', 'ikhwan', 'akhwat'];
      } else {
        if (newAudience.includes(val)) {
          newAudience = newAudience.filter(a => a !== val);
        } else {
          newAudience.push(val);
        }
      }
      return { ...p, audience: newAudience };
    });
  };

  const getIslamicTimeLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const h = date.getHours();
    if (h >= 4 && h < 6) return "Ba'da Subuh";
    if (h >= 8 && h < 11) return "Dhuha";
    if (h >= 11 && h < 14) return "Ba'da Dzuhur";
    if (h >= 15 && h < 17) return "Ba'da Ashar";
    if (h >= 17 && h < 19) return "Ba'da Maghrib";
    if (h >= 19) return "Ba'da Isya";
    return "";
  };

  return (
    <div className="h-full flex flex-col">
      {/* 1. Sticky Search & Filter Header */}
      <div className="flex p-4 pb-2 bg-surface-container-lowest/95 backdrop-blur-md flex-col gap-3 border-b border-surface-container-high shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="font-semibold text-base text-on-surface tracking-tight">Peta Kajian</h1>
            <span className="w-2 h-2 rounded-full bg-primary-container inline-block ml-1.5 align-middle"></span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-outline px-2 py-0.5 rounded bg-surface-container-low">
            Indonesia
          </span>
        </div>
        
        {/* Search Input */}
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">search</span>
          <input 
            type="text" 
            placeholder="Cari ustadz, kitab, atau masjid..." 
            value={filters.searchQuery}
            onChange={e => setFilters(p => ({ ...p, searchQuery: e.target.value }))}
            className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-sm rounded-lg pl-9 pr-3 py-2 focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary-container transition-all"
          />
        </div>

        {/* Scrollable Filters Area */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 pt-0.5 select-none no-scrollbar items-center">
          <Pill active={filters.time === 'semua'} label="Semua" onClick={() => setFilters(p => ({ ...p, time: 'semua' }))} />
          <Pill active={filters.time === 'terbaru'} label="Terbaru" onClick={() => setFilters(p => ({ ...p, time: 'terbaru' }))} />
          <Pill active={filters.time === 'selesai'} label="Selesai" onClick={() => setFilters(p => ({ ...p, time: 'selesai' }))} />
          <Pill active={filters.time === 'rutin'} label="Rutin" onClick={() => setFilters(p => ({ ...p, time: 'rutin' }))} />
          <Pill active={!filters.audience.includes('ikhwan')} label="Khusus Akhwat" onClick={() => setFilters(p => ({ ...p, audience: p.audience.includes('ikhwan') ? ['akhwat'] : ['umum', 'ikhwan', 'akhwat'] }))} />
        </div>
      </div>

      {/* 2. Result Count Subtext Bar */}
      <div className="flex px-4 py-1.5 bg-surface-container-low/70 items-center justify-between text-outline text-[11px] font-medium shrink-0">
        <span>Menampilkan {sessions.length} kajian terdekat</span>
      </div>

      {/* 3. Scrollable List of Kajian Items */}
      <div className="flex-1 overflow-y-auto" ref={listRef}>
        {sessions.map((session, index) => {
          const hasDate = !!session.start_datetime;
          const dateObj = hasDate ? new Date(session.start_datetime!) : null;
          const dateStr = dateObj ? dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
          const timeStr = dateObj ? dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
          
          const now = new Date();
          const isPast = hasDate && dateObj! < now;
          const isRutin = session.is_recurring;
          
          const isAkhwatOnly = session.audience_type === 'akhwat';
          const distanceFake = (2.1 + (index * 1.3)).toFixed(1); // Fake distance
          const isSelected = selectedSession?.id === session.id;

          return (
            <div 
              key={session.id} 
              data-id={session.id}
              onClick={() => onSelectSession(session)}
              className={`cursor-pointer p-4 transition-colors relative border-b border-surface-container-high/50 group
                ${isSelected ? 'bg-primary-container/10 shadow-[inset_3px_0_0_0_#15803d]' : 'hover:bg-surface-container-low'}
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[12px] font-bold ${isAkhwatOnly ? 'text-tertiary' : 'text-primary'}`}>
                    {hasDate ? `${dateStr} • ${timeStr} WIB` : (session.recurring_pattern || 'Kajian Rutin')}
                  </span>
                  
                  {isRutin ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e0f2fe] text-[#0369a1] uppercase tracking-wide border border-[#bae6fd]">Rutin</span>
                  ) : isPast ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant uppercase tracking-wide">Selesai</span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#dcfce7] text-[#166534] uppercase tracking-wide border border-[#bbf7d0]">Akan Datang</span>
                  )}

                  <span className="text-[11px] text-on-surface-variant capitalize px-1 bg-surface-container-low rounded">{session.audience_type}</span>
                </div>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant shrink-0 mt-0.5">{distanceFake} km</span>
              </div>
              <div className="mt-1">
                <h2 className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">{session.title}</h2>
                <p className="text-[13px] text-on-surface-variant mt-0.5">{session.speaker_name}</p>
              </div>
              <div className="mt-1 flex items-center gap-1 text-outline text-[13px]">
                <span className="material-symbols-outlined text-[15px]">location_on</span>
                <span className="truncate">{session.venues?.name}</span>
              </div>
              <div className="mt-2 pt-1.5 flex items-center justify-between">
                <a href={`https://maps.google.com/?q=${session.venues?.lat},${session.venues?.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-on-surface-variant hover:text-primary transition-colors">
                  <span>Rute Google Maps</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </a>
                {session.book_title && session.book_title !== 'null' && (
                  <span className="text-[11px] text-outline truncate max-w-[120px]" title={session.book_title}>
                    {session.book_title}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="p-8 text-center text-outline text-sm">
            Tidak ada kajian yang sesuai pencarian.
          </div>
        )}
      </div>
    </div>
  );
}
