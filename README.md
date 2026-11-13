# InstaStats V2 ⚡

Aplikasi web modern untuk menganalisis followers dan following Instagram secara instan, aman, dan privat langsung di browsermu tanpa login akun.

---

## ✨ Fitur Utama

- 🔒 **100% Privat & Aman**: Seluruh pemrosesan data (ekstraksi ZIP & komparasi akun) berlangsung lokal di browser Anda. Tidak ada data yang dikirim ke server.
- 📁 **Mendukung 2 Format Instagram**:
  - **Format JSON** (dari menu Unduh Data Instagram).
  - **Format HTML** (dari menu Unduh Data Instagram).
- ⚡ **Performa Tinggi**: Mampu memproses hingga ratusan ribu akun dalam hitungan detik menggunakan pustaka `fflate` dan algoritma komparasi $O(N)$ berbasis `Map` & `Set`.
- 📑 **Navigasi Tab Halaman (Pagination)**: Daftar akun dibagi per 100 akun dengan bar navigasi nomor horizontal yang bisa di-scroll secara mulus.
- 💾 **Penyimpanan Lokal (LocalStorage)**: Progress analisis, nomor tab, dan kategori terakhir otomatis tersimpan saat web ditutup/direfresh dan dapat dibersihkan dengan tombol Reset.
- 💰 **Monetisasi Siap Pakai (Rewarded Ads)**: Terintegrasi dengan model Rewarded Ads (tonton iklan untuk mendapatkan credit sebelum memproses data).

---

## 🚀 Panduan Deploy

Aplikasi ini adalah Single Page Application (SPA) berbasis Vite + Vue 3, sangat mudah di-deploy ke platform gratis mana pun:

### Opsi 1: Deploy ke Vercel (Rekomendasi)
1. Push repository ini ke akun GitHub Anda.
2. Buka [vercel.com](https://vercel.com) dan login dengan GitHub.
3. Klik **"Add New" → "Project"**, lalu pilih repository `instastats-v2`.
4. Biarkan pengaturan default (Framework: Vite, Build Command: `npm run build`, Output Directory: `dist`).
5. Klik **"Deploy"**. Dalam ~30 detik web Anda akan aktif di URL `https://nama-projek.vercel.app`.

### Opsi 2: Deploy ke Netlify
1. Buka [netlify.com](https://netlify.com) dan hubungkan repository GitHub.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Klik **"Deploy"**.

---

## 💵 Panduan Integrasi Monetag (Untuk Menghasilkan Income)

Setelah web Anda berhasil di-deploy dan memiliki URL publik (misal: `https://instastats.vercel.app`):

1. **Daftar Akun**:
   Buka [monetag.com](https://monetag.com) dan daftar sebagai **Publisher**.
2. **Tambahkan Website**:
   Di dashboard Monetag, klik menu **Sites** → **Add Site**, lalu masukkan URL website Anda yang sudah di-deploy.
3. **Verifikasi Website**:
   Jika diminta verifikasi tag HTML, salin kodenya dan buka file `index.html` pada baris:
   ```html
   <meta name="monetag" content="KODE_DARI_MONETAG_ANDA" />
   ```
4. **Buat Zona Iklan**:
   Pilih zona format **Direct Link / Smartlink**.
5. **Pasang Link ke Aplikasi**:
   Buka file [src/adConfig.js](src/adConfig.js) lalu ganti nilai `directLinkUrl`:
   ```javascript
   export const AD_CONFIG = {
     providerName: 'Monetag',
     durationSeconds: 8,
     directLinkUrl: 'https://alwingulla.com/...', // Ganti dengan Direct Link Monetag Anda
     autoStartOnReward: true,
     testMode: false,
   }
   ```
6. Commit & push perubahan ke GitHub, maka Vercel/Netlify akan otomatis meng-update web Anda.

---

## 🛠️ Pengembangan Lokal

```bash
# Install dependensi
npm install

# Jalankan server lokal
npm run dev

# Jalankan unit test parser & zip
npm test

# Generate data dummy 100k akun untuk uji coba
npm run generate-dummy

# Build untuk produksi
npm run build
```

---

## 📄 Lisensi
Hak Cipta © 2026 InstaStats. Dibuat dengan Vue 3, Vite, dan GSAP.
