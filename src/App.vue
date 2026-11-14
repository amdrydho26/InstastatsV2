<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { compareInstagramData, extractAccountsFromJson, extractAccountsFromHtml } from './instagramParser.js'
import { extractInstagramZip } from './zipInstagram.js'
import { AD_CONFIG } from './adConfig.js'

gsap.registerPlugin(ScrollToPlugin)
gsap.config({ nullTargetWarn: false })

// ─── Storage & Pagination Constants ───────────────────────────────────────────

const STORAGE_KEY = 'instastats_v2_saved_state'
const PAGE_SIZE = 100

// ─── State ────────────────────────────────────────────────────────────────────

const inputFormat = ref('json') // 'json' | 'html'
const zipFile = ref(null)
const zipFileName = ref('')
const zipValid = ref(null) // null | true | false
const zipValidating = ref(false)
const zipError = ref('')

const status = ref('idle') // idle | validating | processing | success | error
const activeStep = ref('Menunggu file')
const progress = ref(0)
const errorMessage = ref('')
const result = ref(null)

const userCredits = ref(0)
const showAdModal = ref(false)
const isAdBlocked = ref(false)
const adVideoEl = ref(null)
const isAdMuted = ref(true)
const adTimeRemaining = ref(AD_CONFIG.durationSeconds)
const adProgressPercent = ref(0)
let adInterval = null

function toggleMute() {
  isAdMuted.value = !isAdMuted.value
  if (adVideoEl.value) {
    adVideoEl.value.muted = isAdMuted.value
  }
}

const activeCategory = ref('notFollowBack') // notFollowBack | notFollowingBack | following | followers
const currentPage = ref(1)
const categoryPages = ref({
  notFollowBack: 1,
  notFollowingBack: 1,
  following: 1,
  followers: 1,
})

const showSplash = ref(true)

const appRoot = ref(null)
const splash = ref(null)
const progressFill = ref(null)
const statusText = ref(null)

// ─── Process steps ────────────────────────────────────────────────────────────

const processSteps = [
  'Menunggu file',
  'File siap',
  'Membaca ZIP',
  'Mengekstrak isi',
  'Membaca followers',
  'Membaca following',
  'Membandingkan data',
  'Menampilkan hasil',
]

// ─── Computed ─────────────────────────────────────────────────────────────────

const isZipReady = computed(() => zipValid.value === true)
const canProcess = computed(() => {
  return isZipReady.value && status.value !== 'processing' && status.value !== 'success'
})
const currentStepIndex = computed(() => Math.max(0, processSteps.indexOf(activeStep.value)))

const activeList = computed(() => {
  if (!result.value) return []
  const list = result.value[activeCategory.value]
  if (!list) return []
  return Array.isArray(list) ? list : list.accounts || []
})

const totalPages = computed(() => {
  const len = activeList.value.length
  return len ? Math.ceil(len / PAGE_SIZE) : 1
})

const paginatedAccounts = computed(() => {
  const list = activeList.value
  const start = (currentPage.value - 1) * PAGE_SIZE
  return list.slice(start, start + PAGE_SIZE)
})

const allPages = computed(() => {
  return Array.from({ length: totalPages.value }, (_, i) => i + 1)
})

const categoryStats = computed(() => {
  if (!result.value) return null
  return {
    notFollowBack: result.value.notFollowBack.length,
    notFollowingBack: result.value.notFollowingBack.length,
    following: result.value.following.accounts.length,
    followers: result.value.followers.accounts.length,
  }
})

const categoryLabel = computed(() => ({
  notFollowBack: 'Tidak Follow Back Kamu',
  notFollowingBack: 'Kamu Tidak Follow',
  following: 'Mengikuti',
  followers: 'Pengikut',
}))

// ─── LocalStorage Persistence ─────────────────────────────────────────────────

