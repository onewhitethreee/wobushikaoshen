import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { checkAnswer, ruleAnswer } from '../../scripts/convert/answers'
import { convertGroup, mapType, mergeMulti, parseWordLimit, toBlanks, type RawGroup } from '../../scripts/convert/questions'
import { convertReading, toPassage } from '../../scripts/convert/reading'
import { pickSpot } from '../../scripts/convert/report'

// 007 阅读转换（T025），数据为原创示例，不用 out/ 里的题
const tf = { A: 'TRUE', B: 'FALSE', C: 'NOT GIVEN' }
const grp = (patch: Partial<RawGroup>): RawGroup => ({ type: 'single-choice', instructions: '', questions: [{ no: '1' }], ...patch })

describe('阅读转换：题型与字数', () => {
  it('题型映射（R3）', () => {
    expect(mapType(grp({ questions: [{ no: '1', options: tf }] }), 'reading')).toBe('tfng')
    expect(mapType(grp({ questions: [{ no: '1', options: { A: 'YES', B: 'NO', C: 'NOT GIVEN' } }] }), 'reading')).toBe('ynng')
    expect(mapType(grp({ questions: [{ no: '1', options: { A: 'x', B: 'y' } }] }), 'reading')).toBe('single_choice')
    expect(mapType(grp({ type: 'map', questions: [{ no: '1', options: ['A', 'B'] }] }), 'reading')).toBe('matching_information')
    expect(mapType(grp({ type: 'map' }), 'listening')).toBe('labelling')
    expect(mapType(grp({ type: 'matching', instructions: 'Choose the correct heading for each paragraph' }), 'reading')).toBe('matching_headings')
    expect(mapType(grp({ type: 'matching', instructions: 'Complete each sentence with the correct ending, A-F' }), 'reading')).toBe('matching_endings')
    expect(mapType(grp({ type: 'matching', instructions: 'Complete the summary using the list of words, A-I', content: 'x [1]' }), 'reading')).toBe('completion')
    expect(mapType(grp({ type: 'matching', instructions: 'Look at the following statements and the list of people below.' }), 'reading')).toBe('matching_features')
    expect(mapType(grp({ type: 'fill-in-the-blank', instructions: 'Answer the questions below.' }), 'reading')).toBe('short_answer')
    expect(mapType(grp({ type: 'fill-in-the-blank', instructions: 'Complete the notes below.' }), 'reading')).toBe('completion')
  })

  it('字数限制解析', () => {
    expect(parseWordLimit('Choose ONE WORD ONLY from the passage')).toEqual({ maxWords: 1, numberAllowed: false })
    expect(parseWordLimit('Write NO MORE THAN TWO WORDS from the text')).toEqual({ maxWords: 2, numberAllowed: false })
    expect(parseWordLimit('Write NO MORE THAN THREE WORDS AND/OR A NUMBER')).toEqual({ maxWords: 3, numberAllowed: true })
    expect(parseWordLimit('Write ONE WORD AND/OR A NUMBER')).toEqual({ maxWords: 1, numberAllowed: true })
    expect(parseWordLimit('Using NO MORE THAN TWO WORDS AND/OR NUMBER')).toEqual({ maxWords: 2, numberAllowed: true })
    expect(parseWordLimit('Write A NUMBER for each answer')).toEqual({ maxWords: 1, numberAllowed: true })
    expect(parseWordLimit('Complete the table below.')).toBeNull()
    expect(parseWordLimit('Write NO MORE THAN ONE WORDA for each answer.')).toEqual({ maxWords: 1, numberAllowed: false })
    for (const t of ['Write ONE WORD ONLY AND/OR A NUMBER', 'Write ONE WORD AND/ OR A NUMBER', 'Write ONE WORD AND/ ORA NUMBER'])
      expect(parseWordLimit(t)).toEqual({ maxWords: 1, numberAllowed: true })
  })

  it('空位替换、多选合并、匹配题题干取自正文', () => {
    expect(toBlanks('Bees dance [3] and [14].')).toBe('Bees dance {{3}} and {{14}}.')
    const opts = { A: 'a', B: 'b', C: 'c' }
    const merged = mergeMulti([
      { no: '5', question: 'Which TWO?', options: opts },
      { no: '6', question: 'Which TWO?' },
      { no: '7', question: 'Which TWO?', options: opts },
      { no: '8', question: 'Other?', options: opts },
    ])
    expect(merged.map((c) => c.map((q) => q.no))).toEqual([['5', '6', '7'], ['8']])

    const h = convertGroup(
      grp({
        type: 'matching',
        instructions: 'Choose the correct heading for each paragraph',
        content: '1 Paragraph A [1]\n2 Paragraph B [2]',
        options: { i: 'x', ii: 'y' },
        questions: [{ no: '1', question: 'Paragraph' }, { no: '2' }],
      }),
      'reading',
    )
    expect(h.group.questions.map((q) => q.prompt)).toEqual(['Paragraph A', 'Paragraph B'])
    expect(h.group.content).toBeUndefined()

    const fill = convertGroup(
      grp({ type: 'fill-in-the-blank', instructions: 'Complete the notes. ONE WORD ONLY.', content: 'a [1] b', questions: [{ no: '1' }, { no: '2' }] }),
      'reading',
    )
    expect(fill.group).toMatchObject({ content: 'a {{1}} b', maxWords: 1 })
    expect(fill.issues.join()).toContain('缺少空位 2')
  })

  it('段落字母：去掉前缀；全文没有时按顺序补', () => {
    const raw = [[{ i: 0, text: '(A) One.' }, { i: 1, text: 'Two.' }], [{ i: 2, text: 'Quote line.' }], [{ i: 3, text: '(B) Three.' }]]
    const r = toPassage(raw, true)
    expect(r.passage.map((p) => p.label)).toEqual(['A', undefined, 'B'])
    expect(r.passage[0].sentences[0]).toEqual({ n: 0, text: 'One.' })
    expect(toPassage([[{ i: 0, text: 'x' }], [{ i: 1, text: 'y' }]], true).passage.map((p) => p.label)).toEqual(['A', 'B'])
    expect(toPassage([[{ i: 1, text: 'x' }]], false).issues).toContain('句子编号不是从 0 连续')
  })
})

