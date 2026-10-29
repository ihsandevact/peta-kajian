import { createClient } from '@/utils/supabase/client';

export interface SketchPoint {
  x: number;
  y: number;
}

export interface SketchStroke {
  id: string;
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;
  size: number;
  points: SketchPoint[];
}

export interface StudyNote {
  id?: string;
  user_id: string;
  video_id: string;
  session_id?: string | null;
  title: string;
  speaker_name?: string | null;
  channel_name?: string | null;
  content: string;
  created_at?: string;
  updated_at?: string;
}

const LOCAL_BACKUP_PREFIX = 'peta_kajian_note_draft_';
const LOCAL_SKETCH_PREFIX = 'peta_kajian_note_sketch_';
const PENDING_STUDY_SESSION_KEY = 'peta_kajian_pending_study_session';
const SKETCH_METADATA_REGEX = /\n*<!--PK_SKETCH_DATA:([\s\S]*?)-->\s*$/;

/**
 * Pisahkan teks catatan murni dengan metadata coretan (sketch) yang disematkan
 */
export function decodeNoteWithSketch(rawContent: string): {
  textContent: string;
  strokes: SketchStroke[] | null;
} {
  if (!rawContent) {
    return { textContent: '', strokes: null };
  }
  const match = rawContent.match(SKETCH_METADATA_REGEX);
  if (!match) {
    return { textContent: rawContent, strokes: null };
  }
  const cleanText = rawContent.replace(SKETCH_METADATA_REGEX, '');
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) {
      return { textContent: cleanText, strokes: parsed };
    }
  } catch {
    // Abaikan jika gagal parse
  }
  return { textContent: cleanText, strokes: null };
}

/**
 * Gabungkan teks catatan dengan metadata coretan untuk disimpan ke database
 */
export function encodeNoteWithSketch(textContent: string, strokes: SketchStroke[]): string {
  const cleanText = textContent.replace(SKETCH_METADATA_REGEX, '');
  if (!strokes || strokes.length === 0) {
    return cleanText;
  }
  try {
    return `${cleanText}\n\n<!--PK_SKETCH_DATA:${JSON.stringify(strokes)}-->`;
  } catch {
    return cleanText;
  }
}

/**
 * Bersihkan metadata coretan dari teks catatan untuk tampilan UI / WhatsApp
 */
export function stripSketchMetadata(rawContent: string): string {
  if (!rawContent) return '';
  return rawContent.replace(SKETCH_METADATA_REGEX, '');
}

/**
 * Simpan data coretan (sketch) ke localStorage
 */
export function setLocalSketchData(videoId: string, strokes: SketchStroke[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (!strokes || strokes.length === 0) {
      localStorage.removeItem(`${LOCAL_SKETCH_PREFIX}${videoId}`);
    } else {
      localStorage.setItem(`${LOCAL_SKETCH_PREFIX}${videoId}`, JSON.stringify(strokes));
    }
  } catch (err) {
    console.warn('Gagal menyimpan data coretan lokal:', err);
  }
}

/**
 * Ambil data coretan (sketch) dari localStorage
 */
export function getLocalSketchData(videoId: string): SketchStroke[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_SKETCH_PREFIX}${videoId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Simpan draft ke localStorage sebagai proteksi instan jika koneksi bermasalah
 */
export function setLocalDraftNote(videoId: string, content: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${LOCAL_BACKUP_PREFIX}${videoId}`, content);
  } catch (err) {
    console.warn('Gagal menyimpan draft note lokal:', err);
  }
}

/**
 * Ambil draft note dari localStorage
 */
export function getLocalDraftNote(videoId: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(`${LOCAL_BACKUP_PREFIX}${videoId}`) || '';
  } catch {
    return '';
  }
}

/**
 * Hapus draft note lokal setelah berhasil disimpan penuh
 */
export function clearLocalDraftNote(videoId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${LOCAL_BACKUP_PREFIX}${videoId}`);
  } catch {
    // Abaikan
  }
}

/**
 * Simpan data sesi kajian tertunda sebelum redirect ke login Google
 */
export interface PendingStudySession {
  videoId: string;
  title: string;
  speakerName?: string;
  channelName?: string;
  sessionId?: string;
}

export function setPendingStudySession(session: PendingStudySession): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PENDING_STUDY_SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('Gagal menyimpan sesi kajian tertunda:', err);
  }
}

export function getPendingStudySession(): PendingStudySession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_STUDY_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingStudySession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_STUDY_SESSION_KEY);
  } catch {
    // Abaikan
  }
}

function getErrorMessage(error: any): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  return error.message || error.details || error.hint || error.code || JSON.stringify(error);
}

/**
 * Ambil seluruh catatan milik pengguna untuk halaman profil / buku saku
 */
