// 考生密码（012 research R2、R4、R7）：规则校验、按 Payload 的格式比对哈希、密码登录的暂停与限频
import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto'

export { checkPassword } from './passwordRules'

export const MAX_FAILURES = 5
export const LOCK_MS = 15 * 60 * 1000
export const IP_PER_HOUR = 30
export const MAX_ENTRIES = 10_000
const HOUR = 3600_000

// 与 payload/dist/auth/strategies/local/generatePasswordSaltHash.js 一致；那里没有从包入口导出，照写一份
const PREFIX = 'pbkdf2-sha256-v1:'
const params = (hash: string) =>
  hash.startsWith(PREFIX)
    ? { hex: hash.slice(PREFIX.length), iterations: 600_000, keyLength: 32 }
    : { hex: hash, iterations: 25_000, keyLength: 512 }

const derive = (password: string, salt: string, iterations: number, keyLength: number) =>
  new Promise<Buffer>((resolve, reject) =>
    pbkdf2(password, salt, iterations, keyLength, 'sha256', (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  )

// 账号不存在或没设密码时也算一遍，耗时与真实比对一致（FR-012）
const DUMMY = {
  salt: randomBytes(32).toString('hex'),
  hash: PREFIX + randomBytes(32).toString('hex'),
}

export const verifyHash = async (password: string, doc?: Record<string, unknown> | null) => {
  const real = typeof doc?.hash === 'string' && typeof doc?.salt === 'string'
  const { salt, hash } = real ? (doc as { salt: string; hash: string }) : DUMMY
  const { hex, iterations, keyLength } = params(hash)
  const key = await derive(password, salt, iterations, keyLength)
  const stored = Buffer.from(hex, 'hex')
  return real && key.length === stored.length && timingSafeEqual(key, stored)
}

// ponytail: 计数只在进程内存里，重启清零、只适用于单进程（宪章 V 单台服务器）；改成多进程时换成数据库表
export const failures = new Map<string, { count: number; until?: number }>()
export const ipHits = new Map<string, number[]>()

const cap = (m: Map<string, unknown>) => {
  if (m.size > MAX_ENTRIES) m.clear()
}

/** 暂停中返回剩余秒数，否则 null */
export const lockedFor = (email: string): number | null => {
  const f = failures.get(email)
  if (!f?.until) return null
  const left = f.until - Date.now()
  if (left > 0) return Math.ceil(left / 1000)
  failures.delete(email)
  return null
}

export const recordFailure = (email: string) => {
  const f = failures.get(email) ?? { count: 0 }
  f.count++
  if (f.count >= MAX_FAILURES) f.until = Date.now() + LOCK_MS
  failures.set(email, f)
  cap(failures)
}

export const clearFailures = (email: string) => failures.delete(email)

/** 记一次尝试；超限时返回需要等待的秒数（超限后不再追加），否则 null */
// next dev 下本机所有请求都是同一个地址，e2e 反复跑会撞上限，而内存计数又没法从测试进程里清；生产与单元测试照常限频
export const ipLimited = (ip: string): number | null => {
  if (ip === 'unknown' || process.env.NODE_ENV === 'development') return null
  const now = Date.now()
  const hits = (ipHits.get(ip) ?? []).filter((t) => t > now - HOUR)
  if (hits.length >= IP_PER_HOUR) {
    ipHits.set(ip, hits)
    return Math.ceil((hits[0] + HOUR - now) / 1000)
  }
  hits.push(now)
  ipHits.set(ip, hits)
  cap(ipHits)
  return null
}
