/**
 * Konfigurasi Rewarded Ads
 * Menggunakan Monetag Official Rewarded Interstitial SDK
 * Zona: 12252049 (Zona Interstitial Monetag Anda)
 *
 * Iklan komersial resmi Monetag muncul HANYA ketika tombol "Bandingkan" ditekan.
 * Selama belum ditekan, website 100% bersih tanpa iklan.
 */
export const AD_CONFIG = {
  providerName: 'Monetag',
  format: 'Official Monetag Rewarded Interstitial SDK',

  // Zone ID resmi Interstitial Monetag Anda
  zoneId: '12252049',

  // Durasi wajib menonton iklan (detik)
  durationSeconds: 10,

  // Fallback video jika ad server kosong
  videoUrl: '/ad-video.mp4',

  // Otomatis memproses data setelah reward selesai
  autoStartOnReward: true,

  directLinkUrl: 'https://monetag.com',
}
