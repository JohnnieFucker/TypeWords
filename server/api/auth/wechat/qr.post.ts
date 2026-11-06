import { newTicket } from '../../../utils/wechat'
export default defineEventHandler(async event => newTicket(event, await readBody(event)))
