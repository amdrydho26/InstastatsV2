<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { compareInstagramData } from './instagramParser.js'
import { extractInstagramZip } from './zipInstagram.js'

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)

const inputMode = ref('zip')
const zipFile = ref(null)
const zipFileName = ref('')
const followersText = ref('')
const followingText = ref('')
const followersFileName = ref('')
const followingFileName = ref('')
const status = ref('idle')
const activeStep = ref('Menunggu file')
const progress = ref(0)
const errorMessage = ref('')
const result = ref(null)
const query = ref('')
const showSplash = ref(true)

const appRoot = ref(null)
const splash = ref(null)
const progressFill = ref(null)
const statusText = ref(null)

const processSteps = [
  'Menunggu file',
  'File siap',
  'Menerima file',
  'Membaca ZIP',
  'Mengekstrak isi',
  'Mencari file JSON',
  'Membaca followers',
  'Membaca following',
  'Membandingkan data',
  'Menampilkan hasil',
]

const guideSteps = [
  ['01', 'Upload ZIP', 'Pilih file hasil download Instagram. Tidak perlu ekstrak manual.'],
  ['02', 'Tekan Bandingkan', 'Aplikasi membaca ZIP dan mencari followers/following.'],
  ['03', 'Baca hasil', 'Ringkasan dan daftar akun tampil jelas.'],
]

const receivedCount = computed(() => Number(Boolean(followersText.value.trim())) + Number(Boolean(followingText.value.trim())))
const currentStepIndex = computed(() => Math.max(0, processSteps.indexOf(activeStep.value)))
const isZipReady = computed(() => Boolean(zipFile.value))
const isManualReady = computed(() => receivedCount.value === 2)
const canProcess = computed(() => status.value !== 'processing' && (inputMode.value === 'zip' ? isZipReady.value : isManualReady.value))
const visibleAccounts = computed(() => filteredAccounts.value.slice(0, 120))

const currentPanel = computed(() => {
  if (status.value === 'processing') return 'loading'
  if (status.value === 'error') return 'error'
  if (!result.value) return 'empty'
  if (!result.value.notFollowBack.length) return 'safe'
  return 'result'
})

const statusCopy = computed(() => {
  if (status.value === 'processing') return ['Sedang memproses', activeStep.value]
  if (status.value === 'success') return ['Hasil siap', 'Akun tidak follow back sudah ditemukan.']
  if (status.value === 'error') return ['Ada masalah', errorMessage.value]
  if (status.value === 'empty') return ['Aman', 'Tidak ada akun yang perlu ditinjau.']
  if (inputMode.value === 'zip' && isZipReady.value) return ['ZIP siap', 'Tekan Bandingkan untuk mulai membaca isi ZIP.']
  if (inputMode.value === 'manual' && isManualReady.value) return ['JSON siap', 'Tekan Bandingkan untuk mulai memproses data.']
  if (inputMode.value === 'manual' && receivedCount.value === 1) return ['Satu file masuk', 'Tambahkan satu file lagi.']
  return ['Menunggu input', inputMode.value === 'zip' ? 'Upload ZIP Instagram sebagai alur utama.' : 'Masukkan followers dan following manual.']
})

const filteredAccounts = computed(() => {
  const text = query.value.trim().toLowerCase().replace(/^@/, '')
  const items = result.value?.notFollowBack || []
  return text ? items.filter((account) => account.id.includes(text)) : items
})

watch(progress, (value) => {
  if (!progressFill.value) return
  gsap.to(progressFill.value, { width: `${value}%`, duration: 0.5, ease: 'power3.out' })
})

