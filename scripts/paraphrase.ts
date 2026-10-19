// pnpm paraphrase [--limit N] [--redo 3,5] [--only-failed] [--price-in 元/百万] [--price-out 元/百万]
// 用后台「AI 设置」的文字模型，给已发布练习单元的每道题生成题干 ↔ 原文的同义替换（026 research R2–R4）。
// 默认只处理还没有数据的单元；验证不通过的对丢弃；失败的单元 id 写进 paraphrase.failed.txt
import 'dotenv/config'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { getPayload } from 'payload'

import config from '../src/payload.config.js'
import { chat, loadAi } from '../src/ai/chat'
import { getPracticeUnit } from '../src/content/practiceUnit'
import { questionTexts, validatePairs, type Pair } from '../src/exam/paraphrase'

const FAILED = 'paraphrase.failed.txt'
const CONCURRENCY = 4
const TIMEOUT = 120_000

const PROMPT = `You are an IELTS reading and listening teacher. For each question, find the paraphrases between the question wording and the source sentence(s) it is tested on: synonyms, near-synonymous phrases, word-form changes, active/passive rewording.
Rules:
- "q" MUST be copied word for word from the question text; "s" MUST be copied word for word from the source text.
- At most 3 pairs per question, most useful first. Skip identical wording. If there is no paraphrase, return an empty list.
- Output JSON only: {"items":[{"number":1,"pairs":[{"q":"...","s":"..."}]}]}`

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i < 0 ? undefined : (process.argv[i + 1] ?? '')
}
const ids = (s: string | undefined) => (s ?? '').split(/[\s,]+/).filter(Boolean).map(Number)

const payload = await getPayload({ config })
const ai = await loadAi(payload)
if (!ai) {
  console.error('后台「AI 设置」没有填 API key')
  process.exit(1)
}

const redo = arg('--redo')
const onlyFailed = process.argv.includes('--only-failed')
const limit = Number(arg('--limit')) || undefined
const priceIn = Number(arg('--price-in')) || 0
const priceOut = Number(arg('--price-out')) || 0
const picked = redo !== undefined ? ids(redo) : onlyFailed ? ids(existsSync(FAILED) ? readFileSync(FAILED, 'utf8') : '') : null

const { docs: all } = await payload.find({
  collection: 'units',
  overrideAccess: true,
  depth: 0,
  pagination: false,
  sort: 'id',
  select: { paraphrases: true },
  where: { _status: { equals: 'published' }, ...(picked ? { id: { in: picked } } : {}) },
})
const pending = picked ? all : all.filter((u) => !u.paraphrases)
const todo = pending.slice(0, limit)

const failed: number[] = []
let ok = 0
let pairs = 0
let tin = 0
let tout = 0

const one = async (id: number) => {
  const t0 = Date.now()
  try {
    const unit = await getPracticeUnit(`u${id}`)
    if (!unit) throw new Error('单元不存在或未发布')
    const s = unit.sections[0]
    const sentences = new Map<number, string>(
      Array.isArray(s.transcript) ? s.transcript.map((l) => [l.n, l.text]) : (s.passage?.paragraphs ?? []).flatMap((p) => (p.sentences ?? []).map((x) => [x.n, x.text] as [number, string])),
    )
    const questions = s.groups.flatMap((g) =>
      g.questions.flatMap((q) => {
        const m = q.evidence ? /^(\d+)(?:-(\d+))?$/.exec(q.evidence) : null
        if (!m) return []
        const evidence = Array.from({ length: Number(m[2] ?? m[1]) - Number(m[1]) + 1 }, (_, i) => sentences.get(Number(m[1]) + i) ?? '').join(' ').trim()
        const question = questionTexts(g, q)
        return evidence && question ? [{ number: q.number, question, answer: q.answers.split(/\r?\n/)[0], evidence }] : []
      }),
    )
    const items: Record<string, Pair[]> = {}
    if (questions.length) {
      const { content, usage } = await chat(ai, {
        json: true,
        timeoutMs: TIMEOUT,
        maxTokens: 4000,
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: JSON.stringify({ title: unit.title, questions }) },
        ],
      })
      tin += usage.prompt
      tout += usage.completion
      const parsed = JSON.parse(content) as { items?: { number?: unknown; pairs?: unknown }[] }
      for (const it of parsed.items ?? []) {
        const q = questions.find((x) => x.number === it.number)
        if (!q) continue
        const valid = validatePairs(it.pairs, q.question, q.evidence)
        if (valid.length) items[q.number] = valid
      }
    }
    const n = Object.values(items).reduce((a, l) => a + l.length, 0)
    pairs += n
    await payload.update({
      collection: 'units',
      id,
      overrideAccess: true,
      data: { paraphrases: { at: Date.now(), model: ai.model, items }, paraphraseChecked: false },
    })
    ok++
    console.log(`u${id} ok ${((Date.now() - t0) / 1000).toFixed(1)}s ${questions.length} 题 → ${n} 对`)
  } catch (e) {
    failed.push(id)
    console.log(`u${id} failed: ${(e as Error).message}`)
  }
}

const queue = todo.map((u) => u.id)
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let id = queue.shift(); id; id = queue.shift()) await one(id)
  }),
)

writeFileSync(FAILED, failed.sort((a, b) => a - b).join('\n'))
const cost = (tin * priceIn + tout * priceOut) / 1_000_000
const rest = pending.length - todo.length
console.log(`成功 ${ok}，失败 ${failed.length}，共 ${pairs} 对；输入 ${tin} tokens，输出 ${tout} tokens${failed.length ? `；失败单元见 ${FAILED}` : ''}`)
if (priceIn || priceOut) {
  console.log(`本次约 ${cost.toFixed(3)} 元（平均每单元 ${(ok ? cost / ok : 0).toFixed(4)} 元）`)
  if (rest > 0 && ok) console.log(`还有 ${rest} 个单元没有数据，全部生成预计约 ${((cost / ok) * rest).toFixed(2)} 元`)
}
process.exit(0)
