import { session } from '../../utils/db'
export default defineEventHandler(event => ({ user: session(event)?.username ?? null }))
