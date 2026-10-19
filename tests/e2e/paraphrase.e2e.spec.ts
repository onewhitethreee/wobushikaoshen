import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import type { Unit } from '../../src/payload-types'

// 026 同义替换：给最新阅读单元的一道题写入一对替换，测完还原
const BASE = 'http://localhost:3000'
let payload: Payload
let unit: Unit | undefined
let original: unknown
let pick: { number: number; q: string; s: string } | undefined

test.beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const res = await payload.find({ collection: 'units', where: { and: [{ module: { equals: 'reading' } }, { _status: { equals: 'published' } }] }, sort: '-id', limit: 1, depth: 0 })
  unit = res.docs[0]
  if (!unit) return
  const sentences = new Map(((unit.passage ?? []) as { sentences?: { n: number; text: string }[] }[]).flatMap((p) => p.sentences ?? []).map((s) => [s.n, s.text]))
  for (const g of unit.groups ?? [])
    for (const q of g.questions ?? []) {
      const ev = /^(\d+)/.exec(q.evidence ?? '')
      const text = ev ? sentences.get(Number(ev[1])) : undefined
      const word = (q.prompt ?? '').split(/\s+/).find((w) => /^[A-Za-z]{5,}$/.test(w))
      if (!text || !word || pick) continue
      const s = text.split(/\s+/).slice(0, 2).join(' ')
      if (s.toLowerCase() !== word.toLowerCase()) pick = { number: q.number, q: word, s }
    }
  if (!pick) return
  original = unit.paraphrases ?? null
  await payload.update({ collection: 'units', id: unit.id, data: { paraphrases: { at: Date.now(), model: 'e2e', items: { [pick.number]: [{ q: pick.q, s: pick.s }] } } } })
})

test.afterAll(async () => {
  if (unit && pick) await payload.update({ collection: 'units', id: unit.id, data: { paraphrases: original as never } })
})

test('026 交卷前不显示；交卷后解析里有同义替换，定位后原文说法被标出', async ({ page }) => {
  test.skip(!unit || !pick, '本机没有带出处的阅读单元')
  await page.goto(`${BASE}/practice/u${unit!.id}`)
  await expect(page.getByTestId('questions-pane')).toBeVisible()
  await expect(page.getByText('同义替换')).toHaveCount(0)

  await page.getByRole('button', { name: '交卷', exact: true }).click()
  const confirm = page.getByRole('button', { name: '仍然交卷' })
  if (await confirm.isVisible()) await confirm.click()
  await page.getByRole('button', { name: new RegExp(`^跳到第 ${pick!.number} 题`) }).click()

  const panel = page.getByTestId('explain-panel')
  await expect(panel.getByTestId('paraphrases')).toContainText(`${pick!.q} ↔ ${pick!.s}`)
  await panel.getByRole('button', { name: '在原文中定位' }).click()
  const mark = page.getByTestId('passage-pane').getByTestId('paraphrase-mark').first()
  await expect(mark).toBeVisible()
  expect((await mark.textContent())!.toLowerCase()).toBe(pick!.s.toLowerCase())
})
