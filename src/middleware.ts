import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Update session & get response object + user
  const { supabaseResponse, user } = await updateSession(request)

  // Protect /kontributor/dashboard and /kontributor/profile routes
  const isProtectedPath =
    request.nextUrl.pathname.startsWith('/kontributor/dashboard') ||
    request.nextUrl.pathname.startsWith('/kontributor/profile')

  if (isProtectedPath && !user) {
    // Redirect to login page if no user
    const url = request.nextUrl.clone()
    url.pathname = '/kontributor/login'
    const redirectResponse = NextResponse.redirect(url)
    // Salin cookie yang mungkin telah diperbarui Supabase
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // Redirect to dashboard if logged-in user visits login page
  if (request.nextUrl.pathname === '/kontributor/login' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/kontributor/dashboard'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
