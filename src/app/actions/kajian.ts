'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitKajian(formData: FormData) {
  const supabase = await createClient()

  // 1. Verifikasi Autentikasi
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Anda harus login untuk mempublikasikan kajian.' }
  }

  try {
    // 2. Ekstrak Data Formulir
    const title = formData.get('title') as string
    const speaker_name = formData.get('speaker_name') as string
    const book_title = formData.get('book_title') as string || null
    const start_datetime_raw = formData.get('start_datetime') as string
    const start_datetime = start_datetime_raw ? start_datetime_raw : null
    const venue_name = formData.get('venue_name') as string
    const poster_url = formData.get('poster_url') as string || null
    const audience_type = formData.get('audience') as string
    const is_recurring = formData.get('is_recurring') === 'on'
    const recurring_pattern = is_recurring ? (formData.get('recurring_pattern') as string || null) : null

    if (!title || !speaker_name || !venue_name) {
      return { success: false, error: 'Harap isi semua kolom yang wajib.' }
    }
    
    if (!is_recurring && !start_datetime) {
      return { success: false, error: 'Waktu pelaksanaan wajib diisi untuk kajian non-rutin.' }
    }

    // 3. Geocoding Masjid (Mengubah nama menjadi koordinat)
    let lat = -6.200000 // Default fallback Jakarta
    let lng = 106.816666
    let address = venue_name

    const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY
    if (maptilerKey) {
      const geoUrl = `https://api.maptiler.com/geocoding/${encodeURIComponent(venue_name)}.json?key=${maptilerKey}&bbox=95.0,-11.0,141.0,6.0&limit=1`
      const res = await fetch(geoUrl)
      const data = await res.json()
      
      if (data.features && data.features.length > 0) {
        lng = data.features[0].center[0]
        lat = data.features[0].center[1]
        address = data.features[0].place_name
      }
    }

    // 4. Cari atau Buat Venue
    let venueId: string
    const { data: existingVenue } = await supabase
      .from('venues')
      .select('id')
      .ilike('name', `%${venue_name}%`)
      .limit(1)
      .maybeSingle()

    if (existingVenue) {
      venueId = existingVenue.id
    } else {
      venueId = crypto.randomUUID()
      const { error: venueError } = await supabase
        .from('venues')
        .insert({
          id: venueId,
          name: venue_name,
          address: address,
          location: `POINT(${lng} ${lat})`,
          facilities: {}
        })

      if (venueError) {
        console.error('Venue Insert Error:', venueError)
        return { success: false, error: 'Gagal mendaftarkan lokasi masjid baru.' }
      }
    }

    // 5. Simpan Sesi Kajian
    const { error: sessionError } = await supabase
      .from('study_sessions')
      .insert({
        id: crypto.randomUUID(),
        venue_id: venueId,
        title,
        speaker_name,
        book_title,
        audience_type,
        start_datetime,
        is_recurring,
        recurring_pattern,
        poster_url,
        status: 'confirmed'
      })

    if (sessionError) {
      console.error('Session Insert Error:', sessionError)
      return { success: false, error: 'Gagal menyimpan data kajian ke database.' }
    }

    // 6. Segarkan Cache Halaman Utama agar kajian langsung muncul di Peta!
    revalidatePath('/')

    return { success: true }
  } catch (err: any) {
    console.error('Submit Kajian Error:', err)
    return { success: false, error: 'Terjadi kesalahan sistem internal.' }
  }
}
