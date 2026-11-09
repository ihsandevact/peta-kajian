'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { submitKajian } from '@/app/actions/kajian'
import { extractKajianFromPoster } from '@/app/actions/ai-poster'
import dynamic from 'next/dynamic'
import { searchPlaces } from '@/lib/services/geocoding'

import RecurringRuleSelector from '@/components/RecurringRuleSelector'
import { RecurringRule } from '@/utils/recurring'
import { checkIsAdmin, getUserRoleAndStatus, type UserRoleInfo } from '@/lib/services/admin'
import DynamicBackButton from '@/components/navigation/DynamicBackButton'

const VenueLocationPicker = dynamic(() => import('@/components/VenueLocationPicker'), { ssr: false })
const AppMenuBottomSheet = dynamic(() => import('@/components/navigation/AppMenuBottomSheet'), { ssr: false })
const RequestContributorModal = dynamic(() => import('@/components/RequestContributorModal'), { ssr: false })

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [roleInfo, setRoleInfo] = useState<UserRoleInfo | null>(null)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Relawan Dakwah'
  const avatarUrl = user?.user_metadata?.avatar_url

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
  interface QuotaExhaustedInfo {
    resetAt?: string;
    retryDelayText?: string;
  }
  const [quotaExhaustedInfo, setQuotaExhaustedInfo] = useState<QuotaExhaustedInfo | null>(null)
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [posterPreview, setPosterPreview] = useState<string | null>(null)
  const [isScanningAi, setIsScanningAi] = useState(false)
  const [aiScanSuccess, setAiScanSuccess] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cek cache status kuota AI dari sessionStorage
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('ai_quota_exhausted')
      if (cached) {
        const parsed: QuotaExhaustedInfo = JSON.parse(cached)
        if (parsed.resetAt) {
          const resetTime = new Date(parsed.resetAt).getTime()
          if (Date.now() < resetTime) {
            setQuotaExhaustedInfo(parsed)
            return
          } else {
            sessionStorage.removeItem('ai_quota_exhausted')
          }
        } else {
          setQuotaExhaustedInfo(parsed)
        }
      }
    } catch {}
  }, [])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [submittedData, setSubmittedData] = useState<{
    sessionId?: string;
    title: string;
    speakerName: string;
    venueName?: string;
    isPending: boolean;
  } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Map / Location State
  const [markerPos, setMarkerPos] = useState({ lat: -6.200000, lng: 106.816666 })

  // Geocoding helper for AI extraction
  const geocodeAddress = async (query: string) => {
    if (!query) return
    try {
      const places = await searchPlaces(query)
      if (places.length > 0) {
        setMarkerPos({ lat: places[0].lat, lng: places[0].lng })
      }
    } catch (e) {
      console.error('AI auto geocoding error:', e)
    }
  }

  // Scan Poster Handler
  const handleScanPoster = async (fileToScan: File) => {
    if (quotaExhaustedInfo) {
      setMessage({
        type: 'error',
        text: 'Fitur AI sedang dinonaktifkan sementara karena kuota harian telah habis. Silakan isi form kajian secara manual.',
      })
      return
    }

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
        }

        // Auto move pin if geocoded location exists
        if (d.geocodedLocation) {
          const { lat, lng } = d.geocodedLocation
          setMarkerPos({ lat, lng })
        } else if (d.venue_name && d.mode !== 'online') {
          geocodeAddress(d.venue_name)
        }

        setAiScanSuccess(
          'Alhamdulillah! Data kajian berhasil diekstrak otomatis dari poster. Silakan periksa kolom-kolom di bawah dan sesuaikan pin lokasi jika perlu.'
        )
      } else {
        if (res.isQuotaExhausted) {
          const qInfo: QuotaExhaustedInfo = {
            resetAt: res.resetAt,
            retryDelayText: res.retryDelayText,
          }
          setQuotaExhaustedInfo(qInfo)
          try {
            sessionStorage.setItem('ai_quota_exhausted', JSON.stringify(qInfo))
          } catch {}

          setMessage({
            type: 'error',
            text: res.error || 'Kuota harian pemindaian AI saat ini telah habis. Silakan lengkapi formulir di bawah secara manual.',
          })
        } else {
          let errText = res.error || 'Gagal mengekstrak data dari poster kajian.'
          if (typeof errText === 'string' && errText.trim().startsWith('{')) {
            errText = 'Gagal memindai poster secara otomatis. Silakan lengkapi formulir kajian secara manual.'
          }
          setMessage({
            type: 'error',
            text: errText,
          })
        }
      }
    } catch (err: any) {
      let errMsg = err?.message || 'Terjadi kesalahan sistem saat memproses poster.'
      if (
        typeof errMsg === 'string' &&
        (errMsg.trim().startsWith('{') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429'))
      ) {
        errMsg = 'Layanan pemindaian AI saat ini sedang mencapai batas kuota. Silakan isi rincian kajian secara manual.'
        const qInfo: QuotaExhaustedInfo = { retryDelayText: 'beberapa waktu ke depan' }
        setQuotaExhaustedInfo(qInfo)
        try {
          sessionStorage.setItem('ai_quota_exhausted', JSON.stringify(qInfo))
        } catch {}
      }
      setMessage({
        type: 'error',
        text: errMsg,
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
      if (quotaExhaustedInfo) {
        setMessage({
          type: 'error',
          text: 'Berkas poster berhasil disimpan. Karena kuota AI sedang habis, silakan isi formulir kajian di bawah secara manual.',
        })
      } else {
        handleScanPoster(file)
      }
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
      if (quotaExhaustedInfo) {
        setMessage({
          type: 'error',
          text: 'Berkas poster berhasil disimpan. Karena kuota AI sedang habis, silakan isi formulir kajian di bawah secara manual.',
        })
      } else {
        handleScanPoster(file)
      }
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
      let currentUser: any = null
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        currentUser = user
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          currentUser = session.user
        }
      }

      if (!mounted) return
      if (!currentUser) {
        router.push('/login?next=/kontributor/dashboard')
        setLoading(false)
        return
      }

      setUser(currentUser)
      const [adminCheck, rInfo] = await Promise.all([
        checkIsAdmin(currentUser),
        getUserRoleAndStatus(currentUser),
      ])

      if (mounted) {
        setIsAdmin(adminCheck)
        setRoleInfo(rInfo)
        setLoading(false)
      }
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        const [adminCheck, rInfo] = await Promise.all([
          checkIsAdmin(session.user),
          getUserRoleAndStatus(session.user),
        ])
        if (mounted) {
          setIsAdmin(adminCheck)
          setRoleInfo(rInfo)
          setLoading(false)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  async function onSubmit(formData: FormData) {
    if (isSubmitting) return
    setIsSubmitting(true)
    setMessage(null)

    const submittedTitle = title.trim()
    const submittedSpeaker = speakerName.trim()
    const submittedVenue = venueName.trim()

    try {
      const res = await submitKajian(formData)
      setIsSubmitting(false)

      if (res.success) {
        setSubmittedData({
          sessionId: res.sessionId,
          title: submittedTitle,
          speakerName: submittedSpeaker,
          venueName: submittedVenue,
          isPending: !!res.isPending,
        })

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
        setMarkerPos({ lat: -6.200000, lng: 106.816666 })
        setStreamUrl('')
        setPosterUrl('')
        setAudience('umum')
        setMode('offline')
        setIsRecurring(false)
        handleClearPoster()
        formRef.current?.reset()

        setTimeout(() => setMessage(null), 10000)
      } else {
        setMessage({ type: 'error', text: res.error || 'Terjadi kesalahan saat memublikasikan.' })
        window.scrollTo({ top: 300, behavior: 'smooth' })
      }
    } catch (err: any) {
      setIsSubmitting(false)
      let errText = err?.message || 'Terjadi kesalahan sistem saat memproses kajian.'
      if (typeof errText === 'string' && errText.trim().startsWith('{')) {
        errText = 'Terjadi kesalahan sistem saat memproses kajian. Silakan coba beberapa saat lagi.'
      }
      setMessage({ type: 'error', text: errText })
      window.scrollTo({ top: 300, behavior: 'smooth' })
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

  if (!isAdmin && roleInfo?.role === 'user') {
    return (
      <div className="min-h-screen bg-surface p-3 sm:p-6 md:p-8 font-geist text-on-surface flex flex-col justify-between">
        <header className="max-w-4xl mx-auto w-full flex items-center justify-between gap-4 mb-6">
          <Link
            href="/peta"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors py-1.5 px-2 rounded-lg hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Kembali ke Peta</span>
          </Link>
          <Link
            href="/kontributor/profile"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors py-1.5 px-3 rounded-full hover:bg-surface-container border border-surface-container-high"
          >
            <span className="material-symbols-outlined text-[18px]">account_circle</span>
            <span>Profil Saya</span>
          </Link>
        </header>

        <div className="max-w-lg mx-auto w-full bg-surface-container-lowest border border-surface-container-high rounded-3xl p-6 sm:p-8 shadow-sm text-center my-auto">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <span className="material-symbols-outlined text-[32px]">volunteer_activism</span>
          </div>

          <h2 className="text-xl font-bold text-on-surface mb-2">Fitur Khusus Kontributor Dakwah</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
            Akun Anda saat ini terdaftar sebagai <strong>Jamaah (User Biasa)</strong>. Untuk dapat menambahkan jadwal kajian baru ke peta, silakan ajukan diri Anda sebagai <strong>Relawan Kontributor Dakwah</strong>.
          </p>

          {roleInfo.requestStatus === 'pending' ? (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-left mb-6">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Permohonan Anda Sedang Ditinjau Admin</span>
              </div>
              <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                {roleInfo.communityName ? `Masjid/Majelis: ${roleInfo.communityName}. ` : ''}Admin akan segera memverifikasi akun Anda. Begitu disetujui, Anda dapat langsung mengirim kajian di halaman ini.
              </p>
            </div>
          ) : roleInfo.requestStatus === 'rejected' ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-left mb-6">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-300 mb-1">
                <span className="material-symbols-outlined text-[16px] text-rose-600">info</span>
                <span>Permohonan Belum Disetujui</span>
              </div>
              <p className="text-[11px] text-rose-900/80 dark:text-rose-200/80 leading-relaxed mb-3">
                {roleInfo.requestNote ? `Catatan Admin: ${roleInfo.requestNote}` : 'Anda dapat memperbarui data komunitas dan mengajukan kembali.'}
              </p>
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(true)}
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
              >
                Ajukan Ulang Permohonan
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsRequestModalOpen(true)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2 cursor-pointer mb-3"
            >
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
              <span>Ajukan Menjadi Kontributor Dakwah</span>
            </button>
          )}

          <Link
            href="/peta"
            className="inline-flex items-center gap-1 text-xs font-semibold text-outline hover:text-on-surface transition-colors mt-2"
          >
            <span>Eksplorasi Peta Kajian</span>
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </Link>
        </div>

        <RequestContributorModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          onSuccess={async () => {
            if (user) {
              const rInfo = await getUserRoleAndStatus(user);
              setRoleInfo(rInfo);
            }
          }}
          userEmail={user.email}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-3 sm:p-6 md:p-8 font-geist text-on-surface">
      {/* Top Header */}
      <header className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <DynamicBackButton />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-on-surface">Dasbor Kontributor</h1>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Ahlan wa sahlan, <span className="font-semibold text-primary">{displayName}</span>
            </p>
            </div>
          </div>

          {/* Mobile Single Hamburger Button */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="sm:hidden w-9 h-9 rounded-xl bg-surface-container/80 hover:bg-surface-container-high border border-outline-variant/50 flex items-center justify-center text-on-surface shadow-2xs active:scale-95 transition-all cursor-pointer shrink-0 ml-3"
            aria-label="Buka Menu Navigasi"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-on-surface"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="14" y2="12" />
              <line x1="4" y1="18" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Desktop Navigation Pills */}
        <div className="hidden sm:flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 dark:bg-amber-950/50 border border-amber-500/30 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 dark:hover:bg-amber-900/60 dark:hover:text-amber-100 rounded-full text-xs font-semibold transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[17px] text-amber-600 dark:text-amber-400">admin_panel_settings</span>
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
            href="/peta"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-full text-xs font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[17px]">map</span>
            <span>Peta</span>
          </Link>
          <form action="/auth/signout" method="post">
            <button className="px-3 py-1.5 bg-error/10 text-error rounded-full text-xs font-medium hover:bg-error/20 transition-colors cursor-pointer">
              Keluar
            </button>
          </form>
        </div>
      </header>

      {/* Slide-over Mobile Sidebar Drawer */}
      <AppMenuBottomSheet
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentUser={{
          id: user?.id,
          name: displayName,
          email: user?.email,
          avatarUrl: avatarUrl,
          role: roleInfo?.role,
          requestStatus: roleInfo?.requestStatus,
        }}
        isAdmin={isAdmin}
      />

      <main className="max-w-4xl mx-auto flex flex-col gap-6">
        {/* ========================================================================= */}
        {/* FITUR BARU: AI POSTER SCANNER DROPZONE */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-surface-container-lowest to-surface-container-low border border-emerald-500/25 rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${
                quotaExhaustedInfo
                  ? 'bg-gradient-to-tr from-amber-600 to-amber-500 text-white'
                  : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white'
              }`}>
                <span className="material-symbols-outlined text-[22px]">
                  {quotaExhaustedInfo ? 'hourglass_empty' : 'auto_awesome'}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-on-surface">Pindai Poster dengan AI</h2>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white tracking-wider uppercase ${
                    quotaExhaustedInfo ? 'bg-amber-600' : 'bg-emerald-600'
                  }`}>
                    {quotaExhaustedInfo ? 'Kuota Habis' : 'Otomatis'}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  {quotaExhaustedInfo
                    ? 'Layanan pemindaian otomatis sedang istirahat. Anda tetap bisa melampirkan berkas poster & mengisi formulir di bawah secara manual.'
                    : 'Cukup unggah gambar/flyer kajian, AI akan mengekstrak data dan mengisi form di bawah secara otomatis!'}
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

          {/* Banner Notifikasi Kuota Habis & Panduan Manual */}
          {quotaExhaustedInfo && (
            <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 text-xs flex items-start gap-3">
              <span className="material-symbols-outlined text-[20px] text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                lock_clock
              </span>
              <div className="flex-1">
                <span className="font-bold block text-sm text-amber-900 dark:text-amber-300">
                  Batas Kuota Pemindaian AI Harian Tercapai
                </span>
                <p className="mt-1 leading-relaxed text-on-surface-variant text-[11px] sm:text-xs">
                  Batas kuota harian layanan pemindaian Gemini AI untuk publik telah tercapai.
                  {quotaExhaustedInfo.retryDelayText && (
                    <span className="font-semibold block my-1 text-amber-800 dark:text-amber-400">
                      Estimasi reset kuota: {quotaExhaustedInfo.retryDelayText}
                    </span>
                  )}
                  Poster Anda tetap tersimpan dan tidak hilang. Silakan lanjutkan pengisian formulir kajian di bawah secara manual.
                </p>
              </div>
            </div>
          )}

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
              <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xs transition-colors mt-1 text-white ${
                quotaExhaustedInfo ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}>
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
                  ) : quotaExhaustedInfo ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-medium mt-1.5 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">info</span>
                      <span>Poster tersimpan. Silakan lengkapi formulir kajian di bawah secara manual.</span>
                    </p>
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
                    disabled={isScanningAi || !!quotaExhaustedInfo}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      quotaExhaustedInfo
                        ? 'bg-surface-container-high text-on-surface-variant/70 cursor-not-allowed border border-surface-container-highest'
                        : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white'
                    }`}
                    title={quotaExhaustedInfo ? 'Pemindaian AI dinonaktifkan sementara karena kuota habis' : undefined}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isScanningAi ? 'progress_activity' : quotaExhaustedInfo ? 'lock' : 'refresh'}
                    </span>
                    <span>
                      {isScanningAi
                        ? 'Sedang Memindai...'
                        : quotaExhaustedInfo
                        ? 'Kuota AI Habis (Isi Manual)'
                        : 'Pindai Ulang dengan AI'}
                    </span>
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
              <span>
                {message.text?.trim().startsWith('{')
                  ? 'Layanan AI sedang mencapai batas kuota harian. Silakan lengkapi formulir kajian secara manual.'
                  : message.text}
              </span>
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
              <div className="border border-surface-container-high rounded-xl p-4 bg-surface-container-lowest animate-in fade-in slide-in-from-top-2 duration-300">
                <VenueLocationPicker
                  venueName={venueName}
                  onVenueNameChange={setVenueName}
                  markerPos={markerPos}
                  onMarkerPosChange={setMarkerPos}
                  required
                />
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

      {/* Blocking Full-Screen Loading Overlay saat Menerbitkan Kajian */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-container-high rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center relative">
              <span className="material-symbols-outlined text-[36px] animate-spin">
                progress_activity
              </span>
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping pointer-events-none"></div>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-on-surface">
                Sedang Menerbitkan Kajian...
              </h3>
              <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                Mohon tunggu sebentar, data kajian sedang divalidasi dan disinkronkan ke server.
              </p>
            </div>
            <div className="w-full bg-surface-container-low rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-600 h-full w-2/3 animate-[pulse_1.5s_infinite]"></div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Sukses Submit Kajian */}
      {submittedData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-container-high rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200 relative overflow-hidden">
            {/* Dekorasi Cahaya Sukses */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none"></div>

            {/* Ikon Sukses */}
            <div className="w-20 h-20 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 shadow-inner ring-8 ring-emerald-500/10">
              <span className="material-symbols-outlined text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>

            {/* Judul & Penjelasan Status */}
            <h3 className="text-lg sm:text-xl font-bold text-on-surface tracking-tight">
              {submittedData.isPending
                ? 'Alhamdulillah, Kajian Berhasil Dikirim!'
                : 'Alhamdulillah, Kajian Berhasil Diterbitkan!'}
            </h3>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-2 leading-relaxed max-w-sm">
              {submittedData.isPending ? (
                <span>
                  Jadwal kajian telah masuk ke <strong>antrean kurasi Admin</strong> untuk verifikasi singkat sebelum tayang di peta publik.
                </span>
              ) : (
                <span>
                  Jadwal kajian kini <strong>langsung aktif</strong> dan dapat ditemukan oleh jamaah di Peta Kajian.
                </span>
              )}
            </p>

            {/* Kotak Ringkasan Data Kajian yang Baru Disubmit */}
            <div className="w-full bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 my-5 text-left text-xs space-y-2">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">menu_book</span>
                <span className="font-semibold text-on-surface line-clamp-1">{submittedData.title || 'Kajian Rutin'}</span>
              </div>
              {submittedData.speakerName && (
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-outline shrink-0">record_voice_over</span>
                  <span className="truncate">{submittedData.speakerName}</span>
                </div>
              )}
              {submittedData.venueName && (
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-outline shrink-0">location_on</span>
                  <span className="truncate">{submittedData.venueName}</span>
                </div>
              )}
            </div>

            {/* Tombol Aksi */}
            <div className="w-full flex flex-col gap-2.5">
              <Link
                href={submittedData.sessionId ? `/peta?session=${submittedData.sessionId}` : '/peta'}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <span className="material-symbols-outlined text-[18px]">map</span>
                <span>Lihat di Peta Kajian</span>
              </Link>

              <button
                type="button"
                onClick={() => setSubmittedData(null)}
                className="w-full py-2.5 bg-surface-container-high hover:bg-surface-container-highest active:bg-surface-container text-on-surface font-semibold rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Tambah Kajian Lain</span>
              </button>

              <Link
                href="/kontributor/profile"
                className="text-[11px] text-outline hover:text-primary font-medium py-1 transition-colors"
              >
                Buka Riwayat Kontribusi Saya
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
