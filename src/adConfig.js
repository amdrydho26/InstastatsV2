/**
 * Konfigurasi Jaringan Iklan / Rewarded Ads
 * Provider rekomendasi: Monetag (PropellerAds)
 *
 * Monetag adalah penyedia iklan yang paling simpel, aman, tanpa minimum traffic,
 * dan langsung aktif seketika tanpa proses approval website yang rumit.
 */
export const AD_CONFIG = {
  // Nama provider yang digunakan
  providerName: 'Monetag',

  // Durasi menonton iklan sebelum mendapatkan reward credit (detik)
  durationSeconds: 8,

  // URL Direct Link / Smartlink Monetag Anda
  // Cara dapatkan link:
  // 1. Daftar akun gratis di https://monetag.com
  // 2. Buat zona format "Direct Link"
  // 3. Salin link tersebut dan tempelkan di bawah ini:
  directLinkUrl: 'https://monetag.com',

  // Apakah otomatis langsung memproses data setelah iklan selesai
  autoStartOnReward: true,

  // Mode simulasi/demo aktif (bisa langsung berfungsi sekarang)
  testMode: true,
}

