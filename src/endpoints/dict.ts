import { sql } from '@payloadcms/db-postgres'
import type { Endpoint } from 'payload'

import { candidates, FORM_LABEL, parseExchange, type DictResult } from '../vocab/lookup'

// 查词（013 contracts/api.md）：公开、只读。候选词一次查回，按候选顺序取第一个；变形词返回原形的词条
type Row = { word: string; phonetic: string | null; translation: string | null; exchange: string | null; lemma: string | null }
type Db = { execute: (q: unknown) => Promise<{ rows: Row[] }> }

const fail = (error: string, status: number) => Response.json({ error }, { status })

export const dictEndpoint: Endpoint = {
  path: '/dict',
  method: 'get',
  handler: async (req) => {
    const w = req.searchParams.get('w') ?? ''
    const cands = w.length <= 64 ? candidates(w) : []
    if (!cands.length) return fail('不是英文单词', 400)
    const db = (req.payload.db as unknown as { drizzle: Db }).drizzle
    const find = async (words: string[]) => {
      const list = sql.join(words.map((x) => sql`${x}`), sql`, `)
      return (await db.execute(sql`SELECT word, phonetic, translation, exchange, lemma FROM dict_entries WHERE word IN (${list})`)).rows
    }
    const rows = await find(cands)
    const hit = cands.map((c) => rows.find((r) => r.word === c)).find(Boolean)
    if (!hit) return fail('词典里没有这个词', 404)

    // 只有 lemma 的补充行，或 exchange 里带 0:（原形）的变形词：换成原形的词条
    const ex = parseExchange(hit.exchange)
    const base = hit.lemma ?? ex['0']
    let entry = hit
    let form: DictResult['form']
    if (base && base !== hit.word) {
      const [lemma] = await find([base])
      if (lemma?.translation) {
        entry = lemma
        // 1: 可能有多个类型（mitigated 是 dp：过去分词和过去式），原样返回，前端逐个显示
        form = { word: hit.word, type: [...(ex['1'] ?? 's')].filter((t) => t in FORM_LABEL).join('') || 's' }
      }
    }
    if (!entry.translation) return fail('词典里没有这个词', 404)

    const body: DictResult = {
      word: entry.word,
      ...(entry.phonetic ? { phonetic: entry.phonetic } : {}),
      meanings: entry.translation.split(/\\n|\n/).map((s) => s.trim()).filter(Boolean),
      ...(form ? { form } : {}),
    }
    return Response.json(body, { headers: { 'Cache-Control': 'public, max-age=86400' } })
  },
}