function saveToStorage() {
  if (!result.value || status.value !== 'success') return
  try {
    const totalAccounts = (categoryStats.value?.followers || 0) + (categoryStats.value?.following || 0)
    if (totalAccounts > 25000) {
      // Dataset benchmark besar melewati penyimpanan localStorage agar browser tetap optimal
      return
    }
    const payload = {
      result: result.value,
      zipFileName: zipFileName.value,
      inputFormat: inputFormat.value,
      activeCategory: activeCategory.value,
      currentPage: currentPage.value,
      categoryPages: categoryPages.value,
      userCredits: userCredits.value,
      timestamp: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('Gagal menyimpan ke localStorage:', err)
  }
}

function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('Gagal menghapus localStorage:', err)
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const data = JSON.parse(raw)
    if (!data || !data.result) return false

    result.value = data.result
    zipFileName.value = data.zipFileName || ''
    inputFormat.value = data.inputFormat || 'json'
    activeCategory.value = data.activeCategory || 'notFollowBack'
    if (data.categoryPages) {
      categoryPages.value = { ...categoryPages.value, ...data.categoryPages }
    }
    currentPage.value = data.currentPage || (categoryPages.value[activeCategory.value] || 1)
    if (typeof data.userCredits === 'number') {
      userCredits.value = data.userCredits
    }
    status.value = 'success'
    zipValid.value = true
    progress.value = 100
    activeStep.value = 'Menampilkan hasil'
    return true
  } catch (err) {
    console.warn('Gagal memuat dari localStorage:', err)
    return false
  }
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

watch(progress, (value) => {
  if (!progressFill.value) return
  gsap.to(progressFill.value, { width: `${value}%`, duration: 0.4, ease: 'power3.out' })
})

watch(activeStep, async () => {
  await nextTick()
  animateStatus()
  animateTimeline()
})

watch(activeCategory, async () => {
  await nextTick()
  gsap.fromTo('.account-row:nth-child(-n+24)', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, stagger: 0.01, ease: 'power2.out' })
})

// ─── Category & Page navigation ───────────────────────────────────────────────

function selectCategory(cat) {
  if (activeCategory.value === cat) return
  // Simpan halaman tab saat ini untuk kategori lama
  categoryPages.value[activeCategory.value] = currentPage.value
  activeCategory.value = cat
  // Pulihkan halaman tab untuk kategori baru
  currentPage.value = categoryPages.value[cat] || 1
  saveToStorage()
}

function setPage(p) {
  if (p < 1 || p > totalPages.value || p === currentPage.value) return
  currentPage.value = p
  categoryPages.value[activeCategory.value] = p
  saveToStorage()
  nextTick(() => {
    gsap.fromTo('.account-row:nth-child(-n+24)', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, stagger: 0.01, ease: 'power2.out' })
    const activeBtn = document.querySelector('.page-num-btn.active')
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  })
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  const restored = loadFromStorage()

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    showSplash.value = false
    gsap.set(appRoot.value, { opacity: 1, clearProps: 'transform' })
    if (restored) {
      nextTick(() => smoothScroll('#hasil'))
    }
    return
  }

  gsap.set(appRoot.value, { opacity: 0 })
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from('.splash-orb', { scale: 0, opacity: 0, duration: 0.45 })
    .from('.splash-word span:not(.splash-version-tag)', { yPercent: 110, opacity: 0, rotate: 4, duration: 0.5, stagger: 0.035 }, '-=0.18')
    .from('.splash-version-tag', { scale: 0, opacity: 0, duration: 0.35, ease: 'back.out(2)' }, '-=0.15')
    .from('.splash-title, .splash-progress', { y: 14, opacity: 0, duration: 0.38, stagger: 0.08 }, '-=0.2')
    .to('.splash-progress span', { width: '100%', duration: 0.85, ease: 'power2.inOut' }, '-=0.12')
    .to(splash.value, { yPercent: -100, duration: 0.55, ease: 'power4.inOut', delay: 0.08 })
    .set(splash.value, { display: 'none' })
    .set(showSplash, { value: false })
    .add(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }))
    .to(appRoot.value, { opacity: 1, duration: 0.42 }, '-=0.2')
    .from('.hero-kicker, .hero-title, .hero-text, .hero-cta', { y: 22, opacity: 0, duration: 0.45, stagger: 0.07 }, '-=0.22')
    .from('.guide-card', { y: 18, opacity: 0, scale: 0.96, duration: 0.42, stagger: 0.08 }, '-=0.16')
    .from('.float-card', { y: 24, opacity: 0, rotate: -2, duration: 0.55, stagger: 0.08 }, '-=0.22')
    .add(() => {
      startAmbientMotion()
      if (restored) {
        setTimeout(() => {
          smoothScroll('#hasil')
        }, 220)
      }
    })
})

