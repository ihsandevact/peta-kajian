import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Update session & get response object + user
  const { supabaseResponse, user } = await updateSession(request)

  // Protect /kontributor/dashboard routes
  if (request.nextUrl.pathname.startsWith('/kontributor/dashboard')) {
    if (!user) {
      // Redirect to login page if no user
      const url = request.nextUrl.clone()
      url.pathname = '/kontributor/login'
      return NextResponse.redirect(url)
    }
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
