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
    const venue_name = (formData.get('venue_name') as string || '').trim()
    const poster_url = formData.get('poster_url') as string || null
    const audience_type = formData.get('audience') as string
    const is_recurring = formData.get('is_recurring') === 'on'
    const recurring_pattern = is_recurring ? (formData.get('recurring_pattern') as string || null) : null

    // Mode kajian: offline | online | hybrid
    const modeRaw = formData.get('mode') as string
    const mode: 'offline' | 'online' | 'hybrid' =
      modeRaw === 'online' || modeRaw === 'hybrid' ? modeRaw : 'offline'
    const needsVenue = mode !== 'online'
    const is_online = mode !== 'offline'
    const stream_url = is_online ? ((formData.get('stream_url') as string || '').trim() || null) : null

    if (!title || !speaker_name) {
      return { success: false, error: 'Harap isi semua kolom yang wajib.' }
    }

    if (needsVenue && !venue_name) {
      return { success: false, error: 'Nama masjid / lokasi wajib diisi untuk kajian offline atau hybrid.' }
    }

    if (is_online) {
      if (!stream_url) {
        return { success: false, error: 'Link live streaming wajib diisi untuk kajian online atau hybrid.' }
      }
      try {
        const u = new URL(stream_url)
        if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error()
      } catch {
        return { success: false, error: 'Link live streaming tidak valid (harus diawali https://).' }
      }
    }
    
    if (!is_recurring && !start_datetime) {
      return { success: false, error: 'Waktu pelaksanaan wajib diisi untuk kajian non-rutin.' }
    }

    // 3 & 4. Venue (hanya untuk offline / hybrid)
    let venueId: string | null = null

    if (needsVenue) {
      const latStr = formData.get('lat') as string
      const lngStr = formData.get('lng') as string
      
      let lat = parseFloat(latStr)
      let lng = parseFloat(lngStr)
      let address = venue_name

      if (isNaN(lat) || isNaN(lng)) {
        // Fallback geocoding (kalau Javascript di browser mati)
        const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY
        if (!maptilerKey) {
          return { success: false, error: 'Koordinat lokasi gagal ditemukan.' }
        }
        const geoUrl = `https://api.maptiler.com/geocoding/${encodeURIComponent(venue_name)}.json?key=${maptilerKey}&bbox=95.0,-11.0,141.0,6.0&limit=1`
        const res = await fetch(geoUrl)
        const data = await res.json()
        
        if (data.features && data.features.length > 0) {
          lng = data.features[0].center[0]
          lat = data.features[0].center[1]
          address = data.features[0].place_name
        } else {
          return { success: false, error: 'Koordinat lokasi gagal ditemukan. Silakan pilih titik di peta.' }
        }
      }

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
    }

    // 5. Simpan Sesi Kajian
    const contributorName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Relawan Dakwah'

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
        is_online,
        stream_url,
        status: 'confirmed',
        created_by: user.id,
        contributor_name: contributorName
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
