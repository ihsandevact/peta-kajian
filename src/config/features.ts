/**
 * Global Feature Flags configuration
 */
export const FEATURE_FLAGS = {
  /**
   * Fitur Mode Belajar & Catatan Faidah di perangkat mobile (< 768px).
   * Diaktifkan dengan UI Split Atas-Bawah ala YouTube (Video di atas, Catatan/Coret-Coret di bawah).
   */
  ENABLE_MOBILE_STUDY_NOTES: true,
} as const;