// ─── File handling ────────────────────────────────────────────────────

function setFormat(fmt) {
  if (inputFormat.value === fmt) return
  inputFormat.value = fmt
  clearFile()
  press('.format-switch')
}

function clearFile() {
  clearStorage()
  zipFile.value = null
  zipFileName.value = ''
  zipValid.value = null
  zipValidating.value = false
  zipError.value = ''
  result.value = null
  status.value = 'idle'
  activeStep.value = 'Menunggu file'
  progress.value = 0
  errorMessage.value = ''
  currentPage.value = 1
  categoryPages.value = {
    notFollowBack: 1,
    notFollowingBack: 1,
    following: 1,
    followers: 1,
  }
  userCredits.value = 0
}

async function readZip(event) {
  const file = event.target.files?.[0]
  if (!file) return

  clearStorage()
  userCredits.value = 0

  if (!file.name.toLowerCase().endsWith('.zip')) {
    zipError.value = 'File harus berekstensi .zip dari unduhan data Instagram.'
    zipValid.value = false
    event.target.value = ''
    return
  }

  zipFile.value = file
  zipFileName.value = file.name
  zipValid.value = null
  zipValidating.value = true
  zipError.value = ''
  result.value = null
  status.value = 'validating'
  activeStep.value = 'Memeriksa ZIP'
  progress.value = 10

  try {
    const extracted = await extractInstagramZip(file)

    const expectedFormat = inputFormat.value
    if (extracted.format !== expectedFormat) {
      const labelMap = { json: 'JSON', html: 'HTML' }
      zipError.value = `ZIP berisi format ${labelMap[extracted.format]}, tapi metode yang dipilih adalah ${labelMap[expectedFormat]}. Silakan pilih format yang sesuai.`
      zipValid.value = false
      zipValidating.value = false
      status.value = 'idle'
      activeStep.value = 'Menunggu file'
      progress.value = 0
      return
    }

    zipFile._extracted = extracted
    zipValid.value = true
    zipValidating.value = false
    status.value = 'idle'
    activeStep.value = 'File siap'
    progress.value = 25

    await nextTick()
    pulse('.zip-upload-card')
    setTimeout(() => {
      smoothScroll('#bandingkan')
    }, 450)
  } catch (err) {
    zipError.value = err.message
    zipValid.value = false
    zipValidating.value = false
    zipFile.value = null
    zipFileName.value = ''
    status.value = 'idle'
    activeStep.value = 'Menunggu file'
    progress.value = 0
    event.target.value = ''
  }
}

// ─── Rewarded Ad & Credit Handlers ────────────────────────────────────

function startRewardedAd() {
  adTimeRemaining.value = AD_CONFIG.durationSeconds
  adProgressPercent.value = 0
  showAdModal.value = true

  nextTick(() => {
    if (adVideoEl.value) {
      adVideoEl.value.currentTime = 0
      adVideoEl.value.muted = isAdMuted.value
      adVideoEl.value.play().catch(() => {})
    }
  })

  if (adInterval) {
    clearInterval(adInterval)
  }

  const total = AD_CONFIG.durationSeconds
  adInterval = setInterval(() => {
    if (adTimeRemaining.value > 1) {
      adTimeRemaining.value--
      adProgressPercent.value = Math.round(((total - adTimeRemaining.value) / total) * 100)
    } else {
      adTimeRemaining.value = 0
      adProgressPercent.value = 100
      clearInterval(adInterval)
      adInterval = null
      if (AD_CONFIG.autoStartOnReward) {
        setTimeout(() => {
          claimRewardAndProcess()
        }, 500)
      }
    }
  }, 1000)
}

function claimRewardAndProcess() {
  if (adTimeRemaining.value > 0) return
  if (adInterval) {
    clearInterval(adInterval)
    adInterval = null
  }
  if (adVideoEl.value) {
    adVideoEl.value.pause()
  }
  showAdModal.value = false
  userCredits.value = 1
  saveToStorage()
  nextTick(() => {
    processData()
  })
}

