import { isSameRequestOrigin } from '../utils/request-origin'

const attempts = new Map<string, { count: number; until: number }>()
export default defineEventHandler(event => {
  const pathname = getRequestURL(event).pathname
  if (!/(?:^|\/)api\//.test(pathname)) return
  setHeader(event, 'Cache-Control', 'no-store')
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.method)) {
    const origin = getHeader(event, 'origin')
    const host = getHeader(event, 'host')
    if (origin && !isSameRequestOrigin(origin, host))
      throw createError({ statusCode: 403, statusMessage: '请求来源无效' })
  }
  if (pathname.endsWith('/api/auth/wechat/qr')) {
    const now = Date.now()
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key)
    const address = getRequestIP(event) || 'unknown'
    const entry = attempts.get(address) || { count: 0, until: now + 60000 }
    entry.count++
    attempts.set(address, entry)
    if (entry.count > 10) throw createError({ statusCode: 429, statusMessage: '操作过于频繁，请稍后重试' })
  }
})