describe('阅读转换：答案', () => {
  const tfng = convertGroup(grp({ questions: [{ no: '1', options: tf, analysis: '原文说相反，选 FALSE。' }] }), 'reading')
  const fill = convertGroup(
    grp({
      type: 'fill-in-the-blank',
      instructions: 'ONE WORD ONLY',
      content: '[1]',
      questions: [{ no: '1', analysis: '原文说 shows distance，填 distance。', quote: 'The dance shows distance.' }],
    }),
    'reading',
  )

  it('规则只认明确写出的答案', () => {
    expect(ruleAnswer(tfng.group, tfng.raw[0][0])).toBe('FALSE')
    expect(ruleAnswer(fill.group, fill.raw[0][0])).toBe('distance')
    const sc = convertGroup(grp({ questions: [{ no: '1', options: { A: 'x', B: 'y' } }] }), 'reading').group
    expect(ruleAnswer(sc, { no: '1', analysis: '对应选项 B。' })).toBe('B')
    expect(ruleAnswer(sc, { no: '1', analysis: '选项B错误，原文没说。' })).toBeNull()
    expect(ruleAnswer(sc, { no: '1', analysis: '作者认为很难。' })).toBeNull()
  })

  it('自动检查各分支', () => {
    const q = tfng.group.questions[0]
    const raws = tfng.raw[0]
    expect(checkAnswer(tfng.group, q, raws, { rule: ['FALSE'], ai: ['B'] }, []).reasons).toEqual([]) // 字母换成选项原文
    expect(checkAnswer(tfng.group, q, raws, { rule: ['FALSE'], ai: ['TRUE'] }, []).reasons.join()).toContain('不一致')
    expect(checkAnswer(tfng.group, q, raws, { rule: [], ai: [] }, []).reasons).toContain('没有候选答案')
    expect(checkAnswer(tfng.group, q, raws, { rule: [], ai: ['MAYBE'] }, []).reasons.join()).toContain('不是有效选项')
    const fq = fill.group.questions[0]
    expect(checkAnswer(fill.group, fq, fill.raw[0], { rule: [], ai: ['distance'] }, []).reasons).toEqual([])
    expect(checkAnswer(fill.group, fq, fill.raw[0], { rule: [], ai: ['the distance'] }, []).reasons.join()).toContain('超过 1 个词')
    expect(checkAnswer(fill.group, fq, fill.raw[0], { rule: [], ai: ['speed'] }, []).reasons.join()).toContain('找不到')
    const multi = convertGroup(
      grp({
        type: 'multiple-choice',
        instructions: 'Choose TWO letters',
        questions: [{ no: '1', question: 'Q', options: { A: 'a', B: 'b', C: 'c' } }, { no: '2', question: 'Q' }],
      }),
      'reading',
    )
    const mq = multi.group.questions[0]
    expect(mq.span).toBe(2)
    expect(checkAnswer(multi.group, mq, multi.raw[0], { rule: [], ai: ['A', 'C'] }, []).reasons).toEqual([])
    expect(checkAnswer(multi.group, mq, multi.raw[0], { rule: [], ai: ['A', 'A'] }, []).reasons.join()).toContain('2 个不同答案')
  })

  it('抽查：每层 10% 至少 1 题，结果与输入顺序无关', () => {
    const strata = new Map([
      ['a', Array.from({ length: 25 }, (_, i) => `k${i}`)],
      ['b', ['x']],
    ])
    const p = pickSpot(strata)
    expect(p.size).toBe(4)
    expect(p.has('x')).toBe(true)
    const reordered = new Map([
      ['b', ['x']],
      ['a', [...strata.get('a')!].reverse()],
    ])
    expect([...pickSpot(reordered)].sort()).toEqual([...p].sort())
    // 已复核的题优先：只要够数，就不再抽新题
    const done = new Set(['k3', 'k7', 'k11'])
    const q = pickSpot(new Map([['a', strata.get('a')!]]), done)
    expect([...q].sort()).toEqual(['k11', 'k3', 'k7'])
  })
})

