/**
 * Konfigurasi Rewarded Video Ad Overlay
 * Fullscreen Video Ad yang tampil HANYA ketika tombol "Bandingkan" ditekan.
 * Selama belum ditekan, website 100% bersih tanpa iklan.
 */
export const AD_CONFIG = {
  // Nama provider sponsor
  providerName: 'Monetag',

  // Format iklan aktif: Fullscreen Rewarded Video
  format: 'Fullscreen Rewarded Video',

  // URL video iklan yang diputar di fullscreen player (disajikan dari server sendiri agar bebas adblock)
  videoUrl: '/ad-video.mp4',

  // Durasi wajib menonton iklan video sebelum credit diberikan (detik)
  durationSeconds: 10,

  // Apakah otomatis langsung memproses data setelah durasi video selesai
  autoStartOnReward: true,

  // URL Direct Link / Smartlink Monetag (opsional jika pengguna klik banner sponsor di dalam video)
  directLinkUrl: 'https://monetag.com',

  // Zone ID resmi Monetag
  zoneId: '12252177',
  vignetteZoneId: '12252049',
}
