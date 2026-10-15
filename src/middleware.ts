import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Update session & get response object + user
  const { supabaseResponse, user } = await updateSession(request)

  // Protect /admin routes (Admin only)
  const isAdminPath = request.nextUrl.pathname.startsWith('/admin')
  if (isAdminPath) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', '/admin')
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      return redirectResponse
    }

    const ADMIN_EMAILS = ['dev.ihsan.act@gmail.com']
    const isAdminEmail = user.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim())

    if (!isAdminEmail) {
      const url = request.nextUrl.clone()
      url.pathname = '/kontributor/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Protect /kontributor/dashboard and /kontributor/profile routes
  const isProtectedPath =
    request.nextUrl.pathname.startsWith('/kontributor/dashboard') ||
    request.nextUrl.pathname.startsWith('/kontributor/profile')

  if (isProtectedPath && !user) {
    // Redirect to login page if no user
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    const redirectResponse = NextResponse.redirect(url)
    // Salin cookie yang mungkin telah diperbarui Supabase
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // Redirect if logged-in user visits login page
  if ((request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/kontributor/login') && user) {
    const targetNext = request.nextUrl.searchParams.get('next') || '/'
    const url = new URL(targetNext, request.nextUrl.origin)
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