describe('阅读转换：整篇流程（覆盖、抽查退回、去重）', () => {
  // 原创短文；完全相同的两份放在两个题集里，验证去重合并
  const exam = {
    set: 'x',
    title: 'Fixture Bees',
    channel: 'reading',
    part: 'Part 1',
    passage: [[{ i: 0, text: '(A) Bees dance to show where flowers are.' }, { i: 1, text: 'The dance shows distance.' }]],
    groups: [
      {
        type: 'single-choice',
        instructions: 'Do the following statements agree?',
        questions: [1, 2].map((n) => ({ no: String(n), question: `S${n}`, options: tf, analysis: '选 TRUE', quote: 'Bees dance.', evidence_sentences: '0' })),
      },
      {
        type: 'fill-in-the-blank',
        instructions: 'ONE WORD ONLY',
        content: 'It shows [3].',
        questions: [{ no: '3', analysis: '填 distance。', quote: 'The dance shows distance.', evidence_sentences: '1-1' }],
      },
    ],
  }
  const setup = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-'))
    for (const [set, id] of [['Z家阅读9月高频', 1111111], ['Z家阅读10月高频', 2222222]] as const) {
      const dir = path.join(root, 'src', set, `Part 1 Fixture Bees ${id}`)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'exam.json'), JSON.stringify(exam))
    }
    fs.mkdirSync(path.join(root, 'out', '转换缓存'), { recursive: true })
    return root
  }
  const run = async (root: string, overrides?: object) => {
    if (overrides) fs.writeFileSync(path.join(root, 'out', '转换缓存', 'overrides.json'), JSON.stringify(overrides))
    const r = await convertReading(path.join(root, 'src'), path.join(root, 'out', '导入包'), 30, null)
    const pack = path.join(root, 'out', '导入包', 'reading', 'batch-001', 'import.json')
    return { r, pack: fs.existsSync(pack) ? JSON.parse(fs.readFileSync(pack, 'utf8')) : null }
  }

  it('抽查未回填不进包；回填 ok 后进包；改了答案整批退回', async () => {
    const root = setup()
    const first = await run(root)
    expect(first.r.units).toBe(1)
    expect(first.pack).toBeNull()
    const spot = fs.readFileSync(path.join(root, 'out', '导入包', 'reading', '抽查.md'), 'utf8')
    const keys = [...spot.matchAll(/^### (\S+)/gm)].map((m) => m[1])
    expect(keys.length).toBe(2) // 判断 1 题 + 填空 1 题
    const allOk = Object.fromEntries(keys.map((k) => [k, 'ok']))

    const ok = await run(root, allOk)
    const unit = ok.pack.data[0]
    // 新月份的题集优先：编号与标签取 10 月那份
    expect(unit).toMatchObject({ sourceId: '2222222', sourceSets: 'Z家阅读10月高频, Z家阅读9月高频', sourceTag: '10月高频' })
    expect(unit.passage[0]).toMatchObject({ label: 'A', sentences: [{ n: 0, text: 'Bees dance to show where flowers are.' }, { n: 1 }] })
    expect(unit.groups[1]).toMatchObject({ type: 'completion', content: 'It shows {{3}}.', maxWords: 1 })
    expect(unit.groups[1].questions[0]).toMatchObject({ answers: 'distance', evidence: '1' })

    const tfKey = keys.find((k) => !k.endsWith('#3'))!
    const bad = await run(root, { ...allOk, [tfKey]: ['FALSE'] })
    expect(bad.pack).toBeNull()
    expect(bad.r.pending).toBe(1) // 同层另一题退回；被改的那题按覆盖确认
    fs.rmSync(root, { recursive: true, force: true })
  })
})
