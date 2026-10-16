'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import type { YoutubeChannel } from '@/lib/services/youtubeTracker';
import type { StudySession } from '@/lib/services/kajian';
import ShareModal from '@/components/ShareModal';
import MobileNavDrawer from '@/components/MobileNavDrawer';
import { checkIsAdmin } from '@/lib/services/admin';
import { useLivePlayer } from '@/context/LivePlayerContext';

export default function LiveStreamingPage() {
  const { playStream } = useLivePlayer();
  const [channels, setChannels] = useState<YoutubeChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<{
    videoId: string;
    title: string;
    channelName: string;
    speakerName?: string;
  } | null>(null);

  const [shareSession, setShareSession] = useState<StudySession | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadData();
    initUser();
  }, []);

  async function initUser() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);
      const admin = await checkIsAdmin(user);
      setIsAdmin(admin);
    } else {
      setIsAdmin(false);
    }
  }

  async function loadData() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('is_active', true)
      .order('is_currently_live', { ascending: false })
      .order('channel_name', { ascending: true });

    if (!error && data) {
      setChannels(data as YoutubeChannel[]);
    }
    setLoading(false);
  }

  // Daftar channel yang sedang live saat ini (didukung proteksi deduplikasi)
  const liveChannels = useMemo(() => {
    const map = new Map<string, YoutubeChannel>();
    channels.forEach((c) => {
      if (c.is_currently_live && c.current_video_id) {
        // Kunci deduplikasi utama: videoId unik atau handle channel
        const normKey = (c.current_video_id || c.channel_handle).toLowerCase().trim();
        if (!map.has(normKey)) {
          map.set(normKey, c);
        }
      }
    });
    return Array.from(map.values());
  }, [channels]);

  // Filter pencarian khusus untuk siaran live yang sedang tayang
  const filteredLiveChannels = useMemo(() => {
    return liveChannels.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        c.channel_name.toLowerCase().includes(q) ||
        c.channel_handle.toLowerCase().includes(q) ||
        (c.default_speaker_name && c.default_speaker_name.toLowerCase().includes(q)) ||
        (c.current_video_title && c.current_video_title.toLowerCase().includes(q))
      );
    });
  }, [liveChannels, searchQuery]);

  // Filter pencarian untuk channel (khusus admin, deduplikasi handle)
  const filteredAllChannels = useMemo(() => {
    const map = new Map<string, YoutubeChannel>();
    channels.forEach((c) => {
      const normHandle = (c.channel_handle || '').toLowerCase().trim();
      if (!map.has(normHandle)) {
        map.set(normHandle, c);
      }
    });
    const uniqueChannels = Array.from(map.values());

    return uniqueChannels.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        c.channel_name.toLowerCase().includes(q) ||
        c.channel_handle.toLowerCase().includes(q) ||
        (c.default_speaker_name && c.default_speaker_name.toLowerCase().includes(q))
      );
    });
  }, [channels, searchQuery]);

  return (
    <div className="min-h-screen bg-surface font-geist text-on-surface flex flex-col">
      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-high/60 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Sisi Kiri: Tombol Back ke Peta & Logo */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-colors shrink-0"
              title="Kembali ke Peta Kajian"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span className="hidden sm:inline">Peta Kajian</span>
            </Link>

            <div className="h-5 w-px bg-surface-container-high hidden sm:block shrink-0" />

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-red-600/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-[19px]">smart_display</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-xs sm:text-base leading-tight truncate">Live Kajian</h1>
                  {/* Badge Live Ringkas di Layar Mobile */}
                  {liveChannels.length > 0 && (
                    <span className="sm:hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-bold shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {liveChannels.length} Live
                    </span>
                  )}
                </div>
                <p className="text-[10px] sm:text-[11px] text-outline truncate hidden xs:block">
                  Siaran Langsung Kajian Islam
                </p>
              </div>
            </div>
          </div>

          {/* Sisi Kanan: Status Counter & Menu Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Pill Badge Sedang Live (Desktop Only) */}
            {liveChannels.length > 0 ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold shadow-xs animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>{liveChannels.length} Sedang Live</span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-xs font-medium text-outline">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                <span>Belum Ada Siaran Aktif</span>
              </div>
            )}

            {/* Tombol Refresh */}
            <button
              onClick={loadData}
              disabled={loading}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-on-surface-variant hover:bg-surface-container flex items-center justify-center transition-colors shrink-0"
              title="Perbarui Data"
            >
              <span className={`material-symbols-outlined text-[18px] sm:text-[20px] ${loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>

            {/* Menu Drawer Mobile */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="md:hidden w-8 h-8 rounded-xl text-on-surface-variant hover:bg-surface-container flex items-center justify-center transition-colors shrink-0"
              title="Menu Navigasi"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION / BANNER */}
      <section className="bg-gradient-to-b from-surface-container-low to-surface py-5 sm:py-8 px-3.5 sm:px-6 border-b border-surface-container-high/40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[11px] sm:text-xs font-semibold mb-2 sm:mb-3 border border-red-200 dark:border-red-900/50">
              <span className="material-symbols-outlined text-[15px] sm:text-[16px] text-red-600">live_tv</span>
              <span>Pusat Siaran Live Kajian</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
              Kajian Islam Live Langsung dari Rumah
            </h2>
            <p className="text-xs sm:text-sm text-outline mt-1.5 sm:mt-2 leading-relaxed">
              Pantau dan simak siaran langsung kajian dari channel-channel dakwah dan asatidzah secara real-time tanpa perlu mencari manual satu per satu.
            </p>
          </div>

          {/* Quick Filter & Search Bar */}
          <div className="w-full md:w-80 flex flex-col gap-1.5 mt-1 sm:mt-0">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-outline">
                search
              </span>
              <input
                type="text"
                placeholder={isAdmin ? "Cari channel, ustadz, atau judul..." : "Cari siaran live atau ustadz..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 sm:py-2.5 rounded-xl bg-surface-container-lowest border border-surface-container-high text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-1"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                </button>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-outline px-1">
              {liveChannels.length > 0
                ? `${liveChannels.length} siaran langsung tersedia saat ini`
                : 'Tidak ada siaran live berlangsung'}
            </p>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 py-6 sm:py-8 flex-1 w-full">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-surface-container-high/60 bg-surface-container-lowest p-4 flex flex-col gap-3 animate-pulse"
              >
                <div className="w-full aspect-video rounded-xl bg-surface-container" />
                <div className="w-2/3 h-4 rounded bg-surface-container" />
                <div className="w-1/2 h-3 rounded bg-surface-container" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* BAGIAN 1: SEDANG LIVE SEKARANG (TERLIHAT OLEH SEMUA USER) */}
            {liveChannels.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
                    <h3 className="font-extrabold text-lg sm:text-xl text-on-surface tracking-tight">
                      Sedang Tayang Langsung ({filteredLiveChannels.length})
                    </h3>
                  </div>
                  <span className="text-xs text-outline hidden sm:inline">Diperbarui otomatis</span>
                </div>

                {filteredLiveChannels.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60">
                    <span className="material-symbols-outlined text-[32px] text-outline mb-2">search_off</span>
                    <p className="text-sm font-semibold text-on-surface">Tidak ada siaran live yang cocok</p>
                    <p className="text-xs text-outline mt-1">Coba kata kunci pencarian yang lain.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLiveChannels.map((channel) => {
                      const videoId = channel.current_video_id!;
                      const title = channel.current_video_title || `Live Streaming ${channel.channel_name}`;
                      const posterUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                      const streamUrl = `https://www.youtube.com/watch?v=${videoId}`;
                      const speaker = channel.default_speaker_name || 'Asatidzah';

                      return (
                        <div
                          key={channel.id}
                          className="group relative rounded-2xl bg-surface-container-lowest border-2 border-red-500/40 hover:border-red-500 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden"
                        >
                          {/* Video Thumbnail Area */}
                          <div
                            className="relative aspect-video w-full bg-black cursor-pointer overflow-hidden"
                            onClick={() =>
                              setSelectedVideo({
                                videoId,
                                title,
                                channelName: channel.channel_name,
                                speakerName: speaker,
                              })
                            }
                          >
                            <img
                              src={posterUrl}
                              alt={title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                              {/* Play Button Overlay */}
                              <div className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-[32px] ml-0.5">
                                  play_arrow
                                </span>
                              </div>
                            </div>

                            {/* Live Badge */}
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 text-white text-[11px] font-bold shadow-md tracking-wider">
                              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                              <span>LIVE</span>
                            </div>

                            {/* Kota / Jangkauan */}
                            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-medium">
                              {channel.default_city || 'Nasional'}
                            </div>
                          </div>

                          {/* Video Details */}
                          <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="material-symbols-outlined text-[16px] text-red-600">
                                  verified
                                </span>
                                <span className="text-xs font-bold text-on-surface-variant truncate">
                                  {channel.channel_name}
                                </span>
                              </div>
                              <h4
                                className="font-bold text-sm sm:text-base text-on-surface line-clamp-2 leading-snug cursor-pointer hover:text-red-600 transition-colors"
                                onClick={() =>
                                  setSelectedVideo({
                                    videoId,
                                    title,
                                    channelName: channel.channel_name,
                                    speakerName: speaker,
                                  })
                                }
                              >
                                {title}
                              </h4>
                              <p className="text-xs text-outline mt-1 truncate">
                                Pemateri: <span className="text-on-surface font-medium">{speaker}</span>
                              </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-between gap-2 pt-3 border-t border-surface-container-high/60">
                              <button
                                onClick={() =>
                                  setSelectedVideo({
                                    videoId,
                                    title,
                                    channelName: channel.channel_name,
                                    speakerName: speaker,
                                  })
                                }
                                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">play_circle</span>
                                <span>Tonton</span>
                              </button>

                              {/* Tombol Putar Mini Player (PiP) */}
                              <button
                                type="button"
                                onClick={() =>
                                  playStream({
                                    videoId,
                                    title,
                                    channelName: channel.channel_name,
                                    speakerName: speaker,
                                    handle: channel.channel_handle,
                                  })
                                }
                                className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high text-outline hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                title="Putar di Mini Player (PiP pojok bawah)"
                                aria-label="Putar di Mini Player"
                              >
                                <span className="material-symbols-outlined text-[19px]">picture_in_picture_alt</span>
                              </button>

                              {/* Share Button */}
                              <button
                                onClick={() =>
                                  setShareSession({
                                    id: channel.current_session_id || channel.id,
                                    venue_id: null,
                                    title,
                                    speaker_name: speaker,
                                    is_online: true,
                                    stream_url: streamUrl,
                                    poster_url: posterUrl,
                                    status: 'confirmed',
                                    audience_type: 'umum',
                                    is_recurring: false,
                                    start_datetime: new Date().toISOString(),
                                  })
                                }
                                className="p-2 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                                title="Bagikan Kajian"
                              >
                                <span className="material-symbols-outlined text-[18px]">share</span>
                              </button>

                              {/* External YouTube Link */}
                              <a
                                href={streamUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl text-outline hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                title="Buka di YouTube"
                              >
                                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* EMPTY STATE JIKA TIDAK ADA YANG LIVE */
              <div className="text-center py-16 px-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto text-outline mb-4">
                  <span className="material-symbols-outlined text-[32px]">live_tv</span>
                </div>
                <h3 className="font-bold text-lg text-on-surface">Belum Ada Kajian Live Saat Ini</h3>
                <p className="text-xs text-outline mt-1.5 leading-relaxed">
                  Saat ini belum ada siaran langsung kajian yang sedang berlangsung. Silakan periksa kembali saat waktu kajian tiba atau jelajahi jadwal kajian di Peta.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 mt-5 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">map</span>
                  <span>Jelajahi Peta Kajian</span>
                </Link>
              </div>
            )}

            {/* BAGIAN 2: DAFTAR SELURUH CHANNEL DAKWAH YANG DIPANTAU (KHUSUS ADMIN) */}
            {isAdmin && (
              <div className="mt-14 pt-8 border-t border-surface-container-high/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 text-[10px] font-bold border border-purple-200 dark:border-purple-800">
                        Akses Khusus Admin
                      </span>
                      <h3 className="font-extrabold text-lg sm:text-xl text-on-surface tracking-tight">
                        Channel Dakwah yang Dipantau ({filteredAllChannels.length})
                      </h3>
                    </div>
                    <p className="text-xs text-outline mt-1">
                      Bagian ini hanya dapat dilihat oleh administrator untuk memantau status bot tracker.
                    </p>
                  </div>

                  <Link
                    href="/admin/youtube"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors w-fit"
                  >
                    <span className="material-symbols-outlined text-[18px]">settings</span>
                    <span>Kelola YouTube Admin</span>
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAllChannels.map((channel) => {
                    const handleClean = channel.channel_handle.replace(/^@/, '');
                    const channelUrl = `https://www.youtube.com/@${handleClean}`;
                    const liveUrl = `https://www.youtube.com/@${handleClean}/live`;

                    return (
                      <div
                        key={channel.id}
                        className="rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 p-4 hover:border-purple-300 dark:hover:border-purple-800 transition-all flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-red-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                              {channel.channel_name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm text-on-surface truncate">
                                {channel.channel_name}
                              </h4>
                              <p className="text-[11px] text-outline truncate font-mono">
                                {channel.channel_handle}
                              </p>
                              <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                                {channel.default_speaker_name || 'Asatidzah'}
                              </p>
                            </div>
                          </div>

                          {channel.is_currently_live ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold shrink-0 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              LIVE
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-outline text-[10px] font-medium shrink-0">
                              Offline
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-surface-container-high/40 text-xs">
                          <span className="text-[11px] text-outline">
                            Kota: <strong className="text-on-surface">{channel.default_city || 'Nasional'}</strong>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={channelUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-[11px] font-semibold text-on-surface transition-colors flex items-center gap-1"
                            >
                              <span>Channel</span>
                              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                            </a>
                            <a
                              href={liveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-[11px] font-bold transition-colors flex items-center gap-1"
                            >
                              <span>Live</span>
                              <span className="material-symbols-outlined text-[13px]">videocam</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-surface-container-high/60 bg-surface-container-lowest py-6 text-center text-xs text-outline mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Peta Kajian — Pelacak Kajian & Siaran Langsung Kajian Islam</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-on-surface transition-colors">
              Peta Kajian
            </Link>
            <Link href="/faq" className="hover:text-on-surface transition-colors">
              Bantuan & FAQ
            </Link>
            {isAdmin && (
              <Link href="/admin/youtube" className="text-purple-600 font-semibold hover:underline">
                Kelola YouTube Admin
              </Link>
            )}
          </div>
        </div>
      </footer>

      {/* MODAL EMBED VIDEO PLAYER */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col border border-surface-container-high">
            
            {/* Modal Header */}
            <div className="px-4 py-3 bg-surface-container flex items-center justify-between gap-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping shrink-0" />
                <h3 className="font-bold text-sm sm:text-base text-on-surface truncate">
                  {selectedVideo.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedVideo(null)}
                className="w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-outline hover:text-on-surface transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Embed Video Iframe */}
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${selectedVideo.videoId}?autoplay=1&rel=0`}
                title={selectedVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-red-600">{selectedVideo.channelName}</span>
                {selectedVideo.speakerName && (
                  <p className="text-xs text-outline mt-0.5">
                    Pemateri: <strong className="text-on-surface">{selectedVideo.speakerName}</strong>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playStream({
                      videoId: selectedVideo.videoId,
                      title: selectedVideo.title,
                      channelName: selectedVideo.channelName,
                      speakerName: selectedVideo.speakerName || '',
                    });
                    setSelectedVideo(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Lanjutkan di Mini Player pojok kanan bawah"
                >
                  <span className="material-symbols-outlined text-[16px] text-red-600">picture_in_picture_alt</span>
                  <span>Putar di Pojok</span>
                </button>
                <a
                  href={`https://www.youtube.com/watch?v=${selectedVideo.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>YouTube</span>
                </a>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="px-4 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SHARE */}
      {shareSession && (
        <ShareModal
          isOpen={true}
          onClose={() => setShareSession(null)}
          session={shareSession}
        />
      )}

      {/* MOBILE NAV DRAWER */}
      <MobileNavDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentUser={currentUser}
        isAdmin={isAdmin}
      />
    </div>
  );
}
