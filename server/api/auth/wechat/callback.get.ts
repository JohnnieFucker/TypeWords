import { completeWechatTicket, failWechatTicket } from '../../../utils/db'
import { wechatConfig } from '../../../utils/wechat'
export default defineEventHandler(async event => {
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  const query = getQuery(event)
  const state = typeof query.state === 'string' ? query.state : ''
  const code = typeof query.code === 'string' ? query.code : ''
  const cookie = getCookie(event, 'typewords_wechat_state')
  deleteCookie(event, 'typewords_wechat_state', { path: '/' })
  if (!/^[a-f0-9]{64}$/.test(state) || !cookie || cookie !== state)
    throw createError({ statusCode: 400, statusMessage: '授权无效或已过期，请重新扫码' })
  if (!code || code.length > 256) {
    failWechatTicket(state)
    throw createError({ statusCode: 400, statusMessage: '微信授权未完成，请重新扫码' })
  }
  try {
    const config = wechatConfig()
    const url = new URL('https://api.weixin.qq.com/sns/oauth2/access_token')
    url.search = new URLSearchParams({
      appid: config.appid,
      secret: config.secret,
      code,
      grant_type: 'authorization_code',
    }).toString()
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const result = (await response.json()) as { openid?: unknown; errcode?: number }
    if (
      !response.ok ||
      result.errcode ||
      typeof result.openid !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(result.openid)
    )
      throw new Error('wechat authorization failed')
    const ok = completeWechatTicket(state, config.appid, result.openid)
    return ok
      ? '<!doctype html><meta name="viewport" content="width=device-width"><p>授权成功，请返回电脑继续学习。</p>'
      : '<!doctype html><meta name="viewport" content="width=device-width"><p>绑定失败，请返回电脑查看原因。</p>'
  } catch {
    failWechatTicket(state)
    throw createError({ statusCode: 502, statusMessage: '微信授权失败，请返回电脑重新扫码' })
  }
})
