/**
 * Konfigurasi Jaringan Iklan / In-Page Rewarded Ads
 * Provider: Monetag (PropellerAds)
 * Format Utama: In-Page Push Banner (Zone: 12252177)
 * Format Sekunder: Vignette Interstitial (Zone: 12252049)
 *
 * Iklan tampil langsung di dalam layar web tanpa berpindah halaman / tanpa buka tab baru.
 * Setelah durasi countdown selesai, pengguna otomatis mendapatkan credit dan memproses data.
 */
export const AD_CONFIG = {
  // Nama provider yang digunakan
  providerName: 'Monetag',

  // Format iklan aktif
  format: 'In-Page Push Banner & Vignette',

  // Zone ID resmi In-Page Push Banner
  zoneId: '12252177',

  // Zone ID cadangan (Vignette)
  vignetteZoneId: '12252049',

  // Durasi hitung mundur menonton iklan di web (detik)
  durationSeconds: 8,

  // Apakah otomatis langsung memproses data setelah iklan/durasi selesai
  autoStartOnReward: true,

  // Mode live (false = aktif menggunakan Monetag SDK di web)
  testMode: false,
}
