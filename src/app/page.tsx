'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import SidebarFilter from '@/components/SidebarFilter';
import { fetchActiveSessions, hasPhysicalLocation, type StudySession } from '@/lib/services/kajian';
import { calculateDistance } from '@/utils/distance';
import { createClient } from '@/utils/supabase/client';

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Periksa status login pengguna
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUser(data.user);
      } else {
        supabase.auth.getSession().then(({ data: sess }) => {
          if (sess?.session?.user) {
            setCurrentUser(sess.session.user);
          }
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Minta lokasi pengguna saat aplikasi dimuat
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        (error) => {
          console.error('Error getting location', error);
          // Silent fail agar tidak mengganggu pengguna yang menolak akses GPS
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const data = await fetchActiveSessions();
      setSessions(data);
      setIsLoading(false);
    }
    loadData();
  }, []);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      // Kajian tanpa lokasi fisik hanya valid jika online
      if (!hasPhysicalLocation(s) && !s.is_online) return false;
      
      // Search Query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchTitle = s.title.toLowerCase().includes(query);
        const matchSpeaker = s.speaker_name.toLowerCase().includes(query);
        const matchVenue = s.venues?.name?.toLowerCase().includes(query);
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

      // Status Filter: Terbaru, Selesai, Rutin, Online
      const hasDate = !!s.start_datetime;
      const sessionDate = hasDate ? new Date(s.start_datetime!) : null;
      const now = new Date();
      const isPast = hasDate && sessionDate! < now;
      const isRutin = s.is_recurring;
      
      if (filters.time === 'terbaru' && (isPast && !isRutin)) return false;
      if (filters.time === 'selesai' && (!isPast || isRutin)) return false;
      if (filters.time === 'rutin' && !isRutin) return false;
      if (filters.time === 'online' && !s.is_online) return false;
      
      return true;
    });
  }, [sessions, filters]);

  // SMART SORTING: Upcoming/Rutin di atas, Selesai di bawah
  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => {
      // Sorting Jarak (Terdekat) — kajian tanpa lokasi fisik ditaruh paling bawah
      if (filters.time === 'terdekat' && userLocation) {
        const aHasLoc = hasPhysicalLocation(a);
        const bHasLoc = hasPhysicalLocation(b);
        if (aHasLoc && !bHasLoc) return -1;
        if (!aHasLoc && bHasLoc) return 1;
        if (!aHasLoc && !bHasLoc) return 0;
        const distA = calculateDistance(userLocation.lat, userLocation.lng, a.venues!.lat, a.venues!.lng);
        const distB = calculateDistance(userLocation.lat, userLocation.lng, b.venues!.lat, b.venues!.lng);
        return distA - distB;
      }

      // Default Sorting (Waktu)
      const now = new Date();
      const hasDateA = !!a.start_datetime;
      const hasDateB = !!b.start_datetime;
      const dateA = hasDateA ? new Date(a.start_datetime!) : null;
      const dateB = hasDateB ? new Date(b.start_datetime!) : null;
      
      const aIsFuture = (hasDateA && dateA! >= now) || a.is_recurring;
      const bIsFuture = (hasDateB && dateB! >= now) || b.is_recurring;

      if (aIsFuture && !bIsFuture) return -1;
      if (!aIsFuture && bIsFuture) return 1;

      if (aIsFuture && bIsFuture) {
        if (hasDateA && hasDateB) return dateA!.getTime() - dateB!.getTime();
        return 0;
      } else {
        if (hasDateA && hasDateB) return dateB!.getTime() - dateA!.getTime();
        return 0;
      }
    });
  }, [filteredSessions, filters.time, userLocation]);

  // OBSERVER: Auto-Focus dinamis setiap kali daftar filter/sorting berubah
  useEffect(() => {
    if (sortedSessions.length > 0) {
      setSelectedSession(sortedSessions[0]);
    } else {
      setSelectedSession(null);
    }
  }, [sortedSessions]);

  return (
    <div className="w-full h-screen bg-surface font-geist text-on-surface flex overflow-hidden">
      
      {/* GLOBAL SIDEBAR (Kiri Jauh) */}
      <aside className={`hidden lg:flex transition-all duration-300 bg-surface-container-lowest z-50 flex-col justify-between py-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)] shrink-0 relative ${isSidebarCollapsed ? 'w-[72px]' : 'w-64'}`}>
        
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`absolute -right-3 top-8 w-6 h-6 bg-surface-container-high rounded-full flex items-center justify-center text-on-surface hover:bg-primary-container hover:text-on-primary transition-colors shadow-sm z-50`}
        >
          <span className="material-symbols-outlined text-[14px]">
            {isSidebarCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>

        <div className={`flex flex-col gap-6 ${isSidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {/* Logo Area */}
          <div className={`flex items-center gap-2 ${isSidebarCollapsed ? 'justify-center' : 'px-2'}`}>
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-primary text-[18px]">mosque</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col overflow-hidden whitespace-nowrap">
                <span className="font-semibold text-base text-on-surface leading-tight">Peta Kajian</span>
                <span className="text-[11px] font-medium text-outline">Seluruh Indonesia</span>
              </div>
            )}
          </div>
          
          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            <a href="#" className={`group relative flex items-center transition-colors rounded-lg text-xs font-medium ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2 gap-2'} bg-primary-container text-on-primary`}>
              <span className="material-symbols-outlined text-[20px]">map</span>
              {!isSidebarCollapsed && <span>Jelajah Peta</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-on-surface text-surface text-[11px] rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                  Jelajah Peta
                </span>
              )}
            </a>
            
            <Link 
              href="/leaderboard"
              className={`group relative flex items-center transition-colors rounded-lg text-xs font-medium ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2 gap-2'} text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface w-full text-left`}
            >
              <span className="material-symbols-outlined text-[20px] text-amber-500">workspace_premium</span>
              {!isSidebarCollapsed && <span>Leaderboard Relawan</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-on-surface text-surface text-[11px] rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                  Leaderboard Relawan
                </span>
              )}
            </Link>
          </nav>
        </div>
        
        <div className={`flex flex-col gap-1.5 ${isSidebarCollapsed ? 'px-2' : 'px-3'}`}>
          <Link href="/kontributor/dashboard" className={`group relative flex items-center transition-colors rounded-lg text-xs font-medium ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2 gap-2'} text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface`}>
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            {!isSidebarCollapsed && <span>Kirim Info Kajian</span>}
            {isSidebarCollapsed && (
              <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-on-surface text-surface text-[11px] rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                Kirim Info Kajian
              </span>
            )}
          </Link>

          {currentUser ? (
            <Link
              href="/kontributor/profile"
              className={`group relative flex items-center transition-colors rounded-lg text-xs font-medium ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2 gap-2'} text-on-surface hover:bg-surface-container-high`}
            >
              {currentUser.user_metadata?.avatar_url ? (
                <img src={currentUser.user_metadata.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
              ) : (
                <span className="material-symbols-outlined text-[20px] text-primary">account_circle</span>
              )}
              {!isSidebarCollapsed && (
                <span className="truncate">
                  {currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Profil'}
                </span>
              )}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-on-surface text-surface text-[11px] rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                  Profil Relawan
                </span>
              )}
            </Link>
          ) : (
            <Link
              href="/kontributor/login"
              className={`group relative flex items-center transition-colors rounded-lg text-xs font-medium ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2 gap-2'} text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface`}
            >
              <span className="material-symbols-outlined text-[20px]">login</span>
              {!isSidebarCollapsed && <span>Masuk Relawan</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-on-surface text-surface text-[11px] rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                  Masuk Relawan
                </span>
              )}
            </Link>
          )}
        </div>
      </aside>

      {/* AREA KANAN */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* MAIN CONTENT SPLIT */}
        <main className="flex-1 flex w-full h-full relative overflow-hidden bg-surface md:pb-0 pb-[64px] /* pb-16 untuk Bottom Nav di Mobile */">
          
          {/* Kolom Kanan: Map */}
          <div className="absolute inset-0 w-full h-full md:relative md:flex-1 bg-[#f1f5f9] overflow-hidden z-10">
            <MapComponent 
              sessions={sortedSessions} 
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
                sessions={sortedSessions} 
                selectedSession={selectedSession}
                onSelectSession={(session) => {
                  setSelectedSession(session);
                  if (session) setIsSheetExpanded(false); // Otomatis collapse saat kajian dipilih agar map terlihat
                }}
                isLoading={isLoading}
                userLocation={userLocation}
              />
            </div>
          </div>
          
        </main>

        {/* MOBILE BOTTOM NAVIGATION (Hanya di HP) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface-container-lowest shadow-[0_-2px_12px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom,0px)] border-t border-surface-container-high/50">
          <div className="flex items-center justify-around h-16 px-2">
            <a href="#" className="flex flex-col items-center justify-center min-w-[56px] h-12 text-primary font-bold">
              <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>map</span>
              <span className="text-[10px] mt-0.5 tracking-tight">Peta</span>
            </a>
            <Link 
              href="/leaderboard"
              className="flex flex-col items-center justify-center min-w-[56px] h-12 text-outline hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[22px] text-amber-500">workspace_premium</span>
              <span className="text-[10px] mt-0.5 font-medium tracking-tight">Peringkat</span>
            </Link>
            <Link 
              href="/kontributor/dashboard" 
              className="flex flex-col items-center justify-center min-w-[56px] h-12 text-outline hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">add_circle</span>
              <span className="text-[10px] mt-0.5 font-medium tracking-tight">Kirim</span>
            </Link>
            {currentUser ? (
              <Link
                href="/kontributor/profile"
                className="flex flex-col items-center justify-center min-w-[56px] h-12 text-outline hover:text-on-surface transition-colors"
              >
                {currentUser.user_metadata?.avatar_url ? (
                  <img src={currentUser.user_metadata.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-[22px] text-primary">account_circle</span>
                )}
                <span className="text-[10px] mt-0.5 font-medium tracking-tight">Profil</span>
              </Link>
            ) : (
              <Link
                href="/kontributor/login"
                className="flex flex-col items-center justify-center min-w-[56px] h-12 text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">login</span>
                <span className="text-[10px] mt-0.5 font-medium tracking-tight">Masuk</span>
              </Link>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
