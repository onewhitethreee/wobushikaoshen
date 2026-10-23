import { createHash, randomBytes, timingSafeEqual } from 'crypto'

// 029 内容接口密钥（research R1、R7）：cak_ + 32 字节随机数；只存 sha256 摘要。
// 密钥是 256 位随机数，不需要慢哈希（慢哈希防的是弱口令）

export const newKey = () => `cak_${randomBytes(32).toString('base64url')}`

export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex')

/** 两边都是等长摘要再比，比对耗时不泄露信息；摘要为空（没有密钥 / 已停用）一律不通过 */
export const verifyKey = (key: string | null | undefined, hash: string | null | undefined): boolean => {
  if (!key || !hash) return false
  const a = Buffer.from(hashKey(key), 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Authorization: Bearer <key> */
export const bearer = (headers: Headers): string | null => {
  const m = /^Bearer\s+(\S+)$/i.exec(headers.get('authorization')?.trim() ?? '')
  return m ? m[1] : null
}

// 密钥错误限频：同一地址一小时内错 20 次后暂停，直到窗口滑过。
// ponytail: 计数在进程内存，重启清零、只适用于单进程（宪章 V 单台服务器，同 account/password.ts）
const HOUR = 60 * 60 * 1000
export const BAD_KEY_LIMIT = 20
const MAX_ENTRIES = 10_000
export const badKeys = new Map<string, number[]>()

const recent = (ip: string, now: number) => (badKeys.get(ip) ?? []).filter((t) => t > now - HOUR)

/** 暂停中返回剩余秒数，否则 null */
export const badKeyWait = (ip: string, now = Date.now()): number | null => {
  const hits = recent(ip, now)
  return hits.length >= BAD_KEY_LIMIT ? Math.ceil((hits[0] + HOUR - now) / 1000) : null
}

export const recordBadKey = (ip: string, now = Date.now()) => {
  if (badKeys.size > MAX_ENTRIES) badKeys.clear()
  badKeys.set(ip, [...recent(ip, now), now].slice(-BAD_KEY_LIMIT))
}
