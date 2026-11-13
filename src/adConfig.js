/**
 * Konfigurasi Jaringan Iklan / In-Page Rewarded Ads
 * Provider: Monetag (PropellerAds)
 * Format: In-Page Vignette Banner (Zone: 12252049)
 *
 * Iklan tampil langsung di dalam layar web tanpa berpindah halaman / tanpa buka tab baru.
 * Setelah durasi countdown selesai, pengguna otomatis mendapatkan credit dan memproses data.
 */
export const AD_CONFIG = {
  // Nama provider yang digunakan
  providerName: 'Monetag',

  // Format iklan
  format: 'Vignette In-Page Banner',

  // Zone ID resmi Monetag
  zoneId: '12252049',

  // Durasi hitung mundur menonton iklan di web (detik)
  durationSeconds: 8,

  // Apakah otomatis langsung memproses data setelah iklan/durasi selesai
  autoStartOnReward: true,

  // Mode live (false = aktif menggunakan Monetag SDK di web)
  testMode: false,
}