watch(activeStep, async () => {
  await nextTick()
  animateStatus()
  animateTimeline()
})
watch(currentPanel, async () => {
  await nextTick()
  animatePanel()
})
watch(inputMode, async () => {
  clearError()
  result.value = null
  query.value = ''
  activeStep.value = isCurrentInputReady() ? 'File siap' : 'Menunggu file'
  progress.value = isCurrentInputReady() ? 12 : 0
  await nextTick()
  gsap.fromTo('.mode-panel', { x: inputMode.value === 'zip' ? -18 : 18, opacity: 0, scale: 0.985 }, { x: 0, opacity: 1, scale: 1, duration: 0.36, ease: 'power3.out' })
  gsap.fromTo('.mode-switch', { scale: 0.985 }, { scale: 1, duration: 0.24, ease: 'back.out(2)' })
})
watch(query, async () => {
  await nextTick()
  gsap.fromTo('.account-row', { x: -8, opacity: 0.65 }, { x: 0, opacity: 1, duration: 0.22, stagger: 0.012, ease: 'power2.out' })
})

onMounted(() => {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    showSplash.value = false
    gsap.set(appRoot.value, { opacity: 1, clearProps: 'transform' })
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    return
  }

  gsap.set(appRoot.value, { opacity: 0 })
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from('.splash-orb', { scale: 0, opacity: 0, duration: 0.45 })
    .from('.splash-word span', { yPercent: 110, opacity: 0, rotate: 4, duration: 0.5, stagger: 0.035 }, '-=0.18')
    .from('.splash-title, .splash-progress', { y: 14, opacity: 0, duration: 0.38, stagger: 0.08 }, '-=0.2')
    .to('.splash-progress span', { xPercent: 185, duration: 0.72, ease: 'power2.inOut' }, '-=0.15')
    .to(splash.value, { yPercent: -100, duration: 0.55, ease: 'power4.inOut', delay: 0.1 })
    .set(splash.value, { display: 'none' })
    .set(showSplash, { value: false })
    .add(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }))
    .to(appRoot.value, { opacity: 1, duration: 0.42 }, '-=0.2')
    .from('.hero-kicker, .hero-title, .hero-text, .hero-cta', { y: 22, opacity: 0, duration: 0.45, stagger: 0.07 }, '-=0.22')
    .from('.guide-card', { y: 18, opacity: 0, scale: 0.96, duration: 0.42, stagger: 0.08 }, '-=0.16')
    .from('.float-card', { y: 24, opacity: 0, rotate: -2, duration: 0.55, stagger: 0.08 }, '-=0.22')
    .add(() => startAmbientMotion())

  gsap.utils.toArray('.reveal').forEach((element) => {
    gsap.from(element, {
      y: 26,
      opacity: 0,
      duration: 0.65,
      ease: 'power3.out',
      scrollTrigger: { trigger: element, start: 'top 84%', once: true },
    })
  })
})

function setInputMode(mode) {
  if (inputMode.value === mode || status.value === 'processing') return
  inputMode.value = mode
  press('.mode-switch')
}

function readZip(event) {
  const file = event.target.files?.[0]
  if (!file) return

  clearError()
  if (!file.name.toLowerCase().endsWith('.zip')) {
    setError('File harus .zip dari unduhan data Instagram.')
    event.target.value = ''
    return
  }

  zipFile.value = file
  zipFileName.value = file.name
  result.value = null
  query.value = ''
  status.value = 'idle'
  activeStep.value = 'File siap'
  progress.value = 12
  nextTick(() => pulse('.zip-card'))
}

async function readFile(event, target) {
  const file = event.target.files?.[0]
  if (!file) return

  clearError()
  if (!file.name.toLowerCase().endsWith('.json')) {
    setError('File harus .json. Pilih file dari unduhan data Instagram.')
    event.target.value = ''
    return
  }

  try {
    const text = await file.text()
    if (target === 'followers') {
      followersText.value = text
      followersFileName.value = file.name
    } else {
      followingText.value = text
      followingFileName.value = file.name
    }
    result.value = null
    query.value = ''
    activeStep.value = isManualReady.value ? 'File siap' : 'Menunggu file'
    status.value = 'idle'
    progress.value = isManualReady.value ? 12 : 6
    await nextTick()
    pulse(target === 'followers' ? '.followers-card' : '.following-card')
  } catch {
    setError(`File ${file.name} gagal dibaca. Coba pilih ulang.`)
  }
}

