// 听力转换（007 T034）：out/题目_json/D家听力全年高频/*/exam.json（+ mp3、地图）→ 导入包 kind "unit"
import fs from 'node:fs'
import path from 'node:path'

import type { AiSettings } from './aiSettings'
import { finishUnits, type BaseUnit } from './pipeline'
import { convertGroup, type RawGroup } from './questions'
import { toTranscript, type RawSentence, type Sentence } from './transcript'
import { sourceIdOf } from './writing'

export type RawListening = {
  set: string
  title: string
  channel: 'listening'
  part: string
  audio: string
  transcript: RawSentence[]
  groups: RawGroup[]
}

export const LISTENING_SET = 'D家听力全年高频'

type ListeningUnit = BaseUnit & { audio: string; transcript: Sentence[] }

export const convertListening = async (src: string, out: string, batch: number, ai: AiSettings | null) => {
  const errors: string[] = []
  const dropped: string[] = []
  const warnings: string[] = []
  const base = path.join(src, LISTENING_SET)
  if (!fs.existsSync(base)) errors.push(`缺少题集目录：${base}`)
  const seen = new Map<string, string>() // 去重：标题 + 首句非播报原文
  const units: ListeningUnit[] = []

  for (const folder of fs.existsSync(base) ? fs.readdirSync(base).sort() : []) {
    const dir = path.join(base, folder)
    const file = path.join(dir, 'exam.json')
    if (!fs.existsSync(file)) continue
    const sourceId = sourceIdOf(folder)
    if (!sourceId) {
      errors.push(`文件夹名里没有原始编号：${folder}`)
      continue
    }
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as RawListening
    const { transcript, issues } = toTranscript(raw.transcript ?? [])
    const firstSpoken = transcript.find((s) => !s.announce)?.text ?? ''
    const key = `${raw.title}\n${firstSpoken}`.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) {
      dropped.push(`${sourceId} 与 ${seen.get(key)} 重复，丢弃`)
      continue
    }
    seen.set(key, sourceId)

    const converted = raw.groups.map((g) => convertGroup(g, 'listening'))
    const groups = converted.map((c) => c.group)
    const unitErrors = [
      ...issues.filter((m) => !m.startsWith('无逐句时间轴')),
      ...converted.flatMap((c, i) => c.issues.map((m) => `第 ${i + 1} 个题组：${m}`)),
    ]
    if (issues.some((m) => m.startsWith('无逐句时间轴'))) warnings.push(`${sourceId} ${raw.title}：无逐句时间轴`)

    const media = new Map<string, string>()
    const audioFrom = path.join(dir, raw.audio ?? '')
    const audio = `audio/${sourceId}${path.extname(raw.audio ?? '.mp3')}`
    if (raw.audio && fs.existsSync(audioFrom)) media.set(audio, audioFrom)
    else unitErrors.push(`音频文件不存在：${audioFrom}`)
    for (const g of groups)
      if (g.image) {
        const from = path.join(dir, g.image)
        g.image = `img/${sourceId}-${path.basename(g.image)}`
        if (fs.existsSync(from)) media.set(g.image, from)
        else unitErrors.push(`配图文件不存在：${from}`)
      }

    units.push({
      module: 'listening',
      part: Number(/\d/.exec(raw.part)?.[0]) || 0,
      title: raw.title.trim(),
      sourceType: 'repost',
      sourceId,
      sourceSets: LISTENING_SET,
      sourceTag: '全年高频',
      audio,
      transcript,
      groups,
      converted,
      media,
      errors: unitErrors,
    })
  }

  const r = await finishUnits({ kind: 'listening', units, out, batch, ai, errors, dropped })
  if (warnings.length)
    fs.appendFileSync(path.join(r.dir, '报告.md'), ['', '## 无逐句时间轴（可导入，字幕不可用）', '', ...warnings.map((w) => `- ${w}`), ''].join('\n'))
  return r
}
