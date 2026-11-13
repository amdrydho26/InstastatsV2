import fs from 'node:fs'
import path from 'node:path'
import { zipSync, strToU8 } from 'fflate'

/**
 * Generate synthetic Instagram JSON & HTML data for performance testing.
 * @param {number} followerCount - Number of followers to generate (default 100,000)
 * @param {number} followingCount - Number of following to generate (default 60,000)
 * @param {number} mutualCount - Number of mutual follows (default 30,000)
 */
export function generateInstagramDataset(followerCount = 100000, followingCount = 60000, mutualCount = 30000) {
  console.log(`Generating dataset: ${followerCount.toLocaleString()} followers, ${followingCount.toLocaleString()} following (${mutualCount.toLocaleString()} mutual)...`)

  // Base timestamp for dates
  const baseTimestamp = 1780000000

  // 1. Generate Followers Data
  // Mutual followers: user_000001 to user_030000
  // Followers who don't follow back / you don't follow back: user_030001 to user_100000
  const followersList = []
  for (let i = 1; i <= followerCount; i++) {
    const id = `user_${String(i).padStart(6, '0')}`
    followersList.push({
      title: '',
      media_list_data: [],
      string_list_data: [
        {
          href: `https://www.instagram.com/${id}`,
          value: id,
          timestamp: baseTimestamp - (i * 120),
        },
      ],
    })
  }

  // 2. Generate Following Data
  // Mutual: user_000001 to user_030000
  // Non-mutual (accounts you follow that don't follow back): user_notfb_000001 to user_notfb_030000
  const followingList = []
  for (let i = 1; i <= mutualCount; i++) {
    const id = `user_${String(i).padStart(6, '0')}`
    followingList.push({
      title: id,
      string_list_data: [
        {
          href: `https://www.instagram.com/_u/${id}`,
          timestamp: baseTimestamp - (i * 150),
        },
      ],
    })
  }

  const notFollowBackCount = followingCount - mutualCount
  for (let i = 1; i <= notFollowBackCount; i++) {
    const id = `user_vip_${String(i).padStart(6, '0')}`
    followingList.push({
      title: id,
      string_list_data: [
        {
          href: `https://www.instagram.com/_u/${id}`,
          timestamp: baseTimestamp - (i * 180),
        },
      ],
    })
  }

  const followingObj = {
    relationships_following: followingList,
  }

  return { followersList, followingObj }
}

/**
 * Convert JSON dataset to Instagram HTML export format
 */
export function datasetToHtml(followersList, followingObj) {
  console.log('Converting to HTML format...')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  function formatHtmlDate(ts) {
    const d = new Date(ts * 1000)
    const m = months[d.getUTCMonth()]
    const day = String(d.getUTCDate()).padStart(2, '0')
    const year = d.getUTCFullYear()
    return `${m} ${day}, ${year} 10:00 am`
  }

  // Build followers HTML in chunks
  const fRows = []
  for (let i = 0; i < followersList.length; i++) {
    const item = followersList[i].string_list_data[0]
    fRows.push(
      `<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder"><div class="_a6-p"><div><div><a target="_blank" href="${item.href}">${item.value}</a></div><div>${formatHtmlDate(item.timestamp)}</div></div></div></div>`
    )
  }
  const followersHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Followers</title></head><body><div class="_a6-q">${fRows.join('\n')}</div></body></html>`

  // Build following HTML in chunks
  const fwRows = []
  const fwList = followingObj.relationships_following
  for (let i = 0; i < fwList.length; i++) {
    const item = fwList[i]
    const data = item.string_list_data[0]
    fwRows.push(
      `<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder"><h2 class="_3-95 _2pim _a6-h _a6-i">${item.title}</h2><div class="_a6-p"><div><div><a target="_blank" href="${data.href}">${data.href}</a></div><div>${formatHtmlDate(data.timestamp)}</div></div></div></div>`
    )
  }
  const followingHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Following</title></head><body><div class="_a6-q">${fwRows.join('\n')}</div></body></html>`

  return { followersHtml, followingHtml }
}

/**
 * Create ZIP file containing JSON files
 */
export function createJsonZip(followersList, followingObj) {
  console.log('Compressing JSON ZIP...')
  const followersJson = JSON.stringify(followersList)
  const followingJson = JSON.stringify(followingObj)

  const zipData = {
    'connections/followers_and_following/followers_1.json': strToU8(followersJson),
    'connections/followers_and_following/following.json': strToU8(followingJson),
  }

  const zipped = zipSync(zipData, { level: 6 })
  return zipped
}

/**
 * Create ZIP file containing HTML files
 */
export function createHtmlZip(followersHtml, followingHtml) {
  console.log('Compressing HTML ZIP...')
  const zipData = {
    'connections/followers_and_following/followers_1.html': strToU8(followersHtml),
    'connections/followers_and_following/following.html': strToU8(followingHtml),
  }

  const zipped = zipSync(zipData, { level: 6 })
  return zipped
}

// ─── CLI Entrypoint ───────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const followersCount = parseInt(args[0], 10) || 100000
const followingCount = parseInt(args[1], 10) || 60000
const mutualCount = parseInt(args[2], 10) || 30000

const outputDir = path.resolve(process.cwd(), 'data')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

console.log('=== Instagram Dummy Data Generator ===')
const startTime = Date.now()

// 1. Generate core data
const { followersList, followingObj } = generateInstagramDataset(followersCount, followingCount, mutualCount)

// 2. Build JSON ZIP
const jsonZipBytes = createJsonZip(followersList, followingObj)
const jsonZipPath = path.join(outputDir, `dummy-instagram-100k-users(JSON).zip`)
fs.writeFileSync(jsonZipPath, jsonZipBytes)
const jsonSizeMb = (jsonZipBytes.length / (1024 * 1024)).toFixed(2)
console.log(`Saved JSON ZIP: ${jsonZipPath} (${jsonSizeMb} MB)`)

// 3. Build HTML ZIP
const { followersHtml, followingHtml } = datasetToHtml(followersList, followingObj)
const htmlZipBytes = createHtmlZip(followersHtml, followingHtml)
const htmlZipPath = path.join(outputDir, `dummy-instagram-100k-users(HTML).zip`)
fs.writeFileSync(htmlZipPath, htmlZipBytes)
const htmlSizeMb = (htmlZipBytes.length / (1024 * 1024)).toFixed(2)
console.log(`Saved HTML ZIP: ${htmlZipPath} (${htmlSizeMb} MB)`)

const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2)
console.log(`\nAll done in ${totalElapsed}s!`)
console.log(`Summary:`)
console.log(`- Followers: ${followersCount.toLocaleString()}`)
console.log(`- Following: ${followingCount.toLocaleString()}`)
console.log(`- Mutual: ${mutualCount.toLocaleString()}`)
console.log(`- Tidak Follow Back Kamu: ${(followingCount - mutualCount).toLocaleString()}`)
console.log(`- Kamu Tidak Follow: ${(followersCount - mutualCount).toLocaleString()}`)

