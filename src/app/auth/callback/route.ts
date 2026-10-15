import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

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
      
      // Pastikan cookie auth tersalin utuh ke header Set-Cookie pada respons redirect
      const cookieStore = await cookies()
      cookieStore.getAll().forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, {
          path: '/',
          sameSite: 'lax',
          secure: !isLocalEnv && !origin.includes('localhost'),
        })
      })

      return response
    }
  }

  // Jika gagal, kembalikan ke halaman login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
