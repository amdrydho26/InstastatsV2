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

export function extractAccounts(input, kind) {
  const arrays = findAccountArrays(input, kind)
  const byId = new Map()
  let rawCount = 0

  for (const list of arrays) {
    if (!Array.isArray(list)) continue

    for (const item of list) {
      const accounts = accountCandidates(item)
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

function accountCandidates(item) {
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

export function compareInstagramData(followersInput, followingInput) {
  const followers = extractAccounts(followersInput, 'followers')
  const following = extractAccounts(followingInput, 'following')

  if (!followers.accounts.length) {
    throw new Error('Daftar followers tidak ditemukan. Pastikan file followers berisi array atau key "followers" / "relationships_followers".')
  }

  if (!following.accounts.length) {
    throw new Error('Daftar following tidak ditemukan. Pastikan file following berisi key "relationships_following" atau array following.')
  }

  const followerIds = new Set(followers.accounts.map((account) => account.id))
  const notFollowBack = following.accounts.filter((account) => !followerIds.has(account.id))

  return {
    followers,
    following,
    notFollowBack,
  }
}
