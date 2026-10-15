'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { ADMIN_EMAILS } from '@/lib/services/admin'

function cleanNullableString(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'undefined' ||
    trimmed.toLowerCase() === '$undefined'
  ) {
    return null;
  }
  return trimmed;
}

export async function submitKajian(formData: FormData) {
  const supabase = await createClient()

  // 1. Verifikasi Autentikasi & Izin Role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Anda harus login untuk mempublikasikan kajian.' }
  }

  // Verifikasi role kontributor atau admin
  const isAdminByEmail = user.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim())
  let userRole = isAdminByEmail ? 'admin' : 'user'
  let isUserTrusted = !!isAdminByEmail

  try {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role, is_trusted')
      .eq('user_id', user.id)
      .maybeSingle()

    if (roleData) {
      userRole = isAdminByEmail ? 'admin' : (roleData.role || 'user')
      if (roleData.is_trusted) isUserTrusted = true
    } else {
      // Cek apakah user pernah punya riwayat session (legacy contributor)
      const { count } = await supabase
        .from('study_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id)
      if (count && count > 0) {
        userRole = 'kontributor'
      }
    }
  } catch {}

  if (userRole === 'user' && !isAdminByEmail) {
    return {
      success: false,
      error: 'Akses terbatas. Anda harus berstatus sebagai Relawan Kontributor Dakwah terverifikasi untuk mempublikasikan kajian. Silakan ajukan permohonan di profil Anda.'
    }
  }

  try {
    // 2. Ekstrak Data Formulir
    const title = (formData.get('title') as string || '').trim()
    const speaker_name = (formData.get('speaker_name') as string || '').trim()
    const book_title = cleanNullableString(formData.get('book_title'))
    const start_datetime_raw = formData.get('start_datetime') as string
    const start_datetime = start_datetime_raw ? start_datetime_raw : null
    const venue_name = (formData.get('venue_name') as string || '').trim()
    const poster_url = cleanNullableString(formData.get('poster_url'))
    const audience_type = formData.get('audience') as string
    const is_recurring = formData.get('is_recurring') === 'on' || formData.get('is_recurring') === 'true'
    const recurring_pattern = is_recurring ? (formData.get('recurring_pattern') as string || null) : null

    let recurring_rule: any = null
    const recurring_rule_raw = formData.get('recurring_rule') as string
    if (is_recurring && recurring_rule_raw) {
      try {
        recurring_rule = JSON.parse(recurring_rule_raw)
      } catch {
        recurring_rule = null
      }
    }

    // Mode kajian: offline | online | hybrid
    const modeRaw = formData.get('mode') as string
    const mode: 'offline' | 'online' | 'hybrid' =
      modeRaw === 'online' || modeRaw === 'hybrid' ? modeRaw : 'offline'
    const needsVenue = mode !== 'online'
    const is_online = mode !== 'offline'
    const stream_url = is_online ? cleanNullableString(formData.get('stream_url')) : null

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

    // 5. Cek apakah pengguna adalah Admin atau Trusted Contributor
    const isAutoPublish = isUserTrusted || userRole === 'admin';
    const initialStatus = isAutoPublish ? 'confirmed' : 'pending';
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
        recurring_rule,
        poster_url,
        is_online,
        stream_url,
        status: initialStatus,
        created_by: user.id,
        contributor_name: contributorName
      })

    if (sessionError) {
      console.error('Session Insert Error:', sessionError)
      return { success: false, error: 'Gagal menyimpan data kajian ke database.' }
    }

    // 6. Segarkan Cache Halaman Utama, Admin, dan Profil
    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath('/kontributor/profile')

    return { success: true, isPending: !isAutoPublish }
  } catch (err: any) {
    console.error('Submit Kajian Error:', err)
    return { success: false, error: 'Terjadi kesalahan sistem internal.' }
  }
}

