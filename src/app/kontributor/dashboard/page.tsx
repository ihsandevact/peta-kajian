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

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isRecurring, setIsRecurring] = useState(false)
  
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
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/kontributor/login')
      } else {
        setUser(data.user)
      }
      setLoading(false)
    })
  }, [router])

  async function onSubmit(formData: FormData) {
    setIsSubmitting(true)
    setMessage(null)
    const res = await submitKajian(formData)
    setIsSubmitting(false)
    
    if (res.success) {
      setMessage({ type: 'success', text: 'Alhamdulillah, kajian berhasil dipublikasikan dan telah ditayangkan di Peta!' })
      formRef.current?.reset()
      setIsRecurring(false)
      // Hilangkan pesan setelah 5 detik
      setTimeout(() => setMessage(null), 5000)
    } else {
      setMessage({ type: 'error', text: res.error || 'Terjadi kesalahan saat memublikasikan.' })
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center">Memuat...</div>
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-surface p-4 md:p-8">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Dasbor Kontributor</h1>
          <p className="text-sm text-on-surface-variant">Ahlan wa sahlan, {user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            Buka Peta
          </Link>
          <form action="/auth/signout" method="post">
            <button className="px-4 py-2 bg-error/10 text-error rounded-full text-sm font-medium hover:bg-error/20 transition-colors">
              Keluar
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-on-surface">Form Input Kajian Manual</h2>
          <p className="text-sm text-on-surface-variant mb-6">
            Kajian yang diinput melalui formulir ini akan langsung berstatus <span className="font-mono bg-surface-container px-1 py-0.5 rounded">confirmed</span> dan otomatis tampil di Peta publik.
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

            <div className="flex flex-col gap-4 border border-surface-container-high rounded-xl p-4 bg-surface-container-lowest">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-on-surface">Nama Masjid / Lokasi <span className="text-error">*</span></span>
                  <input type="text" name="venue_name" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="Contoh: Masjid Nurul Iman Blok M" required />
                </label>
                
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-on-surface">URL Poster (Opsional)</span>
                  <input type="url" name="poster_url" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="https://..." />
                </label>
              </div>

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

            <div className="flex flex-col gap-3 mt-2 p-4 rounded-xl bg-surface-container-low border border-surface-container-high">
              <label className="flex items-center gap-2 cursor-pointer w-max">
                <input 
                  type="checkbox" 
                  name="is_recurring" 
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded text-primary" 
                />
                <span className="text-sm font-semibold text-on-surface">Tandai sebagai Kajian Rutin</span>
              </label>
              
              {isRecurring && (
                <label className="flex flex-col gap-1.5 mt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                  <span className="text-sm font-medium text-on-surface">Pola Waktu Rutin</span>
                  <input type="text" name="recurring_pattern" className="w-full bg-surface border border-surface-container-highest rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="Contoh: Setiap Rabu pekan ke-1 dan ke-2 di awal bulan" />
                  <span className="text-[11px] text-outline">Tuliskan pola unik rutinitasnya agar jamaah tahu kapan tepatnya kajian ini diadakan.</span>
                </label>
              )}
            </div>

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