export async function fetchUserStudyNotes(userId: string): Promise<StudyNote[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('user_study_notes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        console.warn(
          '[Mode Belajar] Tabel "user_study_notes" belum dibuat di Supabase. Jalankan migrasi 20261017_study_notes.sql di SQL Editor Supabase.'
        );
      } else {
        console.warn('Gagal memuat daftar catatan kajian:', getErrorMessage(error));
      }
      return [];
    }

    const notes = (data as StudyNote[]) || [];
    return notes.map((n) => {
      const { textContent, strokes } = decodeNoteWithSketch(n.content);
      if (strokes && strokes.length > 0 && n.video_id) {
        setLocalSketchData(n.video_id, strokes);
      }
      return {
        ...n,
        content: textContent,
      };
    });
  } catch (err) {
    console.warn('Unexpected error fetchUserStudyNotes:', err);
    return [];
  }
}

/**
 * Ambil catatan untuk video kajian tertentu
 */
export async function fetchStudyNoteByVideo(
  userId: string,
  videoId: string
): Promise<StudyNote | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('user_study_notes')
      .select('*')
      .eq('user_id', userId)
      .eq('video_id', videoId)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01') {
        console.warn(
          '[Mode Belajar] Tabel "user_study_notes" belum ada di Supabase. Menggunakan penyimpanan lokal sementara. Silakan jalankan migrasi 20261017_study_notes.sql di SQL Editor.'
        );
      } else {
        console.warn('Gagal memuat catatan kajian dari Supabase:', getErrorMessage(error));
      }
      return null;
    }

    return (data as StudyNote) || null;
  } catch (err) {
    console.warn('Unexpected error fetchStudyNoteByVideo:', err);
    return null;
  }
}

/**
 * Simpan atau perbarui catatan kajian ke cloud Supabase
 */
export async function upsertStudyNote(
  note: Omit<StudyNote, 'id' | 'created_at' | 'updated_at'>
): Promise<StudyNote | null> {
  try {
    const supabase = createClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('user_study_notes')
      .upsert(
        {
          user_id: note.user_id,
          video_id: note.video_id,
          session_id: note.session_id || null,
          title: note.title,
          speaker_name: note.speaker_name || null,
          channel_name: note.channel_name || null,
          content: note.content,
          updated_at: now,
        },
        { onConflict: 'user_id,video_id' }
      )
      .select('*')
      .single();

    if (error) {
      if (error.code === '42P01') {
        console.warn(
          '[Mode Belajar] Tabel "user_study_notes" belum dibuat di Supabase. Catatan berhasil diamankan di localStorage.'
        );
      } else {
        console.warn('Gagal menyimpan catatan ke Supabase:', getErrorMessage(error));
      }
      // Simpan backup lokal jika database gagal/offline
      setLocalDraftNote(note.video_id, note.content);
      return null;
    }

    // Bersihkan draft lokal jika berhasil sinkron
    clearLocalDraftNote(note.video_id);
    return data as StudyNote;
  } catch (err) {
    console.warn('Unexpected error upsertStudyNote:', err);
    setLocalDraftNote(note.video_id, note.content);
    return null;
  }
}

/**
 * Hapus catatan kajian
 */
export async function deleteStudyNote(userId: string, noteId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('user_study_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId);

    if (error) {
      console.warn('Gagal menghapus catatan:', getErrorMessage(error));
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Unexpected error deleteStudyNote:', err);
    return false;
  }
}

/**
 * Helper untuk mendapatkan URL video YouTube ringkas
 */
export function getYouTubeVideoUrl(videoId: string): string {
  return `https://youtu.be/${videoId}`;
}

/**
 * Generator format pesan WhatsApp yang rapi dan terstruktur
 */
export function formatNoteForWhatsApp(note: {
  title: string;
  speaker_name?: string | null;
  channel_name?: string | null;
  video_id?: string | null;
  content: string;
}): string {
  const dateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const divider = '━━━━━━━━━━━━━━━━━━━━';
  const speakerLine = note.speaker_name ? `🎙️ *Pemateri:* ${note.speaker_name}\n` : '';
  const channelLine = note.channel_name ? `📺 *Kanal/Sumber:* ${note.channel_name}\n` : '';
  const videoLine = note.video_id ? `🔗 *Tautan Rekaman:* https://youtu.be/${note.video_id}\n` : '';
  const cleanContent = stripSketchMetadata(note.content).trim();

  return (
    `📝 *CATATAN FAIDAH KAJIAN*\n` +
    `${divider}\n` +
    `📖 *Tema:* ${note.title}\n` +
    speakerLine +
    channelLine +
    videoLine +
    `📅 *Tanggal:* ${dateStr}\n` +
    `${divider}\n\n` +
    `${cleanContent}\n\n` +
    `${divider}\n` +
    `_Dicatat melalui Mode Belajar — Peta Kajian Sunnah_`
  );
}
