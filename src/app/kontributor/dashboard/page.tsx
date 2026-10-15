'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { submitKajian } from '@/app/actions/kajian'
import { extractKajianFromPoster } from '@/app/actions/ai-poster'
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
  const [avatarError, setAvatarError] = useState(false)
  const [loading, setLoading] = useState(true)

  // Form Controlled States
  const [title, setTitle] = useState('')
  const [speakerName, setSpeakerName] = useState('')
  const [bookTitle, setBookTitle] = useState('')
  const [startDatetime, setStartDatetime] = useState('')
  const [posterUrl, setPosterUrl] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [venueName, setVenueName] = useState('')
  const [audience, setAudience] = useState<'umum' | 'ikhwan' | 'akhwat'>('umum')

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

  // AI Scanner States
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [posterPreview, setPosterPreview] = useState<string | null>(null)
  const [isScanningAi, setIsScanningAi] = useState(false)
  const [aiScanSuccess, setAiScanSuccess] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Map States
  const [viewState, setViewState] = useState({
    longitude: 106.816666,
    latitude: -6.200000,
    zoom: 11,
  })
  const [markerPos, setMarkerPos] = useState({ lat: -6.200000, lng: 106.816666 })
  const [venueQuery, setVenueQuery] = useState('')
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])

  const handleSearchLocation = async () => {
    if (!venueQuery) return
    setIsSearchingLocation(true)
    setSearchResults([])
    try {
      const res = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(venueQuery)}.json?key=${MAPTILER_KEY}&bbox=95.0,-11.0,141.0,6.0&limit=5`
      )
      const data = await res.json()
      if (data.features && data.features.length > 0) {
        setSearchResults(data.features)
        if (data.features.length === 1) {
          selectLocation(data.features[0])
        }
      } else {
        alert('Area tidak ditemukan. Coba ketik nama kota atau kecamatan yang lebih umum.')
      }
    } catch (e) {
      console.error(e)
      alert('Gagal mencari lokasi.')
    }
    setIsSearchingLocation(false)
  }

  const selectLocation = (feature: any) => {
    const [lng, lat] = feature.center
    setViewState({ longitude: lng, latitude: lat, zoom: 15 })
    setMarkerPos({ lat, lng })
    setSearchResults([])
  }

  // Geocoding helper for AI extraction
  const geocodeAddress = async (query: string) => {
    if (!query) return
    try {
      const res = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&bbox=95.0,-11.0,141.0,6.0&limit=1`
      )
      const data = await res.json()
      if (data.features && data.features.length > 0) {
        selectLocation(data.features[0])
      }
    } catch (e) {
      console.error('AI auto geocoding error:', e)
    }
  }

  // Scan Poster Handler
  const handleScanPoster = async (fileToScan: File) => {
    setIsScanningAi(true)
    setAiScanSuccess(null)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('poster', fileToScan)

      const res = await extractKajianFromPoster(formData)

      if (res.success && res.data) {
        const d = res.data
        if (d.title) setTitle(d.title)
        if (d.speaker_name) setSpeakerName(d.speaker_name)
        if (d.book_title) setBookTitle(d.book_title)
        if (d.start_datetime) setStartDatetime(d.start_datetime)
        if (d.mode) setMode(d.mode)
        if (d.audience) setAudience(d.audience)
        if (d.stream_url) setStreamUrl(d.stream_url)

        if (d.is_recurring !== undefined) {
          setIsRecurring(d.is_recurring)
          if (d.is_recurring && d.recurring_rule) {
            setRecurringRule({
              dayOfWeek: d.recurring_rule.dayOfWeek ?? 0,
              time: d.recurring_rule.time || '05:00',
              timeCategory: d.recurring_rule.timeCategory || 'subuh',
              weeks: d.recurring_rule.weeks || [1, 2, 3, 4, 5],
            })
          }
        }

        if (d.venue_name) {
          setVenueName(d.venue_name)
          setVenueQuery(d.venue_name)
        }

        // Auto move pin if geocoded location exists
        if (d.geocodedLocation) {
          const { lat, lng } = d.geocodedLocation
          setMarkerPos({ lat, lng })
          setViewState({ longitude: lng, latitude: lat, zoom: 15 })
        } else if (d.venue_name && d.mode !== 'online') {
          geocodeAddress(d.venue_name)
        }

        setAiScanSuccess(
          'Alhamdulillah! Data kajian berhasil diekstrak otomatis dari poster. Silakan periksa kolom-kolom di bawah dan sesuaikan pin lokasi jika perlu.'
        )
      } else {
        setMessage({
          type: 'error',
          text: res.error || 'Gagal mengekstrak data dari poster kajian.',
        })
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Terjadi kesalahan sistem saat memproses poster.',
      })
    } finally {
      setIsScanningAi(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPosterFile(file)
      const preview = URL.createObjectURL(file)
      setPosterPreview(preview)
      handleScanPoster(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setPosterFile(file)
      const preview = URL.createObjectURL(file)
      setPosterPreview(preview)
      handleScanPoster(file)
    }
  }

  const handleClearPoster = () => {
    setPosterFile(null)
    setPosterPreview(null)
    setAiScanSuccess(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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

      // Reset states
      setTitle('')
      setSpeakerName('')
      setBookTitle('')
      setStartDatetime('')
      setVenueName('')
      setVenueQuery('')
      setStreamUrl('')
      setPosterUrl('')
      setAudience('umum')
      setMode('offline')
      setIsRecurring(false)
      handleClearPoster()
      formRef.current?.reset()

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

  if (!user) return null

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Relawan'
  const avatarUrl = user.user_metadata?.avatar_url

  return (
    <div className="min-h-screen bg-surface p-3 sm:p-6 md:p-8 font-geist text-on-surface">
      {/* Top Header */}
      <header className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface">Dasbor Kontributor</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            Ahlan wa sahlan, <span className="font-semibold text-primary">{displayName}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 rounded-full text-xs font-semibold transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[17px] text-amber-600">admin_panel_settings</span>
              <span>Portal Admin</span>
            </Link>
          )}
          <Link
            href="/kontributor/profile"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-surface-container-high hover:border-primary text-on-surface rounded-full text-xs font-medium transition-all"
          >
            {avatarUrl && !avatarError ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-5 h-5 rounded-full object-cover shrink-0"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <span className="material-symbols-outlined text-[17px] text-primary shrink-0">account_circle</span>
            )}
            <span>Profil Saya</span>
          </Link>
          <Link
            href="/leaderboard"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-surface-container-high hover:border-amber-400 text-on-surface rounded-full text-xs font-medium transition-all"
          >
            <span className="material-symbols-outlined text-[17px] text-amber-500">trophy</span>
            <span>Leaderboard</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-full text-xs font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[17px]">map</span>
            <span>Peta</span>
          </Link>
          <form action="/auth/signout" method="post">
            <button className="px-3 py-1.5 bg-error/10 text-error rounded-full text-xs font-medium hover:bg-error/20 transition-colors">
              Keluar
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto flex flex-col gap-6">
        {/* ========================================================================= */}
        {/* FITUR BARU: AI POSTER SCANNER DROPZONE */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-surface-container-lowest to-surface-container-low border border-emerald-500/25 rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-sm shrink-0">
                <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-on-surface">Pindai Poster dengan AI</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white tracking-wider uppercase">
                    Otomatis
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Cukup unggah gambar/flyer kajian, AI akan mengekstrak data dan mengisi form di bawah secara otomatis!
                </p>
              </div>
            </div>

            {posterPreview && (
              <button
                type="button"
                onClick={handleClearPoster}
                className="self-end sm:self-center text-xs font-semibold text-error hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Hapus Poster</span>
              </button>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            className="hidden"
            onChange={handleFileChange}
          />

          {!posterPreview ? (
            /* Dropzone Box saat belum ada gambar */
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
                isDragging
                  ? 'border-emerald-600 bg-emerald-500/10 scale-[1.01]'
                  : 'border-surface-container-high hover:border-emerald-500/60 bg-surface-container-lowest/60 hover:bg-surface-container-lowest'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[28px]">add_photo_alternate</span>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-on-surface">
                  Pilih atau Tarik Berkas Poster ke Sini
                </p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Format gambar JPG, PNG, atau WEBP (Maksimal 6 MB)
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-semibold shadow-xs transition-colors mt-1">
                <span className="material-symbols-outlined text-[16px]">upload</span>
                <span>Pilih Gambar Poster</span>
              </span>
            </div>
          ) : (
            /* Preview Gambar dan Status Pemindaian */
            <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-lg overflow-hidden bg-surface-container-high shrink-0 border border-surface-container relative">
                <img
                  src={posterPreview}
                  alt="Poster Kajian"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 w-full min-w-0 flex flex-col justify-between py-1">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-on-surface truncate">
                      {posterFile?.name || 'Poster Terpilih'}
                    </span>
                    <span className="text-[11px] text-outline font-mono">
                      {posterFile ? `${(posterFile.size / 1024).toFixed(0)} KB` : ''}
                    </span>
                  </div>

                  {isScanningAi ? (
                    <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center gap-3 animate-pulse">
                      <span className="material-symbols-outlined animate-spin text-[20px] text-emerald-600">
                        progress_activity
                      </span>
                      <div className="text-xs">
                        <span className="font-bold block">Sedang Memindai dengan AI...</span>
                        <span className="text-[11px] opacity-80">
                          Membaca judul, pemateri, waktu, kitab & mencari titik masjid di peta.
                        </span>
                      </div>
                    </div>
                  ) : aiScanSuccess ? (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-2">
                      <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>{aiScanSuccess}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant mt-1.5">
                      Poster siap dipindai ulang jika hasil sebelumnya ingin diperbarui.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => posterFile && handleScanPoster(posterFile)}
                    disabled={isScanningAi}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isScanningAi ? 'progress_activity' : 'refresh'}
                    </span>
                    <span>{isScanningAi ? 'Sedang Memindai...' : 'Pindai Ulang dengan AI'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanningAi}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg text-xs font-medium border border-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">sync_alt</span>
                    <span>Ganti Gambar</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* FORM INPUT MANUAL & AUTO-FILLED */}
        {/* ========================================================================= */}
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-on-surface">Data Jadwal Kajian</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Periksa dan lengkapi detail informasi kajian sebelum diterbitkan.
              </p>
            </div>
          </div>

          {message && (
            <div
              className={`mb-6 p-4 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
                message.type === 'success'
                  ? 'bg-primary-container text-on-primary-container border border-primary/20'
                  : 'bg-error/10 text-error border border-error/20'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">
                {message.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <span>{message.text}</span>
            </div>
          )}

          <form ref={formRef} action={onSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs sm:text-sm font-semibold text-on-surface">
                  Judul Kajian / Tema <span className="text-error">*</span>
                </span>
                <input
                  type="text"
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary"
                  placeholder="Contoh: Fiqih Shalat & Thaharah"
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs sm:text-sm font-semibold text-on-surface">
                  Nama Ustadz / Pemateri <span className="text-error">*</span>
                </span>
                <input
                  type="text"
                  name="speaker_name"
                  value={speakerName}
                  onChange={(e) => setSpeakerName(e.target.value)}
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary"
                  placeholder="Contoh: Ustadz Dr. Syafiq Riza Basalamah, M.A."
                  required
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs sm:text-sm font-semibold text-on-surface">Nama Kitab (Opsional)</span>
                <input
                  type="text"
                  name="book_title"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary"
                  placeholder="Contoh: Bulughul Maram / Riyadhis Shalihin"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs sm:text-sm font-semibold text-on-surface">
                  Waktu Pelaksanaan{' '}
                  {isRecurring && <span className="text-outline font-normal">(Opsional untuk Rutin)</span>}{' '}
                  {!isRecurring && <span className="text-error">*</span>}
                </span>
                <input
                  type="datetime-local"
                  name="start_datetime"
                  value={startDatetime}
                  onChange={(e) => setStartDatetime(e.target.value)}
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary"
                  required={!isRecurring}
                />
              </label>
            </div>

            {/* Mode Kajian */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs sm:text-sm font-semibold text-on-surface">
                Mode Kajian <span className="text-error">*</span>
              </span>
              <input type="hidden" name="mode" value={mode} />
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: 'offline', label: 'Offline', icon: 'mosque', desc: 'Di masjid fisik' },
                    { value: 'online', label: 'Online', icon: 'videocam', desc: 'Live streaming murni' },
                    { value: 'hybrid', label: 'Hybrid', icon: 'connected_tv', desc: 'Masjid + Live' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMode(opt.value)}
                    className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-colors ${
                      mode === opt.value
                        ? 'border-primary bg-primary-container/20 text-primary font-bold shadow-2xs'
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
              <span className="text-xs sm:text-sm font-semibold text-on-surface">URL Poster Asli (Opsional)</span>
              <input
                type="url"
                name="poster_url"
                value={posterUrl}
                onChange={(e) => setPosterUrl(e.target.value)}
                className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary"
                placeholder="https://..."
              />
            </label>

            {needsStream && (
              <label className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <span className="text-xs sm:text-sm font-semibold text-on-surface">
                  Link Live Streaming <span className="text-error">*</span>
                </span>
                <input
                  type="url"
                  name="stream_url"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary"
                  placeholder="https://youtube.com/@channel/live"
                  required
                />
                <span className="text-[11px] text-outline">
                  Link YouTube, Zoom, Instagram Live, atau platform streaming lainnya.
                </span>
              </label>
            )}

            {needsVenue && (
              <div className="flex flex-col gap-4 border border-surface-container-high rounded-xl p-4 bg-surface-container-lowest animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs sm:text-sm font-semibold text-on-surface">
                    Nama Masjid / Lokasi <span className="text-error">*</span>
                  </span>
                  <input
                    type="text"
                    name="venue_name"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary"
                    placeholder="Contoh: Masjid Nurul Iman Blok M, Kebayoran Baru"
                    required
                  />
                </label>

                <div className="border-t border-surface-container-high pt-3">
                  <label className="flex flex-col gap-1.5 relative">
                    <span className="text-xs sm:text-sm font-semibold text-on-surface">
                      Tandai Titik Peta (Wajib) <span className="text-error">*</span>
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={venueQuery}
                        onChange={(e) => setVenueQuery(e.target.value)}
                        className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary"
                        placeholder="Cari nama masjid, kecamatan, atau kota..."
                      />
                      <button
                        type="button"
                        onClick={handleSearchLocation}
                        disabled={isSearchingLocation}
                        className="px-3.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center justify-center min-w-[70px]"
                      >
                        {isSearchingLocation ? (
                          <span className="material-symbols-outlined animate-spin text-[18px]">
                            progress_activity
                          </span>
                        ) : (
                          'Cari'
                        )}
                      </button>
                    </div>

                    {searchResults.length > 1 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-surface-container-high rounded-lg shadow-lg z-50 overflow-hidden">
                        <ul className="max-h-48 overflow-y-auto">
                          {searchResults.map((feat) => (
                            <li
                              key={feat.id}
                              onClick={() => selectLocation(feat)}
                              className="px-3 py-2 text-xs sm:text-sm hover:bg-surface-container-low cursor-pointer border-b border-surface-container-high last:border-b-0"
                            >
                              <span className="font-semibold text-on-surface block">{feat.text}</span>
                              <span className="text-[11px] text-on-surface-variant line-clamp-1">
                                {feat.place_name}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <span className="text-[11px] text-outline mt-1 leading-tight">
                      Geser peta di bawah dan tempatkan <b>Pin Merah</b> persis di atas bangunan masjid.
                    </span>
                  </label>
                </div>

                {/* Peta Mini */}
                <div className="w-full h-[240px] sm:h-[280px] rounded-lg overflow-hidden border border-outline-variant relative">
                  <div className="absolute top-2 left-2 z-10 bg-surface/90 backdrop-blur text-[11px] px-2.5 py-1 rounded shadow-sm text-on-surface font-medium border border-surface-container-high pointer-events-none">
                    Geser pin merah ke lokasi persis masjid
                  </div>
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
                        <span
                          className="material-symbols-outlined text-[36px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          location_on
                        </span>
                      </div>
                    </Marker>
                  </Map>
                </div>

                {/* Hidden Inputs for coordinates */}
                <input type="hidden" name="lat" value={markerPos.lat} />
                <input type="hidden" name="lng" value={markerPos.lng} />
              </div>
            )}

            {/* Sasaran Jamaah */}
            <div className="flex flex-col gap-1.5 mt-1">
              <span className="text-xs sm:text-sm font-semibold text-on-surface">Target Jamaah</span>
              <div className="flex gap-4 sm:gap-6 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="audience"
                    value="umum"
                    checked={audience === 'umum'}
                    onChange={() => setAudience('umum')}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-xs sm:text-sm text-on-surface">Umum (Ikhwan & Akhwat)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="audience"
                    value="ikhwan"
                    checked={audience === 'ikhwan'}
                    onChange={() => setAudience('ikhwan')}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-xs sm:text-sm text-on-surface">Khusus Ikhwan</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="audience"
                    value="akhwat"
                    checked={audience === 'akhwat'}
                    onChange={() => setAudience('akhwat')}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-xs sm:text-sm text-on-surface">Khusus Akhwat</span>
                </label>
              </div>
            </div>

            {/* Selector Kajian Rutin */}
            <RecurringRuleSelector
              isRecurring={isRecurring}
              setIsRecurring={setIsRecurring}
              rule={recurringRule}
              setRule={setRecurringRule}
            />

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-3 bg-primary text-on-primary font-semibold rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    <span>Terbitkan Kajian</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
