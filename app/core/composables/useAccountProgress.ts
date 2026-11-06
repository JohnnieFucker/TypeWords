import { get, update, del } from 'idb-keyval'
import { useBaseStore } from '@/core/stores/base'
import { getDefaultDict, getDefaultWord } from '@/core/types/func'
import { useDataSyncPersistence } from './useDataSyncPersistence'
import { useRuntimeStore } from '@/core/stores/runtime'
import { withAppBaseURL } from '@/core/utils/base-url'
import { Toast } from '@/base'
import { DICT_LIST } from '@/core/config/env'
import { resourceWrap } from '@/core/utils'

import { mergeProgress, type Progress } from './progressMerge'

const user = ref<string | null>(null)
const error = ref('')
let syncPromise: Promise<void> | null = null
const queueKey = (name: string) => `typewords-pending-progress:${name}`

function localProgress(words: string[] = []): Progress {
  const store = useBaseStore()
  const now = new Date()
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return {
    current: String(store.sdict.id || ''),
    dictionaries: store.word.bookList.map(dict => ({
      id: String(dict.id),
      enName: dict.enName || '',
      name: dict.name,
      url: dict.url,
      language: dict.language,
      custom: dict.custom,
      system: !!dict.system,
      words: dict.custom || dict.system ? dict.words.map(item => item.word).filter(Boolean) : [],
      lastLearnIndex: dict.lastLearnIndex,
      perDayStudyNumber: dict.perDayStudyNumber,
      complete: dict.complete,
    })),
    cards: Object.fromEntries(
      Object.entries(store.fsrsData).map(([word, card]) => [
        word,
        {
          due: card.due,
          stability: card.stability,
          difficulty: card.difficulty,
          elapsed_days: card.elapsed_days ?? 0,
          scheduled_days: card.scheduled_days,
          learning_steps: card.learning_steps ?? 0,
          reps: card.reps,
          lapses: card.lapses,
          state: card.state,
          last_review: card.last_review,
        },
      ])
    ),
    days: words.length ? { [day]: [...new Set(words.filter(Boolean))] } : {},
  }
}

async function applyProgress(data: Progress | null) {
  if (!data) return
  const store = useBaseStore()
  const runtime = useRuntimeStore()
  const wasLoading = runtime.globalLoading
  runtime.globalLoading = true
  try {
    const official = await $fetch<any[]>(resourceWrap(DICT_LIST.WORD.ALL))
    for (const remote of data.dictionaries) {
      let dict = store.word.bookList.find(item => String(item.id) === remote.id)
      if (!dict) {
        const resource =
          !remote.custom && !remote.system
            ? official.find(item => String(item.id) === remote.id || (remote.enName && item.enName === remote.enName))
            : null
        dict = getDefaultDict({
          ...resource,
          ...remote,
          length: resource?.length ?? remote.words.length,
          language: remote.language as any,
          words: remote.words.map(word => getDefaultWord({ word })),
        })
        store.word.bookList.push(dict)
      } else {
        dict.lastLearnIndex = Math.max(dict.lastLearnIndex, remote.lastLearnIndex)
        dict.complete ||= remote.complete
        if (dict.custom || dict.system) {
          const existing = new Set(dict.words.map(word => word.word))
          for (const word of remote.words) if (!existing.has(word)) dict.words.push(getDefaultWord({ word }))
        }
      }
    }
    store.fsrsData = mergeProgress(data, localProgress()).cards
    if (store.word.studyIndex < 0 && data.current) {
      const index = store.word.bookList.findIndex(item => String(item.id) === data.current)
      if (index >= 0) store.word.studyIndex = index
    }
    await useDataSyncPersistence().saveDictState()
  } finally {
    runtime.globalLoading = wasLoading
  }
}

async function flush() {
  if (syncPromise) return syncPromise
  const name = user.value
  if (!name) return
  syncPromise = (async () => {
    const pending = await get<Progress>(queueKey(name))
    if (!pending) return
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await $fetch<{ revision: number; data: Progress | null }>(withAppBaseURL('/api/progress'), {
        timeout: 10000,
      })
      const merged = mergeProgress(remote.data, pending)
      try {
        await $fetch(withAppBaseURL('/api/progress'), {
          method: 'POST',
          timeout: 10000,
          body: { revision: remote.revision, data: merged },
        })
        await update<Progress | undefined>(queueKey(name), latest =>
          JSON.stringify(latest) === JSON.stringify(pending) ? undefined : latest
        )
        await applyProgress(merged)
        error.value = ''
        return
      } catch (e: any) {
        if (e?.statusCode !== 409 || attempt === 2) throw e
      }
    }
  })().finally(() => {
    syncPromise = null
  })
  return syncPromise
}

export function useAccountProgress() {
  async function restore() {
    if (user.value) {
      const guest = await get<Progress>(queueKey('guest'))
      if (guest) {
        await update<Progress | undefined>(queueKey(user.value), pending => mergeProgress(pending || null, guest))
        await del(queueKey('guest'))
      }
    }
    const remote = await $fetch<{ revision: number; data: Progress | null }>(withAppBaseURL('/api/progress'), {
      timeout: 10000,
    })
    await applyProgress(remote.data)
    await flush()
  }
  async function initialize() {
    try {
      user.value = localStorage.getItem('typewords-account-session')
      const result = await $fetch<{ user: string | null }>(withAppBaseURL('/api/auth/me'), { timeout: 10000 })
      const bound = localStorage.getItem('typewords-local-account')
      if (result.user && bound && bound !== result.user) {
        user.value = null
        localStorage.removeItem('typewords-account-session')
        throw new Error('本地学习数据属于其他账号')
      }
      user.value = result.user
      if (result.user && !bound) localStorage.setItem('typewords-local-account', result.user)
      if (result.user) localStorage.setItem('typewords-account-session', result.user)
      if (!result.user) localStorage.removeItem('typewords-account-session')
      if (user.value && !location.pathname.includes('/practice-words/')) await restore()
    } catch {
      error.value = '无法连接服务器，学习进度仍保存在本地'
    }
  }
  async function signOut() {
    await $fetch(withAppBaseURL('/api/auth/logout'), { method: 'POST', timeout: 10000 })
    user.value = null
    localStorage.removeItem('typewords-account-session')
    error.value = ''
  }
  async function complete(words: string[]) {
    const key = queueKey(user.value || localStorage.getItem('typewords-local-account') || 'guest')
    try {
      const progress = JSON.parse(JSON.stringify(localProgress(words))) as Progress
      await update<Progress | undefined>(key, pending => mergeProgress(pending || null, progress))
      if (!user.value) {
        Toast.warning('学习进度已保存在本地，登录后可同步')
        return
      }
      await flush()
      if (await get<Progress>(key)) await flush()
    } catch {
      error.value = '同步失败，学习进度保存在本地；请登录后重试'
      Toast.warning(error.value)
    }
  }
  return { user, error, initialize, signOut, complete, restore }
}
