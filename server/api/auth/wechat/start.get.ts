import { startWechatTicket } from '../../../utils/db'
import { stateCookie, wechatConfig } from '../../../utils/wechat'
export default defineEventHandler(event => {
  const { ticket } = getQuery(event)
  if (typeof ticket !== 'string' || !/^[a-f0-9]{48}$/.test(ticket))
    throw createError({ statusCode: 400, statusMessage: '二维码无效' })
  const config = wechatConfig()
  const state = startWechatTicket(ticket)
  stateCookie(event, state)
  const url = new URL('https://open.weixin.qq.com/connect/oauth2/authorize')
  url.search = new URLSearchParams({
    appid: config.appid,
    redirect_uri: config.callback,
    response_type: 'code',
    scope: 'snsapi_base',
    state,
  }).toString()
  return sendRedirect(event, url.toString() + '#wechat_redirect', 302)
})
