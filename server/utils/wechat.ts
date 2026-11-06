import type { H3Event } from 'h3'
import { createWechatTicket } from './db'

export function wechatConfig() {
  const appid = process.env.WECHAT_APP_ID || ''
  const secret = process.env.WECHAT_APP_SECRET || ''
  const callback = process.env.WECHAT_CALLBACK_URL || ''
  let url: URL
  try {
    url = new URL(callback)
  } catch {
    throw createError({ statusCode: 503, statusMessage: '微信登录尚未配置' })
  }
  if (
    !appid ||
    !secret ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith('/api/auth/wechat/callback')
  )
    throw createError({ statusCode: 503, statusMessage: '微信登录尚未配置' })
  return {
    appid,
    secret,
    callback: url.toString(),
    start: new URL(url.pathname.replace(/\/callback$/, '/start'), url.origin).toString(),
  }
}
export function ticketCookie(event: H3Event) {
  const value = getCookie(event, 'typewords_wechat_ticket') || ''
  const match = /^([a-f0-9]{48})\.([a-f0-9]{64})$/.exec(value)
  if (!match) throw createError({ statusCode: 400, statusMessage: '二维码已失效，请刷新' })
  return { id: match[1], verifier: match[2] }
}
export async function newTicket(event: H3Event) {
  const config = wechatConfig()
  const ticket = createWechatTicket()
  setCookie(event, 'typewords_wechat_ticket', `${ticket.id}.${ticket.verifier}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 180,
  })
  const url = new URL(config.start)
  url.searchParams.set('ticket', ticket.id)
  return { url: url.toString(), expiresIn: 180 }
}
export function stateCookie(event: H3Event, state: string) {
  setCookie(event, 'typewords_wechat_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 180,
  })
}
