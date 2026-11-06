import './config.ts'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import type { H3Event } from 'h3'

const directory = resolve(process.env.TYPEWORDS_DATA_DIR || '.data')
mkdirSync(directory, { recursive: true })
const db = new DatabaseSync(resolve(directory, 'typewords.sqlite'))
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS progress (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wechat_identities (appid TEXT NOT NULL, openid TEXT NOT NULL, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id), PRIMARY KEY(appid, openid));
CREATE TABLE IF NOT EXISTS wechat_tickets (id TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires INTEGER NOT NULL, state TEXT, user_id INTEGER REFERENCES users(id), error TEXT, wechat_appid TEXT, wechat_openid TEXT);
CREATE TABLE IF NOT EXISTS pets (user_id INTEGER PRIMARY KEY REFERENCES users(id), public_id TEXT NOT NULL UNIQUE, species TEXT NOT NULL, name TEXT NOT NULL, exp INTEGER NOT NULL DEFAULT 0, attack INTEGER NOT NULL DEFAULT 0, defense INTEGER NOT NULL DEFAULT 0, spirit INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS pet_items (user_id INTEGER NOT NULL REFERENCES users(id), item TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0), PRIMARY KEY(user_id, item));
CREATE TABLE IF NOT EXISTS pet_rewards (user_id INTEGER NOT NULL REFERENCES users(id), day TEXT NOT NULL, item TEXT NOT NULL, PRIMARY KEY(user_id, day));
CREATE TABLE IF NOT EXISTS pet_battles (id INTEGER PRIMARY KEY, challenger INTEGER NOT NULL REFERENCES users(id), defender INTEGER NOT NULL REFERENCES users(id), day TEXT NOT NULL, won INTEGER NOT NULL, challenger_score INTEGER NOT NULL, defender_score INTEGER NOT NULL, created_at INTEGER NOT NULL, opponent_name TEXT);
CREATE TABLE IF NOT EXISTS pet_roster (user_id INTEGER NOT NULL REFERENCES users(id), species TEXT NOT NULL, exp INTEGER NOT NULL DEFAULT 0, attack INTEGER NOT NULL DEFAULT 0, defense INTEGER NOT NULL DEFAULT 0, spirit INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,species));
CREATE TABLE IF NOT EXISTS adventure_supplies (user_id INTEGER PRIMARY KEY REFERENCES users(id), food INTEGER NOT NULL DEFAULT 1 CHECK(food>=0), beacon INTEGER NOT NULL DEFAULT 1 CHECK(beacon>=0));
CREATE TABLE IF NOT EXISTS pet_journeys (user_id INTEGER PRIMARY KEY REFERENCES users(id), species TEXT NOT NULL, destination TEXT NOT NULL, souvenir TEXT NOT NULL, started_at INTEGER NOT NULL, returns_at INTEGER NOT NULL, claimed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS pet_souvenirs (user_id INTEGER NOT NULL REFERENCES users(id), souvenir TEXT NOT NULL, destination TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, last_at INTEGER NOT NULL, PRIMARY KEY(user_id,souvenir));
CREATE TABLE IF NOT EXISTS pet_care (user_id INTEGER NOT NULL REFERENCES users(id), species TEXT NOT NULL, hunger INTEGER NOT NULL DEFAULT 80, cleanliness INTEGER NOT NULL DEFAULT 80, mood INTEGER NOT NULL DEFAULT 80, updated_at INTEGER NOT NULL, PRIMARY KEY(user_id,species));
CREATE TABLE IF NOT EXISTS pet_greetings (user_id INTEGER NOT NULL REFERENCES users(id), day TEXT NOT NULL, PRIMARY KEY(user_id,day));
CREATE TABLE IF NOT EXISTS pet_streak_bonuses (user_id INTEGER NOT NULL REFERENCES users(id), day TEXT NOT NULL, item TEXT NOT NULL, PRIMARY KEY(user_id,day));




`)

// 兼容已有票据表，保留账号和学习数据。
const ticketColumns = db.prepare('PRAGMA table_info(wechat_tickets)').all() as Array<{ name: string }>
if (!ticketColumns.some(column => column.name === 'wechat_appid'))
  db.exec('ALTER TABLE wechat_tickets ADD COLUMN wechat_appid TEXT')
if (!ticketColumns.some(column => column.name === 'wechat_openid'))
  db.exec('ALTER TABLE wechat_tickets ADD COLUMN wechat_openid TEXT')
const battleColumns = db.prepare('PRAGMA table_info(pet_battles)').all() as Array<{ name: string }>
if (!battleColumns.some(column => column.name === 'opponent_name'))
  db.exec('ALTER TABLE pet_battles ADD COLUMN opponent_name TEXT')

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export function createSession(userId: number) {
  const token = randomBytes(32).toString('hex')
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now())
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token), userId, Date.now() + 30 * 86400000)
  return token
}
export function createWechatTicket() {
  const id = randomBytes(24).toString('hex')
  const verifier = randomBytes(32).toString('hex')
  db.prepare('DELETE FROM wechat_tickets WHERE expires < ?').run(Date.now())
  db.prepare('INSERT INTO wechat_tickets (id,verifier,expires) VALUES (?,?,?)').run(
    id,
    hash(verifier),
    Date.now() + 180000
  )
  return { id, verifier }
}
export function startWechatTicket(id: string) {
  const state = randomBytes(32).toString('hex')
  const result = db
    .prepare(
      'UPDATE wechat_tickets SET state=? WHERE id=? AND expires>? AND user_id IS NULL AND error IS NULL AND state IS NULL AND wechat_openid IS NULL'
    )
    .run(hash(state), id, Date.now())
  if (!result.changes) throw createError({ statusCode: 400, statusMessage: '二维码已失效，请刷新后重试' })
  return state
}
export function completeWechatTicket(state: string, appid: string, openid: string) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const ticket = db
      .prepare('SELECT id FROM wechat_tickets WHERE state=? AND expires>? AND user_id IS NULL AND error IS NULL')
      .get(hash(state), Date.now()) as { id: string } | undefined
    if (!ticket) throw createError({ statusCode: 400, statusMessage: '授权已失效' })
    const identity = db
      .prepare('SELECT user_id FROM wechat_identities WHERE appid=? AND openid=?')
      .get(appid, openid) as { user_id: number } | undefined
    db.prepare('UPDATE wechat_tickets SET user_id=?, wechat_appid=?, wechat_openid=?, state=NULL WHERE id=?').run(
      identity?.user_id ?? null,
      appid,
      openid,
      ticket.id
    )
    db.exec('COMMIT')
    return true
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
export function failWechatTicket(state: string) {
  db.prepare('UPDATE wechat_tickets SET error=?, state=NULL WHERE state=? AND expires>? AND user_id IS NULL').run(
    '微信授权失败，请刷新二维码重试',
    hash(state),
    Date.now()
  )
}
export function readWechatTicket(id: string, verifier: string) {
  return db
    .prepare(
      'SELECT wechat_tickets.user_id, wechat_tickets.wechat_appid, wechat_tickets.wechat_openid, wechat_tickets.error, users.username FROM wechat_tickets LEFT JOIN users ON users.id=wechat_tickets.user_id WHERE wechat_tickets.id=? AND wechat_tickets.verifier=? AND wechat_tickets.expires>?'
    )
    .get(id, hash(verifier), Date.now()) as
    | {
        user_id: number | null
        wechat_appid: string | null
        wechat_openid: string | null
        username: string | null
        error: string | null
      }
    | undefined
}
export function claimWechatTicket(id: string, verifier: string) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const ticket = readWechatTicket(id, verifier)
    if (!ticket?.wechat_appid || !ticket.wechat_openid || ticket.error)
      throw createError({ statusCode: 400, statusMessage: '二维码未授权或已过期' })
    const identity = db
      .prepare('SELECT user_id FROM wechat_identities WHERE appid=? AND openid=?')
      .get(ticket.wechat_appid, ticket.wechat_openid) as { user_id: number } | undefined
    let userId = identity?.user_id
    if (!userId) {
      const username = 'wx_' + randomBytes(16).toString('hex')
      userId = Number(
        db.prepare('INSERT INTO users (username,salt,password) VALUES (?,?,?)').run(username, '', '').lastInsertRowid
      )
    }
    if (!identity) {
      db.prepare('INSERT INTO wechat_identities (appid,openid,user_id) VALUES (?,?,?)').run(
        ticket.wechat_appid,
        ticket.wechat_openid,
        userId
      )
    }
    ensurePet(userId)
    db.prepare('DELETE FROM wechat_tickets WHERE id=?').run(id)
    const token = createSession(userId)
    db.exec('COMMIT')
    return token
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
export function session(event: H3Event) {
  const token = getCookie(event, 'typewords_session')
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  return db
    .prepare(
      'SELECT users.id, users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?'
    )
    .get(hash(token), Date.now()) as { id: number; username: string } | undefined
}
export function setSession(event: H3Event, token: string) {
  setCookie(event, 'typewords_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 86400,
  })
}
export function logout(event: H3Event) {
  const token = getCookie(event, 'typewords_session')
  if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token))
  deleteCookie(event, 'typewords_session', { path: '/' })
}
export function requireUser(event: H3Event) {
  const user = session(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: '请先登录' })
  return user
}
export function readProgress(userId: number) {
  const row = db.prepare('SELECT revision,data FROM progress WHERE user_id=?').get(userId) as
    { revision: number; data: string } | undefined
  return row ? { revision: row.revision, data: JSON.parse(row.data) } : { revision: 0, data: null }
}
export function writeProgress(userId: number, revision: number, data: unknown) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const current = readProgress(userId)
    if (current.revision !== revision)
      throw createError({ statusCode: 409, statusMessage: '其他设备已更新进度，请先恢复后重试' })
    db.prepare(
      'INSERT INTO progress (user_id,revision,data) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,data=excluded.data'
    ).run(userId, revision + 1, JSON.stringify(data))
    grantStudyRewards(userId, current.data, data)
    db.exec('COMMIT')
    return revision + 1
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

const PET_SPECIES = [
  { species: 'fox', name: '小灵狐' },
  { species: 'rabbit', name: '月灵兔' },
  { species: 'deer', name: '青芽鹿' },
  { species: 'crane', name: '云羽鹤' },
  { species: 'turtle', name: '山灵龟' },
] as const
const ITEM_EFFECTS = {
  grains: {
    name: '灵谷饭',
    kind: 'food',
    rarity: 'common',
    description: '饱食 +30，心情 +3',
    effect: { hunger: 30, mood: 3 },
  },
  dew_wash: {
    name: '清泉露',
    kind: 'clean',
    rarity: 'common',
    description: '洁净 +30，心情 +3',
    effect: { cleanliness: 30, mood: 3 },
  },
  peach_rice: {
    name: '蜜桃饭',
    kind: 'food',
    rarity: 'uncommon',
    description: '饱食 +55，心情 +6',
    effect: { hunger: 55, mood: 6 },
  },
  breeze_brush: {
    name: '清风梳',
    kind: 'clean',
    rarity: 'uncommon',
    description: '洁净 +55，心情 +6',
    effect: { cleanliness: 55, mood: 6 },
  },
  fairy_feast: {
    name: '仙果拼盘',
    kind: 'food',
    rarity: 'rare',
    description: '饱食 +75，心情 +15',
    effect: { hunger: 75, mood: 15 },
  },
  cloud_bath: {
    name: '云锦沐浴',
    kind: 'clean',
    rarity: 'rare',
    description: '洁净 +75，心情 +15',
    effect: { cleanliness: 75, mood: 15 },
  },
  // 保留玩家已经获得的旧道具，不再作为学习掉落。
  ember: { name: '赤焰果', kind: 'legacy', rarity: 'legacy', description: '攻击 +2', effect: { attack: 2 } },
  dew: { name: '凝露草', kind: 'legacy', rarity: 'legacy', description: '防御 +2', effect: { defense: 2 } },
  crystal: { name: '灵光石', kind: 'legacy', rarity: 'legacy', description: '灵力 +2', effect: { spirit: 2 } },
} as const
const CARE_POOLS = {
  common: ['grains', 'dew_wash'],
  uncommon: ['peach_rice', 'breeze_brush'],
  rare: ['fairy_feast', 'cloud_bath'],
} as const
export function chooseCareItem(roll: number, variant: number) {
  if (!Number.isInteger(roll) || roll < 0 || roll >= 100 || !Number.isInteger(variant) || variant < 0 || variant > 1)
    throw new RangeError('Invalid care item roll')
  return CARE_POOLS[roll < 70 ? 'common' : roll < 95 ? 'uncommon' : 'rare'][variant]
}
function randomCareItem() {
  return chooseCareItem(randomInt(100), randomInt(2))
}

type Pet = {
  user_id: number
  public_id: string
  species: string
  name: string
  exp: number
  attack: number
  defense: number
  spirit: number
  wins: number
  losses: number
}
function chinaDay() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
function petLevel(pet: Pet) {
  return 1 + Math.floor(pet.exp / 100)
}
type Care = { hunger: number; cleanliness: number; mood: number; updated_at: number }
export function decayCare(care: Care, now: number) {
  const hours = Math.max(0, now - care.updated_at) / 3600000
  return {
    hunger: Math.max(20, care.hunger - Math.floor(hours / 4)),
    cleanliness: Math.max(20, care.cleanliness - Math.floor(hours / 6)),
    mood: Math.max(20, care.mood - Math.floor(hours / 8)),
  }
}
function getCare(userId: number, species: string) {
  const care = db
    .prepare('SELECT hunger,cleanliness,mood,updated_at FROM pet_care WHERE user_id=? AND species=?')
    .get(userId, species) as Care | undefined
  return decayCare(care ?? { hunger: 80, cleanliness: 80, mood: 80, updated_at: Date.now() }, Date.now())
}
function saveCare(userId: number, species: string, care: { hunger: number; cleanliness: number; mood: number }) {
  db.prepare(
    'INSERT INTO pet_care (user_id,species,hunger,cleanliness,mood,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,species) DO UPDATE SET hunger=excluded.hunger,cleanliness=excluded.cleanliness,mood=excluded.mood,updated_at=excluded.updated_at'
  ).run(userId, species, care.hunger, care.cleanliness, care.mood, Date.now())
}
function publicPet(pet: Pet) {
  const level = petLevel(pet)
  return {
    id: pet.public_id,
    name: pet.name,
    species: pet.species,
    level,
    exp: pet.exp,
    attack: 10 + level * 2 + pet.attack,
    defense: 8 + level * 2 + pet.defense,
    spirit: 8 + level * 2 + pet.spirit,
    wins: pet.wins,
    losses: pet.losses,
    element:
      ({ fox: '火', rabbit: '水', deer: '木', crane: '金', turtle: '土' } as Record<string, string>)[pet.species] ||
      '木',
    care: getCare(pet.user_id, pet.species),
    stage: level >= 5 ? '化灵' : '初生',
  }
}
function ensurePet(userId: number) {
  let pet = db.prepare('SELECT * FROM pets WHERE user_id=?').get(userId) as Pet | undefined
  if (!pet) {
    const choice = PET_SPECIES[randomInt(PET_SPECIES.length)]
    db.prepare('INSERT OR IGNORE INTO pets (user_id,public_id,species,name) VALUES (?,?,?,?)').run(
      userId,
      randomBytes(12).toString('hex'),
      choice.species,
      choice.name
    )
    pet = db.prepare('SELECT * FROM pets WHERE user_id=?').get(userId) as Pet
  }
  db.prepare('INSERT OR IGNORE INTO pet_roster (user_id,species,exp,attack,defense,spirit) VALUES (?,?,?,?,?,?)').run(
    userId,
    pet.species,
    pet.exp,
    pet.attack,
    pet.defense,
    pet.spirit
  )
  db.prepare('INSERT OR IGNORE INTO adventure_supplies (user_id) VALUES (?)').run(userId)
  db.prepare('INSERT OR IGNORE INTO pet_care (user_id,species,updated_at) VALUES (?,?,?)').run(
    userId,
    pet.species,
    Date.now()
  )
  return pet
}

function grantStudyRewards(userId: number, previous: any, next: any) {
  const days = next?.days
  if (!days || typeof days !== 'object') return
  const today = Date.parse(chinaDay() + 'T00:00:00+08:00')
  let added = false
  for (const [day, words] of Object.entries(days).sort(([a], [b]) => a.localeCompare(b))) {
    if (!Array.isArray(words) || !words.length || previous?.days?.[day]?.length) continue
    const timestamp = Date.parse(day + 'T00:00:00+08:00')
    const age = (today - timestamp) / 86400000
    if (!Number.isInteger(age) || age < 0 || age > 7) continue
    const item = randomCareItem()
    const result = db
      .prepare('INSERT OR IGNORE INTO pet_rewards (user_id,day,item) VALUES (?,?,?)')
      .run(userId, day, item)
    if (!result.changes) continue
    added = true
    ensurePet(userId)
    db.prepare(
      'INSERT INTO pet_items (user_id,item,quantity) VALUES (?,?,1) ON CONFLICT(user_id,item) DO UPDATE SET quantity=quantity+1'
    ).run(userId, item)
    db.prepare('UPDATE pets SET exp=exp+25 WHERE user_id=?').run(userId)
  }
  if (added) grantStreakBonuses(userId)
}
function dayBefore(day: string, offset: number) {
  return new Date(Date.parse(day + 'T00:00:00Z') - offset * 86400000).toISOString().slice(0, 10)
}
function streakEnding(userId: number, day: string) {
  const rows = db
    .prepare('SELECT day FROM pet_rewards WHERE user_id=? AND day<=? ORDER BY day DESC')
    .all(userId, day) as Array<{ day: string }>
  let count = 0
  for (const row of rows) {
    if (row.day !== dayBefore(day, count)) break
    count++
  }
  return count
}
function grantStreakBonuses(userId: number) {
  const today = chinaDay()
  const days = db
    .prepare('SELECT day FROM pet_rewards WHERE user_id=? AND day>=? AND day<=? ORDER BY day')
    .all(userId, dayBefore(today, 7), today) as Array<{ day: string }>
  for (const { day } of days) {
    const streak = streakEnding(userId, day)
    if (!streak || streak % 3 !== 0) continue
    const item = randomCareItem()
    const inserted = db
      .prepare('INSERT OR IGNORE INTO pet_streak_bonuses (user_id,day,item) VALUES (?,?,?)')
      .run(userId, day, item)
    if (inserted.changes)
      db.prepare(
        'INSERT INTO pet_items (user_id,item,quantity) VALUES (?,?,1) ON CONFLICT(user_id,item) DO UPDATE SET quantity=quantity+1'
      ).run(userId, item)
  }
}
export function getGame(userId: number) {
  ensurePet(userId)
  settleJourney(userId)
  const pet = ensurePet(userId)
  const inventory = db.prepare('SELECT item,quantity FROM pet_items WHERE user_id=?').all(userId) as Array<{
    item: keyof typeof ITEM_EFFECTS
    quantity: number
  }>
  const today = chinaDay()
  const reward = db.prepare('SELECT item FROM pet_rewards WHERE user_id=? AND day=?').get(userId, today) as
    { item: keyof typeof ITEM_EFFECTS } | undefined
  const streak = streakEnding(userId, today) || streakEnding(userId, dayBefore(today, 1))
  const greeted = !!db.prepare('SELECT 1 FROM pet_greetings WHERE user_id=? AND day=?').get(userId, today)
  const bonus = db.prepare('SELECT item FROM pet_streak_bonuses WHERE user_id=? AND day=?').get(userId, today) as
    { item: keyof typeof ITEM_EFFECTS } | undefined
  const battlesToday = db
    .prepare('SELECT COUNT(*) AS count FROM pet_battles WHERE challenger=? AND day=?')
    .get(userId, today) as { count: number }
  const opponents = db
    .prepare(
      'SELECT p.* FROM pets p WHERE p.user_id<>? AND NOT EXISTS (SELECT 1 FROM pet_journeys j WHERE j.user_id=p.user_id AND j.claimed=0 AND j.returns_at>?) ORDER BY p.wins DESC, p.exp DESC LIMIT 30'
    )
    .all(userId, Date.now()) as Pet[]
  const records = db
    .prepare(
      'SELECT b.won,b.challenger_score,b.defender_score,b.created_at,COALESCE(b.opponent_name,p.name) AS opponent FROM pet_battles b JOIN pets p ON p.user_id=b.defender WHERE b.challenger=? ORDER BY b.id DESC LIMIT 10'
    )
    .all(userId)
  const supplies = db.prepare('SELECT food,beacon FROM adventure_supplies WHERE user_id=?').get(userId) as {
    food: number
    beacon: number
  }
  const roster = db
    .prepare('SELECT species,exp,attack,defense,spirit FROM pet_roster WHERE user_id=?')
    .all(userId) as Array<{ species: string; exp: number; attack: number; defense: number; spirit: number }>
  const journey = db
    .prepare('SELECT species,destination,started_at,returns_at,claimed FROM pet_journeys WHERE user_id=?')
    .get(userId) as
    { species: string; destination: string; started_at: number; returns_at: number; claimed: number } | undefined
  const souvenirs = db
    .prepare('SELECT souvenir,destination,quantity,last_at FROM pet_souvenirs WHERE user_id=? ORDER BY last_at DESC')
    .all(userId)
  return {
    pet: publicPet(pet),
    supplies,
    roster: PET_SPECIES.map(entry => {
      const found = roster.find(row => row.species === entry.species)
      return {
        ...entry,
        owned: !!found,
        active: pet.species === entry.species,
        level: found ? 1 + Math.floor((pet.species === entry.species ? pet.exp : found.exp) / 100) : null,
      }
    }),
    journey: journey && !journey.claimed ? journey : null,
    souvenirs: (souvenirs as Array<{ souvenir: string; destination: string; quantity: number; last_at: number }>).map(
      item => ({
        ...item,
        note:
          JOURNEY_PLACES.find(place => place.destination === item.destination)?.note ?? '它带回了一段温柔的旅途记忆。',
      })
    ),
    items: Object.entries(ITEM_EFFECTS)
      .map(([id, item]) => ({
        id,
        name: item.name,
        kind: item.kind,
        rarity: item.rarity,
        description: item.description,
        quantity: inventory.find(v => v.item === id)?.quantity ?? 0,
      }))
      .filter(item => item.kind !== 'legacy' || item.quantity > 0),
    todayReward: reward ? (ITEM_EFFECTS[reward.item]?.name ?? null) : null,
    streak,
    greeted,
    bonusToday: bonus ? (ITEM_EFFECTS[bonus.item]?.name ?? null) : null,
    battlesLeft: Math.max(0, 5 - battlesToday.count),
    opponents: opponents.map(publicPet),
    records,
  }
}
export function usePetItem(userId: number, item: string) {
  if (!Object.hasOwn(ITEM_EFFECTS, item)) throw createError({ statusCode: 400, statusMessage: '道具不存在' })
  const effect: {
    hunger?: number
    cleanliness?: number
    mood?: number
    attack?: number
    defense?: number
    spirit?: number
  } = ITEM_EFFECTS[item as keyof typeof ITEM_EFFECTS].effect
  db.exec('BEGIN IMMEDIATE')
  try {
    const pet = ensurePet(userId)
    if (isAway(userId)) throw createError({ statusCode: 409, statusMessage: '仙宠正在旅行，回家后再使用灵物' })
    const care = getCare(userId, pet.species)
    const next = {
      hunger: Math.min(100, care.hunger + (effect.hunger || 0)),
      cleanliness: Math.min(100, care.cleanliness + (effect.cleanliness || 0)),
      mood: Math.min(100, care.mood + (effect.mood || 0)),
    }
    if (
      !effect.attack &&
      !effect.defense &&
      !effect.spirit &&
      next.hunger === care.hunger &&
      next.cleanliness === care.cleanliness &&
      next.mood === care.mood
    )
      throw createError({ statusCode: 400, statusMessage: '当前状态已满，稍后再使用吧' })
    const used = db
      .prepare('UPDATE pet_items SET quantity=quantity-1 WHERE user_id=? AND item=? AND quantity>0')
      .run(userId, item)
    if (!used.changes) throw createError({ statusCode: 400, statusMessage: '道具数量不足' })
    if (effect.attack || effect.defense || effect.spirit) {
      db.prepare('UPDATE pets SET attack=attack+?,defense=defense+?,spirit=spirit+? WHERE user_id=?').run(
        effect.attack || 0,
        effect.defense || 0,
        effect.spirit || 0,
        userId
      )
    } else saveCare(userId, pet.species, next)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return getGame(userId)
}
export function greetPet(userId: number) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const pet = ensurePet(userId)
    if (isAway(userId)) throw createError({ statusCode: 409, statusMessage: '仙宠正在旅行，回家后再打招呼' })
    const inserted = db
      .prepare('INSERT OR IGNORE INTO pet_greetings (user_id,day) VALUES (?,?)')
      .run(userId, chinaDay())
    if (!inserted.changes) throw createError({ statusCode: 409, statusMessage: '今天已经打过招呼了' })
    const care = getCare(userId, pet.species)
    saveCare(userId, pet.species, { ...care, mood: Math.min(100, care.mood + 8) })
    db.prepare('UPDATE adventure_supplies SET food=food+1,beacon=beacon+1 WHERE user_id=?').run(userId)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return getGame(userId)
}
export function elementBonus(attacker: string, defender: string) {
  const beats: Record<string, string> = { crane: 'deer', deer: 'turtle', turtle: 'rabbit', rabbit: 'fox', fox: 'crane' }
  return beats[attacker] === defender ? 1.2 : 1
}
export function battlePet(userId: number, opponentId: string) {
  if (!/^[a-f0-9]{24}$/.test(opponentId)) throw createError({ statusCode: 400, statusMessage: '对手无效' })
  db.exec('BEGIN IMMEDIATE')
  let result: { won: boolean; challengerScore: number; defenderScore: number }
  try {
    const challenger = ensurePet(userId)
    if (isAway(userId)) throw createError({ statusCode: 409, statusMessage: '仙宠正在旅行，回家后再切磋' })
    const defender = db.prepare('SELECT * FROM pets WHERE public_id=?').get(opponentId) as Pet | undefined
    if (!defender || defender.user_id === userId) throw createError({ statusCode: 400, statusMessage: '对手无效' })
    if (isAway(defender.user_id)) throw createError({ statusCode: 409, statusMessage: '对方仙宠正在旅行' })
    const today = chinaDay()
    const count = db
      .prepare('SELECT COUNT(*) AS count FROM pet_battles WHERE challenger=? AND day=?')
      .get(userId, today) as { count: number }
    if (count.count >= 5) throw createError({ statusCode: 429, statusMessage: '今日挑战次数已用完' })
    const score = (pet: Pet) => {
      const p = publicPet(pet)
      const average = (p.care.hunger + p.care.cleanliness + p.care.mood) / 3
      return (p.attack * 2 + p.defense + p.spirit + randomInt(21)) * (0.85 + average * 0.0015)
    }
    const challengerScore = Math.round(score(challenger) * elementBonus(challenger.species, defender.species))
    const defenderScore = Math.round(score(defender) * elementBonus(defender.species, challenger.species))
    const won = challengerScore >= defenderScore
    db.prepare(
      'INSERT INTO pet_battles (challenger,defender,day,won,challenger_score,defender_score,created_at,opponent_name) VALUES (?,?,?,?,?,?,?,?)'
    ).run(userId, defender.user_id, today, won ? 1 : 0, challengerScore, defenderScore, Date.now(), defender.name)
    db.prepare('UPDATE pets SET wins=wins+?, losses=losses+?, exp=exp+? WHERE user_id=?').run(
      won ? 1 : 0,
      won ? 0 : 1,
      won ? 20 : 10,
      userId
    )
    db.prepare('UPDATE pets SET wins=wins+?, losses=losses+? WHERE user_id=?').run(
      won ? 0 : 1,
      won ? 1 : 0,
      defender.user_id
    )
    db.exec('COMMIT')
    result = { won, challengerScore, defenderScore }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return { result, game: getGame(userId) }
}

const JOURNEY_PLACES = [
  { destination: '云雾山', souvenir: '云纹石', note: '它说，山顶的云摸起来像柔软的棉花。' },
  { destination: '碧波湖', souvenir: '映月贝', note: '湖面藏着一轮月亮，晚风吹出了涟漪。' },
  { destination: '青竹林', souvenir: '竹叶书签', note: '它在竹影里休息，听了一下午的风声。' },
  { destination: '星光原', souvenir: '星砂瓶', note: '夜色里落下了细碎的星光，它悄悄捡了一点。' },
] as const
function isAway(userId: number) {
  return !!db
    .prepare('SELECT 1 FROM pet_journeys WHERE user_id=? AND claimed=0 AND returns_at>?')
    .get(userId, Date.now())
}
function settleJourney(userId: number) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const journey = db
      .prepare(
        'SELECT destination,souvenir,returns_at FROM pet_journeys WHERE user_id=? AND claimed=0 AND returns_at<=?'
      )
      .get(userId, Date.now()) as { destination: string; souvenir: string; returns_at: number } | undefined
    if (journey) {
      db.prepare(
        'INSERT INTO pet_souvenirs (user_id,souvenir,destination,quantity,last_at) VALUES (?,?,?,1,?) ON CONFLICT(user_id,souvenir) DO UPDATE SET quantity=quantity+1,last_at=excluded.last_at'
      ).run(userId, journey.souvenir, journey.destination, journey.returns_at)
      db.prepare('UPDATE pets SET exp=exp+15 WHERE user_id=?').run(userId)
      db.prepare('UPDATE pet_journeys SET claimed=1 WHERE user_id=?').run(userId)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
export function startJourney(userId: number) {
  ensurePet(userId)
  settleJourney(userId)
  db.exec('BEGIN IMMEDIATE')
  try {
    const current = ensurePet(userId)
    if (isAway(userId)) throw createError({ statusCode: 409, statusMessage: '仙宠已经在旅途中' })
    const used = db.prepare('UPDATE adventure_supplies SET food=food-1 WHERE user_id=? AND food>0').run(userId)
    if (!used.changes) throw createError({ statusCode: 400, statusMessage: '行囊不足，完成每日学习可获得' })
    const place = JOURNEY_PLACES[randomInt(JOURNEY_PLACES.length)]
    const now = Date.now()
    db.prepare(
      'INSERT INTO pet_journeys (user_id,species,destination,souvenir,started_at,returns_at,claimed) VALUES (?,?,?,?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET species=excluded.species,destination=excluded.destination,souvenir=excluded.souvenir,started_at=excluded.started_at,returns_at=excluded.returns_at,claimed=0'
    ).run(userId, current.species, place.destination, place.souvenir, now, now + 3600000)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return getGame(userId)
}
export function encounterPet(userId: number) {
  db.exec('BEGIN IMMEDIATE')
  let encounter: { species: string; name: string; caught: boolean; duplicate: boolean }
  try {
    const pet = ensurePet(userId)
    if (isAway(userId)) throw createError({ statusCode: 409, statusMessage: '仙宠旅行中，回家后再去寻缘' })
    const used = db.prepare('UPDATE adventure_supplies SET beacon=beacon-1 WHERE user_id=? AND beacon>0').run(userId)
    if (!used.changes) throw createError({ statusCode: 400, statusMessage: '寻缘符不足，完成每日学习可获得' })
    const choice = PET_SPECIES[randomInt(PET_SPECIES.length)]
    const caught = randomInt(100) < 85
    const owned = !!db.prepare('SELECT 1 FROM pet_roster WHERE user_id=? AND species=?').get(userId, choice.species)
    if (caught && !owned)
      db.prepare('INSERT INTO pet_roster (user_id,species) VALUES (?,?)').run(userId, choice.species)
    if (caught && owned) {
      if (pet.species === choice.species) db.prepare('UPDATE pets SET exp=exp+15 WHERE user_id=?').run(userId)
      else db.prepare('UPDATE pet_roster SET exp=exp+15 WHERE user_id=? AND species=?').run(userId, choice.species)
    }
    encounter = { ...choice, caught, duplicate: caught && owned }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return { encounter, game: getGame(userId) }
}
export function switchPet(userId: number, species: string) {
  if (!PET_SPECIES.some(item => item.species === species))
    throw createError({ statusCode: 400, statusMessage: '灵兽不存在' })
  ensurePet(userId)
  settleJourney(userId)
  db.exec('BEGIN IMMEDIATE')
  try {
    const current = ensurePet(userId)
    if (isAway(userId)) throw createError({ statusCode: 409, statusMessage: '仙宠旅行中，回家后再更换' })
    const next = db.prepare('SELECT * FROM pet_roster WHERE user_id=? AND species=?').get(userId, species) as
      { exp: number; attack: number; defense: number; spirit: number } | undefined
    if (!next) throw createError({ statusCode: 400, statusMessage: '尚未遇见这只灵兽' })
    if (current.species !== species) {
      db.prepare('UPDATE pet_roster SET exp=?,attack=?,defense=?,spirit=? WHERE user_id=? AND species=?').run(
        current.exp,
        current.attack,
        current.defense,
        current.spirit,
        userId,
        current.species
      )
      const name = PET_SPECIES.find(item => item.species === species)!.name
      db.prepare('UPDATE pets SET species=?,name=?,exp=?,attack=?,defense=?,spirit=? WHERE user_id=?').run(
        species,
        name,
        next.exp,
        next.attack,
        next.defense,
        next.spirit,
        userId
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return getGame(userId)
}
