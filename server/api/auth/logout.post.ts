import { logout } from '../../utils/db'
export default defineEventHandler(event => {
  logout(event)
  return { ok: true }
})
