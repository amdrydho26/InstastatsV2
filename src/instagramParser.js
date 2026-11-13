const USERNAME_RE = /^[a-z0-9._]{1,30}$/

export function normalizeUsername(value) {
  if (value == null) return ''

  let text = String(value).trim().toLowerCase()
  if (!text) return ''

  try {
    if (text.includes('instagram.com/')) {
      const url = new URL(text.startsWith('http') ? text : `https://${text}`)
      const parts = url.pathname.split('/').filter(Boolean)
      text = parts[0] === '_u' ? parts[1] || '' : parts[0] || ''
    }
  } catch {
    const match = text.match(/instagram\.com\/(?:_u\/)?([^/?#]+)/)
    text = match?.[1] || text
  }

  text = text.replace(/^@+/, '').split(/[/?#]/)[0].trim()
  return USERNAME_RE.test(text) ? text : ''
}

// ─── JSON format parser ───────────────────────────────────────────────────────

export function extractAccountsFromJson(input, kind) {
  const arrays = findAccountArrays(input, kind)
  const byId = new Map()
  let rawCount = 0

  for (const list of arrays) {
    if (!Array.isArray(list)) continue

    for (const item of list) {
      const accounts = accountCandidatesJson(item)
      rawCount += accounts.length

      for (const account of accounts) {
        const id = normalizeUsername(account.username || account.href)
        if (!id || byId.has(id)) continue

        byId.set(id, {
          id,
          username: account.username || id,
          href: normalizeHref(account.href, id),
          timestamp: Number.isFinite(account.timestamp) ? account.timestamp : null,
        })
      }
    }
  }

  return {
    accounts: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
    rawCount,
    duplicateCount: Math.max(0, rawCount - byId.size),
  }
}

/** Legacy alias — still works for callers that pass already-parsed JSON */
export const extractAccounts = extractAccountsFromJson

// ─── HTML format parser ───────────────────────────────────────────────────────

/**
 * Parse Instagram HTML export.
 * followers_1.html: each account is <a target="_blank" href="...">username</a>
 *   inside <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
 * following.html: each account is <h2 class="...">username</h2>
 *   plus <a target="_blank" href="...">url</a> inside the same container
 */
export function extractAccountsFromHtml(html, kind) {
  const byId = new Map()
  let rawCount = 0

  if (kind === 'followers') {
    // followers_1.html: <div class="pam ..."><div class="_a6-p"><div><div><a href="...">username</a></div>...
    // Each entry block contains exactly one <a> with the profile href
    const entryRe = /<div class="pam[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g
    const linkRe = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/
    const dateRe = /<div>([A-Za-z]{3} \d{1,2}, \d{4} [^<]+)<\/div>/

    let m
    while ((m = entryRe.exec(html)) !== null) {
      rawCount++
      const block = m[1]
      const linkMatch = linkRe.exec(block)
      if (!linkMatch) continue
      const href = linkMatch[1].trim()
      const textVal = linkMatch[2].trim()
      const id = normalizeUsername(href) || normalizeUsername(textVal)
      if (!id || byId.has(id)) continue
      const dateMatch = dateRe.exec(block)
      byId.set(id, {
        id,
        username: textVal || id,
        href: normalizeHref(href, id),
        timestamp: dateMatch ? parseFbDate(dateMatch[1]) : null,
      })
    }
  } else {
    // following.html: <div class="pam ..."><h2 class="...">username</h2><div class="_a6-p"><div><div><a href="...">...</a></div><div>date</div>
    const entryRe = /<div class="pam[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g
    const h2Re = /<h2[^>]*>([^<]+)<\/h2>/
    const linkRe = /<a[^>]+href="([^"]+)"/
    const dateRe = /<div>([A-Za-z]{3} \d{1,2}, \d{4} [^<]+)<\/div>/

    let m
    while ((m = entryRe.exec(html)) !== null) {
      rawCount++
      const block = m[1]
      const h2Match = h2Re.exec(block)
      const linkMatch = linkRe.exec(block)
      if (!h2Match && !linkMatch) continue
      const textVal = h2Match?.[1]?.trim() || ''
      const href = linkMatch?.[1]?.trim() || ''
      const id = normalizeUsername(textVal) || normalizeUsername(href)
      if (!id || byId.has(id)) continue
      const dateMatch = dateRe.exec(block)
      byId.set(id, {
        id,
        username: textVal || id,
        href: normalizeHref(href, id),
        timestamp: dateMatch ? parseFbDate(dateMatch[1]) : null,
      })
    }
  }

  return {
    accounts: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
    rawCount,
    duplicateCount: Math.max(0, rawCount - byId.size),
  }
}

/**
 * Parse a date string like "Nov 03, 2026 11:57 pm" into a Unix timestamp.
 * Returns null when parsing fails.
 */
function parseFbDate(str) {
  if (!str) return null
  try {
    const d = new Date(str.trim())
    if (isNaN(d.getTime())) return null
    return Math.floor(d.getTime() / 1000)
  } catch {
    return null
  }
}

// ─── Compare ─────────────────────────────────────────────────────────────────

/**
 * Compare followers and following data.
 * Returns { followers, following, notFollowBack, notFollowingBack }
 *   notFollowBack     — accounts you follow but they don't follow you back
 *   notFollowingBack  — accounts that follow you but you don't follow them back
 */
export function compareInstagramData(followersData, followingData) {
  // Accept either { accounts } objects or raw inputs
  const followers = followersData.accounts
    ? followersData
    : extractAccountsFromJson(followersData, 'followers')

  const following = followingData.accounts
    ? followingData
    : extractAccountsFromJson(followingData, 'following')

  if (!followers.accounts.length) {
    throw new Error('Daftar followers tidak ditemukan. Pastikan file followers berisi data yang benar.')
  }

  if (!following.accounts.length) {
    throw new Error('Daftar following tidak ditemukan. Pastikan file following berisi data yang benar.')
  }

  const followerIds = new Set(followers.accounts.map((a) => a.id))
  const followingIds = new Set(following.accounts.map((a) => a.id))

  const notFollowBack = following.accounts.filter((a) => !followerIds.has(a.id))
  const notFollowingBack = followers.accounts.filter((a) => !followingIds.has(a.id))

  return {
    followers,
    following,
    notFollowBack,
    notFollowingBack,
  }
}

// ─── JSON parsing internals ───────────────────────────────────────────────────

function findAccountArrays(input, kind) {
  const found = []
  const wanted = kind === 'following'
    ? ['following', 'relationships_following']
    : ['followers', 'relationships_followers']

  if (Array.isArray(input)) found.push(input)
  if (!input || typeof input !== 'object') return found

  const stack = [{ value: input, depth: 0 }]
  const seen = new Set()

  while (stack.length) {
    const { value, depth } = stack.pop()
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 6) continue
    seen.add(value)

    for (const [key, child] of Object.entries(value)) {
      const lowerKey = key.toLowerCase()
      if (Array.isArray(child) && wanted.some((term) => lowerKey.includes(term))) {
        found.push(child)
        continue
      }
      if (child && typeof child === 'object') stack.push({ value: child, depth: depth + 1 })
    }
  }

  return uniqueArrays(found)
}

function uniqueArrays(arrays) {
  const seen = new Set()
  return arrays.filter((list) => {
    if (seen.has(list)) return false
    seen.add(list)
    return true
  })
}

function accountCandidatesJson(item) {
  const candidates = []
  if (!item || typeof item !== 'object') {
    const username = normalizeUsername(item)
    return username ? [{ username }] : []
  }

  const title = cleanText(item.title)
  addCandidate(candidates, { username: item.username || item.value || item.name || title, href: item.href || item.url, timestamp: item.timestamp })

  if (Array.isArray(item.string_list_data)) {
    for (const entry of item.string_list_data) {
      addCandidate(candidates, {
        username: entry?.value || title || entry?.username,
        href: entry?.href,
        timestamp: Number(entry?.timestamp),
      })
    }
  }

  return candidates
}

function addCandidate(candidates, account) {
  const username = normalizeUsername(account.username || account.href)
  const hrefName = normalizeUsername(account.href)
  const id = username || hrefName
  if (!id) return

  candidates.push({
    username: id,
    href: account.href,
    timestamp: account.timestamp,
  })
}

function normalizeHref(href, username) {
  if (typeof href === 'string' && href.includes('instagram.com')) return href
  return `https://www.instagram.com/${username}`
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}
