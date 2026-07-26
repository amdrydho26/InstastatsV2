import { unzipSync, strFromU8 } from 'fflate'

const TEXT_DECODER = new TextDecoder('utf-8')

export async function extractInstagramZip(fileOrBuffer) {
  const buffer = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer()
  let entries

  try {
    entries = unzipSync(new Uint8Array(buffer))
  } catch {
    throw new Error('ZIP tidak bisa dibaca. Pastikan file tidak rusak dan berasal dari unduhan data Instagram.')
  }

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
    followersText: readUtf8(followersEntry.bytes),
    followingText: readUtf8(followingEntry.bytes),
    followersName: followersEntry.name,
    followingName: followingEntry.name,
    jsonCount: jsonEntries.length,
  }
}

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
    if (/(^|\/)followers(?:_\d+)?\.json$/.test(name)) score += 100
    if (/(^|\/)followers(?:_\d+)?\b/.test(name)) score += 35
    if (name.includes('following')) score -= 80
    if (name.includes('request') || name.includes('unfollowed') || name.includes('hide_story')) score -= 70
  } else {
    if (/(^|\/)following\.json$/.test(name)) score += 100
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
