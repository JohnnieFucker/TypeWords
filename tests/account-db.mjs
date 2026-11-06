// node --experimental-strip-types tests/account-db.mjs
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
const dir = mkdtempSync(join(tmpdir(), 'wordsbattle-db-'))
process.env.TYPEWORDS_DATA_DIR = dir
// 旧版战绩表缺少对手名称，新版应原地补充而不丢失数据。
const oldDb = new DatabaseSync(join(dir, 'typewords.sqlite'))
oldDb.exec(
  'CREATE TABLE pet_battles (id INTEGER PRIMARY KEY, challenger INTEGER NOT NULL, defender INTEGER NOT NULL, day TEXT NOT NULL, won INTEGER NOT NULL, challenger_score INTEGER NOT NULL, defender_score INTEGER NOT NULL, created_at INTEGER NOT NULL)'
)
oldDb.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password TEXT NOT NULL);
CREATE TABLE pets (user_id INTEGER PRIMARY KEY REFERENCES users(id), public_id TEXT NOT NULL UNIQUE, species TEXT NOT NULL, name TEXT NOT NULL, exp INTEGER NOT NULL DEFAULT 0, attack INTEGER NOT NULL DEFAULT 0, defense INTEGER NOT NULL DEFAULT 0, spirit INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0);
INSERT INTO users VALUES (900,'existing','','');
INSERT INTO pets VALUES (900,'abcdefabcdefabcdefabcdef','fox','小灵狐',275,7,3,5,8,4);`)
oldDb.close()
globalThis.createError = options => Object.assign(new Error(options.statusMessage), options)
globalThis.getCookie = event => event.cookie
globalThis.setCookie = (event, _name, value) => {
  event.cookie = value
}
globalThis.deleteCookie = event => {
  event.cookie = undefined
}
try {
  const {
    createWechatTicket,
    startWechatTicket,
    completeWechatTicket,
    readWechatTicket,
    claimWechatTicket,
    session,
    setSession,
    logout,
    readProgress,
    writeProgress,
    getGame,
    usePetItem,
    battlePet,
    encounterPet,
    switchPet,
    startJourney,
    elementBonus,
    chooseCareItem,
    decayCare,
    greetPet,
  } = await import('../server/utils/db.ts')
  function createUser(openid) {
    const ticket = createWechatTicket()
    assert.equal(readWechatTicket(ticket.id, 'wrong'), undefined)
    assert.throws(() => claimWechatTicket(ticket.id, ticket.verifier), { statusCode: 400 })
    const state = startWechatTicket(ticket.id)
    assert.equal(completeWechatTicket(state, 'appid', openid), true)
    assert.throws(() => completeWechatTicket(state, 'appid', openid), { statusCode: 400 })
    const event = {}
    setSession(event, claimWechatTicket(ticket.id, ticket.verifier))
    assert.throws(() => claimWechatTicket(ticket.id, ticket.verifier), { statusCode: 400 })
    return event
  }
  const cycle = [
    ['crane', 'deer'],
    ['deer', 'turtle'],
    ['turtle', 'rabbit'],
    ['rabbit', 'fox'],
    ['fox', 'crane'],
  ]
  for (const [attacker, defender] of cycle) {
    assert.equal(elementBonus(attacker, defender), 1.2)
    assert.equal(elementBonus(defender, attacker), 1)
  }
  const weighted = { common: 0, uncommon: 0, rare: 0 }
  for (let roll = 0; roll < 100; roll++) {
    const item = chooseCareItem(roll, 0)
    if (['grains', 'dew_wash'].includes(item)) weighted.common++
    else if (['peach_rice', 'breeze_brush'].includes(item)) weighted.uncommon++
    else if (['fairy_feast', 'cloud_bath'].includes(item)) weighted.rare++
    else assert.fail('学习掉落不应包含战斗属性道具')
  }
  assert.deepEqual(weighted, { common: 70, uncommon: 25, rare: 5 })
  assert.throws(() => chooseCareItem(100, 0), RangeError)
  const careBase = { hunger: 80, cleanliness: 80, mood: 80, updated_at: 1000 }
  assert.deepEqual(decayCare(careBase, 1000 + 4 * 3600000), { hunger: 79, cleanliness: 80, mood: 80 })
  assert.deepEqual(decayCare(careBase, 1000 + 1000 * 3600000), { hunger: 20, cleanliness: 20, mood: 20 })
  assert.deepEqual(decayCare(careBase, 0), { hunger: 80, cleanliness: 80, mood: 80 })
  const migrated = getGame(900)
  assert.equal(migrated.pet.exp, 275)
  assert.equal(migrated.pet.attack, 23)
  assert.equal(migrated.pet.wins, 8)
  assert.equal(migrated.roster.find(entry => entry.species === 'fox').owned, true)
  assert.equal(migrated.supplies.food, 1)
  const legacyFixture = new DatabaseSync(join(dir, 'typewords.sqlite'))
  legacyFixture.prepare('INSERT INTO pet_items (user_id,item,quantity) VALUES (?,?,?)').run(900, 'ember', 1)
  legacyFixture.close()
  assert.equal(getGame(900).items.find(entry => entry.id === 'ember').quantity, 1)
  assert.equal(usePetItem(900, 'ember').pet.attack, 25)
  assert.equal(
    getGame(900).items.some(entry => entry.id === 'ember'),
    false
  )
  const first = createUser('first')
  const second = createUser('second')
  const alice = session(first)
  const bob = session(second)
  const pet = getGame(alice.id).pet
  assert.ok(['fox', 'rabbit', 'deer', 'crane', 'turtle'].includes(pet.species))
  assert.deepEqual(readProgress(alice.id), { revision: 0, data: null })
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const progress = { days: { [day]: ['hello'] } }
  assert.equal(writeProgress(alice.id, 0, progress), 1)
  let state = getGame(alice.id)
  assert.ok(state.todayReward)
  assert.equal(
    state.items.reduce((sum, item) => sum + item.quantity, 0),
    1
  )
  assert.equal(state.pet.exp, 25)
  assert.equal(state.supplies.food, 1)
  assert.equal(state.supplies.beacon, 1)
  assert.equal(state.streak, 1)
  assert.ok(state.items.find(entry => entry.quantity > 0 && entry.kind !== 'legacy'))
  assert.equal(state.pet.care.hunger, 80)
  const greeted = greetPet(alice.id)
  assert.equal(greeted.pet.care.mood, 88)
  assert.equal(greeted.supplies.food, 2)
  assert.equal(greeted.supplies.beacon, 2)
  assert.throws(() => greetPet(alice.id), { statusCode: 409 })
  assert.equal(writeProgress(alice.id, 1, progress), 2)
  assert.equal(
    getGame(alice.id).items.reduce((sum, item) => sum + item.quantity, 0),
    1
  )
  assert.throws(() => writeProgress(alice.id, 1, progress), { statusCode: 409 })
  const item = state.items.find(item => item.quantity)
  const oldTotal = state.pet.attack + state.pet.defense + state.pet.spirit
  const careBefore = getGame(alice.id).pet.care
  state = usePetItem(alice.id, item.id)
  assert.equal(state.pet.attack + state.pet.defense + state.pet.spirit, oldTotal)
  assert.ok(state.pet.care.hunger > careBefore.hunger || state.pet.care.cleanliness > careBefore.cleanliness)
  assert.equal(state.items.find(entry => entry.id === item.id).quantity, 0)
  assert.throws(() => usePetItem(alice.id, item.id), { statusCode: 400 })
  assert.throws(() => battlePet(alice.id, state.pet.id), { statusCode: 400 })
  const opponentPet = getGame(bob.id).pet
  const opponent = opponentPet.id
  for (let i = 0; i < 5; i++) battlePet(alice.id, opponent)
  const opponentFixture = new DatabaseSync(join(dir, 'typewords.sqlite'))
  opponentFixture.prepare('UPDATE pets SET name=? WHERE user_id=?').run('新名字', bob.id)
  opponentFixture.close()
  assert.equal(getGame(alice.id).records[0].opponent, opponentPet.name)
  assert.equal(getGame(alice.id).battlesLeft, 0)
  assert.throws(() => battlePet(alice.id, opponent), { statusCode: 429 })
  assert.equal(getGame(bob.id).pet.wins + getGame(bob.id).pet.losses, 5)
  assert.equal(readProgress(bob.id).data, null)
  const dayOffset = offset =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(Date.now() + offset * 86400000))
  const pending = {
    days: { [day]: ['hello'], [dayOffset(-1)]: ['world'], [dayOffset(-9)]: ['old'], [dayOffset(1)]: ['future'] },
  }
  const before = getGame(alice.id).items.reduce((sum, entry) => sum + entry.quantity, 0)
  assert.equal(writeProgress(alice.id, 2, pending), 3)
  assert.equal(
    getGame(alice.id).items.reduce((sum, entry) => sum + entry.quantity, 0),
    before + 1
  )
  // 随机相遇无论成功或失败都只消耗一次寻缘符。
  const resources = getGame(alice.id).supplies
  const found = encounterPet(alice.id)
  assert.equal(found.game.supplies.beacon, resources.beacon - 1)
  assert.equal(
    found.game.roster.find(entry => entry.species === found.encounter.species).owned,
    found.encounter.caught || found.encounter.duplicate || state.pet.species === found.encounter.species
  )
  const fixture = new DatabaseSync(join(dir, 'typewords.sqlite'))
  const original = getGame(alice.id).pet
  const anotherSpecies = ['fox', 'rabbit', 'deer', 'crane', 'turtle'].find(species => species !== original.species)
  fixture.prepare('INSERT OR IGNORE INTO pet_roster (user_id,species) VALUES (?,?)').run(alice.id, anotherSpecies)
  const otherPet = switchPet(alice.id, anotherSpecies).pet
  assert.equal(otherPet.species, anotherSpecies)
  assert.deepEqual(otherPet.care, { hunger: 80, cleanliness: 80, mood: 80 })
  const returned = switchPet(alice.id, original.species).pet
  assert.equal(returned.exp, original.exp)
  assert.equal(returned.attack, original.attack)
  assert.deepEqual(returned.care, original.care)
  const oldTime = Date.now() - 24 * 3600000 - 1000
  fixture
    .prepare('UPDATE pet_care SET updated_at=? WHERE user_id=? AND species=?')
    .run(oldTime, alice.id, original.species)
  const decayed = getGame(alice.id).pet.care
  assert.equal(decayed.hunger, Math.max(20, returned.care.hunger - 6))
  assert.equal(decayed.cleanliness, Math.max(20, returned.care.cleanliness - 4))
  assert.equal(decayed.mood, Math.max(20, returned.care.mood - 3))
  assert.equal(
    fixture.prepare('SELECT updated_at FROM pet_care WHERE user_id=? AND species=?').get(alice.id, original.species)
      .updated_at,
    oldTime
  )
  const traveling = startJourney(alice.id)
  assert.ok(traveling.journey)
  assert.equal(traveling.supplies.food, resources.food - 1)
  assert.throws(() => startJourney(alice.id), { statusCode: 409 })
  assert.throws(() => encounterPet(alice.id), { statusCode: 409 })
  assert.throws(() => switchPet(alice.id, anotherSpecies), { statusCode: 409 })
  assert.throws(() => usePetItem(alice.id, item.id), { statusCode: 409 })
  assert.throws(() => battlePet(alice.id, opponent), { statusCode: 409 })
  assert.equal(
    getGame(bob.id).opponents.some(entry => entry.id === original.id),
    false
  )
  // 模拟服务停止期间旅行到期；切换时应先将修为结算给原灵兽。
  fixture.prepare('UPDATE pet_journeys SET returns_at=? WHERE user_id=?').run(Date.now() - 1, alice.id)
  assert.equal(switchPet(alice.id, anotherSpecies).pet.species, anotherSpecies)
  const home = switchPet(alice.id, original.species)
  assert.equal(home.pet.exp, returned.exp + 15)
  assert.equal(home.journey, null)
  assert.equal(home.souvenirs.length, 1)
  assert.ok(home.souvenirs[0].note)
  assert.equal(getGame(alice.id).souvenirs[0].quantity, 1)
  fixture.close()
  const countBeforeStreak = getGame(alice.id).items.reduce((sum, entry) => sum + entry.quantity, 0)
  const threeDays = { days: { ...pending.days, [dayOffset(-2)]: ['another'] } }
  assert.equal(writeProgress(alice.id, 3, threeDays), 4)
  const streakState = getGame(alice.id)
  assert.equal(streakState.streak, 3)
  assert.ok(streakState.bonusToday)
  assert.equal(
    streakState.items.reduce((sum, entry) => sum + entry.quantity, 0),
    countBeforeStreak + 2
  )
  assert.equal(writeProgress(alice.id, 4, threeDays), 5)
  assert.equal(
    getGame(alice.id).items.reduce((sum, entry) => sum + entry.quantity, 0),
    countBeforeStreak + 2
  )
  const again = createUser('first')
  assert.equal(session(again).id, alice.id)
  assert.equal(getGame(alice.id).pet.id, pet.id)
  logout(first)
  assert.equal(session(first), null)
  console.log('微信登录、五行相克、稀有度、照料、连学奖励、旅行和对战检查通过')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
