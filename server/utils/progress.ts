const invalid = () => {
  throw createError({ statusCode: 400, statusMessage: '进度数据格式无效' })
}
const text = (value: unknown, max = 256): string => {
  if (typeof value !== 'string' || value.length > max) return invalid()
  return value
}
const number = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9) return invalid()
  return value
}
const boolean = (value: unknown): boolean => (typeof value === 'boolean' ? value : invalid())
const words = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.length > 100000) return invalid()
  return value.map(item => text(item))
}
export function parseProgress(input: any) {
  if (
    !input ||
    typeof input !== 'object' ||
    !Array.isArray(input.dictionaries) ||
    input.dictionaries.length > 1000 ||
    !input.cards ||
    typeof input.cards !== 'object' ||
    Array.isArray(input.cards) ||
    !input.days ||
    typeof input.days !== 'object' ||
    Array.isArray(input.days)
  )
    return invalid()
  const dictionaries = input.dictionaries.map((item: any) => ({
    id: text(item?.id),
    enName: text(item?.enName),
    name: text(item?.name),
    url: text(item?.url),
    language: text(item?.language),
    custom: boolean(item?.custom),
    system: boolean(item?.system),
    words: words(item?.words),
    lastLearnIndex: number(item?.lastLearnIndex),
    perDayStudyNumber: number(item?.perDayStudyNumber),
    complete: boolean(item?.complete),
  }))
  const cards: Record<string, unknown> = Object.create(null)
  if (Object.keys(input.cards).length > 100000) return invalid()
  for (const [word, value] of Object.entries(input.cards)) {
    text(word)
    const card = value as any
    if (!card || typeof card !== 'object') return invalid()
    const due = text(card.due, 64)
    if (!Number.isFinite(Date.parse(due))) return invalid()
    const last_review = card.last_review == null ? undefined : text(card.last_review, 64)
    if (last_review !== undefined && !Number.isFinite(Date.parse(last_review))) return invalid()
    cards[word] = {
      due,
      stability: number(card.stability),
      difficulty: number(card.difficulty),
      elapsed_days: number(card.elapsed_days),
      scheduled_days: number(card.scheduled_days),
      learning_steps: number(card.learning_steps),
      reps: number(card.reps),
      lapses: number(card.lapses),
      state: number(card.state),
      ...(last_review ? { last_review } : {}),
    }
  }
  const days: Record<string, string[]> = Object.create(null)
  if (Object.keys(input.days).length > 10000) return invalid()
  for (const [day, value] of Object.entries(input.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return invalid()
    days[day] = words(value)
  }
  return { current: text(input.current), dictionaries, cards, days }
}
