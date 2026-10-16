// pnpm import:dict <ecdict.csv>：把 ECDICT（MIT，https://github.com/skywind3000/ECDICT）整表导入 dict_entries（013 research R1）。
// 只取能转成小写的英文词条和有中文释义的行；原形 exchange 里列出、词典里没有单独一行的变形，补一行只有 lemma 的记录。
// 在一个事务里先删光再插入，可重复运行。文件约 66 MB，逐行流式读取
import 'dotenv/config'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'

import { parseExchange } from '../src/vocab/lookup'

const KEY_RE = /^[a-z]+(['-][a-z]+)*$/
const FORM_TYPES = new Set(['p', 'd', 'i', '3', 's', 'r', 't'])

export type Row = { word: string; phonetic: string; translation: string; exchange: string; lemma?: string }

/** 逐行喂入，返回已凑齐的整条记录（引号内可以有逗号、换行，"" 表示一个引号）；没凑齐时返回 null */
export const csvParser = () => {
  let fields: string[] = []
  let cur = ''
  let quoted = false
  return (line: string): string[] | null => {
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (c === '"') quoted = false
        else cur += c
      } else if (c === '"') quoted = true
      else if (c === ',') {
        fields.push(cur)
        cur = ''
      } else cur += c
    }
    if (quoted) {
      cur += '\n'
      return null
    }
    fields.push(cur)
    const out = fields
    fields = []
    cur = ''
    return out
  }
}

/** 由 CSV 记录（含表头映射后）算出要导入的行：小写键、优先原本就是小写的行、补变形 */
export const buildRows = (records: Iterable<Record<string, string>>): { rows: Row[]; forms: number } => {
  const byKey = new Map<string, Row>()
  for (const r of records) {
    const key = r.word?.toLowerCase()
    if (!key || !KEY_RE.test(key) || !r.translation?.trim()) continue
    const old = byKey.get(key)
    if (old && old.word === key) continue // 已有原本就是小写的那行
    byKey.set(key, { word: r.word === key ? key : r.word, phonetic: r.phonetic ?? '', translation: r.translation.trim(), exchange: r.exchange ?? '' })
  }
  const rows = [...byKey.entries()].map(([key, r]) => ({ ...r, word: key }))
  let forms = 0
  for (const r of rows) {
    for (const [t, f] of Object.entries(parseExchange(r.exchange))) {
      const k = f.toLowerCase()
      if (!FORM_TYPES.has(t) || !KEY_RE.test(k) || byKey.has(k)) continue
      byKey.set(k, { word: k, phonetic: '', translation: '', exchange: `0:${r.word}/1:${t}`, lemma: r.word })
      forms++
    }
  }
  return { rows: [...byKey.entries()].map(([key, r]) => ({ ...r, word: key })), forms }
}

const main = async () => {
  const file = process.argv[2]
  if (!file) throw new Error('用法：pnpm import:dict <ecdict.csv>')
  const parse = csvParser()
  let header: string[] | null = null
  const records: Record<string, string>[] = []
  for await (const line of createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity })) {
    const f = parse(line)
    if (!f) continue
    if (!header) header = f
    else records.push(Object.fromEntries(header.map((h, i) => [h, f[i] ?? ''])))
  }
  const { rows, forms } = buildRows(records)

  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  const config = (await import('../src/payload.config.js')).default
  const payload = await getPayload({ config })
  type Tx = { execute: (q: unknown) => Promise<unknown> }
  const db = payload.db as unknown as { drizzle: { transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> } }
  await db.drizzle.transaction(async (tx) => {
    // 不能 TRUNCATE：Payload 的 payload_locked_documents_rels 有外键指向这张表（CASCADE 会把那张表整个清空）
    await tx.execute(sql`DELETE FROM dict_entries`)
    for (let i = 0; i < rows.length; i += 2000) {
      const batch = rows.slice(i, i + 2000)
      const values = sql.join(
        batch.map((r) => sql`(${r.word}, ${r.phonetic || null}, ${r.translation || null}, ${r.exchange || null}, ${r.lemma ?? null})`),
        sql`, `,
      )
      await tx.execute(sql`INSERT INTO dict_entries (word, phonetic, translation, exchange, lemma) VALUES ${values}`)
    }
  })
  console.log(`已导入 ${rows.length} 条词条（其中补出的变形 ${forms} 条）`)
  process.exit(0)
}

// 测试里只引用上面的纯函数，不执行导入
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/import-dict.ts')) await main()
