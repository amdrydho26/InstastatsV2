/**
 * Konfigurasi Jaringan Iklan / Rewarded Ads (Solusi A - Direct Link)
 * Provider: Monetag (PropellerAds)
 * Format: Direct link (Direct ads)
 * Zone ID: 12258559
 *
 * Iklan resmi Monetag muncul HANYA saat tombol "Bandingkan" ditekan.
 * Tab penawaran sponsor Monetag dibuka, dan timer countdown 8 detik berjalan
 * untuk memberikan 1 kredit analisis secara otomatis.
 */
export const AD_CONFIG = {
  providerName: 'Monetag',
  format: 'Direct link (Direct ads)',
  zoneId: '12258559',
  directLinkUrl: 'https://uplcm.com/4/12258559',
  durationSeconds: 8,
  autoStartOnReward: true,
  openInNewTab: true,
}
