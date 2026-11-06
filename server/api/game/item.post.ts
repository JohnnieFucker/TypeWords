import { requireUser, usePetItem } from '../../utils/db'
export default defineEventHandler(async event => {
  const user = requireUser(event)
  const body = await readBody(event)
  if (typeof body?.item !== 'string') throw createError({ statusCode: 400, statusMessage: '道具无效' })
  return usePetItem(user.id, body.item)
})
