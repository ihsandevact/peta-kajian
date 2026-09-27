import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Sign out
  await supabase.auth.signOut()

  return NextResponse.redirect(new URL('/kontributor/login', request.url))
}
