// pnpm import:dict <ecdict.csv>：把 ECDICT（MIT，https://github.com/skywind3000/ECDICT）整表导入 dict_entries（013 research R1）。
// 只取能转成小写的英文词条和有中文释义的行；原形 exchange 里列出、词典里没有单独一行的变形，补一行只有 lemma 的记录。
// 在一个事务里先删光再插入，可重复运行。文件约 66 MB，逐行流式读取。解析规则在 src/vocab/ecdict.ts
// 必须静态 import payload 和 config：在顶层 await 里动态 import 它们，tsx 下会时好时坏地卡死（exit 13 unsettled top-level await）
import 'dotenv/config'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { sql } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'

import config from '../src/payload.config.js'
import { buildRows, csvParser } from '../src/vocab/ecdict'

const file = process.argv[2]
if (!file) {
  console.error('用法：pnpm import:dict <ecdict.csv>')
  process.exit(1)
}
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
