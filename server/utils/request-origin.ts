export function isSameRequestOrigin(origin: string, host: string | undefined): boolean {
  if (!host) return false
  try {
    const url = new URL(origin)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    return url.host === new URL(`${url.protocol}//${host}`).host
  } catch {
    return false
  }
}
