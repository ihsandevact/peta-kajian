import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
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
    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocalEnv = process.env.NODE_ENV === 'development'
    
    let redirectUrl = `${origin}${next}`
    if (!isLocalEnv && forwardedHost) {
      redirectUrl = `https://${forwardedHost}${next}`
    }

    const response = NextResponse.redirect(redirectUrl)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              const cookieOpts = {
                ...options,
                path: '/',
                sameSite: 'lax' as const,
              }
              try {
                cookieStore.set(name, value, cookieOpts)
              } catch {}
              response.cookies.set(name, value, cookieOpts)
            })
          },
        },
      }
    )

    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        // Sinkronisasi otomatis ke user_roles agar tercatat di manajemen admin
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: existingRole } = await supabase
              .from('user_roles')
              .select('role, email')
              .eq('user_id', user.id)
              .maybeSingle();

            if (!existingRole) {
              await supabase.from('user_roles').insert({
                user_id: user.id,
                email: user.email,
                role: 'user',
                is_trusted: false,
                request_status: 'none',
              });
            } else if (!existingRole.email && user.email) {
              await supabase
                .from('user_roles')
                .update({ email: user.email })
                .eq('user_id', user.id);
            }
          }
        } catch (syncErr) {
          console.warn('Auto-sync user_roles warning:', syncErr);
        }

        // Hapus cookie peta_kajian_auth_next setelah dipakai
        response.cookies.delete('peta_kajian_auth_next')
        response.cookies.set('peta_kajian_auth_next', '', {
          path: '/',
          maxAge: 0,
          expires: new Date(0),
        })

        return response
      } else {
        console.error('Auth callback exchangeCodeForSession error:', error.message)
      }
    } catch (err) {
      console.error('Auth callback exception during exchangeCodeForSession:', err)
    }
  }

  // Jika gagal, kembalikan ke halaman login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
