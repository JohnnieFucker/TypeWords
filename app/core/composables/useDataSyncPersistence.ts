import { get, set, del } from 'idb-keyval'
import { APP_VERSION, BACKUP_INDEX_KEY, BACKUP_KEY, SAVE_DICT_KEY, SAVE_SETTING_KEY, WEBSITE_VERSION_HASH } from '../config/env'
import { getDefaultBaseState, getDefaultSettingState, useBaseStore, useSettingStore, type BaseState } from '../stores'
import { SyncDataType } from '../types/enum'
import type { BackupData, Snapshot } from '../types/types'
import { shakeCommonDict } from '../utils'
import { PRACTICE_ARTICLE_CACHE, PRACTICE_WORD_CACHE, setPracticeArticleCacheLocal, setPracticeWordCacheLocal } from '../utils/cache'

type HashBackupIndexItem = {
  hash: string
  key: string
  createdAt: number
}

function normalizeHash(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim()
  return v.length > 0 ? v : null
}

export async function ensureHashGuardBeforeInit() {
  //@ts-ignore
  const runtimeConfig = useRuntimeConfig()

  try {
    const currentHash = normalizeHash(runtimeConfig?.public?.latestCommitHash)
    if (!currentHash) return

    const localHash = normalizeHash(await get(WEBSITE_VERSION_HASH))
    let res = true
    if (localHash !== currentHash) {
      res = await saveHashSnapshot(localHash ?? currentHash, '')
    }
    res && (await set(WEBSITE_VERSION_HASH, currentHash))
  } catch (e) {
    console.warn('init hash guard failed', e)
  }
}

export async function saveHashSnapshot(currentHash: string, previousHash: string | null): Promise<boolean> {
  const backupKey = `${BACKUP_KEY}${currentHash}`
  const createdAt = Date.now()

  const snapshot: Snapshot = {
    meta: {
      currentHash,
      previousHash,
      createdAt,
    },
    data: {
      dict: await get(SAVE_DICT_KEY.key),
      setting: await get(SAVE_SETTING_KEY.key),
      [PRACTICE_WORD_CACHE.key]: (await get(PRACTICE_WORD_CACHE.key)) ?? null,
      [PRACTICE_ARTICLE_CACHE.key]: (await get(PRACTICE_ARTICLE_CACHE.key)) ?? null,
    },
  }
  if (!snapshot.data.dict) {
    return false
  }
  await set(backupKey, snapshot)

  const rawIndex = (await get(BACKUP_INDEX_KEY)) as HashBackupIndexItem[] | undefined
  const index = Array.isArray(rawIndex)
    ? rawIndex.filter(item => item && typeof item.hash === 'string' && typeof item.key === 'string')
    : []

  let rIndex = index.findIndex(item => item.hash === currentHash)
  if (rIndex === -1) {
    index.push({ hash: currentHash, key: backupKey, createdAt })
  } else {
    index[rIndex] = { hash: currentHash, key: backupKey, createdAt }
  }

  if (index.length > 15) {
    index.sort((a, b) => a.createdAt - b.createdAt)
    const removed = index.splice(0, index.length - 10)
    for (const item of removed) {
      await del(item.key)
    }
  }
  await set(BACKUP_INDEX_KEY, index)
  return true
}

export function useDataSyncPersistence() {
  const store = useBaseStore()
  const settingStore = useSettingStore()
  async function saveLocalAndSync(type: SyncDataType, value: unknown, _options?: unknown) {
    const updated_at = new Date().toISOString()
    if (type === SyncDataType.practice_word) return setPracticeWordCacheLocal(value as any, updated_at)
    if (type === SyncDataType.practice_article) return setPracticeArticleCacheLocal(value as any, updated_at)
    const config = type === SyncDataType.dict ? SAVE_DICT_KEY : SAVE_SETTING_KEY
    await set(config.key, JSON.stringify({ val: value, version: config.version, updated_at }))
  }
  async function saveDictState(state: BaseState = store.$state, _options?: unknown) {
    await saveLocalAndSync(SyncDataType.dict, shakeCommonDict(state))
  }
  async function restoreLocalData(data: BackupData['val']) {
    await saveLocalAndSync(SyncDataType.dict, data.dict.val)
    await saveLocalAndSync(SyncDataType.setting, data.setting.val)
    await saveLocalAndSync(SyncDataType.practice_word, data[PRACTICE_WORD_CACHE.key]?.val ?? null)
    await saveLocalAndSync(SyncDataType.practice_article, data[PRACTICE_ARTICLE_CACHE.key]?.val ?? null)
  }
  async function clear() {
    const base = getDefaultBaseState()
    const settings = getDefaultSettingState()
    base.load = true
    settings.load = true
    store.setState(base)
    settingStore.setState(settings)
    await restoreLocalData({ dict: { val: base }, setting: { val: settings }, [PRACTICE_WORD_CACHE.key]: null, [PRACTICE_ARTICLE_CACHE.key]: null, [APP_VERSION.key]: null } as any)
  }
  return {
    saveLocalAndSync, saveDictState, restoreLocalData, clear,
    syncData: async (..._args: any[]) => {},
    getRemoteData: async (..._args: any[]): Promise<any> => null,
    getRemoteMeta: async (..._args: any[]): Promise<any> => null,
    pullIfRemoteNewer: async (..._args: any[]): Promise<any> => null,
  }
}
