// 本机数据与账号同步（009 research R6、R7）。未登录时什么都不做，练习只用本机。
// 写入总是先落本机，再防抖推送；服务端返回的数据与本机再合并一次，不会覆盖掉还没推出去的改动
import { mergeData, type SyncData } from '@/account/sync'
import { load as loadVocab, save as saveVocab, VOCAB_KEY } from '@/vocab/store'

import { KEY, WRITING_KEY, load, loadDrafts, save, saveDrafts } from './store'

/** 本机数据被同步改过后派发，已挂载的组件重读本机 */
export const STORE_EVENT = 'ybz:store'

let member: Promise<boolean> | null = null
export const isMember = () =>
  (member ??= fetch('/api/members/me', { credentials: 'include' })
    .then((r) => r.json())
    .then((d: { user?: { collection?: string } | null }) => d.user?.collection === 'members')
    .catch(() => false))

const since = <T,>(o: Record<string, T>, at: (v: T) => number, t: number) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => at(v) >= t))

/** 本机自 t 起的改动（t = 0 即全部） */
const localSince = (t: number): SyncData => {
  const { store } = load()
  return {
    records: store.records.filter((r) => r.at >= t),
    progress: since(store.progress, (p) => p.savedAt, t),
    drafts: since(loadDrafts(), (d) => d.at, t),
    favorites: since(store.favorites, (m) => m.at, t),
    dismissed: since(store.dismissed, (m) => m.at, t),
    dictation: since(store.dictation, (e) => e.at, t),
    ...(store.plan && store.plan.at >= t ? { plan: store.plan } : {}),
    ...localVocabSince(t),
  }
}

const localVocabSince = (t: number): Pick<SyncData, 'words' | 'vocab'> => {
  const v = loadVocab()
  return { words: since(v.words, (w) => w.at, t), ...(v.vocab.at && v.vocab.at >= t ? { vocab: v.vocab } : {}) }
}

const apply = (server: SyncData | undefined, rev: number, at: number) => {
  const { store } = load()
  if (server) {
    const m = mergeData(server, { ...localSince(0) })
    store.records = m.records
    store.progress = m.progress
    store.favorites = m.favorites
    store.dismissed = m.dismissed
    store.dictation = m.dictation ?? {}
    if (m.plan) store.plan = m.plan
    saveDrafts(m.drafts)
    // 单词本写回自己的键；这里不再触发推送（推送由本次同步完成）
    const v = loadVocab()
    if (v.ok) saveVocab({ words: m.words ?? {}, vocab: m.vocab ?? v.vocab }, false)
  }
  store.syncedRev = rev
  store.syncedAt = at
  save(store)
  if (server) window.dispatchEvent(new Event(STORE_EVENT))
}

let chain: Promise<unknown> = Promise.resolve()

/** 推送本机改动并取回账号的新数据；full = 首次登录，把本机全部推上去 */
export const sync = (full = false): Promise<void> => {
  const run = async () => {
    if (!(await isMember())) return
    const { store } = load()
    const fresh = full || store.syncedRev === undefined
    const baseRev = fresh ? -1 : (store.syncedRev ?? -1)
    const startedAt = Date.now()
    const res = await fetch('/api/me/data', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseRev, data: localSince(fresh ? 0 : (store.syncedAt ?? 0)) }),
    })
    if (res.status === 401) {
      member = Promise.resolve(false)
      return
    }
    if (!res.ok) return // 下次写入或打开页面时再试
    const body = (await res.json()) as { rev: number; data?: SyncData }
    apply(body.data, body.rev, startedAt)
  }
  const p = chain.then(run).catch(() => {})
  chain = p
  return p
}

let timer: ReturnType<typeof setTimeout> | undefined
/** 本机写入后调用：2 秒内的多次改动合成一次推送 */
export const schedulePush = () => {
  clearTimeout(timer)
  timer = setTimeout(() => void sync(), 2000)
}

/** 登录成功后：本机已有的记录并入账号（FR-022） */
export const mergeOnLogin = () => {
  member = Promise.resolve(true)
  return sync(true)
}

/** 退出登录后清空本机做题数据（FR-026）；账号里有完整备份 */
export const clearLocal = () => {
  member = Promise.resolve(false)
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(WRITING_KEY)
    localStorage.removeItem(VOCAB_KEY)
  } catch {}
}
