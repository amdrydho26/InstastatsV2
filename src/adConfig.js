/**
 * Konfigurasi Jaringan Iklan / Rewarded Ads (Solusi A - Direct Link)
 * Provider: Monetag (PropellerAds)
 * Format: Direct link (Direct ads)
 *
 * Iklan resmi Monetag muncul HANYA saat tombol "Bandingkan" ditekan.
 * Tab penawaran sponsor Monetag dibuka, dan timer countdown 8 detik berjalan
 * untuk memberikan 1 kredit analisis secara otomatis.
 */
export const AD_CONFIG = {
  providerName: 'Monetag',
  format: 'Direct link (Direct ads)',
  // Tautan Direct Link resmi dari Dashboard Monetag Anda.
  // Buat di dashboard Monetag: Add format -> Direct link (Direct ads).
  // Salin tautan Anda ke sini (contoh: 'https://otieufta.com/4/xxxxxxx').
  directLinkUrl: 'https://monetag.com',
  durationSeconds: 8,
  autoStartOnReward: true,
  openInNewTab: true,
}
