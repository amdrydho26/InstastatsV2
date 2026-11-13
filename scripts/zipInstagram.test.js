import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { extractInstagramZip } from '../src/zipInstagram.js'

// Test JSON ZIP
const jsonBuffer = await readFile('data/instagram-amd.rydho26-2026-11-11-pNR1KJen(JSON).zip')
const jsonSlice = jsonBuffer.buffer.slice(jsonBuffer.byteOffset, jsonBuffer.byteOffset + jsonBuffer.byteLength)
const jsonResult = await extractInstagramZip(jsonSlice)

assert.equal(jsonResult.format, 'json')
assert.equal(jsonResult.followersName, 'connections/followers_and_following/followers_1.json')
assert.equal(jsonResult.followingName, 'connections/followers_and_following/following.json')
assert.ok(jsonResult.followersText.includes('string_list_data'))
assert.ok(jsonResult.followingText.includes('relationships_following'))

// Test HTML ZIP
const htmlBuffer = await readFile('data/instagram-amd.rydho26-2026-11-11-12Hj8hrk(HTML).zip')
const htmlSlice = htmlBuffer.buffer.slice(htmlBuffer.byteOffset, htmlBuffer.byteOffset + htmlBuffer.byteLength)
const htmlResult = await extractInstagramZip(htmlSlice)

assert.equal(htmlResult.format, 'html')
assert.equal(htmlResult.followersName, 'connections/followers_and_following/followers_1.html')
assert.equal(htmlResult.followingName, 'connections/followers_and_following/following.html')
assert.ok(htmlResult.followersText.includes('<a'))
assert.ok(htmlResult.followingText.includes('<h2'))

console.log('zipInstagram self-check passed')
