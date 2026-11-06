import { requireUser, writeProgress } from '../utils/db'
import { parseProgress } from '../utils/progress'
export default defineEventHandler(async event => {
  const user = requireUser(event)
  const length = Number(getHeader(event, 'content-length') || 0)
  if (length > 10_000_000) throw createError({ statusCode: 413, statusMessage: '数据过大' })
  const body = await readBody(event)
  if (
    !Number.isSafeInteger(body?.revision) ||
    body.revision < 0 ||
    !body.data ||
    typeof body.data !== 'object' ||
    Array.isArray(body.data)
  )
    throw createError({ statusCode: 400, statusMessage: '进度数据无效' })
  if (JSON.stringify(body.data).length > 10_000_000) throw createError({ statusCode: 413, statusMessage: '数据过大' })
  return { revision: writeProgress(user.id, body.revision, parseProgress(body.data)) }
})