async function processData() {
  clearError()
  result.value = null
  query.value = ''

  if (!canProcess.value) {
    setError(inputMode.value === 'zip' ? 'Pilih file ZIP dulu, lalu tekan Bandingkan.' : 'Masukkan followers dan following dulu, lalu tekan Bandingkan.')
    return
  }

  press('.primary-button')
  status.value = 'processing'

  try {
    const compared = inputMode.value === 'zip' ? await processZipData() : await processManualData()
    result.value = compared
    await runStep('Menampilkan hasil', 100, 360)
    status.value = compared.notFollowBack.length ? 'success' : 'empty'
    nextTick(() => smoothScroll('#hasil'))
  } catch (error) {
    setError(error.message || 'Data gagal diproses.')
  }
}

async function processZipData() {
  await runStep('Menerima file', 12, 320)
  await runStep('Membaca ZIP', 24, 460)
  await runStep('Mengekstrak isi', 38, 420)
  const extracted = await extractInstagramZip(zipFile.value)

  await runStep('Mencari file JSON', 52, 460)
  followersText.value = extracted.followersText
  followingText.value = extracted.followingText
  followersFileName.value = extracted.followersName
  followingFileName.value = extracted.followingName

  await runStep('Membaca followers', 64, 380)
  const followersJson = parseJson(extracted.followersText, 'followers')

  await runStep('Membaca following', 76, 380)
  const followingJson = parseJson(extracted.followingText, 'following')

  await runStep('Membandingkan data', 90, 780)
  return compareInstagramData(followersJson, followingJson)
}

async function processManualData() {
  await runStep('Menerima file', 12, 320)
  await runStep('Membaca followers', 35, 420)
  const followersJson = parseJson(followersText.value, 'followers')

  await runStep('Membaca following', 60, 420)
  const followingJson = parseJson(followingText.value, 'following')

  await runStep('Membandingkan data', 90, 780)
  return compareInstagramData(followersJson, followingJson)
}

async function runStep(step, value, delay) {
  activeStep.value = step
  progress.value = value
  await wait(delay)
}

function parseJson(text, label) {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`JSON ${label} tidak valid. Detail: ${error.message}`)
  }
}

function resetAll() {
  press('.top-action')
  zipFile.value = null
  zipFileName.value = ''
  followersText.value = ''
  followingText.value = ''
  followersFileName.value = ''
  followingFileName.value = ''
  result.value = null
  query.value = ''
  status.value = 'idle'
  activeStep.value = 'Menunggu file'
  progress.value = 0
  errorMessage.value = ''
  nextTick(() => gsap.fromTo('.input-card, .process-card', { y: 14, opacity: 0.65 }, { y: 0, opacity: 1, duration: 0.36, stagger: 0.05, ease: 'power3.out' }))
}

function clearError() {
  if (status.value === 'error') status.value = 'idle'
  errorMessage.value = ''
}

function setError(message) {
  errorMessage.value = message
  status.value = 'error'
  activeStep.value = 'Menunggu file'
  progress.value = Math.max(progress.value, 8)
  nextTick(() => {
    gsap.fromTo('.error-card, .process-card', { x: -8 }, { x: 0, duration: 0.45, ease: 'elastic.out(1, 0.55)' })
  })
}

function isCurrentInputReady() {
  return inputMode.value === 'zip' ? isZipReady.value : isManualReady.value
}

function animateStatus() {
  if (!statusText.value) return
  gsap.fromTo(statusText.value, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: 'power2.out' })
  gsap.fromTo('.status-ring', { scale: 0.9 }, { scale: 1, duration: 0.36, ease: 'back.out(2.4)' })
}

function animateTimeline() {
  gsap.fromTo('.timeline-step.done', { opacity: 0.72 }, { opacity: 1, duration: 0.22, stagger: 0.015, overwrite: 'auto' })
  gsap.fromTo('.timeline-step.active', { scale: 0.96, x: -4 }, { scale: 1, x: 0, duration: 0.34, ease: 'back.out(2.4)', overwrite: 'auto' })
}

