import assert from 'node:assert/strict'
import { compareInstagramData, normalizeUsername } from '../src/instagramParser.js'

assert.equal(normalizeUsername('https://www.instagram.com/_u/Foo.Bar_?x=1'), 'foo.bar_')
assert.equal(normalizeUsername('@User_Name'), 'user_name')
assert.equal(normalizeUsername('bad name'), '')

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
assert.deepEqual(result.notFollowBack.map((account) => account.id), ['charlie'])

console.log('instagramParser self-check passed')
