import { requireUser, switchPet } from '../../utils/db'
export default defineEventHandler(async event => {
  const user = requireUser(event)
  const body = await readBody(event)
  if (typeof body?.species !== 'string') throw createError({ statusCode: 400, statusMessage: '灵兽无效' })
  return switchPet(user.id, body.species)
})
