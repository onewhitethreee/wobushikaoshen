// 035 统计上传限频（research R3）：同一 IP 每分钟 ≤ 20 次，同一考生（账号或设备）同一单元每分钟 ≤ 3 次。
// ponytail: 进程内存计数，重启清零；多进程部署时改数据库计数
const MINUTE = 60_000
const PER_IP = 20
const PER_WHO_UNIT = 3
const ipHits = new Map<string, number[]>()
const whoHits = new Map<string, number[]>()

const hit = (map: Map<string, number[]>, key: string, max: number, now: number) => {
  const hits = (map.get(key) ?? []).filter((t) => t > now - MINUTE)
  if (hits.length >= max) {
    map.set(key, hits)
    return false
  }
  hits.push(now)
  map.set(key, hits)
  return true
}

// 每次调用顺手清掉一分钟内没再出现的键，Map 不会无限长
const sweep = (map: Map<string, number[]>, now: number) => {
  for (const [k, v] of map) if (!v.length || v[v.length - 1] <= now - MINUTE) map.delete(k)
}

/** 允许记入返回 true。next dev 下本机请求都是同一个地址，IP 限频跳过（同 account/password.ts 的 ipLimited） */
export const allow = (ip: string, who: string, unitId: string, now = Date.now()): boolean => {
  sweep(ipHits, now)
  sweep(whoHits, now)
  const skipIp = ip === 'unknown' || process.env.NODE_ENV === 'development'
  if (!skipIp && !hit(ipHits, ip, PER_IP, now)) return false
  return hit(whoHits, `${who}|${unitId}`, PER_WHO_UNIT, now)
}
