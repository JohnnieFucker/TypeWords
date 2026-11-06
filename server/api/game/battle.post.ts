import { battlePet, requireUser } from '../../utils/db'
export default defineEventHandler(async event => {
  const user = requireUser(event)
  const body = await readBody(event)
  if (typeof body?.opponent !== 'string') throw createError({ statusCode: 400, statusMessage: '对手无效' })
  return battlePet(user.id, body.opponent)
})