function closeAdModal() {
  if (adInterval) {
    clearInterval(adInterval)
    adInterval = null
  }
  if (adVideoEl.value) {
    adVideoEl.value.pause()
  }
  showAdModal.value = false
}

function handleCompareClick() {
  if (!canProcess.value) return
  if (userCredits.value <= 0) {
    startRewardedAd()
    return
  }
  processData()
}

// ─── Processing ───────────────────────────────────────────────────────

async function processData() {
  if (!canProcess.value) return
  if (!zipFile._extracted) {
    errorMessage.value = 'File belum tervalidasi. Pilih file ZIP terlebih dahulu.'
    status.value = 'error'
    return
  }

  // Konsumsi 1 credit untuk proses komparasi ini
  if (userCredits.value > 0) {
    userCredits.value--
    saveToStorage()
  }

  press('.primary-button')
  status.value = 'processing'
  errorMessage.value = ''
  result.value = null

  try {
    const extracted = zipFile._extracted

    await runStep('Membaca ZIP', 35, 300)
    await runStep('Mengekstrak isi', 48, 300)

    await runStep('Membaca followers', 65, 320)
    const followers = extracted.format === 'html'
      ? extractAccountsFromHtml(extracted.followersText, 'followers')
      : extractAccountsFromJson(JSON.parse(extracted.followersText), 'followers')

    await runStep('Membaca following', 80, 320)
    const following = extracted.format === 'html'
      ? extractAccountsFromHtml(extracted.followingText, 'following')
      : extractAccountsFromJson(JSON.parse(extracted.followingText), 'following')

    await runStep('Membandingkan data', 92, 550)
    const compared = compareInstagramData(followers, following)

    await runStep('Menampilkan hasil', 100, 250)
    result.value = compared
    activeCategory.value = 'notFollowBack'
    currentPage.value = 1
    categoryPages.value = {
      notFollowBack: 1,
      notFollowingBack: 1,
      following: 1,
      followers: 1,
    }
    status.value = 'success'
    saveToStorage()

    await nextTick()
    gsap.fromTo('#hasil',
      { y: 80, opacity: 0.6 },
      { y: 0, opacity: 1, duration: 0.65, ease: 'power3.out' }
    )
    setTimeout(() => {
      smoothScroll('#hasil')
    }, 140)
  } catch (err) {
    errorMessage.value = err.message || 'Data gagal diproses.'
    status.value = 'error'
    activeStep.value = 'Menunggu file'
  }
}

async function runStep(step, value, delay) {
  activeStep.value = step
  progress.value = value
  await wait(delay)
}

function resetAll() {
  press('.top-action')
  clearFile()
  nextTick(() => {
    smoothScroll('#pilih')
    gsap.fromTo('.zip-upload-card', { y: 14, opacity: 0.65 }, { y: 0, opacity: 1, duration: 0.36, ease: 'power3.out' })
  })
}

// ─── Smooth scrolling ─────────────────────────────────────────────────

function smoothScroll(target) {
  const topOffset = window.innerWidth >= 760 ? 76 : 64
  gsap.to(window, { duration: 0.65, scrollTo: { y: target, offsetY: topOffset }, ease: 'power3.inOut' })
}

// ─── Animations ───────────────────────────────────────────────────────

function animateStatus() {
  if (statusText.value) {
    gsap.fromTo(statusText.value, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: 'power2.out' })
  }
  const ring = document.querySelector('.status-ring')
  if (ring) {
    gsap.fromTo(ring, { scale: 0.9 }, { scale: 1, duration: 0.36, ease: 'back.out(2.4)' })
  }
}

function animateTimeline() {
  const doneElements = document.querySelectorAll('.timeline-step.done')
  if (doneElements.length > 0) {
    gsap.fromTo(doneElements, { opacity: 0.72 }, { opacity: 1, duration: 0.22, stagger: 0.015, overwrite: 'auto' })
  }
  const activeElements = document.querySelectorAll('.timeline-step.active')
  if (activeElements.length > 0) {
    gsap.fromTo(activeElements, { scale: 0.96, x: -4 }, { scale: 1, x: 0, duration: 0.34, ease: 'back.out(2.4)', overwrite: 'auto' })
  }
}

