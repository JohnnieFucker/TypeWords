import { newTicket } from '../../../utils/wechat'
export default defineEventHandler(event => newTicket(event))
