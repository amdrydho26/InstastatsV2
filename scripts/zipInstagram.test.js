import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { extractInstagramZip } from '../src/zipInstagram.js'

const buffer = await readFile('data/instagram-amd.rydho26-2026-07-25-B420ZcgT.zip')
const slice = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
const result = await extractInstagramZip(slice)

assert.equal(result.followersName, 'connections/followers_and_following/followers_1.json')
assert.equal(result.followingName, 'connections/followers_and_following/following.json')
assert.ok(result.followersText.includes('ilhmfadl_'))
assert.ok(result.followingText.includes('relationships_following'))
assert.ok(result.jsonCount >= 2)

console.log('zipInstagram self-check passed')
