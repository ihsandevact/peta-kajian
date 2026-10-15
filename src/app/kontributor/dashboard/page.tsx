'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState, useRef, useCallback } from 'react'
import { submitKajian } from '@/app/actions/kajian'
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre'
import { setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl('/lib/maplibre/maplibre-gl-worker.mjs')

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || 'get_your_own_OpIi9ZULNHzrESv6T2vL'

import RecurringRuleSelector from '@/components/RecurringRuleSelector'
import { RecurringRule } from '@/utils/recurring'
import { checkIsAdmin } from '@/lib/services/admin'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringRule, setRecurringRule] = useState<RecurringRule>({
    dayOfWeek: 0,
    time: '05:00',
    timeCategory: 'subuh',
    weeks: [1, 2, 3, 4, 5],
  })
  const [mode, setMode] = useState<'offline' | 'online' | 'hybrid'>('offline')
  const needsVenue = mode !== 'online'
  const needsStream = mode !== 'offline'
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Map States
  const [viewState, setViewState] = useState({
    longitude: 106.816666,
    latitude: -6.200000,
    zoom: 11
  })
  const [markerPos, setMarkerPos] = useState({ lat: -6.200000, lng: 106.816666 })
  const [venueQuery, setVenueQuery] = useState('')
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])

  const handleSearchLocation = async () => {
    if (!venueQuery) return;
    setIsSearchingLocation(true);
    setSearchResults([]);
    try {
      const res = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(venueQuery)}.json?key=${MAPTILER_KEY}&bbox=95.0,-11.0,141.0,6.0&limit=5`);
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        setSearchResults(data.features);
        if (data.features.length === 1) {
          selectLocation(data.features[0]);
        }
      } else {
        alert('Area tidak ditemukan. Coba ketik nama kota atau kecamatan yang lebih umum.');
      }
    } catch (e) {
      console.error(e);
      alert('Gagal mencari lokasi.');
    }
    setIsSearchingLocation(false);
  };

  const selectLocation = (feature: any) => {
    const [lng, lat] = feature.center;
    setViewState({ longitude: lng, latitude: lat, zoom: 15 });
    setMarkerPos({ lat, lng });
    setSearchResults([]);
  };

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      if (user) {
        setUser(user)
        checkIsAdmin(user).then((admin) => {
          if (mounted) setIsAdmin(admin)
        })
        setLoading(false)
        return
      }

      // Fallback to getSession
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        checkIsAdmin(session.user).then((admin) => {
          if (mounted) setIsAdmin(admin)
        })
        setLoading(false)
        return
      }

      router.push('/kontributor/login')
      setLoading(false)
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        checkIsAdmin(session.user).then((admin) => {
          if (mounted) setIsAdmin(admin)
        })
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  async function onSubmit(formData: FormData) {
    setIsSubmitting(true)
    setMessage(null)
    const res = await submitKajian(formData)
    setIsSubmitting(false)
    
    if (res.success) {
      if (res.isPending) {
        setMessage({
          type: 'success',
          text: 'Alhamdulillah, kajian berhasil dikirim dan saat ini masuk antrean kurasi Admin sebelum tayang di peta publik.',
        })
      } else {
        setMessage({
          type: 'success',
          text: 'Alhamdulillah, kajian berhasil dipublikasikan dan langsung tayang di Peta!',
        })
      }
      formRef.current?.reset()
      setIsRecurring(false)
      // Hilangkan pesan setelah 7 detik
      setTimeout(() => setMessage(null), 7000)
    } else {
      setMessage({ type: 'error', text: res.error || 'Terjadi kesalahan saat memublikasikan.' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-on-surface-variant font-medium">Memeriksa autentikasi...</p>
      </div>
    )
  }

  if (!user) return null;

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Relawan'
  const avatarUrl = user.user_metadata?.avatar_url

  return (
    <div className="min-h-screen bg-surface p-4 md:p-8">
      <header className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Dasbor Kontributor</h1>
          <p className="text-sm text-on-surface-variant">Ahlan wa sahlan, <span className="font-semibold text-primary">{displayName}</span></p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {isAdmin && (
            <Link 
              href="/admin" 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 rounded-full text-xs font-semibold transition-colors shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px] text-amber-600">admin_panel_settings</span>
              <span>Portal Admin</span>
            </Link>
          )}
          <Link 
            href="/kontributor/profile" 
            className="flex items-center gap-2 px-3 py-1.5 bg-surface-container border border-surface-container-high hover:border-primary text-on-surface rounded-full text-xs font-medium transition-all"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-[18px] text-primary">account_circle</span>
            )}
            <span>Profil Saya</span>
          </Link>
          <Link 
            href="/leaderboard" 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-surface-container-high hover:border-amber-400 text-on-surface rounded-full text-xs font-medium transition-all"
          >
            <span className="material-symbols-outlined text-[18px] text-amber-500">trophy</span>
            <span>Leaderboard</span>
          </Link>
          <Link 
            href="/" 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-full text-xs font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">map</span>
            <span>Buka Peta</span>
          </Link>
          <form action="/auth/signout" method="post">
            <button className="px-3 py-1.5 bg-error/10 text-error rounded-full text-xs font-medium hover:bg-error/20 transition-colors">
              Keluar
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-on-surface">Form Input Kajian Manual</h2>
          <p className="text-sm text-on-surface-variant mb-6">
            Kajian yang diinput oleh relawan akan dikurasi oleh tim Admin sebelum terbit di peta publik demi menjaga validitas data dan informasi dakwah.
          </p>

          {message && (
            <div className={`mb-6 p-4 rounded-lg font-medium text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
              message.type === 'success' ? 'bg-primary-container text-on-primary-container border border-primary/20' : 'bg-error/10 text-error border border-error/20'
            }`}>
              <span className="material-symbols-outlined text-[20px]">
                {message.type === 'success' ? 'check_circle' : 'error'}
              </span>
              {message.text}
            </div>
          )}

          <form ref={formRef} action={onSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-on-surface">Judul Kajian / Tema <span className="text-error">*</span></span>
                <input type="text" name="title" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="Contoh: Fiqih Shalat" required />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-on-surface">Nama Ustadz / Pemateri <span className="text-error">*</span></span>
                <input type="text" name="speaker_name" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="Contoh: Ustadz Fulan, Lc." required />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-on-surface">Nama Kitab (Opsional)</span>
                <input type="text" name="book_title" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="Contoh: Bulughul Maram" />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-on-surface">
                  Waktu Pelaksanaan {isRecurring && <span className="text-outline font-normal">(Opsional)</span>} {!isRecurring && <span className="text-error">*</span>}
                </span>
                <input type="datetime-local" name="start_datetime" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" required={!isRecurring} />
              </label>
            </div>

            {/* Mode Kajian */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-on-surface">Mode Kajian <span className="text-error">*</span></span>
              <input type="hidden" name="mode" value={mode} />
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'offline', label: 'Offline', icon: 'mosque', desc: 'Di masjid' },
                  { value: 'online', label: 'Online', icon: 'videocam', desc: 'Live streaming' },
                  { value: 'hybrid', label: 'Hybrid', icon: 'connected_tv', desc: 'Masjid + live' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMode(opt.value)}
                    className={`flex flex-col items-center gap-0.5 py-2.5 rounded-lg border text-sm transition-colors ${
                      mode === opt.value
                        ? 'border-primary bg-primary-container/15 text-primary font-semibold'
                        : 'border-surface-container-high bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{opt.icon}</span>
                    <span>{opt.label}</span>
                    <span className="text-[10px] font-normal opacity-75">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-on-surface">URL Poster (Opsional)</span>
              <input type="url" name="poster_url" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="https://..." />
            </label>

            {needsStream && (
              <label className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <span className="text-sm font-medium text-on-surface">Link Live Streaming <span className="text-error">*</span></span>
                <input type="url" name="stream_url" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="https://youtube.com/@channel/live" required />
                <span className="text-[11px] text-outline">Link YouTube, Zoom, Instagram Live, atau platform lain.</span>
              </label>
            )}

            {needsVenue && (
            <div className="flex flex-col gap-4 border border-surface-container-high rounded-xl p-4 bg-surface-container-lowest animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-on-surface">Nama Masjid / Lokasi <span className="text-error">*</span></span>
                <input type="text" name="venue_name" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="Contoh: Masjid Nurul Iman Blok M" required />
              </label>

              <div className="border-t border-surface-container-high pt-4 mt-2">
                <label className="flex flex-col gap-1.5 relative">
                  <span className="text-sm font-medium text-on-surface">Tandai Titik Peta (Wajib) <span className="text-error">*</span></span>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={venueQuery}
                      onChange={(e) => setVenueQuery(e.target.value)}
                      className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" 
                      placeholder="Cari Kecamatan atau Kota untuk melompat cepat" 
                    />
                    <button 
                      type="button" 
                      onClick={handleSearchLocation}
                      disabled={isSearchingLocation}
                      className="px-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center justify-center min-w-[70px]"
                    >
                      {isSearchingLocation ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : 'Cari'}
                    </button>
                  </div>
                  
                  {searchResults.length > 1 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-surface-container-high rounded-lg shadow-lg z-50 overflow-hidden">
                      <ul className="max-h-48 overflow-y-auto">
                        {searchResults.map((feat) => (
                          <li 
                            key={feat.id} 
                            onClick={() => selectLocation(feat)}
                            className="px-3 py-2 text-sm hover:bg-surface-container-low cursor-pointer border-b border-surface-container-high last:border-b-0"
                          >
                            <span className="font-medium text-on-surface block">{feat.text}</span>
                            <span className="text-[11px] text-on-surface-variant line-clamp-1">{feat.place_name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <span className="text-[11px] text-outline mt-1 leading-tight">
                    Jika area tidak ditemukan, abaikan pencarian. Cukup geser peta dan letakkan <b>Pin Merah</b> persis di atas bangunan masjid.
                  </span>
                </label>
              </div>

              {/* Peta Mini */}
              <div className="w-full h-[250px] rounded-lg overflow-hidden border border-outline-variant relative">
                <div className="absolute top-2 left-2 z-10 bg-surface/90 backdrop-blur text-[11px] px-2 py-1 rounded shadow-sm text-on-surface font-medium border border-surface-container-high pointer-events-none">
                  Geser pin merah ke lokasi persis masjid
                </div>
                <Map
                  {...viewState}
                  onMove={evt => setViewState(evt.viewState)}
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
                      <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                    </div>
                  </Marker>
                </Map>
              </div>

              {/* Hidden Inputs for coordinates */}
              <input type="hidden" name="lat" value={markerPos.lat} />
              <input type="hidden" name="lng" value={markerPos.lng} />
            </div>
            )}

            <div className="flex gap-6 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="audience" value="umum" className="w-4 h-4 text-primary" defaultChecked />
                <span className="text-sm text-on-surface">Umum</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="audience" value="ikhwan" className="w-4 h-4 text-primary" />
                <span className="text-sm text-on-surface">Khusus Ikhwan</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="audience" value="akhwat" className="w-4 h-4 text-primary" />
                <span className="text-sm text-on-surface">Khusus Akhwat</span>
              </label>
            </div>

            <RecurringRuleSelector
              isRecurring={isRecurring}
              setIsRecurring={setIsRecurring}
              rule={recurringRule}
              setRule={setRecurringRule}
            />

            <div className="mt-6 flex justify-end">
              <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-primary text-on-primary font-medium rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2">
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Memproses...
                  </>
                ) : (
                  'Terbitkan Kajian'
                )}
              </button>
            </div>
          </form>

        </div>
      </main>
    </div>
  )
}