export async function updateKajian(formData: FormData) {
  const supabase = await createClient()

  // 1. Verifikasi Autentikasi
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Anda harus login untuk mengedit kajian.' }
  }

  const sessionId = formData.get('session_id') as string
  if (!sessionId) {
    return { success: false, error: 'ID kajian tidak ditemukan.' }
  }

  try {
    // 2. Verifikasi Kepemilikan (hanya pembuat yang boleh edit)
    const { data: existingSession, error: checkError } = await supabase
      .from('study_sessions')
      .select('id, created_by, venue_id')
      .eq('id', sessionId)
      .single()

    if (checkError || !existingSession) {
      return { success: false, error: 'Data kajian tidak ditemukan.' }
    }

    if (existingSession.created_by && existingSession.created_by !== user.id) {
      return { success: false, error: 'Anda tidak memiliki izin untuk mengedit kajian ini.' }
    }

    // 3. Ekstrak Data Formulir
    const title = (formData.get('title') as string || '').trim()
    const speaker_name = (formData.get('speaker_name') as string || '').trim()
    const book_title = cleanNullableString(formData.get('book_title'))
    const start_datetime_raw = formData.get('start_datetime') as string
    const start_datetime = start_datetime_raw ? start_datetime_raw : null
    const venue_name = (formData.get('venue_name') as string || '').trim()
    const poster_url = cleanNullableString(formData.get('poster_url'))
    const audience_type = formData.get('audience') as string
    const is_recurring = formData.get('is_recurring') === 'on' || formData.get('is_recurring') === 'true'
    const recurring_pattern = is_recurring ? (formData.get('recurring_pattern') as string || null) : null
    const rawStatus = (formData.get('status') as string || 'confirmed') as 'confirmed' | 'pending' | 'rejected' | 'canceled' | 'postponed'
    // Jika kajian sebelumnya ditolak dan diedit ulang oleh relawan, kembalikan ke status 'pending' untuk direview kembali oleh admin
    const status = rawStatus === 'rejected' ? 'pending' : rawStatus

    let recurring_rule: any = null
    const recurring_rule_raw = formData.get('recurring_rule') as string
    if (is_recurring && recurring_rule_raw) {
      try {
        recurring_rule = JSON.parse(recurring_rule_raw)
      } catch {
        recurring_rule = null
      }
    }

    // Mode kajian: offline | online | hybrid
    const modeRaw = formData.get('mode') as string
    const mode: 'offline' | 'online' | 'hybrid' =
      modeRaw === 'online' || modeRaw === 'hybrid' ? modeRaw : 'offline'
    const needsVenue = mode !== 'online'
    const is_online = mode !== 'offline'
    const stream_url = is_online ? cleanNullableString(formData.get('stream_url')) : null

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

    // 4. Venue handling
    let venueId: string | null = null

    if (needsVenue) {
      const latStr = formData.get('lat') as string
      const lngStr = formData.get('lng') as string
      
      const lat = parseFloat(latStr)
      const lng = parseFloat(lngStr)

      if (!isNaN(lat) && !isNaN(lng)) {
        if (existingSession.venue_id) {
          // Update existing venue
          await supabase
            .from('venues')
            .update({
              name: venue_name,
              address: venue_name,
              location: `POINT(${lng} ${lat})`
            })
            .eq('id', existingSession.venue_id)
          venueId = existingSession.venue_id
        } else {
          // Create new venue
          venueId = crypto.randomUUID()
          await supabase
            .from('venues')
            .insert({
              id: venueId,
              name: venue_name,
              address: venue_name,
              location: `POINT(${lng} ${lat})`,
              facilities: {}
            })
        }
      } else {
        venueId = existingSession.venue_id
      }
    }

    // 5. Update study session record
    const { error: updateError } = await supabase
      .from('study_sessions')
      .update({
        venue_id: venueId,
        title,
        speaker_name,
        book_title,
        audience_type,
        start_datetime,
        is_recurring,
        recurring_pattern,
        recurring_rule,
        poster_url,
        is_online,
        stream_url,
        status,
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Update Kajian Error:', updateError)
      return { success: false, error: 'Gagal memperbarui data kajian di database.' }
    }

    revalidatePath('/')
    revalidatePath('/kontributor/profile')
    return { success: true }
  } catch (err: any) {
    console.error('Update Kajian Exception:', err)
    return { success: false, error: 'Terjadi kesalahan sistem saat memperbarui kajian.' }
  }
}

export async function deleteKajian(sessionId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Anda harus login untuk menghapus kajian.' }
  }

  try {
    const { data: session, error: checkError } = await supabase
      .from('study_sessions')
      .select('id, created_by')
      .eq('id', sessionId)
      .single()

    if (checkError || !session) {
      return { success: false, error: 'Kajian tidak ditemukan.' }
    }

    if (session.created_by && session.created_by !== user.id) {
      return { success: false, error: 'Anda tidak memiliki hak untuk menghapus kajian ini.' }
    }

    const { error: deleteError } = await supabase
      .from('study_sessions')
      .delete()
      .eq('id', sessionId)

    if (deleteError) {
      console.error('Delete Kajian Error:', deleteError)
      return { success: false, error: 'Gagal menghapus kajian dari database.' }
    }

    revalidatePath('/')
    revalidatePath('/kontributor/profile')
    return { success: true }
  } catch (err: any) {
    console.error('Delete Kajian Exception:', err)
    return { success: false, error: 'Terjadi kesalahan sistem saat menghapus kajian.' }
  }
}

/**
 * Mengajukan permohonan hak akses Relawan Kontributor Dakwah
 */
export async function requestContributorAccess(payload: {
  communityName?: string;
  whatsappNumber?: string;
  note?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Anda harus login terlebih dahulu.' };
  }

  try {
    const commName = cleanNullableString(payload.communityName);
    const waNumber = cleanNullableString(payload.whatsappNumber);
    const reqNote = cleanNullableString(payload.note);

    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const targetRole = (existingRole?.role && existingRole.role !== 'user')
      ? existingRole.role
      : 'user';

    const updatePayload: Record<string, any> = {
      user_id: user.id,
      role: targetRole,
      request_status: 'pending',
      community_name: commName,
      whatsapp_number: waNumber,
      request_note: reqNote,
      requested_at: new Date().toISOString(),
    };
    if (user.email) {
      updatePayload.email = user.email;
    }

    const { error } = await supabase
      .from('user_roles')
      .upsert(updatePayload, { onConflict: 'user_id' });

    if (error) {
      console.error('Request contributor access error:', error);
      return { success: false, error: error.message || 'Gagal mengirim permohonan kontributor. Silakan coba lagi.' };
    }

    revalidatePath('/kontributor/profile');
    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}

