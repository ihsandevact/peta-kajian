/**
 * Global Feature Flags configuration
 */
export const FEATURE_FLAGS = {
  /**
   * Fitur Mode Belajar & Catatan Faidah di perangkat mobile (< 768px).
   * Default: false (disembunyikan sementara di mobile sampai optimasi UX selesai).
   * Ubah ke true untuk mengaktifkan kembali di layar mobile.
   */
  ENABLE_MOBILE_STUDY_NOTES: false,
} as const;
