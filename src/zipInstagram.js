import { unzipSync, strFromU8 } from 'fflate'

const TEXT_DECODER = new TextDecoder('utf-8')

// ─── ZIP format detection ─────────────────────────────────────────────────────

/**
 * Detect whether a ZIP contains JSON format or HTML format Instagram data.
 * Returns 'json' | 'html' | 'unknown'
 */
export function detectZipFormat(entries) {
  const names = Object.keys(entries).map((n) => n.toLowerCase().replaceAll('\\', '/'))
  const hasHtml = names.some((n) => n.endsWith('.html') && n.includes('followers'))
  const hasJson = names.some((n) => n.endsWith('.json') && n.includes('followers'))
  if (hasHtml) return 'html'
  if (hasJson) return 'json'
  return 'unknown'
}

// ─── Main extract function ────────────────────────────────────────────────────

export async function extractInstagramZip(fileOrBuffer) {
  const buffer = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer()
  let entries

  try {
    entries = unzipSync(new Uint8Array(buffer))
  } catch {
    throw new Error('ZIP tidak bisa dibaca. Pastikan file tidak rusak dan berasal dari unduhan data Instagram.')
  }

  const format = detectZipFormat(entries)

  if (format === 'unknown') {
    throw new Error('Format ZIP tidak dikenali. Pastikan file berasal dari unduhan data Instagram (format JSON atau HTML).')
  }

  if (format === 'html') {
    return extractHtmlZip(entries)
  }

  return extractJsonZip(entries)
}

// ─── JSON format ──────────────────────────────────────────────────────────────

function extractJsonZip(entries) {
  const jsonEntries = Object.entries(entries)
    .filter(([name]) => name.toLowerCase().endsWith('.json'))
    .map(([name, bytes]) => ({ name, bytes, scoreName: name.toLowerCase().replaceAll('\\', '/') }))

  if (!jsonEntries.length) {
    throw new Error('Tidak ada file JSON di dalam ZIP. Coba unduh ulang data Instagram dalam format JSON.')
  }

  const followersEntry = bestEntry(jsonEntries, 'followers')
  const followingEntry = bestEntry(jsonEntries, 'following')

  if (!followersEntry) {
    throw new Error('File followers tidak ditemukan di ZIP. Cari file seperti connections/followers_and_following/followers_1.json.')
  }

  if (!followingEntry) {
    throw new Error('File following tidak ditemukan di ZIP. Cari file seperti connections/followers_and_following/following.json.')
  }

  return {
    format: 'json',
    followersText: readUtf8(followersEntry.bytes),
    followingText: readUtf8(followingEntry.bytes),
    followersName: followersEntry.name,
    followingName: followingEntry.name,
  }
}

// ─── HTML format ──────────────────────────────────────────────────────────────

function extractHtmlZip(entries) {
  const htmlEntries = Object.entries(entries)
    .filter(([name]) => name.toLowerCase().endsWith('.html'))
    .map(([name, bytes]) => ({ name, bytes, scoreName: name.toLowerCase().replaceAll('\\', '/') }))

  if (!htmlEntries.length) {
    throw new Error('Tidak ada file HTML di dalam ZIP. Coba unduh ulang data Instagram dalam format HTML.')
  }

  const followersEntry = bestEntry(htmlEntries, 'followers')
  const followingEntry = bestEntry(htmlEntries, 'following')

  if (!followersEntry) {
    throw new Error('File followers tidak ditemukan di ZIP HTML. Cari file seperti connections/followers_and_following/followers_1.html.')
  }

  if (!followingEntry) {
    throw new Error('File following tidak ditemukan di ZIP HTML. Cari file seperti connections/followers_and_following/following.html.')
  }

  return {
    format: 'html',
    followersText: readUtf8(followersEntry.bytes),
    followingText: readUtf8(followingEntry.bytes),
    followersName: followersEntry.name,
    followingName: followingEntry.name,
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function bestEntry(entries, kind) {
  const scored = entries
    .map((entry) => ({ entry, score: scoreEntry(entry, kind) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.length - b.entry.name.length)

  return scored[0]?.entry || null
}

function scoreEntry(entry, kind) {
  const name = entry.scoreName
  let score = 0

  if (name.includes('followers_and_following')) score += 20
  if (name.includes('/connections/')) score += 8

  if (kind === 'followers') {
    if (/(^|\/)followers(?:_\d+)?\.(?:json|html)$/.test(name)) score += 100
    if (/(^|\/)followers(?:_\d+)?\b/.test(name)) score += 35
    if (name.includes('following')) score -= 80
    if (name.includes('request') || name.includes('unfollowed') || name.includes('hide_story')) score -= 70
  } else {
    if (/(^|\/)following\.(?:json|html)$/.test(name)) score += 100
    if (/(^|\/)following\b/.test(name)) score += 45
    if (name.includes('followers_')) score -= 80
    if (name.includes('request') || name.includes('unfollowed') || name.includes('hide_story')) score -= 70
  }

  return score
}

function readUtf8(bytes) {
  try {
    return strFromU8(bytes)
  } catch {
    return TEXT_DECODER.decode(bytes)
  }
}
