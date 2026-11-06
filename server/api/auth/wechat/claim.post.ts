import { claimWechatTicket, setSession } from '../../../utils/db'
import { ticketCookie } from '../../../utils/wechat'
export default defineEventHandler(event => {
  const { id, verifier } = ticketCookie(event)
  setSession(event, claimWechatTicket(id, verifier))
  deleteCookie(event, 'typewords_wechat_ticket', { path: '/' })
  return { ok: true }
})
