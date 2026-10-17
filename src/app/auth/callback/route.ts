import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const cookieStore = await cookies()
  const cookieNext = cookieStore.get('peta_kajian_auth_next')?.value

  // Prioritas 1: parameter query 'next'
  // Prioritas 2: cookie 'peta_kajian_auth_next'
  // Fallback: '/'
  const rawNext = searchParams.get('next') || (cookieNext ? decodeURIComponent(cookieNext) : null) || '/'
  // Cegah open-redirect: hanya izinkan path relatif internal
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      let redirectUrl = `${origin}${next}`
      if (!isLocalEnv && forwardedHost) {
        redirectUrl = `https://${forwardedHost}${next}`
      }

      const response = NextResponse.redirect(redirectUrl)
      
      // Hapus cookie peta_kajian_auth_next setelah dipakai
      response.cookies.delete('peta_kajian_auth_next')
      response.cookies.set('peta_kajian_auth_next', '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      })

      // Pastikan cookie auth tersalin utuh ke header Set-Cookie pada respons redirect
      cookieStore.getAll().forEach((cookie) => {
        if (cookie.name !== 'peta_kajian_auth_next') {
          response.cookies.set(cookie.name, cookie.value, {
            path: '/',
            sameSite: 'lax',
            secure: !isLocalEnv && !origin.includes('localhost'),
          })
        }
      })

      return response
    }
  }

  // Jika gagal, kembalikan ke halaman login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
