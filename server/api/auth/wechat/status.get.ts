import { readWechatTicket } from '../../../utils/db'
import { ticketCookie } from '../../../utils/wechat'
export default defineEventHandler(event => {
  const { id, verifier } = ticketCookie(event)
  const ticket = readWechatTicket(id, verifier)
  if (!ticket) return { status: 'expired' }
  if (ticket.error) return { status: 'error', message: ticket.error }
  return ticket.wechat_openid ? { status: 'authorized', username: ticket.username } : { status: 'pending' }
})
