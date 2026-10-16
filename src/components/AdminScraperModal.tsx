'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { TelegramChannel } from '@/lib/services/telegram';
import { runTelegramChannelScraperAction } from '@/app/actions/scraper';

interface AdminScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedChannel?: string | null;
  channels: TelegramChannel[];
  onFinished?: () => void;
}

interface LogEntry {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'success' | 'warn' | 'error';
}

export default function AdminScraperModal({
  isOpen,
  onClose,
  initialSelectedChannel = null,
  channels,
  onFinished,
}: AdminScraperModalProps) {
  // Hanya ambil channel yang statusnya disetujui & aktif
  const activeChannels = useMemo(
    () => channels.filter((c) => c.status === 'approved' && c.is_active),
    [channels]
  );

  // Form State
  const [scrapeMode, setScrapeMode] = useState<'all' | 'single'>(
    initialSelectedChannel ? 'single' : 'all'
  );
  const [selectedChannel, setSelectedChannel] = useState<string>(
    initialSelectedChannel || (activeChannels[0]?.channel_username ?? '')
  );
  const [customUsername, setCustomUsername] = useState<string>('');
  const [maxPosts, setMaxPosts] = useState<number>(5);
  const [targetStatus, setTargetStatus] = useState<'pending' | 'confirmed'>('pending');

  // Runner & Progress State
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalTargets, setTotalTargets] = useState(0);
  const [currentChannelName, setCurrentChannelName] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({
    channelsDone: 0,
    saved: 0,
    duplicates: 0,
    skippedPast: 0,
    extracted: 0,
  });

  const isCancelledRef = useRef(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Sinkronisasi saat initialSelectedChannel berubah saat modal dibuka
  useEffect(() => {
    if (initialSelectedChannel) {
      setScrapeMode('single');
      setSelectedChannel(initialSelectedChannel);
    } else if (activeChannels.length > 0 && !selectedChannel) {
      setSelectedChannel(activeChannels[0].channel_username);
    }
  }, [initialSelectedChannel, activeChannels, selectedChannel]);

  // Auto-scroll terminal log
  useEffect(() => {
    if (isRunning || isCompleted) {
      terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isRunning, isCompleted]);

  if (!isOpen) return null;

  const appendLog = (text: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    let type: LogEntry['type'] = 'info';
    if (text.includes('✅') || text.includes('💾') || text.includes('✨') || text.includes('🏁')) {
      type = 'success';
    } else if (text.includes('⚠️') || text.includes('⏭️') || text.includes('⏳')) {
      type = 'warn';
    } else if (text.includes('❌') || text.toLowerCase().includes('error')) {
      type = 'error';
    }

    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        time: timeStr,
        text,
        type,
      },
    ]);
  };

  const handleStartScraper = async () => {
    // Tentukan target channel
    let targets: string[] = [];
    if (scrapeMode === 'all') {
      targets = activeChannels.map((c) => c.channel_username);
    } else {
      const channel = (selectedChannel === '__custom__' ? customUsername : selectedChannel).trim();
      if (!channel) {
        alert('Harap pilih atau masukkan username channel Telegram yang ingin discrape.');
        return;
      }
      targets = [channel];
    }

    if (targets.length === 0) {
      alert('Tidak ada channel aktif yang dapat diproses.');
      return;
    }

    // Reset State
    isCancelledRef.current = false;
    setIsRunning(true);
    setIsCompleted(false);
    setCurrentIndex(0);
    setTotalTargets(targets.length);
    setLogs([]);
    setStats({ channelsDone: 0, saved: 0, duplicates: 0, skippedPast: 0, extracted: 0 });

    appendLog(
      `🚀 Memulai proses Scraper untuk ${targets.length} channel (Target Status: ${
        targetStatus === 'pending' ? 'Menunggu Approval Admin (Pending)' : 'Langsung Terbit (Confirmed)'
      })`
    );

    let runningSaved = 0;
    let runningDuplicates = 0;
    let runningPast = 0;
    let runningExtracted = 0;
    let runningChannelsDone = 0;

    for (let i = 0; i < targets.length; i++) {
      if (isCancelledRef.current) {
        appendLog(`🛑 Proses dibatalkan oleh pengguna.`);
        break;
      }

      const channelUser = targets[i];
      setCurrentIndex(i + 1);
      setCurrentChannelName(channelUser);

      try {
        const actionResult = await runTelegramChannelScraperAction({
          channelUsername: channelUser,
          maxPosts,
          targetStatus,
        });

        if (!actionResult.success || !actionResult.result) {
          appendLog(`❌ Gagal memproses @${channelUser}: ${actionResult.error || 'Terjadi kesalahan'}`);
        } else {
          const res = actionResult.result;
          // Masukkan logs dari service
          if (res.logs && res.logs.length > 0) {
            res.logs.forEach((logItem) => appendLog(logItem));
          }

          runningSaved += res.savedCount;
          runningDuplicates += res.skippedDuplicatesCount;
          runningPast += res.skippedPastCount || 0;
          runningExtracted += res.extractedCount;
          runningChannelsDone += 1;

          setStats({
            channelsDone: runningChannelsDone,
            saved: runningSaved,
            duplicates: runningDuplicates,
            skippedPast: runningPast,
            extracted: runningExtracted,
          });
        }
      } catch (err: any) {
        appendLog(`❌ Pengecualian sistem pada @${channelUser}: ${err?.message || 'Error'}`);
      }

      // Jeda sopan antar channel
      if (i < targets.length - 1 && !isCancelledRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    setIsRunning(false);
    setIsCompleted(true);
    appendLog(
      `🎉 Selesai! Total ${runningChannelsDone} channel diproses. Kajian baru tersimpan: ${runningSaved}, Lampau dilewati: ${runningPast}, Duplikat dilewati: ${runningDuplicates}.`
    );

    if (onFinished) {
      onFinished();
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    appendLog(`⏳ Menghentikan proses setelah channel ini selesai...`);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsCompleted(false);
    setLogs([]);
    setCurrentIndex(0);
  };

  const progressPercent = totalTargets > 0 ? Math.round((currentIndex / totalTargets) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl max-w-2xl w-full border border-surface-container-high shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">smart_toy</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <span>AI Scraper Jadwal Telegram</span>
                {isRunning && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300 animate-pulse">
                    Sedang Berjalan
                  </span>
                )}
                {isCompleted && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                    Selesai
                  </span>
                )}
              </h2>
              <p className="text-xs text-outline">
                Menyadap pengumuman kajian dari channel Telegram dan mengekstrak jadwal via Gemini AI.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="p-1.5 rounded-xl hover:bg-surface-container text-outline hover:text-on-surface transition-colors disabled:opacity-40 cursor-pointer"
            aria-label="Tutup modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Tampilan Konfigurasi (Sebelum Jalan / Saat Reset) */}
          {!isRunning && !isCompleted && (
            <div className="space-y-4">
              {/* Pilihan Mode Scraping */}
              <div>
                <label className="block text-xs font-bold text-on-surface mb-2">
                  Target Channel Telegram:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScrapeMode('all')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      scrapeMode === 'all'
                        ? 'bg-purple-500/10 border-purple-500 text-purple-900 dark:text-purple-200'
                        : 'bg-surface-container-low border-surface-container-high text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">dynamic_feed</span>
                        <span>Semua Channel Aktif</span>
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-600/20 text-purple-700 dark:text-purple-300">
                        {activeChannels.length} Channel
                      </span>
                    </div>
                    <span className="text-[11px] text-outline">
                      Menyadap seluruh channel yang sudah disetujui & aktif.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScrapeMode('single')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      scrapeMode === 'single'
                        ? 'bg-purple-500/10 border-purple-500 text-purple-900 dark:text-purple-200'
                        : 'bg-surface-container-low border-surface-container-high text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">tag</span>
                        <span>Satu Channel Khusus</span>
                      </span>
                    </div>
                    <span className="text-[11px] text-outline">
                      Pilih satu target channel tertentu untuk disadap segera.
                    </span>
                  </button>
                </div>
              </div>

              {/* Pemilihan Channel Tunggal jika mode === 'single' */}
              {scrapeMode === 'single' && (
                <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2.5">
                  <label className="block text-xs font-semibold text-on-surface">
                    Pilih Channel Terdaftar atau Ketik Manual:
                  </label>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-surface border border-surface-container-high text-on-surface focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  >
                    {activeChannels.map((c) => (
                      <option key={c.id} value={c.channel_username}>
                        @{c.channel_username} - {c.channel_title} {c.city ? `(${c.city})` : ''}
                      </option>
                    ))}
                    <option value="__custom__">➕ Ketik Username Lain Secara Manual...</option>
                  </select>

                  {selectedChannel === '__custom__' && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs font-semibold text-outline">@</span>
                      <input
                        type="text"
                        placeholder="contoh: infokajian_id"
                        value={customUsername}
                        onChange={(e) => setCustomUsername(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl text-xs bg-surface border border-surface-container-high text-on-surface focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Opsi Target Status Simpan */}
              <div>
                <label className="block text-xs font-bold text-on-surface mb-2">
                  Status Hasil Ekstraksi Kajian:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div
                    onClick={() => setTargetStatus('pending')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      targetStatus === 'pending'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/30'
                        : 'bg-surface-container-low border-surface-container-high text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={targetStatus === 'pending'}
                        onChange={() => setTargetStatus('pending')}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-amber-600">hourglass_top</span>
                        <span>Menunggu Approval (Pending)</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-outline mt-1.5 pl-6">
                      Direkomendasikan. Kajian akan masuk antrean moderasi admin terlebih dahulu untuk ditinjau sebelum tampil di peta.
                    </p>
                  </div>

                  <div
                    onClick={() => setTargetStatus('confirmed')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      targetStatus === 'confirmed'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500/30'
                        : 'bg-surface-container-low border-surface-container-high text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={targetStatus === 'confirmed'}
                        onChange={() => setTargetStatus('confirmed')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                        <span>Langsung Terbit (Confirmed)</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-outline mt-1.5 pl-6">
                      Kajian baru akan langsung tampil di peta publik tanpa menunggu kurasi admin.
                    </p>
                  </div>
                </div>
              </div>

              {/* Jumlah Pesan per Channel */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-surface-container-high">
                <div>
                  <span className="text-xs font-bold text-on-surface block">Maksimal Pesan Disadap:</span>
                  <span className="text-[11px] text-outline">
                    Berapa postingan terakhir di channel yang akan dianalisis oleh AI.
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-surface-container p-1 rounded-lg">
                  {[5, 10, 15].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setMaxPosts(cnt)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                        maxPosts === cnt
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-outline hover:text-on-surface'
                      }`}
                    >
                      {cnt} Pesan
                    </button>
                  ))}
                </div>
              </div>

              {/* Informasi Keamanan & API Key */}
              <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs text-purple-800 dark:text-purple-300 flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] shrink-0 text-purple-600">info</span>
                <p className="leading-relaxed">
                  Scraper berjalan secara sekuensial per channel di serverless. Deteksi duplikat otomatis mencegah penambahan kajian yang sama.
                </p>
              </div>
            </div>
          )}

          {/* Progress Bar & Current Channel (Saat Berjalan atau Selesai) */}
          {(isRunning || isCompleted) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface flex items-center gap-2">
                  {isRunning ? (
                    <>
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
                      <span>
                        Memproses channel {currentIndex} dari {totalTargets}: <strong>@{currentChannelName}</strong>
                      </span>
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <span className="material-symbols-outlined text-[16px]">task_alt</span>
                      <span>Semua target channel selesai diproses</span>
                    </span>
                  )}
                </span>
                <span className="font-mono text-outline font-bold">{progressPercent}%</span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-purple-600 to-indigo-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Mini Stats Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-center">
                <div className="p-2 rounded-xl bg-surface-container-low border border-surface-container-high">
                  <span className="text-[10px] text-outline block">Channel Selesai</span>
                  <span className="text-sm font-bold text-on-surface font-mono">
                    {stats.channelsDone}/{totalTargets}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-[10px] text-purple-700 dark:text-purple-300 block">Ditemukan AI</span>
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-300 font-mono">
                    {stats.extracted}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block">Baru Disimpan</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {stats.saved}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-neutral-500/10 border border-neutral-500/20">
                  <span className="text-[10px] text-neutral-600 dark:text-neutral-400 block">Lampau Lewat</span>
                  <span className="text-sm font-bold text-neutral-600 dark:text-neutral-300 font-mono">
                    {stats.skippedPast}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 block">Duplikat Lewat</span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono">
                    {stats.duplicates}
                  </span>
                </div>
              </div>

              {/* Live Terminal Console */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-outline">
                  <span className="flex items-center gap-1 font-mono font-semibold">
                    <span className="material-symbols-outlined text-[14px]">terminal</span>
                    <span>Live Console Log</span>
                  </span>
                  <span className="text-[10px] font-mono">{logs.length} baris</span>
                </div>

                <div className="bg-neutral-950 text-neutral-200 border border-neutral-800 rounded-xl p-3 sm:p-4 font-mono text-[11px] leading-relaxed max-h-60 sm:max-h-72 overflow-y-auto space-y-1 shadow-inner selection:bg-neutral-700">
                  {logs.length === 0 && (
                    <div className="text-neutral-500 italic">Menunggu log pertama...</div>
                  )}
                  {logs.map((log) => {
                    let colorClass = 'text-neutral-300';
                    if (log.type === 'success') colorClass = 'text-emerald-400 font-semibold';
                    if (log.type === 'warn') colorClass = 'text-amber-300';
                    if (log.type === 'error') colorClass = 'text-red-400 font-semibold';

                    return (
                      <div key={log.id} className="flex items-start gap-2 break-all">
                        <span className="text-neutral-600 shrink-0 select-none">[{log.time}]</span>
                        <span className={colorClass}>{log.text}</span>
                      </div>
                    );
                  })}
                  <div ref={terminalBottomRef} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3.5 border-t border-surface-container-high bg-surface-container-low flex items-center justify-between shrink-0">
          {!isRunning && !isCompleted && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleStartScraper}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                <span>Mulai Scraping Sekarang</span>
              </button>
            </>
          )}

          {isRunning && (
            <>
              <span className="text-xs text-outline italic">Proses sedang berlangsung, mohon tidak menutup jendela...</span>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">stop_circle</span>
                <span>Hentikan Proses</span>
              </button>
            </>
          )}

          {isCompleted && (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">replay</span>
                <span>Scrape Ulang</span>
              </button>

              <div className="flex items-center gap-2">
                <Link
                  href="/admin"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                  <span>Lihat Antrean Moderasi</span>
                </Link>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
