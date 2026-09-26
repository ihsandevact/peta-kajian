'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import SidebarFilter from '@/components/SidebarFilter';
import { fetchActiveSessions, type StudySession } from '@/lib/services/kajian';

const MapComponent = dynamic(() => import('@/components/Map'), {
  ssr: false,
});

export type FilterState = {
  time: string;
  audience: string[];
  radius: number;
  searchQuery: string;
  facilities: string[];
};

export default function Home() {
  const [filters, setFilters] = useState<FilterState>({
    time: 'semua',
    audience: ['umum', 'ikhwan', 'akhwat'],
    radius: 20,
    searchQuery: '',
    facilities: [],
  });

  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [selectedSession, setSelectedSession] = useState<StudySession | null>(null);
  const [isSheetExpanded, setIsSheetExpanded] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      const data = await fetchActiveSessions();
      setSessions(data);
    }
    loadData();
  }, []);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (!s.venues?.lat || !s.venues?.lng) return false;
      
      // Search Query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchTitle = s.title.toLowerCase().includes(query);
        const matchSpeaker = s.speaker_name.toLowerCase().includes(query);
        const matchVenue = s.venues?.name.toLowerCase().includes(query);
        if (!matchTitle && !matchSpeaker && !matchVenue) return false;
      }

      // Kategori
      if (!filters.audience.includes(s.audience_type)) return false;

      // Fasilitas
      if (filters.facilities.length > 0 && s.venues?.facilities) {
        const hasAllFacilities = filters.facilities.every(
          (fac) => s.venues!.facilities[fac as keyof typeof s.venues.facilities] === true
        );
        if (!hasAllFacilities) return false;
      }

      // Waktu
      const sessionDate = new Date(s.start_datetime);
      const today = new Date();
      const isToday = sessionDate.toDateString() === today.toDateString();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = sessionDate.toDateString() === tomorrow.toDateString();

      if (filters.time === 'hari-ini' && !isToday) return false;
      if (filters.time === 'besok' && !isTomorrow) return false;
      
      return true;
    });
  }, [sessions, filters]);

  return (
    <div className="w-full h-screen bg-surface font-geist text-on-surface flex overflow-hidden">
      
      {/* GLOBAL SIDEBAR (Kiri Jauh) */}
      <aside className="hidden lg:flex w-64 bg-surface-container-lowest z-50 flex-col justify-between py-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)] shrink-0">
        <div className="flex flex-col gap-6 px-3">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[18px]">mosque</span>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-base text-on-surface leading-tight">Peta Kajian</span>
              <span className="text-[11px] font-medium text-outline">Sunnah Explorer</span>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            <a href="#" className="flex items-center gap-2 px-3 py-2 transition-colors bg-primary-container text-on-primary text-xs font-medium rounded-lg">
              <span className="material-symbols-outlined text-[20px]">map</span>
              Jelajah Peta
            </a>
            <a href="#" className="flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors text-xs font-medium">
              <span className="material-symbols-outlined text-[20px]">calendar_today</span>
              Jadwal Rutin
            </a>
            <a href="#" className="flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors text-xs font-medium">
              <span className="material-symbols-outlined text-[20px]">school</span>
              Daftar Asatidz
            </a>
            <a href="#" className="flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors text-xs font-medium">
              <span className="material-symbols-outlined text-[20px]">location_city</span>
              Masjid Rekanan
            </a>
          </nav>
        </div>
        <div className="px-3 flex flex-col gap-2">
          <a href="#" className="flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors text-xs font-medium">
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            Kirim Info Kajian
          </a>
        </div>
      </aside>

      {/* AREA KANAN */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOP HEADER DESKTOP & MOBILE */}
        <header className="h-16 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-outline flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">public</span>
              Seluruh Indonesia
            </span>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:opacity-90">
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT SPLIT */}
        <main className="flex-1 flex w-full h-full relative overflow-hidden bg-surface md:pb-0 pb-[64px] /* pb-16 untuk Bottom Nav di Mobile */">
          
          {/* Kolom Kanan: Map */}
          <div className="absolute inset-0 w-full h-full md:relative md:flex-1 bg-[#f1f5f9] overflow-hidden z-10">
            <MapComponent 
              sessions={filteredSessions} 
              selectedSession={selectedSession}
              onSelectSession={setSelectedSession}
            />
          </div>
          
          {/* Kolom Kiri: Search & List (Menjadi Bottom Sheet di Mobile) */}
          <div className={`
            absolute bottom-[64px] left-0 w-full z-20 rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]
            ${isSheetExpanded ? 'h-[65vh]' : 'h-[160px]'}
            md:relative md:w-[410px] lg:w-[430px] md:h-full md:rounded-none md:shadow-[1px_0_0_0_rgba(226,232,240,0.8)] md:bottom-auto
            shrink-0 flex flex-col bg-surface-container-lowest overflow-hidden transition-all duration-300 ease-in-out
            md:order-first
          `}>
            {/* Drag Handle Indicator (Hanya tampil di Mobile) */}
            <div 
              className="md:hidden w-full flex justify-center pt-3 pb-2 shrink-0 cursor-pointer hover:bg-surface-container-low transition-colors"
              onClick={() => setIsSheetExpanded(!isSheetExpanded)}
            >
              <div className="w-12 h-1.5 rounded-full bg-outline/60"></div>
            </div>

            <div className="flex-1 overflow-hidden">
              <SidebarFilter 
                filters={filters} 
                setFilters={setFilters} 
                sessions={filteredSessions} 
                selectedSession={selectedSession}
                onSelectSession={(session) => {
                  setSelectedSession(session);
                  if (session) setIsSheetExpanded(false); // Otomatis collapse saat kajian dipilih agar map terlihat
                }}
              />
            </div>
          </div>
          
        </main>

        {/* MOBILE BOTTOM NAVIGATION (Hanya di HP) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface-container-lowest shadow-[0_-2px_12px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom,0px)] border-t border-surface-container-high/50">
          <div className="flex items-center justify-around h-16 px-1">
            <a href="#" className="flex flex-col items-center justify-center min-w-[56px] h-12 text-primary-container font-bold">
              <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>map</span>
              <span className="text-[10px] mt-0.5 tracking-tight">Peta</span>
            </a>
            <a href="#" className="flex flex-col items-center justify-center min-w-[56px] h-12 text-outline hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[22px]">calendar_today</span>
              <span className="text-[10px] mt-0.5 font-medium tracking-tight">Jadwal</span>
            </a>
            <a href="#" className="flex flex-col items-center justify-center min-w-[56px] h-12 text-outline hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[22px]">school</span>
              <span className="text-[10px] mt-0.5 font-medium">Asatidz</span>
            </a>
            <a href="#" className="flex flex-col items-center justify-center min-w-[56px] h-12 text-outline hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[22px]">bookmark</span>
              <span className="text-[10px] mt-0.5 font-medium">Favorit</span>
            </a>
            <a href="#" className="flex flex-col items-center justify-center min-w-[56px] h-12 text-outline hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[22px]">account_circle</span>
              <span className="text-[10px] mt-0.5 font-medium">Profil</span>
            </a>
          </div>
        </nav>
      </div>
    </div>
  );
}
