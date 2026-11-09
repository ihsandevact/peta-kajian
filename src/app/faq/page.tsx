'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { checkIsAdmin, getUserRoleAndStatus, type AppUserRole } from '@/lib/services/admin';
import MobileNavDrawer from '@/components/MobileNavDrawer';
import { useDebounce } from '@/lib/hooks/useDebounce';

type FAQCategory = 'all' | 'jamaah' | 'live' | 'relawan' | 'telegram' | 'akun';

interface FAQItem {
  id: string;
  category: 'jamaah' | 'live' | 'relawan' | 'telegram' | 'akun';
  question: string;
  categoryLabel: string;
  icon: string;
  answer: React.ReactNode;
}

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState<FAQCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 280);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({
    'apa-itu-peta-kajian': true, // Open by default for welcome
  });

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<AppUserRole>('user');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUser(data.user);
        checkIsAdmin(data.user).then(setIsAdmin).catch(() => setIsAdmin(false));
        getUserRoleAndStatus(data.user).then((info) => setUserRole(info.role)).catch(() => setUserRole('user'));
      } else {
        supabase.auth.getSession().then(({ data: sess }) => {
          if (sess?.session?.user) {
            setCurrentUser(sess.session.user);
            checkIsAdmin(sess.session.user).then(setIsAdmin).catch(() => setIsAdmin(false));
            getUserRoleAndStatus(sess.session.user).then((info) => setUserRole(info.role)).catch(() => setUserRole('user'));
          }
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
      if (session?.user) {
        checkIsAdmin(session.user).then(setIsAdmin).catch(() => setIsAdmin(false));
        getUserRoleAndStatus(session.user).then((info) => setUserRole(info.role)).catch(() => setUserRole('user'));
      } else {
        setIsAdmin(false);
        setUserRole('user');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const toggleAccordion = (id: string) => {
    setOpenIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const allOpen: Record<string, boolean> = {};
    faqList.forEach((item) => {
      allOpen[item.id] = true;
    });
    setOpenIds(allOpen);
  };

  const collapseAll = () => {
    setOpenIds({});
  };

  // Daftar Lengkap Pertanyaan & Jawaban
  const faqList: FAQItem[] = useMemo(
    () => [
      // Kategori: Umum & Jamaah
      {
        id: 'apa-itu-peta-kajian',
        category: 'jamaah',
        categoryLabel: 'Umum & Jamaah',
        icon: 'mosque',
        question: 'Apa itu Peta Kajian dan apakah aplikasi ini gratis?',
        answer: (
          <div className="space-y-2.5">
            <p>
              <strong>Peta Kajian</strong> adalah platform peta interaktif berbasis web untuk memudahkan kaum muslimin menemukan jadwal dan lokasi majelis ilmu (kajian Islam Ahlussunnah wal Jama&apos;ah) di seluruh Indonesia.
            </p>
            <p>
              Aplikasi ini <strong>100% gratis</strong>, tanpa biaya langganan, dan berlandaskan semangat <em>fastabiqul khairat</em> (berlomba-lomba dalam kebaikan) untuk menyebarkan syiar ilmu yang bermanfaat.
            </p>
          </div>
        ),
      },
      {
        id: 'cara-mencari-kajian',
        category: 'jamaah',
        categoryLabel: 'Umum & Jamaah',
        icon: 'my_location',
        question: 'Bagaimana cara mencari kajian di sekitar lokasi saya?',
        answer: (
          <div className="space-y-2.5">
            <p>Ada beberapa cara mudah untuk mencari kajian:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-on-surface-variant">
              <li>
                <strong>Aktifkan Akses Lokasi (GPS)</strong>: Browser Anda akan meminta izin lokasi saat pertama kali membuka web. Sistem akan otomatis menghitung jarak (km) dari posisi Anda ke setiap masjid penyelenggara kajian.
              </li>
              <li>
                <strong>Pilih Wilayah / Kota</strong>: Klik tombol <em>&quot;Pilih Wilayah / Kota&quot;</em> di atas daftar kajian untuk langsung melompat ke provinsi atau kota yang Anda inginkan (misal: Bandung, Jabodetabek, Surabaya, dll).
              </li>
              <li>
                <strong>Pencarian Cepat</strong>: Ketikkan nama ustadz (contoh: <em>&quot;Khalid Basalamah&quot;</em>), judul kitab, atau nama masjid pada kolom pencarian.
              </li>
              <li>
                <strong>Filter Waktu & Jamaah</strong>: Gunakan filter <em>Hari Ini</em>, <em>Besok</em>, <em>Akhir Pekan</em>, serta filter segmen <em>Umum</em>, <em>Ikhwan</em>, atau <em>Akhwat</em>.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'perbedaan-pin-peta',
        category: 'jamaah',
        categoryLabel: 'Umum & Jamaah',
        icon: 'pin_drop',
        question: 'Apa perbedaan pin dan tanda kajian di peta?',
        answer: (
          <div className="space-y-2.5">
            <p>Di peta utama, Anda akan menemukan beberapa jenis penanda:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-on-surface-variant">
              <li>
                <strong className="text-emerald-700 dark:text-emerald-300">Pin Hijau (Kajian Masjid / Offline)</strong>: Kajian diadakan langsung di lokasi fisik masjid atau gedung pertemuan. Mengklik pin akan membuka kartu info lengkap beserta tombol <strong>Rute Google Maps</strong> langsung ke lokasi.
              </li>
              <li>
                <strong className="text-primary font-bold">Kajian Hybrid (Pin Masjid + Badge Live)</strong>: Kajian diadakan di masjid fisik yang dapat dihadiri langsung, sekaligus menyertakan tautan siaran langsung online (YouTube Live) bagi jemaah yang menyimak dari rumah atau luar kota.
              </li>
              <li>
                <strong className="text-rose-600 dark:text-rose-400 font-bold">Pill Floating Live (Kajian Online Murni)</strong>: Untuk siaran langsung yang tidak memiliki lokasi fisik masjid, sistem menampilkannya melalui tombol floating <em>&quot;🔴 Tonton Live&quot;</em> di atas peta dan terpusat di halaman <Link href="/live" className="text-primary font-semibold hover:underline">/live</Link>.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'pengingat-kajian-notifikasi',
        category: 'jamaah',
        categoryLabel: 'Umum & Jamaah',
        icon: 'notifications_active',
        question: 'Apakah saya bisa mendapatkan pengingat sebelum kajian dimulai?',
        answer: (
          <div className="space-y-2.5">
            <p>
              <strong>Bisa.</strong> Peta Kajian dilengkapi fitur pengingat otomatis (Web Push Notification) yang dapat Anda aktifkan dengan mudah:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-on-surface-variant">
              <li>
                Buka kartu detail kajian yang ingin Anda hadiri di peta atau daftar kajian.
              </li>
              <li>
                Tekan tombol <strong>Lonceng Pengingat</strong> (&quot;Ingatkan Saya&quot;).
              </li>
              <li>
                Beri izin notifikasi pada peramban (browser) saat muncul permintaan izin (klik <em>Allow / Izinkan</em>).
              </li>
              <li>
                Sistem kami akan otomatis mengirimkan notifikasi pengingat ke perangkat Anda <strong>1 jam sebelum jadwal kajian dimulai</strong>.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'fitur-bookmark',
        category: 'jamaah',
        categoryLabel: 'Umum & Jamaah',
        icon: 'bookmark',
        question: 'Apa fungsi tombol "Simpan" (Bookmark)?',
        answer: (
          <div className="space-y-2">
            <p>
              Tombol <strong>Simpan (Bookmark)</strong> memungkinkan Anda menyimpan jadwal kajian pilihan ke daftar pribadi Anda.
            </p>
            <p>
              Semua kajian yang Anda simpan dapat dilihat kapan saja dengan memilih filter <strong>&quot;📌 Tersimpan&quot;</strong> pada halaman utama atau melalui menu <strong>Profil Saya</strong>. Data penyimpanan tersinkronisasi aman dengan akun login Anda.
            </p>
          </div>
        ),
      },
      {
        id: 'fitur-rsvp',
        category: 'jamaah',
        categoryLabel: 'Umum & Jamaah',
        icon: 'how_to_reg',
        question: 'Mengapa ada tombol "Saya Hadir" (RSVP Kehadiran)?',
        answer: (
          <div className="space-y-2.5">
            <p>
              Fitur <strong>RSVP (&quot;Saya Hadir&quot;)</strong> dirancang untuk membantu DKM masjid dan panitia kajian dalam memperkirakan jumlah jamaah yang akan datang.
            </p>
            <p>
              Dengan mengetahui estimasi kehadiran, panitia dapat mempersiapkan tempat sholat, kapasitas parkir, buku panduan kajian, maupun konsumsi buka puasa sunnah secara lebih optimal. Anda juga dapat membatalkan kehadiran kapan saja jika berhalangan.
            </p>
          </div>
        ),
      },
      {
        id: 'fitur-share',
        category: 'jamaah',
        categoryLabel: 'Umum & Jamaah',
        icon: 'share',
        question: 'Bagaimana cara membagikan info kajian ke keluarga atau grup WhatsApp?',
        answer: (
          <div className="space-y-2">
            <p>
              Klik tombol <strong>Bagikan</strong> pada kartu kajian pilihan Anda. Jendela modal akan menampilkan ringkasan info kajian lengkap yang siap dibagikan ke:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1 text-on-surface-variant">
              <li><strong>WhatsApp</strong> (otomatis menyusun teks pesan yang rapi beserta link ke peta)</li>
              <li><strong>Telegram</strong></li>
              <li><strong>Salin Link Langsung (*Deep Link*)</strong> yang akan langsung membuka popup kajian terkait di peta saat dibuka oleh penerima.</li>
            </ul>
          </div>
        ),
      },

      // Kategori: Live Streaming & YouTube
      {
        id: 'cara-menonton-live-streaming',
        category: 'live',
        categoryLabel: 'Live Streaming',
        icon: 'sensors',
        question: 'Bagaimana cara menonton kajian sunnah yang sedang berlangsung secara langsung (Live)?',
        answer: (
          <div className="space-y-2.5">
            <p>
              Anda dapat menyimak kajian yang sedang mengudara secara langsung melalui beberapa cara praktis:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-on-surface-variant">
              <li>
                Buka menu <Link href="/live" className="text-primary font-semibold hover:underline">🔴 Live Streaming (/live)</Link> melalui sidebar, drawer, atau header aplikasi untuk mengakses pemutar video interaktif serta daftar kanal dakwah yang sedang aktif siaran.
              </li>
              <li>
                Tekan tombol floating pill <strong>&quot;🔴 Tonton Live&quot;</strong> yang otomatis muncul di atas peta utama setiap kali terdeteksi ada channel kajian yang sedang mengudara.
              </li>
              <li>
                Sistem kami memantau puluhan kanal YouTube dakwah sunnah resmi secara otomatis setiap 10–15 menit, menyajikan judul tema dan pemateri secara terpadu tanpa perlu mencari satu per satu.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'kenapa-kajian-online-tidak-di-peta',
        category: 'live',
        categoryLabel: 'Live Streaming',
        icon: 'location_off',
        question: 'Mengapa saya tidak menemukan kajian online murni (tanpa masjid) di peta utama?',
        answer: (
          <div className="space-y-2.5">
            <p>
              Peta utama Peta Kajian difokuskan secara khusus untuk membantu jemaah menemukan <strong>lokasi fisik masjid atau gedung</strong> yang dapat dihadiri langsung (baik kajian offline murni maupun kajian hybrid yang diadakan di masjid sekaligus disiarkan online).
            </p>
            <p>
              Kebijakan ini dibuat agar peta tetap rapi, bersih, dan tidak memunculkan titik pin acak/fiktif di tengah laut atau lokasi koordinat semu. Seluruh siaran online murni telah dialihkan secara rapi ke halaman <Link href="/live" className="text-primary font-semibold hover:underline">Live Streaming (/live)</Link>.
            </p>
          </div>
        ),
      },

      // Kategori: Relawan & Kontributor
      {
        id: 'perbedaan-role',
        category: 'relawan',
        categoryLabel: 'Relawan & Kontributor',
        icon: 'badge',
        question: 'Apa perbedaan peran Jamaah (User), Kontributor (Relawan), dan Admin?',
        answer: (
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="p-3 rounded-2xl bg-surface-container border border-surface-container-high">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block mb-1">Jamaah (User)</span>
                <p className="text-[11px] text-outline">
                  Peran bawaan saat login. Dapat menyimpan kajian (bookmark), RSVP kehadiran, dan mengusulkan channel Telegram.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block mb-1">Relawan (Kontributor)</span>
                <p className="text-[11px] text-outline">
                  Akun yang telah diverifikasi. Dapat mempublikasikan jadwal kajian baru, mengunggah poster dengan AI scanner, dan mengelola kajian masjid binaannya.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-400 block mb-1">Administrator</span>
                <p className="text-[11px] text-outline">
                  Memoderasi jadwal kajian yang masuk, mengelola hak akses permohonan relawan, serta memvalidasi channel Telegram pemantauan scraper.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'cara-daftar-relawan',
        category: 'relawan',
        categoryLabel: 'Relawan & Kontributor',
        icon: 'volunteer_activism',
        question: 'Bagaimana cara mengajukan diri menjadi Relawan Kontributor Dakwah?',
        answer: (
          <div className="space-y-2.5">
            <p>Langkah pengajuan sangat mudah dan cepat:</p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1 text-on-surface-variant">
              <li>
                Login ke akun Anda melalui halaman <Link href="/login" className="text-primary font-semibold hover:underline">/login</Link>.
              </li>
              <li>
                Buka menu <strong>Profil Saya</strong> melalui sidebar atau tombol profil.
              </li>
              <li>
                Klik tombol <strong>&quot;Ajukan Jadi Kontributor&quot;</strong> pada kartu ajakan relawan.
              </li>
              <li>
                Masukkan nomor WhatsApp aktif Anda yang dapat dihubungi dan (opsional) nama masjid/komunitas kajian Anda.
              </li>
              <li>
                Klik <strong>Kirim Permohonan</strong>. Admin akan memverifikasi permohonan Anda. Setelah disetujui, akun Anda langsung memiliki akses untuk mengirimkan info kajian.
              </li>
            </ol>
          </div>
        ),
      },
      {
        id: 'cara-kirim-kajian',
        category: 'relawan',
        categoryLabel: 'Relawan & Kontributor',
        icon: 'add_circle',
        question: 'Bagaimana cara menambahkan info jadwal kajian baru?',
        answer: (
          <div className="space-y-2.5">
            <p>
              Setelah akun Anda disetujui menjadi Kontributor, tombol <strong>&quot;Kirim Info Kajian&quot;</strong> akan muncul di sidebar dan drawer aplikasi.
            </p>
            <p>Anda dapat mengisi data kajian secara manual atau menggunakan formulir cepat yang dilengkapi integrasi geocoding MapTiler untuk mencari koordinat masjid secara presisi di peta.</p>
          </div>
        ),
      },
      {
        id: 'ai-poster-scanner',
        category: 'relawan',
        categoryLabel: 'Relawan & Kontributor',
        icon: 'auto_awesome',
        question: 'Apa itu fitur AI Poster Scanner dan bagaimana cara kerjanya?',
        answer: (
          <div className="space-y-2">
            <p>
              <strong>AI Poster Scanner</strong> adalah fitur cerdas berbasis Google Gemini AI yang berada di halaman pengiriman kajian.
            </p>
            <p>
              Anda cukup mengunggah foto pamflet/poster kajian (format JPG, PNG, atau WEBP). AI akan otomatis membaca teks poster, mengekstrak nama pemateri (ustadz), tema kajian, tanggal, jam, nama masjid, hingga mendeteksi apakah kajian tersebut disiarkan secara live streaming. Semua kolom formulir akan terisi otomatis, sehingga Anda tinggal meninjau ulang dan menyimpannya.
            </p>
          </div>
        ),
      },
      {
        id: 'leaderboard-relawan',
        category: 'relawan',
        categoryLabel: 'Relawan & Kontributor',
        icon: 'workspace_premium',
        question: 'Apa itu Papan Peringkat (Leaderboard) Relawan?',
        answer: (
          <div className="space-y-2">
            <p>
              Halaman <Link href="/leaderboard" className="text-primary font-semibold hover:underline">Leaderboard</Link> adalah bentuk apresiasi dan transparansi bagi para relawan dakwah dan kanal komunitas yang paling aktif mempublikasikan jadwal kajian di berbagai kota.
            </p>
            <p>
              Setiap kajian yang Anda publikasikan dan disetujui akan menambah poin kontribusi Anda pada papan peringkat.
            </p>
          </div>
        ),
      },

      // Kategori: Data & Channel Telegram
      {
        id: 'sumber-data-kajian',
        category: 'telegram',
        categoryLabel: 'Channel Telegram & AI',
        icon: 'database',
        question: 'Dari mana saja sumber data jadwal kajian dan channel YouTube berasal?',
        answer: (
          <div className="space-y-2.5">
            <p>Data di Peta Kajian dihimpun secara terpadu melalui tiga pilar:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-on-surface-variant">
              <li>
                <strong>Kiriman Relawan Terverifikasi</strong>: Pengurus DKM, panitia taklim, dan relawan dakwah lokal yang memasukkan jadwal terkonfirmasi secara langsung.
              </li>
              <li>
                <strong>Bot AI Telegram Scraper</strong>: Bot cerdas kami menyadap poster dan pengumuman resmi dari kanal-kanal Telegram dakwah publik secara berkala, lalu mengekstrak data kajian menggunakan teknologi AI OCR.
              </li>
              <li>
                <strong>Sinkronisasi Otomatis YouTube Tracker</strong>: Channel YouTube dakwah resmi dipantau status live streaming-nya secara berkala. Link siaran dari postingan daring yang belum terdaftar juga otomatis diintegrasikan ke daftar pemantauan YouTube Tracker.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'usulkan-channel-telegram',
        category: 'telegram',
        categoryLabel: 'Channel Telegram & AI',
        icon: 'send',
        question: 'Bagaimana cara mengusulkan channel Telegram baru untuk dipantau bot AI?',
        answer: (
          <div className="space-y-2.5">
            <p>Jika kota atau majelis taklim Anda memiliki channel Telegram publik yang aktif membagikan pamflet kajian:</p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1 text-on-surface-variant">
              <li>Buka menu <strong>Profil Saya</strong>.</li>
              <li>Gulir ke kartu <strong>&quot;Usulan Channel Telegram&quot;</strong>.</li>
              <li>Klik tombol <strong>&quot;Usulkan Channel Baru&quot;</strong>.</li>
              <li>Masukkan username Telegram (contoh: <code>infokajianbdg</code> atau <code>@infokajianbdg</code>) dan nama komunitas.</li>
              <li>Admin akan meninjau kelayakan channel. Setelah disetujui, bot AI kami akan memantau channel tersebut secara berkala.</li>
            </ol>
          </div>
        ),
      },
      {
        id: 'verifikasi-channel',
        category: 'telegram',
        categoryLabel: 'Channel Telegram & AI',
        icon: 'timer',
        question: 'Berapa lama proses verifikasi usulan channel Telegram oleh Admin?',
        answer: (
          <div className="space-y-2">
            <p>
              Proses verifikasi oleh Admin biasanya membutuhkan waktu <strong>1x24 jam</strong>.
            </p>
            <p>
              Anda dapat memantau status usulan secara langsung pada halaman profil Anda (berstatus <em>Menunggu Review</em>, <em>Disetujui & Aktif Dipantau</em>, atau <em>Ditolak</em>).
            </p>
          </div>
        ),
      },
      {
        id: 'channel-ditolak',
        category: 'telegram',
        categoryLabel: 'Channel Telegram & AI',
        icon: 'cancel',
        question: 'Mengapa usulan channel Telegram bisa ditolak atau dinonaktifkan?',
        answer: (
          <div className="space-y-2.5">
            <p>Beberapa alasan channel Telegram tidak disetujui atau dijeda pemantauannya antara lain:</p>
            <ul className="list-disc list-inside space-y-1 pl-1 text-on-surface-variant">
              <li>Channel bersifat privat (tertutup) sehingga tidak dapat diakses publik oleh bot.</li>
              <li>Channel sudah tidak aktif membagikan jadwal kajian terbaru dalam waktu lama.</li>
              <li>Konten channel bukan seputar kajian Islam Ahlussunnah wal Jama&apos;ah.</li>
              <li>Admin mencantumkan alasan penolakan secara transparan yang dapat Anda baca di riwayat profil Anda.</li>
            </ul>
          </div>
        ),
      },

      // Kategori: Akun & Bantuan
      {
        id: 'apakah-wajib-login',
        category: 'akun',
        categoryLabel: 'Akun & Teknis',
        icon: 'lock_open',
        question: 'Apakah saya wajib login untuk melihat peta kajian?',
        answer: (
          <div className="space-y-2">
            <p>
              <strong>Tidak wajib.</strong> Seluruh informasi peta, rute masjid, jadwal, dan pencarian kajian terbuka bebas untuk siapa saja tanpa perlu mendaftar atau login.
            </p>
            <p>
              Login menggunakan Akun Google hanya diperlukan jika Anda ingin: (1) Menyimpan kajian favorit (Bookmark), (2) Menandai RSVP &quot;Saya Hadir&quot;, (3) Mengusulkan channel Telegram baru, atau (4) Mendaftar sebagai relawan kontributor dakwah.
            </p>
          </div>
        ),
      },
      {
        id: 'cara-install-pwa',
        category: 'akun',
        categoryLabel: 'Akun & Teknis',
        icon: 'install_mobile',
        question: 'Apakah Peta Kajian dapat diinstal sebagai aplikasi di smartphone (PWA)?',
        answer: (
          <div className="space-y-2.5">
            <p>
              <strong>Bisa.</strong> Peta Kajian dibuat dengan standar Progressive Web App (PWA) modern, sehingga dapat diinstal layaknya aplikasi smartphone tanpa perlu mengunduh puluhan MB dari Google Play Store atau Apple App Store:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-on-surface-variant">
              <li>
                <strong>Android (Chrome / Edge / Samsung Internet)</strong>: Buka web Peta Kajian, tekan ikon titik tiga di pojok kanan atas peramban, lalu pilih <strong>&quot;Instal Aplikasi&quot;</strong> atau <strong>&quot;Tambahkan ke Layar Utama&quot;</strong>.
              </li>
              <li>
                <strong>iOS / iPhone (Safari)</strong>: Buka web Peta Kajian di Safari, tekan tombol <strong>Share</strong> (ikon kotak dengan panah ke atas) di bilah bawah, lalu pilih <strong>&quot;Add to Home Screen&quot; (Tambah ke Layar Utama)</strong>.
              </li>
              <li>
                <strong>Komputer / Laptop (Chrome / Edge)</strong>: Klik ikon instal (komputer dengan panah bawah) di sebelah kanan address bar peramban.
              </li>
            </ul>
            <p className="text-xs text-outline">
              Aplikasi PWA Peta Kajian berukuran sangat ringan (&lt; 2 MB), memuat instan, mendukung offline cache untuk melihat kajian tersimpan saat sinyal lemah, dan dapat menerima notifikasi pengingat langsung ke perangkat Anda.
            </p>
          </div>
        ),
      },
      {
        id: 'keamanan-data',
        category: 'akun',
        categoryLabel: 'Akun & Teknis',
        icon: 'security',
        question: 'Bagaimana sistem keamanan akun dan data pengguna?',
        answer: (
          <div className="space-y-2">
            <p>
              Peta Kajian menggunakan autentikasi resmi <strong>Google OAuth</strong> yang terenkripsi dan dikelola oleh infrastruktur Supabase Auth.
            </p>
            <p>
              Kami tidak pernah meminta atau menyimpan kata sandi (password) Anda. Data profil Anda hanya digunakan untuk menampilkan nama kontributor dan mengelola jadwal yang Anda simpan.
            </p>
          </div>
        ),
      },
      {
        id: 'kajian-keliru',
        category: 'akun',
        categoryLabel: 'Akun & Teknis',
        icon: 'report_problem',
        question: 'Bagaimana jika menemukan informasi kajian yang keliru atau dibatalkan?',
        answer: (
          <div className="space-y-2">
            <p>
              Kajian dapat mengalami perubahan jadwal atau pembatalan mendadak karena uzur syar&apos;i dari pemateri atau kendala tempat.
            </p>
            <p>
              Jika Anda menemukan kekeliruan data, Anda dapat menghubungi penyelenggara yang tertera pada pamflet poster, atau mengirimkan koreksi melalui kontak relawan/admin agar jadwal segera diperbarui atau dihapus dari sistem.
            </p>
          </div>
        ),
      },
      {
        id: 'dukung-peta-kajian',
        category: 'akun',
        categoryLabel: 'Akun & Teknis',
        icon: 'favorite',
        question: 'Bagaimana cara mendukung kelangsungan proyek Peta Kajian?',
        answer: (
          <div className="space-y-2.5">
            <p>
              Dukungan terbaik Anda adalah dengan cara:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1 text-on-surface-variant">
              <li>Mendoakan keberkahan dakwah ini dan para asatidzah serta relawan yang berjuang.</li>
              <li>Mendaftarkan diri sebagai <Link href="/login" className="text-primary font-semibold hover:underline">Relawan Kontributor</Link> untuk menginput kajian masjid di wilayah Anda.</li>
              <li>Mengusulkan channel Telegram resmi majelis taklim di kota Anda.</li>
              <li>Membagikan tautan <strong>Peta Kajian</strong> kepada sahabat, keluarga, dan grup kajian Anda.</li>
            </ul>
          </div>
        ),
      },
    ],
    []
  );

  // Filter FAQ berdasarkan kategori dan teks pencarian
  const filteredFAQs = useMemo(() => {
    return faqList.filter((item) => {
      // Filter kategori
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }

      // Filter query pencarian (debounced 280ms)
      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.toLowerCase();
        const matchQuestion = item.question.toLowerCase().includes(q);
        const matchCategory = item.categoryLabel.toLowerCase().includes(q);
        return matchQuestion || matchCategory;
      }

      return true;
    });
  }, [faqList, activeCategory, debouncedSearchQuery]);

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-geist selection:bg-primary-container selection:text-on-primary-container flex flex-col">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-high/60 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png?v=3"
              alt="Peta Kajian Logo"
              className="w-10 h-10 rounded-xl object-contain shrink-0 transition-transform group-hover:scale-105"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm sm:text-base text-on-surface">Peta Kajian</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
                  FAQ
                </span>
              </div>
              <p className="text-[11px] text-outline hidden sm:block">Pusat Bantuan & Panduan Pengguna</p>
            </div>
          </Link>

          {/* Desktop Right Links */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">home</span>
              <span>Beranda</span>
            </Link>

            <Link
              href="/peta"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">map</span>
              <span>Peta Kajian</span>
            </Link>

            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-amber-600 hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] text-amber-500">workspace_premium</span>
              <span>Leaderboard</span>
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-950/40 dark:hover:text-purple-200 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">shield</span>
                <span>Admin</span>
              </Link>
            )}

            {currentUser ? (
              <Link
                href="/kontributor/profile"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-surface-container hover:bg-surface-container-high transition-colors ml-2"
              >
                <span className="material-symbols-outlined text-[18px]">account_circle</span>
                <span className="max-w-[120px] truncate">
                  {currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Profil'}
                </span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-xs ml-2"
              >
                <span className="material-symbols-outlined text-[16px]">login</span>
                <span>Masuk</span>
              </Link>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="md:hidden w-9 h-9 rounded-xl bg-surface-container border border-surface-container-high flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            aria-label="Buka Menu"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:py-12 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3 relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-1">
            <span className="material-symbols-outlined text-[16px]">quiz</span>
            <span>Pusat Bantuan & Panduan</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
            Pertanyaan yang Sering Diajukan
          </h1>

          <p className="text-xs sm:text-base text-outline max-w-2xl mx-auto leading-relaxed">
            Semua hal yang perlu Anda ketahui tentang Peta Kajian — mulai dari mencari jadwal terdekat, menandai kehadiran, hingga cara berpartisipasi menjadi relawan dakwah.
          </p>

          {/* Live Search Bar */}
          <div className="pt-4 max-w-xl mx-auto">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari topik (contoh: relawan, rsvp, telegram, rute)..."
                className="w-full pl-11 pr-10 py-3 text-xs sm:text-sm rounded-2xl bg-surface-container border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface placeholder:text-outline/70 shadow-sm transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category Filter Pills & Expand/Collapse Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-surface-container-high/60 pb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-primary text-white dark:bg-emerald-600 dark:text-white shadow-xs'
                  : 'bg-surface-container text-outline hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              Semua ({faqList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('jamaah')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                activeCategory === 'jamaah'
                  ? 'bg-primary text-white dark:bg-emerald-600 dark:text-white shadow-xs'
                  : 'bg-surface-container text-outline hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">mosque</span>
              <span>Umum & Jamaah</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('live')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                activeCategory === 'live'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-surface-container text-outline hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">sensors</span>
              <span>Live Streaming</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('relawan')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                activeCategory === 'relawan'
                  ? 'bg-primary text-white dark:bg-emerald-600 dark:text-white shadow-xs'
                  : 'bg-surface-container text-outline hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">volunteer_activism</span>
              <span>Relawan & Kontributor</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('telegram')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                activeCategory === 'telegram'
                  ? 'bg-primary text-white dark:bg-emerald-600 dark:text-white shadow-xs'
                  : 'bg-surface-container text-outline hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">send</span>
              <span>Channel Telegram & AI</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('akun')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                activeCategory === 'akun'
                  ? 'bg-primary text-white dark:bg-emerald-600 dark:text-white shadow-xs'
                  : 'bg-surface-container text-outline hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">security</span>
              <span>Akun & Teknis</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={expandAll}
              className="text-[11px] font-semibold text-outline hover:text-primary transition-colors cursor-pointer"
            >
              Buka Semua
            </button>
            <span className="text-outline text-xs">•</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-[11px] font-semibold text-outline hover:text-primary transition-colors cursor-pointer"
            >
              Tutup Semua
            </button>
          </div>
        </div>

        {/* Accordion FAQ Items */}
        <div className="space-y-3">
          {filteredFAQs.length === 0 ? (
            <div className="py-12 px-4 rounded-3xl bg-surface-container/30 border border-surface-container-high/60 text-center space-y-3">
              <span className="material-symbols-outlined text-[40px] text-outline">search_off</span>
              <p className="text-sm font-bold text-on-surface">Tidak ada pertanyaan yang sesuai</p>
              <p className="text-xs text-outline max-w-sm mx-auto">
                Pertanyaan dengan kata kunci &quot;{searchQuery}&quot; tidak ditemukan. Coba gunakan kata kunci lain atau reset filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                }}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                <span>Reset Pencarian</span>
              </button>
            </div>
          ) : (
            filteredFAQs.map((item) => {
              const isOpen = !!openIds[item.id];
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? 'bg-surface-container-lowest border-primary/30 shadow-sm'
                      : 'bg-surface-container-lowest/80 border-surface-container-high/70 hover:border-surface-container-high hover:bg-surface-container-lowest'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleAccordion(item.id)}
                    className="w-full p-4 sm:p-5 text-left flex items-start sm:items-center justify-between gap-3 cursor-pointer select-none"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isOpen
                            ? 'bg-primary text-white dark:bg-emerald-600 dark:text-white'
                            : 'bg-surface-container text-outline'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                      </span>
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-outline block mb-0.5">
                          {item.categoryLabel}
                        </span>
                        <h2 className="font-bold text-sm sm:text-base text-on-surface leading-snug">
                          {item.question}
                        </h2>
                      </div>
                    </div>

                    <span
                      className={`material-symbols-outlined text-[20px] text-outline shrink-0 transition-transform duration-200 mt-1 sm:mt-0 ${
                        isOpen ? 'rotate-180 text-primary dark:text-emerald-400' : ''
                      }`}
                    >
                      expand_more
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-5 pt-1 text-xs sm:text-sm text-on-surface-variant border-t border-surface-container-high/40 leading-relaxed animate-in fade-in duration-200">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Bottom CTA Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-primary/10 via-emerald-500/10 to-sky-500/10 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
          <div className="space-y-1.5 max-w-xl">
            <h2 className="text-base sm:text-lg font-extrabold text-on-surface">
              Belum Menemukan Jawaban yang Anda Cari?
            </h2>
            <p className="text-xs sm:text-sm text-outline leading-relaxed">
              Tim kami selalu siap membantu. Anda juga dapat langsung menjelajahi peta untuk mencari majelis ilmu terdekat di sekitar Anda.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-center">
            <Link
              href="/peta"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-primary hover:bg-primary/90 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:text-white shadow-xs transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">map</span>
              <span>Buka Peta Kajian</span>
            </Link>

            {!currentUser && (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                <span>Masuk Akun</span>
              </Link>
            )}
          </div>
        </div>
      </main>

      {/* Slide-over Mobile Navigation Drawer */}
      <MobileNavDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentUser={
          currentUser
            ? {
                name: currentUser.user_metadata?.full_name || null,
                email: currentUser.email || null,
                avatarUrl: currentUser.user_metadata?.avatar_url || null,
              }
            : null
        }
        isAdmin={isAdmin}
      />
    </div>
  );
}
