import './config.ts'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

const directory = resolve(process.env.TYPEWORDS_DATA_DIR || '.data')
mkdirSync(directory, { recursive: true })
const db = new DatabaseSync(resolve(directory, 'typewords.sqlite'))
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS progress (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wechat_identities (appid TEXT NOT NULL, openid TEXT NOT NULL, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id), PRIMARY KEY(appid, openid));
CREATE TABLE IF NOT EXISTS wechat_tickets (id TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires INTEGER NOT NULL, state TEXT, user_id INTEGER REFERENCES users(id), bind_user_id INTEGER REFERENCES users(id), error TEXT, wechat_appid TEXT, wechat_openid TEXT);

`)

// 兼容已有票据表，保留账号和学习数据。
const ticketColumns = db.prepare('PRAGMA table_info(wechat_tickets)').all() as Array<{ name: string }>
if (!ticketColumns.some(column => column.name === 'wechat_appid'))
  db.exec('ALTER TABLE wechat_tickets ADD COLUMN wechat_appid TEXT')
if (!ticketColumns.some(column => column.name === 'wechat_openid'))
  db.exec('ALTER TABLE wechat_tickets ADD COLUMN wechat_openid TEXT')

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const passwordHash = (password: string, salt: string) => scryptSync(password, salt, 64).toString('hex')
const validCredentials = (username: unknown, password: unknown) =>
  typeof username === 'string' &&
  /^[a-zA-Z0-9_]{3,32}$/.test(username) &&
  typeof password === 'string' &&
  password.length >= 8 &&
  password.length <= 128

export function credentials(username: unknown, password: unknown) {
  if (!validCredentials(username, password))
    throw createError({
      statusCode: 400,
      statusMessage: '用户名需为 3 至 32 位字母、数字或下划线，密码需为 8 至 128 位',
    })
  return { username: (username as string).toLowerCase(), password: password as string }
}
export function verifyLegacy(username: string, password: string) {
  const user = db.prepare('SELECT id, salt, password FROM users WHERE username=?').get(username) as any
  const salt = user?.salt ?? '00000000000000000000000000000000'
  const actual = Buffer.from(passwordHash(password, salt), 'hex')
  const expected = Buffer.from(user?.password ?? '00'.repeat(64), 'hex')
  if (!timingSafeEqual(actual, expected) || !user)
    throw createError({ statusCode: 401, statusMessage: '用户名或密码错误' })
  return { id: user.id as number, username }
}
export function createSession(userId: number) {
  const token = randomBytes(32).toString('hex')
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now())
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token), userId, Date.now() + 30 * 86400000)
  return token
}
export function createWechatTicket(bindUserId?: number) {
  const id = randomBytes(24).toString('hex')
  const verifier = randomBytes(32).toString('hex')
  db.prepare('DELETE FROM wechat_tickets WHERE expires < ?').run(Date.now())
  db.prepare('INSERT INTO wechat_tickets (id,verifier,expires,bind_user_id) VALUES (?,?,?,?)').run(
    id,
    hash(verifier),
    Date.now() + 180000,
    bindUserId ?? null
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
      .prepare(
        'SELECT id, bind_user_id FROM wechat_tickets WHERE state=? AND expires>? AND user_id IS NULL AND error IS NULL'
      )
      .get(hash(state), Date.now()) as { id: string; bind_user_id: number | null } | undefined
    if (!ticket) throw createError({ statusCode: 400, statusMessage: '授权已失效' })
    const identity = db
      .prepare('SELECT user_id FROM wechat_identities WHERE appid=? AND openid=?')
      .get(appid, openid) as { user_id: number } | undefined
    if (ticket.bind_user_id && identity && identity.user_id !== ticket.bind_user_id) {
      db.prepare('UPDATE wechat_tickets SET error=?, state=NULL WHERE id=?').run('此微信已绑定其他账号', ticket.id)
      db.exec('COMMIT')
      return false
    }
    if (ticket.bind_user_id) {
      const bound = db
        .prepare('SELECT appid, openid FROM wechat_identities WHERE user_id=?')
        .get(ticket.bind_user_id) as { appid: string; openid: string } | undefined
      if (bound && (bound.appid !== appid || bound.openid !== openid)) {
        db.prepare('UPDATE wechat_tickets SET error=?, state=NULL WHERE id=?').run('此账号已绑定其他微信', ticket.id)
        db.exec('COMMIT')
        return false
      }
    }
    db.prepare('UPDATE wechat_tickets SET user_id=?, wechat_appid=?, wechat_openid=?, state=NULL WHERE id=?').run(
      ticket.bind_user_id ?? identity?.user_id ?? null,
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
      'SELECT wechat_tickets.user_id, wechat_tickets.bind_user_id, wechat_tickets.wechat_appid, wechat_tickets.wechat_openid, wechat_tickets.error, users.username FROM wechat_tickets LEFT JOIN users ON users.id=wechat_tickets.user_id WHERE wechat_tickets.id=? AND wechat_tickets.verifier=? AND wechat_tickets.expires>?'
    )
    .get(id, hash(verifier), Date.now()) as
    | {
        user_id: number | null
        bind_user_id: number | null
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
    if (identity && ticket.bind_user_id && identity.user_id !== ticket.bind_user_id)
      throw createError({ statusCode: 409, statusMessage: '此微信已绑定其他账号' })
    let userId = ticket.bind_user_id ?? identity?.user_id
    if (!userId) {
      const username = 'wx_' + randomBytes(16).toString('hex')
      const salt = randomBytes(16).toString('hex')
      userId = Number(
        db
          .prepare('INSERT INTO users (username,salt,password) VALUES (?,?,?)')
          .run(username, salt, passwordHash(randomBytes(32).toString('hex'), salt)).lastInsertRowid
      )
    }
    if (!identity) {
      const bound = db.prepare('SELECT 1 FROM wechat_identities WHERE user_id=?').get(userId)
      if (bound) throw createError({ statusCode: 409, statusMessage: '此账号已绑定其他微信' })
      db.prepare('INSERT INTO wechat_identities (appid,openid,user_id) VALUES (?,?,?)').run(
        ticket.wechat_appid,
        ticket.wechat_openid,
        userId
      )
    }
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
    db.exec('COMMIT')
    return revision + 1
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
