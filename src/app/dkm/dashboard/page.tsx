import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/dkm/login')
  }

  return (
    <div className="min-h-screen bg-surface p-4 md:p-8">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Dasbor Panitia</h1>
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

          <form className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-on-surface">Judul Kajian / Tema <span className="text-error">*</span></span>
                <input type="text" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="Contoh: Fiqih Shalat" required />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-on-surface">Nama Ustadz / Pemateri <span className="text-error">*</span></span>
                <input type="text" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="Contoh: Ustadz Fulan, Lc." required />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-on-surface">Nama Kitab (Opsional)</span>
                <input type="text" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="Contoh: Bulughul Maram" />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-on-surface">Waktu Pelaksanaan <span className="text-error">*</span></span>
                <input type="datetime-local" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" required />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-on-surface">Nama Masjid / Lokasi <span className="text-error">*</span></span>
                <input type="text" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="Contoh: Masjid Nurul Iman Blok M" required />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-on-surface">URL Poster (Opsional)</span>
                <input type="url" className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="https://..." />
              </label>
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

            <label className="flex items-center gap-2 mt-2 cursor-pointer w-max">
              <input type="checkbox" name="is_recurring" className="w-4 h-4 rounded text-primary" />
              <span className="text-sm font-medium text-on-surface">Tandai sebagai Kajian Rutin Mingguan</span>
            </label>

            <div className="mt-6 flex justify-end">
              <button type="submit" className="px-6 py-2.5 bg-primary text-on-primary font-medium rounded-full hover:opacity-90 transition-opacity disabled:opacity-50">
                Terbitkan Kajian
              </button>
            </div>
          </form>

        </div>
      </main>
    </div>
  )
}