function animatePanel() {
  gsap.fromTo('.state-panel', { y: 18, opacity: 0, scale: 0.985 }, { y: 0, opacity: 1, scale: 1, duration: 0.42, ease: 'power3.out' })
  gsap.fromTo('.summary-card', { y: 20, opacity: 0, rotate: -0.4 }, { y: 0, opacity: 1, rotate: 0, duration: 0.45, stagger: 0.07, ease: 'power3.out' })
  gsap.fromTo('.account-row', { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.34, stagger: 0.018, ease: 'power2.out' })
}

function press(selector) {
  gsap.fromTo(selector, { scale: 0.97 }, { scale: 1, duration: 0.28, ease: 'back.out(2.2)' })
}

function pulse(selector) {
  gsap.timeline()
    .fromTo(selector, { y: -3, scale: 0.99 }, { y: 0, scale: 1, duration: 0.32, ease: 'back.out(2)' })
    .fromTo(`${selector} .ready-mark`, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.26, ease: 'back.out(2.8)' }, '<')
}

function startAmbientMotion() {
  gsap.to('.hero-kicker span', { scale: 1.35, opacity: 0.55, duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut' })
  gsap.to('.float-card', { y: -8, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.22 })
  gsap.to('.guide-card span', { y: -2, duration: 1.3, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.18 })
}

function smoothScroll(target) {
  gsap.to(window, { duration: 0.72, scrollTo: { y: target, offsetY: 86 }, ease: 'power3.inOut' })
}

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
    <div class="splash-word" aria-label="InstaStats">
      <span>I</span><span>N</span><span>S</span><span>T</span><span>A</span><span>S</span><span>T</span><span>A</span><span>T</span><span>S</span><span>.</span>
    </div>
    <p class="splash-title">Menyiapkan pengalaman cek follow back.</p>
    <div class="splash-progress"><span></span></div>
  </div>

  <div ref="appRoot" id="app" class="app-shell">
    <header class="topbar">
      <a class="logo" href="#app" aria-label="InstaStats" @click.prevent="smoothScroll('#app')">INSTASTATS<span>.</span></a>
      <a class="top-link" href="#input" @click.prevent="smoothScroll('#input')">Upload</a>
      <button class="top-action" type="button" @pointerdown="press('.top-action')" @click="resetAll">Reset</button>
    </header>

    <main>
      <section class="hero grid-bg" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="hero-kicker"><span></span> Tanpa login. Proses lokal.</p>
          <h1 id="hero-title" class="hero-title">Cek akun yang tidak <mark>follow back</mark>.</h1>
          <p class="hero-text">Upload ZIP Instagram, tekan Bandingkan, lalu lihat akun yang tidak mengikuti balik. Semua berjalan di browser kamu.</p>
          <div class="guide-grid" aria-label="Cara pakai singkat">
            <article v-for="step in guideSteps" :key="step[0]" class="guide-card">
              <span>{{ step[0] }}</span>
              <strong>{{ step[1] }}</strong>
              <p>{{ step[2] }}</p>
            </article>
          </div>
          <a class="primary-link hero-cta" href="#input" @pointerdown="press('.hero-cta')" @click.prevent="smoothScroll('#input')">Mulai cek</a>
        </div>

        <div class="hero-preview" aria-hidden="true">
          <div class="float-card card-one"><strong>ZIP</strong><span>{{ zipFileName || 'Belum dipilih' }}</span></div>
          <div class="float-card card-two"><strong>Status</strong><span>{{ statusCopy[0] }}</span></div>
          <div class="float-card card-three"><strong>Action</strong><span>Bandingkan saat siap</span></div>
        </div>
      </section>

      <section id="input" class="content-section reveal" aria-labelledby="input-title">
        <div class="section-heading">
          <span>01</span>
          <h2 id="input-title">Pilih metode</h2>
          <p>ZIP jadi alur utama. Input manual tetap ada untuk cadangan.</p>
        </div>

        <div class="workflow-panel">
          <div class="mode-switch" :class="inputMode" role="tablist" aria-label="Metode input">
            <span class="mode-switch__thumb" :class="inputMode"></span>
            <button type="button" role="tab" :aria-selected="inputMode === 'zip'" :class="{ active: inputMode === 'zip' }" @click="setInputMode('zip')">Upload ZIP</button>
            <button type="button" role="tab" :aria-selected="inputMode === 'manual'" :class="{ active: inputMode === 'manual' }" @click="setInputMode('manual')">Manual JSON</button>
          </div>

          <Transition mode="out-in" @enter="(el, done) => gsap.fromTo(el, { y: 12, opacity: 0, scale: 0.985 }, { y: 0, opacity: 1, scale: 1, duration: 0.34, ease: 'power3.out', onComplete: done })" @leave="(el, done) => gsap.to(el, { y: -8, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: done })">
            <div v-if="inputMode === 'zip'" key="zip" class="mode-panel">
              <article class="input-card zip-card primary-upload" :class="{ ready: isZipReady }">
                <div class="card-top">
                  <div>
                    <span class="step-chip">Metode utama</span>
                    <h3>Upload ZIP Instagram</h3>
                    <p>{{ zipFileName || 'Pilih file .zip hasil download data Instagram.' }}</p>
                  </div>
                  <span class="ready-mark">✓</span>
                </div>
                <label class="file-picker zip-picker">
                  <input type="file" accept="application/zip,.zip" @change="readZip" />
                  <span>{{ isZipReady ? 'ZIP siap diproses' : 'Pilih ZIP' }}</span>
                </label>
                <p class="help-note">File hanya dibaca setelah tombol Bandingkan ditekan.</p>
              </article>
            </div>

            <div v-else key="manual" class="mode-panel manual-grid">
              <article class="input-card followers-card" :class="{ ready: followersText.trim() }">
                <div class="card-top">
                  <div>
                    <span class="step-chip">Followers</span>
                    <h3>Pengikut kamu</h3>
                    <p>{{ followersFileName || 'followers_1.json' }}</p>
                  </div>
                  <span class="ready-mark">✓</span>
                </div>
                <label class="file-picker">
                  <input type="file" accept="application/json,.json" @change="readFile($event, 'followers')" />
                  <span>{{ followersText.trim() ? 'File diterima' : 'Pilih followers' }}</span>
                </label>
                <details>
                  <summary>Tempel manual</summary>
                  <textarea v-model="followersText" placeholder="Tempel JSON followers" rows="4" spellcheck="false"></textarea>
                </details>
              </article>

              <article class="input-card following-card" :class="{ ready: followingText.trim() }">
                <div class="card-top">
                  <div>
                    <span class="step-chip dark-chip">Following</span>
                    <h3>Akun kamu ikuti</h3>
                    <p>{{ followingFileName || 'following.json' }}</p>
                  </div>
                  <span class="ready-mark">✓</span>
                </div>
                <label class="file-picker dark-picker">
                  <input type="file" accept="application/json,.json" @change="readFile($event, 'following')" />
                  <span>{{ followingText.trim() ? 'File diterima' : 'Pilih following' }}</span>
                </label>
                <details>
                  <summary>Tempel manual</summary>
                  <textarea v-model="followingText" placeholder="Tempel JSON following" rows="4" spellcheck="false"></textarea>
                </details>
              </article>
            </div>
          </Transition>
        </div>

        <aside class="process-card" :class="status" aria-live="polite">
          <div class="process-head">
            <div ref="statusText" class="status-copy">
              <span class="step-chip">Status</span>
              <h3>{{ statusCopy[0] }}</h3>
              <p>{{ statusCopy[1] }}</p>
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

          <div class="buttons">
            <button class="primary-button" type="button" :disabled="!canProcess" @pointerdown="press('.primary-button')" @click="processData">
              {{ status === 'processing' ? 'Memproses...' : 'Bandingkan' }}
            </button>
            <button class="ghost-button" type="button" @pointerdown="press('.ghost-button')" @click="resetAll">Ulangi</button>
          </div>
        </aside>
      </section>

      <section id="hasil" class="results-section reveal" aria-labelledby="hasil-title">
        <div class="section-heading light-heading">
          <span>02</span>
          <h2 id="hasil-title">Hasil cek</h2>
          <p>Ringkasan dulu. Detail akun muncul setelah proses selesai.</p>
        </div>

        <div class="results-panel">
          <Transition mode="out-in" @enter="(el, done) => gsap.fromTo(el, { y: 18, opacity: 0, scale: 0.985 }, { y: 0, opacity: 1, scale: 1, duration: 0.36, ease: 'power3.out', onComplete: done })" @leave="(el, done) => gsap.to(el, { y: -12, opacity: 0, duration: 0.22, ease: 'power2.in', onComplete: done })">
            <div v-if="currentPanel === 'loading'" key="loading" class="state-panel loading-state" :class="{ comparing: activeStep === 'Membandingkan data' }">
              <div class="loading-orbit"><span></span><i></i><b></b></div>
              <strong>{{ activeStep }}</strong>
              <p>{{ activeStep === 'Membandingkan data' ? 'Aplikasi sedang mencocokkan followers dan following.' : 'Proses berjalan bertahap. Kamu bisa melihat statusnya di atas.' }}</p>
              <div class="compare-bars" aria-hidden="true"><span></span><span></span><span></span></div>
              <div class="skeleton-list"><i></i><i></i><i></i></div>
            </div>

            <div v-else-if="currentPanel === 'error'" key="error" class="state-panel message-card error-card">
              <strong>Data belum bisa diproses.</strong>
              <p>{{ errorMessage }}</p>
            </div>

            <div v-else-if="currentPanel === 'empty'" key="empty" class="state-panel message-card empty-card">
              <strong>Belum ada hasil.</strong>
              <p>Pilih metode input, siapkan file, lalu tekan Bandingkan.</p>
            </div>

            <div v-else-if="currentPanel === 'safe'" key="safe" class="state-panel result-content">
              <div class="summary-grid">
                <article class="summary-card"><span>Following</span><strong>{{ result.following.accounts.length }}</strong><small>{{ result.following.duplicateCount }} duplikat</small></article>
                <article class="summary-card"><span>Followers</span><strong>{{ result.followers.accounts.length }}</strong><small>{{ result.followers.duplicateCount }} duplikat</small></article>
                <article class="summary-card accent-card"><span>Tidak follow back</span><strong>0</strong><small>Aman</small></article>
              </div>
              <div class="message-card success-card"><strong>Aman.</strong><p>Semua following ditemukan di followers.</p></div>
            </div>

            <div v-else key="result" class="state-panel result-content">
              <div class="summary-grid">
                <article class="summary-card"><span>Following</span><strong>{{ result.following.accounts.length }}</strong><small>{{ result.following.duplicateCount }} duplikat</small></article>
                <article class="summary-card"><span>Followers</span><strong>{{ result.followers.accounts.length }}</strong><small>{{ result.followers.duplicateCount }} duplikat</small></article>
                <article class="summary-card accent-card"><span>Tidak follow back</span><strong>{{ result.notFollowBack.length }}</strong><small>{{ filteredAccounts.length }} tampil</small></article>
              </div>

              <label class="search-box">
                <span>Cari akun</span>
                <input v-model="query" type="search" placeholder="Ketik username" />
              </label>

              <div v-if="!filteredAccounts.length" class="message-card empty-card">
                <strong>Tidak ada yang cocok.</strong>
                <p>Coba kata kunci lain.</p>
              </div>

              <ul v-else class="account-list">
                <li v-for="account in visibleAccounts" :key="account.id" class="account-row">
                  <div>
                    <strong>@{{ account.id }}</strong>
                    <small>{{ formatDate(account.timestamp) }}</small>
                  </div>
                  <a :href="account.href" target="_blank" rel="noreferrer" @pointerdown="press('.account-row a')">Buka</a>
                </li>
              </ul>
              <p v-if="filteredAccounts.length > visibleAccounts.length" class="limit-note">Menampilkan 120 akun pertama agar tetap ringan.</p>
            </div>
          </Transition>
        </div>
      </section>
    </main>
  </div>
</template>
