import assert from 'node:assert/strict'
import { compareInstagramData, normalizeUsername, extractAccountsFromHtml } from '../src/instagramParser.js'

// normalizeUsername
assert.equal(normalizeUsername('https://www.instagram.com/_u/Foo.Bar_?x=1'), 'foo.bar_')
assert.equal(normalizeUsername('@User_Name'), 'user_name')
assert.equal(normalizeUsername('bad name'), '')

// JSON format — compareInstagramData with raw JSON input
const followers = [
  { string_list_data: [{ href: 'https://www.instagram.com/alfa', value: 'alfa', timestamp: 1 }] },
  { string_list_data: [{ href: 'https://www.instagram.com/bravo', value: 'bravo', timestamp: 2 }] },
  { string_list_data: [{ href: 'https://www.instagram.com/bravo', value: 'bravo', timestamp: 2 }] },
]

const following = {
  relationships_following: [
    { title: 'alfa', string_list_data: [{ href: 'https://www.instagram.com/_u/alfa', timestamp: 3 }] },
    { title: 'charlie', string_list_data: [{ href: 'https://www.instagram.com/_u/charlie', timestamp: 4 }] },
  ],
}

const result = compareInstagramData(followers, following)
assert.equal(result.followers.accounts.length, 2)
assert.equal(result.followers.duplicateCount, 1)
assert.deepEqual(result.notFollowBack.map((a) => a.id), ['charlie'])
// notFollowingBack: bravo follows us but we don't follow bravo
assert.deepEqual(result.notFollowingBack.map((a) => a.id), ['bravo'])

// HTML format — extractAccountsFromHtml
const followersHtml = `
<html><body>
<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder"><div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/testuser1">testuser1</a></div><div>Nov 03, 2026 11:57 pm</div></div></div></div>
<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder"><div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/testuser2">testuser2</a></div><div>Nov 02, 2026 10:00 am</div></div></div></div>
</body></html>`

const followingHtml = `
<html><body>
<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder"><h2 class="_3-95 _2pim _a6-h _a6-i">testuser1</h2><div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/_u/testuser1">https://www.instagram.com/_u/testuser1</a></div><div>Nov 03, 2026 7:45 pm</div></div></div></div>
<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder"><h2 class="_3-95 _2pim _a6-h _a6-i">extrauser</h2><div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/_u/extrauser">https://www.instagram.com/_u/extrauser</a></div><div>Nov 01, 2026 3:00 pm</div></div></div></div>
</body></html>`

const fHtml = extractAccountsFromHtml(followersHtml, 'followers')
assert.equal(fHtml.accounts.length, 2)
assert.ok(fHtml.accounts.some((a) => a.id === 'testuser1'))

const fwHtml = extractAccountsFromHtml(followingHtml, 'following')
assert.equal(fwHtml.accounts.length, 2)
assert.ok(fwHtml.accounts.some((a) => a.id === 'testuser1'))
assert.ok(fwHtml.accounts.some((a) => a.id === 'extrauser'))

const htmlResult = compareInstagramData(fHtml, fwHtml)
// extrauser is in following but not followers → notFollowBack
assert.deepEqual(htmlResult.notFollowBack.map((a) => a.id), ['extrauser'])
// testuser2 is in followers but not following → notFollowingBack
assert.deepEqual(htmlResult.notFollowingBack.map((a) => a.id), ['testuser2'])

console.log('instagramParser self-check passed')
