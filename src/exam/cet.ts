// 033 四 / 六级：考试、试卷名、各 part 的叫法。纯函数，客户端组件也用
import type { Where } from 'payload'

export const EXAMS = ['ielts', 'cet4', 'cet6'] as const
export type Exam = (typeof EXAMS)[number]
export type Cet = 'cet4' | 'cet6'

export const isCet = (x: unknown): x is Cet => x === 'cet4' || x === 'cet6'

/** 雅思查询都加这一条；exam 默认 ielts、非空（research R1） */
export const IELTS: Where = { exam: { equals: 'ielts' } }

export const EXAM_NAME: Record<Cet, string> = { cet4: '四级', cet6: '六级' }

/** '2024-06-1' → '2024 年 6 月 第 1 套'；不是这个格式就原样返回 */
export const paperLabel = (paper: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d+)$/.exec(paper ?? '')
  return m ? `${m[1]} 年 ${Number(m[2])} 月 第 ${m[3]} 套` : (paper ?? '')
}

export const CET_PART: Record<'reading' | 'listening', Record<number, string>> = {
  reading: { 1: '选词填空', 2: '长篇阅读', 3: '仔细阅读 1', 4: '仔细阅读 2' },
  listening: { 1: 'Section A 新闻报道', 2: 'Section B 长对话', 3: 'Section C 短文' },
}

export const cetPartName = (module: string | null | undefined, part: number | null | undefined) =>
  (module === 'listening' || module === 'reading') && part ? (CET_PART[module][part] ?? `Part ${part}`) : ''
