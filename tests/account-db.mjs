// node --experimental-strip-types tests/account-db.mjs
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { scryptSync } from 'node:crypto'

const dir = mkdtempSync(join(tmpdir(), 'typewords-db-'))
process.env.TYPEWORDS_DATA_DIR = dir
globalThis.createError = options => Object.assign(new Error(options.statusMessage), options)
globalThis.getCookie = event => event.cookie
globalThis.setCookie = (event, _name, value) => {
  event.cookie = value
}
globalThis.deleteCookie = event => {
  event.cookie = undefined
}
try {
  const { mergeProgress } = await import('../app/core/composables/progressMerge.ts')
  const left = {
    current: '1',
    dictionaries: [{ id: '1', words: ['a'], lastLearnIndex: 3, complete: false }],
    cards: { a: { last_review: '2026-01-02' } },
    days: { '2026-01-01': ['a'] },
  }
  const right = {
    current: '1',
    dictionaries: [{ id: '1', words: ['a', 'b'], lastLearnIndex: 2, complete: false }],
    cards: { a: { last_review: '2026-01-01' } },
    days: { '2026-01-01': ['a', 'b'] },
  }
  const merged = mergeProgress(left, right)
  assert.equal(merged.dictionaries[0].lastLearnIndex, 3)
  assert.deepEqual(merged.days['2026-01-01'], ['a', 'b'])
  assert.equal(merged.cards.a.last_review, '2026-01-02')
  const { parseProgress } = await import('../server/utils/progress.ts')
  const parsed = parseProgress({
    current: '',
    dictionaries: [],
    cards: {},
    days: { '2026-01-01': ['hello'] },
    extra: 'discard',
  })
  assert.equal('extra' in parsed, false)
  assert.deepEqual(parsed.days['2026-01-01'], ['hello'])
  assert.throws(() => parseProgress({ current: '', dictionaries: [], cards: {}, days: { bad: ['hello'] } }), {
    statusCode: 400,
  })
  const {
    credentials,
    verifyLegacy,
    createSession,
    session,
    setSession,
    logout,
    readProgress,
    writeProgress,
    createWechatTicket,
    startWechatTicket,
    completeWechatTicket,
    readWechatTicket,
    claimWechatTicket,
  } = await import('../server/utils/db.ts')
  assert.throws(() => credentials('a', 'password123'))
  const first = credentials('Alice', 'password123')
  const fixture = new DatabaseSync(join(dir, 'typewords.sqlite'))
  const salt = '1234567890abcdef'
  const insert = fixture.prepare('INSERT INTO users (username, salt, password) VALUES (?, ?, ?)')
  insert.run(first.username, salt, scryptSync(first.password, salt, 64).toString('hex'))
  assert.throws(() => verifyLegacy(first.username, 'wrong-password'), { statusCode: 401 })
  const event = {}
  setSession(event, createSession(verifyLegacy(first.username, first.password).id))
  const alice = session(event)
  assert.equal(alice.username, 'alice')
  assert.deepEqual(readProgress(alice.id), { revision: 0, data: null })
  assert.equal(writeProgress(alice.id, 0, { words: ['hello'] }), 1)
  assert.throws(() => writeProgress(alice.id, 0, {}), { statusCode: 409 })
  assert.deepEqual(readProgress(alice.id), { revision: 1, data: { words: ['hello'] } })
  insert.run('bob', salt, scryptSync('password123', salt, 64).toString('hex'))
  fixture.close()
  const another = {}
  setSession(another, createSession(verifyLegacy('bob', 'password123').id))
  assert.deepEqual(readProgress(session(another).id), { revision: 0, data: null })
  const newTicket = createWechatTicket()
  assert.equal(readWechatTicket(newTicket.id, 'wrong'), undefined)
  const newState = startWechatTicket(newTicket.id)
  assert.equal(completeWechatTicket(newState, 'appid', 'openid-new'), true)
  assert.throws(() => completeWechatTicket(newState, 'appid', 'openid-new'), { statusCode: 400 })
  const wechatUser = readWechatTicket(newTicket.id, newTicket.verifier)
  assert.equal(wechatUser.user_id, null)
  const wechatEvent = {}
  setSession(wechatEvent, claimWechatTicket(newTicket.id, newTicket.verifier))
  assert.ok(session(wechatEvent).username.startsWith('wx_'))
  assert.throws(() => claimWechatTicket(newTicket.id, newTicket.verifier), { statusCode: 400 })
  const unclaimed = createWechatTicket()
  assert.equal(completeWechatTicket(startWechatTicket(unclaimed.id), 'appid', 'openid-unclaimed'), true)
  assert.equal(readWechatTicket(unclaimed.id, unclaimed.verifier).user_id, null)
  const bindingAfterAbandon = createWechatTicket(session(another).id)
  assert.equal(completeWechatTicket(startWechatTicket(bindingAfterAbandon.id), 'appid', 'openid-unclaimed'), true)
  claimWechatTicket(bindingAfterAbandon.id, bindingAfterAbandon.verifier)
  const abandonedClaim = {}
  setSession(abandonedClaim, claimWechatTicket(unclaimed.id, unclaimed.verifier))
  assert.equal(session(abandonedClaim).id, session(another).id)
  const bindTicket = createWechatTicket(alice.id)
  assert.equal(completeWechatTicket(startWechatTicket(bindTicket.id), 'appid', 'openid-alice'), true)
  assert.equal(readWechatTicket(bindTicket.id, bindTicket.verifier).username, 'alice')
  claimWechatTicket(bindTicket.id, bindTicket.verifier)
  const again = createWechatTicket()
  assert.equal(completeWechatTicket(startWechatTicket(again.id), 'appid', 'openid-alice'), true)
  assert.equal(readWechatTicket(again.id, again.verifier).user_id, alice.id)
  assert.deepEqual(readProgress(alice.id), { revision: 1, data: { words: ['hello'] } })
  const collision = createWechatTicket(session(another).id)
  assert.equal(completeWechatTicket(startWechatTicket(collision.id), 'appid', 'openid-alice'), false)
  assert.ok(readWechatTicket(collision.id, collision.verifier).error)
  logout(event)
  assert.equal(session(event), null)
  console.log('微信票据、账号绑定、会话隔离和进度冲突检查通过')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
