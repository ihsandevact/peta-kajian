'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { StudySession } from '@/lib/services/kajian';
import { updateKajian } from '@/app/actions/kajian';
import RecurringRuleSelector from './RecurringRuleSelector';
import { RecurringRule, parseRecurringPattern } from '@/utils/recurring';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl('/lib/maplibre/maplibre-gl-worker.mjs');

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || 'get_your_own_OpIi9ZULNHzrESv6T2vL';

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
  const [status, setStatus] = useState<'confirmed' | 'canceled' | 'postponed'>('confirmed');
  const [startDatetime, setStartDatetime] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [mode, setMode] = useState<'offline' | 'online' | 'hybrid'>('offline');
  const [venueName, setVenueName] = useState('');

  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringRule, setRecurringRule] = useState<RecurringRule>({
    dayOfWeek: 0,
    time: '05:00',
    timeCategory: 'subuh',
    weeks: [1, 2, 3, 4, 5],
  });

  // Map state
  const [markerPos, setMarkerPos] = useState({ lat: -6.200000, lng: 106.816666 });
  const [viewState, setViewState] = useState({
    longitude: 106.816666,
    latitude: -6.200000,
    zoom: 12,
  });
  const [venueQuery, setVenueQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Synchronize when session prop changes
  useEffect(() => {
    if (!session) return;

    setTitle(session.title || '');
    setSpeakerName(session.speaker_name || '');
    setBookTitle(session.book_title || '');
    setAudience(session.audience_type || 'umum');
    setStatus(session.status || 'confirmed');
    setPosterUrl(session.poster_url || '');
    setStreamUrl(session.stream_url || '');

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
      setViewState({ longitude: lng, latitude: lat, zoom: 13 });
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
  }, [session, isOpen]);

  const handleSearchLocation = async () => {
    if (!venueQuery) return;
    setIsSearchingLocation(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(venueQuery)}.json?key=${MAPTILER_KEY}&bbox=95.0,-11.0,141.0,6.0&limit=5`
      );
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        setSearchResults(data.features);
      }
    } catch (err) {
      console.error('Search Location Error:', err);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const selectLocation = (feature: any) => {
    const [lng, lat] = feature.center;
    setMarkerPos({ lat, lng });
    setViewState((prev) => ({ ...prev, longitude: lng, latitude: lat, zoom: 14 }));
    setSearchResults([]);
  };

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
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-on-surface">
                    Nama Masjid / Lokasi <span className="text-error">*</span>
                  </span>
                  <input
                    type="text"
                    name="venue_name"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    required
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                  />
                </label>

                {/* Cari Lokasi di Peta */}
                <div className="flex flex-col gap-1.5 relative">
                  <span className="text-xs font-semibold text-on-surface">Tandai Lokasi Presisi di Peta</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={venueQuery}
                      onChange={(e) => setVenueQuery(e.target.value)}
                      placeholder="Cari kecamatan / kelurahan / masjid..."
                      className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={handleSearchLocation}
                      disabled={isSearchingLocation}
                      className="px-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg text-xs font-semibold transition-colors shrink-0"
                    >
                      {isSearchingLocation ? 'Mencari...' : 'Cari'}
                    </button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-surface-container-high rounded-lg shadow-xl z-50 overflow-hidden">
                      <ul className="max-h-36 overflow-y-auto">
                        {searchResults.map((feat) => (
                          <li
                            key={feat.id}
                            onClick={() => selectLocation(feat)}
                            className="px-3 py-2 text-xs hover:bg-surface-container-low cursor-pointer border-b border-surface-container-high last:border-b-0"
                          >
                            <span className="font-semibold text-on-surface block">{feat.text}</span>
                            <span className="text-[10px] text-on-surface-variant truncate block">
                              {feat.place_name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Mini Map */}
                <div className="w-full h-[180px] rounded-xl overflow-hidden border border-surface-container-high relative">
                  <Map
                    {...viewState}
                    onMove={(evt) => setViewState(evt.viewState)}
                    mapStyle={`https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`}
                    attributionControl={false}
                  >
                    <NavigationControl position="bottom-right" />
                    <Marker
                      longitude={markerPos.lng}
                      latitude={markerPos.lat}
                      draggable
                      onDragEnd={(e) => setMarkerPos({ lng: e.lngLat.lng, lat: e.lngLat.lat })}
                    >
                      <div className="text-error cursor-grab active:cursor-grabbing transform -translate-y-1/2">
                        <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          location_on
                        </span>
                      </div>
                    </Marker>
                  </Map>
                </div>
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
