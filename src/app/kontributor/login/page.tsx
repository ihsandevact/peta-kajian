'use client'

import { createClient } from '@/utils/supabase/client'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    const supabase = createClient()
    
    // Gunakan window.location.origin agar callback kembali ke domain yang benar
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      console.error('Error logging in:', error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface-container-lowest rounded-3xl p-8 shadow-xl border border-surface-container-high/50 text-center">
        <div className="w-16 h-16 bg-primary-container rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
          <span className="material-symbols-outlined text-[32px] text-on-primary-container">mosque</span>
        </div>
        
        <h1 className="text-2xl font-bold text-on-surface mb-2 tracking-tight">Portal Kontributor</h1>
        <p className="text-sm text-on-surface-variant mb-8">
          Bantu umat menemukan majelis ilmu. Masuk sebagai relawan untuk mempublikasikan jadwal kajian ke seluruh Indonesia.
        </p>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full h-12 bg-surface-container flex items-center justify-center gap-3 rounded-full hover:bg-surface-container-high transition-all border border-outline-variant disabled:opacity-50"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google Logo" />
          <span className="font-semibold text-on-surface text-sm">
            {loading ? 'Memproses...' : 'Lanjutkan dengan Google'}
          </span>
        </button>

        <p className="text-[11px] text-outline mt-8">
          Terbuka untuk seluruh jamaah dan relawan majelis ilmu.
        </p>
      </div>
    </div>
  )
}
