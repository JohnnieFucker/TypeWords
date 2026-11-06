export type Progress = {
  current: string
  dictionaries: Array<{
    id: string
    enName: string
    name: string
    url: string
    language: string
    custom: boolean
    system: boolean
    words: string[]
    lastLearnIndex: number
    perDayStudyNumber: number
    complete: boolean
  }>
  cards: Record<string, any>
  days: Record<string, string[]>
}

export function mergeProgress(a: Progress | null, b: Progress): Progress {
  if (!a) return b
  const dictionaries = new Map(a.dictionaries.map(dict => [dict.id, dict]))
  for (const dict of b.dictionaries) {
    const old = dictionaries.get(dict.id)
    dictionaries.set(
      dict.id,
      old
        ? {
            ...old,
            ...dict,
            lastLearnIndex: Math.max(old.lastLearnIndex, dict.lastLearnIndex),
            complete: old.complete || dict.complete,
            words: [...new Set([...old.words, ...dict.words])],
          }
        : dict
    )
  }
  const cards = Object.assign(Object.create(null), a.cards)
  for (const [word, card] of Object.entries(b.cards)) {
    const old = cards[word]
    if (!old || (Date.parse(card.last_review || '') || 0) >= (Date.parse(old.last_review || '') || 0))
      cards[word] = card
  }
  const days = Object.assign(Object.create(null), a.days)
  for (const [day, words] of Object.entries(b.days)) days[day] = [...new Set([...(days[day] || []), ...words])]
  return { current: b.current || a.current, dictionaries: [...dictionaries.values()], cards, days }
}