function press(selector) {
  if (!selector) return
  const el = document.querySelector(selector)
  if (!el) return
  gsap.fromTo(el, { scale: 0.97 }, { scale: 1, duration: 0.28, ease: 'back.out(2.2)' })
}

function pulse(selector) {
  if (!selector) return
  const el = document.querySelector(selector)
  if (!el) return
  gsap.timeline()
    .fromTo(el, { y: -3, scale: 0.99 }, { y: 0, scale: 1, duration: 0.32, ease: 'back.out(2)' })
    .fromTo(`${selector} .ready-mark`, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.26, ease: 'back.out(2.8)' }, '<')
}

function startAmbientMotion() {
  if (document.querySelector('.hero-kicker span')) {
    gsap.to('.hero-kicker span', { scale: 1.35, opacity: 0.55, duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut' })
  }
  if (document.querySelector('.float-card')) {
    gsap.to('.float-card', { y: -8, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.22 })
  }
  if (document.querySelector('.guide-card span')) {
    gsap.to('.guide-card span', { y: -2, duration: 1.3, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.18 })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function formatDate(timestamp) {
  if (!timestamp) return 'Tanggal tidak tersedia'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(timestamp * 1000)
}
</script>

<template>
  <div v-show="showSplash" ref="splash" class="splash" aria-label="Memuat aplikasi">
    <div class="splash-orb"></div>
    <div class="splash-word" aria-label="InstaStats V2">
      <span>I</span><span>N</span><span>S</span><span>T</span><span>A</span><span>S</span><span>T</span><span>A</span><span>T</span><span>S</span><span>.</span>
      <span class="splash-version-tag">V2</span>
    </div>
    <p class="splash-title">Menyiapkan pengalaman cek follow back.</p>
    <div class="splash-progress"><span></span></div>
  </div>

  <div ref="appRoot" id="app" class="app-shell">
    <header class="topbar">
      <a class="logo" href="#app" aria-label="InstaStats V2" @click.prevent="smoothScroll('#app')">
        INSTASTATS<span>.</span>
        <span class="version-tag">V2</span>
      </a>

      <div class="top-nav">
        <!-- GitHub link (clean minimal icon, no background or border) -->
        <a class="top-icon-btn" href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub Repository" title="GitHub Repository">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </a>

        <!-- TikTok link (clean minimal icon, no background or border) -->
        <a class="top-icon-btn" href="https://tiktok.com" target="_blank" rel="noopener noreferrer" aria-label="TikTok Tutorial" title="TikTok Tutorial">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-.88-.06A6.34 6.34 0 0 0 3.15 15.7a6.34 6.34 0 0 0 10.77 4.51c.36-.36.66-.77.9-1.22.25-.47.4-.98.44-1.51V8.78a8.21 8.21 0 0 0 4.33 1.36V6.69z"/>
          </svg>
        </a>
      </div>

      <button class="top-action" type="button" @pointerdown="press('.top-action')" @click="resetAll">Reset</button>
    </header>

    <main>
      <!-- ─── HERO ─────────────────────────────────────────────────────── -->
      <section class="hero grid-bg" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="hero-kicker"><span></span> Tanpa login. Proses lokal.</p>
          <h1 id="hero-title" class="hero-title">Cek akun yang tidak <mark>follow back</mark>.</h1>
          <p class="hero-text">Analisis followers dan following Instagram secara instan, aman, dan privat di browsermu.</p>
          <div class="guide-grid" aria-label="Cara pakai singkat">
            <article class="guide-card">
              <span>01</span>
              <strong>Pilih Metode</strong>
              <p>Pilih format JSON atau HTML lalu upload file ZIP data Instagram.</p>
            </article>
            <article class="guide-card">
              <span>02</span>
              <strong>Bandingkan</strong>
              <p>Tekan tombol Bandingkan untuk memulai proses analisis.</p>
            </article>
            <article class="guide-card">
              <span>03</span>
              <strong>Cek Hasil</strong>
              <p>Lihat statistik dan daftar akun berdasarkan kategori pilihan.</p>
            </article>
          </div>
          <a class="primary-link hero-cta" href="#pilih" @pointerdown="press('.hero-cta')" @click.prevent="smoothScroll('#pilih')">Mulai cek</a>
        </div>

        <div class="hero-preview" aria-hidden="true">
          <div class="float-card card-one"><strong>ZIP</strong><span>{{ zipFileName || 'Belum dipilih' }}</span></div>
          <div class="float-card card-two"><strong>Status</strong><span>{{ zipValid === true ? 'Siap diproses' : (zipValid === false ? 'File salah' : 'Menunggu') }}</span></div>
          <div class="float-card card-three"><strong>Format</strong><span>{{ inputFormat.toUpperCase() }}</span></div>
        </div>
      </section>

      <!-- ─── SECTION 01 — PILIH METODE ───────────────────────────────── -->
      <section id="pilih" class="content-section" aria-labelledby="pilih-title">
        <div class="section-heading">
          <span>01</span>
          <h2 id="pilih-title">Pilih metode</h2>
          <p>Pilih format file data Instagram yang akan kamu gunakan.</p>
        </div>

        <div class="workflow-panel">
          <!-- Format switch -->
          <div class="format-switch" :class="inputFormat" role="tablist" aria-label="Format input">
            <span class="format-switch__thumb" :class="inputFormat"></span>
            <button type="button" role="tab" :aria-selected="inputFormat === 'json'" :class="{ active: inputFormat === 'json' }" @click="setFormat('json')">JSON</button>
            <button type="button" role="tab" :aria-selected="inputFormat === 'html'" :class="{ active: inputFormat === 'html' }" @click="setFormat('html')">HTML</button>
          </div>

          <!-- Upload card -->
          <article
            class="input-card zip-upload-card"
            :class="[
              `format-${inputFormat}`,
              {
                ready: zipValid === true,
                error: zipValid === false,
                validating: zipValidating,
              }
            ]"
          >
            <div class="card-top">
              <div>
                <h3>Upload ZIP Instagram</h3>
                <p>
                  <template v-if="zipValidating">Memeriksa file…</template>
                  <template v-else-if="zipValid === true">{{ zipFileName }}</template>
                  <template v-else-if="zipValid === false">{{ zipError }}</template>
                  <template v-else>Pilih file .zip hasil download data Instagram.</template>
                </p>
              </div>
              <span class="ready-mark" :class="{ visible: zipValid === true }">✓</span>
            </div>
            <label class="file-picker zip-picker">
              <input type="file" accept="application/zip,.zip" @change="readZip" />
              <span>
                <template v-if="zipValidating">Memeriksa…</template>
                <template v-else-if="zipValid === true">Ganti file ZIP</template>
                <template v-else>Pilih ZIP</template>
              </span>
            </label>
          </article>
        </div>
      </section>

      <!-- ─── SECTION 02 — BANDINGKAN (BATAS SCROLL SEBELUM DIANALISIS) ── -->
      <section id="bandingkan" class="content-section bandingkan-section" aria-labelledby="bandingkan-title">
        <div class="section-heading">
          <span>02</span>
          <h2 id="bandingkan-title">Bandingkan</h2>
          <p>Tekan tombol di bawah untuk memproses dan menganalisis data.</p>
        </div>

        <div class="process-card" :class="status" aria-live="polite">
          <div class="process-head">
            <div ref="statusText" class="status-copy">
              <span class="step-chip">Status</span>
              <h3>
                <template v-if="status === 'processing'">{{ activeStep }}</template>
                <template v-else-if="status === 'success'">Selesai Dianalisis</template>
                <template v-else-if="status === 'error'">Ada masalah</template>
                <template v-else-if="zipValid === true">File siap dianalisis</template>
                <template v-else>Menunggu file</template>
              </h3>
              <p>
                <template v-if="status === 'processing'">Proses berjalan bertahap. Harap tunggu sebentar…</template>
                <template v-else-if="status === 'success'">Data berhasil dibandingkan! Hasil terbuka di lapisan bawah.</template>
                <template v-else-if="status === 'error'">{{ errorMessage }}</template>
                <template v-else-if="zipValid === true">File sudah tervalidasi. Tekan tombol Bandingkan untuk memproses.</template>
                <template v-else>Upload file ZIP pada bagian 01 terlebih dahulu.</template>
              </p>
            </div>
            <div class="status-ring" :class="status"><span></span></div>
          </div>

          <div class="progress-track" aria-label="Progress proses">
            <div ref="progressFill" class="progress-fill"></div>
          </div>

          <ol class="timeline" aria-label="Tahap proses">
            <li
              v-for="(step, index) in processSteps"
              :key="step"
              class="timeline-step"
              :class="{ active: step === activeStep, done: index < currentStepIndex }"
            >
              <span>{{ index + 1 }}</span>
              <p>{{ step }}</p>
            </li>
          </ol>

          <!-- Credit indicator & Action button -->
          <button
            class="primary-button"
            type="button"
            :disabled="!canProcess"
            @pointerdown="press('.primary-button')"
            @click="handleCompareClick"
          >
            <template v-if="status === 'processing'">Memproses…</template>
            <template v-else-if="status === 'success'">Sudah Dianalisis ✓</template>
            <template v-else-if="userCredits > 0">Bandingkan Sekarang (1 Credit Tersedia ✓)</template>
            <template v-else>Tonton Iklan & Bandingkan ⚡</template>
          </button>
        </div>
      </section>

      <!-- ─── SECTION 03 — CEK HASIL (LAYER MUNCUL DARI BAWAH) ────────── -->
      <section
        v-if="result"
        id="hasil"
        class="content-section results-section"
        aria-labelledby="hasil-title"
      >
        <div class="layer-pill-bar" aria-hidden="true">
          <span class="layer-pill"></span>
        </div>

        <div class="section-heading">
          <span>03</span>
          <h2 id="hasil-title">Cek hasil</h2>
          <p>Klik salah satu kategori di bawah untuk melihat rincian daftar akun.</p>
        </div>

        <div class="results-panel">
          <!-- Category stats: 4 cards -->
          <div v-if="categoryStats" class="stat-grid" role="tablist" aria-label="Kategori akun">
            <button
              class="stat-card"
              :class="{ active: activeCategory === 'notFollowBack' }"
              role="tab"
              :aria-selected="activeCategory === 'notFollowBack'"
              @click="selectCategory('notFollowBack')"
            >
              <span>Tidak Follow Back Kamu</span>
              <strong>{{ categoryStats.notFollowBack }}</strong>
              <small>kamu ikuti, tidak ikuti balik</small>
            </button>

            <button
              class="stat-card"
              :class="{ active: activeCategory === 'notFollowingBack' }"
              role="tab"
              :aria-selected="activeCategory === 'notFollowingBack'"
              @click="selectCategory('notFollowingBack')"
            >
              <span>Kamu Tidak Follow</span>
              <strong>{{ categoryStats.notFollowingBack }}</strong>
              <small>ikuti kamu, tidak kamu ikuti</small>
            </button>

            <button
              class="stat-card"
              :class="{ active: activeCategory === 'following' }"
              role="tab"
              :aria-selected="activeCategory === 'following'"
              @click="selectCategory('following')"
            >
              <span>Mengikuti</span>
              <strong>{{ categoryStats.following }}</strong>
              <small>total akun kamu ikuti</small>
            </button>

            <button
              class="stat-card"
              :class="{ active: activeCategory === 'followers' }"
              role="tab"
              :aria-selected="activeCategory === 'followers'"
              @click="selectCategory('followers')"
            >
              <span>Pengikut</span>
              <strong>{{ categoryStats.followers }}</strong>
              <small>total pengikut kamu</small>
            </button>
          </div>

          <!-- Active category label & count -->
          <div class="list-header">
            <p class="list-label">{{ categoryLabel[activeCategory] }} · <strong>{{ activeList.length }}</strong> akun</p>
          </div>

          <!-- Empty state -->
          <div v-if="!activeList.length" class="message-card empty-card">
            <strong>Tidak ada akun pada kategori ini.</strong>
            <p>Pilih kategori lain di atas untuk melihat daftar akun.</p>
          </div>

          <!-- Paginated Account list (100 per page) -->
          <ul v-else class="account-list">
            <li v-for="account in paginatedAccounts" :key="account.id" class="account-row">
              <div>
                <strong>@{{ account.id }}</strong>
                <small>{{ formatDate(account.timestamp) }}</small>
              </div>
              <a :href="account.href" target="_blank" rel="noreferrer" @pointerdown="press('.account-row a')">Buka</a>
            </li>
          </ul>

          <!-- Pagination: Simple horizontal numbers only, scrollable if many -->
          <nav v-if="totalPages > 1" class="simple-pagination" aria-label="Navigasi halaman akun">
            <div class="page-numbers-track">
              <button
                v-for="p in allPages"
                :key="p"
                class="page-num-btn"
                :class="{ active: p === currentPage }"
                type="button"
                :aria-current="p === currentPage ? 'page' : undefined"
                @click="setPage(p)"
              >
                {{ p }}
              </button>
            </div>
            <small class="pagination-subtext">Halaman {{ currentPage }} dari {{ totalPages }}</small>
          </nav>
        </div>
      </section>
    </main>

    <!-- ─── FULLSCREEN REWARDED VIDEO AD OVERLAY ───────────────────────── -->
    <Teleport to="body">
      <div
        v-if="showAdModal"
        class="fullscreen-video-ad"
        role="dialog"
        aria-modal="true"
        aria-label="Iklan Video Sponsor"
      >
        <!-- Background Video Player -->
        <video
          ref="adVideoEl"
          class="video-ad-player"
          :src="AD_CONFIG.videoUrl"
          autoplay
          playsinline
          :muted="isAdMuted"
          loop
        ></video>

        <!-- Scrim Gradients for contrast -->
        <div class="video-ad-scrim-top"></div>
        <div class="video-ad-scrim-bottom"></div>

        <!-- Top Header Controls -->
        <div class="video-ad-header">
          <div class="video-ad-badge-group">
            <span class="video-ad-badge">SPONSOR AD</span>
            <span class="video-ad-provider">{{ AD_CONFIG.providerName }}</span>
          </div>

          <div class="video-ad-controls-right">
            <!-- Audio Toggle -->
            <button
              class="video-audio-btn"
              type="button"
              @click="toggleMute"
              :aria-label="isAdMuted ? 'Nyalakan Audio' : 'Bisukan Audio'"
            >
              <span v-if="isAdMuted">🔇 Suara Mati</span>
              <span v-else>🔊 Suara Aktif</span>
            </button>

            <!-- Countdown Pill -->
            <div class="video-timer-pill" :class="{ ready: adTimeRemaining === 0 }">
              <template v-if="adTimeRemaining > 0">
                <span class="timer-dot"></span>
                Tonton: {{ adTimeRemaining }}s
              </template>
              <template v-else>
                ✓ Reward Terbuka!
              </template>
            </div>
          </div>
        </div>

        <!-- Bottom Overlay Controls & Info -->
        <div class="video-ad-footer">
          <div class="video-ad-info-box">
            <div class="video-ad-copy">
              <span class="video-ad-kicker">REWARDED VIDEO SPONSOR</span>
              <h3>Tonton Video Sampai Selesai untuk Membuka Analisis</h3>
              <p>Dapatkan 1x credit perbandingan instan setelah durasi {{ AD_CONFIG.durationSeconds }} detik selesai.</p>
            </div>

            <a
              v-if="AD_CONFIG.directLinkUrl && AD_CONFIG.directLinkUrl !== 'https://monetag.com'"
              class="video-sponsor-link"
              :href="AD_CONFIG.directLinkUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              Kunjungi Sponsor ↗
            </a>
          </div>

          <!-- Progress Bar -->
          <div class="video-progress-bar" aria-label="Progress durasi iklan">
            <div class="video-progress-fill" :style="{ width: `${adProgressPercent}%` }"></div>
          </div>

          <!-- Action Buttons -->
          <div class="video-ad-actions">
            <button
              v-if="adTimeRemaining > 0"
              class="video-claim-btn disabled"
              type="button"
              disabled
            >
              Menonton Iklan (Sisa {{ adTimeRemaining }}s)...
            </button>
            <button
              v-else
              class="video-claim-btn ready"
              type="button"
              @click="claimRewardAndProcess"
            >
              Klaim 1 Credit & Mulai Analisis ⚡
            </button>

            <button
              v-if="adTimeRemaining > 0"
              class="video-cancel-btn"
              type="button"
              @click="closeAdModal"
            >
              Batal & Kembali (Tanpa Credit)
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
