import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { listeningType, readingType } from '@/exam/typeNames'
import { TEXT_TYPES, type QuestionType } from '@/exam/scoring'
import { SOURCE_TAGS } from '@/collections/Units'
import { MIN_PEOPLE, PAGE_SIZE, questionRows, typeRows, unitRows, type QuestionRow } from '@/stats/read'

// 035 后台"作答统计"（contracts/ui.md 后台一节）：逐题 / 单元 / 题型三个页签，筛选都在网址参数里
const EXAMS = [
  { value: 'ielts', label: '雅思' },
  { value: 'cet4', label: '四级' },
  { value: 'cet6', label: '六级' },
]
const MODULES = [
  { value: '', label: '全部科目' },
  { value: 'listening', label: '听力' },
  { value: 'reading', label: '阅读' },
]
const TYPES = Object.keys(readingType) as QuestionType[]

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '—')
const typeName = (module: string, t: string) => (module === 'listening' ? listeningType : readingType)[t as QuestionType] ?? t
const editHref = (r: { coll: string; docId: number }) => `/admin/collections/${r.coll}/${r.docId}`
// tally 里存的是规范化后的小写；选项类题目（地图、判断、配对、单选 / 多选）按大写显示，站长对照选项更直观
const shown = (t: string, a: string) => (TEXT_TYPES.includes(t as QuestionType) ? a : a.toUpperCase())
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

const cell: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--theme-elevation-100)', textAlign: 'left', verticalAlign: 'top' }
const num: React.CSSProperties = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const muted: React.CSSProperties = { color: 'var(--theme-elevation-500)', fontSize: 12 }

const Table: React.FC<{ head: string[]; right?: number[]; children: React.ReactNode }> = ({ head, right = [], children }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} style={right.includes(i) ? num : cell}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
)

const QuestionTable: React.FC<{ rows: QuestionRow[]; showUnit?: boolean }> = ({ rows, showUnit = true }) => (
  <Table head={[...(showUnit ? ['单元'] : []), '题号', '题型', '首次作答', '正确率', '未作答', '最常见错误答案', '总作答']} right={showUnit ? [3, 4, 5, 7] : [2, 3, 4, 6]}>
    {rows.map((r) => (
      <tr key={`${r.unitKey}#${r.number}`}>
        {showUnit && (
          <td style={cell}>
            <Link href={editHref(r)}>{r.title}</Link>
          </td>
        )}
        <td style={cell}>
          {r.span > 1 ? `${r.number}–${r.number + r.span - 1}` : r.number}{' '}
          <a href={`/practice/${r.unitKey}`} rel="noreferrer" style={muted} target="_blank">
            前台
          </a>
        </td>
        <td style={cell}>{typeName(r.module, r.qType)}</td>
        <td style={num}>{r.people}</td>
        <td style={num}>
          {pct(r.rate)}
          {r.span > 1 && r.avg !== null && <div style={muted}>平均 {r.avg.toFixed(1)}/{r.span}</div>}
          {r.resetAt && <div style={muted}>答案于 {day(r.resetAt)} 修改，统计从此重新开始</div>}
        </td>
        <td style={num}>{r.blank}</td>
        <td style={cell}>{r.wrong.length ? r.wrong.map((w) => `${shown(r.qType, w.a)}（${w.n}）`).join(' · ') : '—'}</td>
        <td style={num}>{r.total}</td>
      </tr>
    ))}
  </Table>
)

const Pager: React.FC<{ page: number; total: number; href: (p: number) => string }> = ({ page, total, href }) => {
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1)
  return (
    <p style={{ display: 'flex', gap: 16, marginTop: 12 }}>
      <span>
        共 {total} 条 · 第 {page} / {pages} 页
      </span>
      {page > 1 && <Link href={href(page - 1)}>上一页</Link>}
      {page < pages && <Link href={href(page + 1)}>下一页</Link>}
    </p>
  )
}

const Select: React.FC<{ name: string; value: string; options: { value: string; label: string }[] }> = ({ name, value, options }) => (
  <select defaultValue={value} name={name}>
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
)

export const StatsView = async ({ initPageResult, params, searchParams = {} }: AdminViewServerProps) => {
  const { req, locale, permissions, visibleEntities } = initPageResult
  // 只有后台管理员能进（contracts/api.md）
  if (req.user?.collection !== 'users') redirect('/admin/login?redirect=/admin/stats')
  const q = (k: string) => one(searchParams[k] as string | string[] | undefined)
  const tab = ['units', 'types'].includes(q('tab')) ? q('tab') : 'questions'
  const exam = EXAMS.some((e) => e.value === q('exam')) ? q('exam') : 'ielts'
  const mod = q('module')
  const type = q('type')
  const tag = q('tag')
  const min = q('min') === '' ? MIN_PEOPLE : Math.max(Number(q('min')) || 0, 0)
  const page = Math.max(Number(q('page')) || 1, 1)
  const open = q('open')
  const base = { tab, exam, module: mod, type, tag, min: String(min), sort: q('sort') }
  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...base, ...over }).filter(([, v]) => v !== ''))
    return `/admin/stats?${p}`
  }
  const filters = { exam, module: mod || undefined, type: type || undefined, tag: tag || undefined }

  let body: React.ReactNode
  if (tab === 'questions') {
    const sort = q('sort') === 'count' ? 'count' : 'rate'
    const { rows, total } = await questionRows(req.payload, { ...filters, min, sort, page })
    body = (
      <>
        <QuestionTable rows={rows} />
        <Pager href={(p) => href({ page: String(p) })} page={page} total={total} />
      </>
    )
  } else if (tab === 'units') {
    const sort = q('sort') === '-count' ? '-count' : 'count'
    const { rows, total } = await unitRows(req.payload, { ...filters, sort, page })
    const detail = open ? await questionRows(req.payload, { unitKey: open, min: 0, sort: 'rate' }) : null
    body = (
      <>
        <Table head={['单元', '题集', '作答次数', '人数', '平均得分率', '最近作答']} right={[2, 3, 4]}>
          {rows.map((r) => (
            <React.Fragment key={r.unitKey}>
              <tr>
                <td style={cell}>
                  <Link href={href({ open: open === r.unitKey ? '' : r.unitKey, page: String(page) })}>{r.title}</Link>{' '}
                  <Link href={editHref(r)} style={muted}>
                    编辑
                  </Link>
                </td>
                <td style={cell}>{r.tag ?? '—'}</td>
                <td style={num}>{r.attempts}</td>
                <td style={num}>{r.people}</td>
                <td style={num}>{pct(r.avgRate)}</td>
                <td style={cell}>{day(r.lastAt)}</td>
              </tr>
              {open === r.unitKey && detail && (
                <tr>
                  <td colSpan={6} style={{ ...cell, background: 'var(--theme-elevation-50)' }}>
                    {detail.rows.length ? <QuestionTable rows={detail.rows} showUnit={false} /> : <p style={muted}>还没有作答</p>}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </Table>
        <Pager href={(p) => href({ page: String(p) })} page={page} total={total} />
        <p style={muted}>单元得分率按交卷时的成绩计算，改答案后不会重算。人数和得分率只算每人第一次作答。</p>
      </>
    )
  } else {
    const rows = await typeRows(req.payload, { exam })
    body = (
      <Table head={['科目', '题型', '题数', '首次作答', '平均正确率']} right={[2, 3, 4]}>
        {rows.map((r) => (
          <tr key={`${r.module}-${r.qType}`}>
            <td style={cell}>{r.module === 'listening' ? '听力' : '阅读'}</td>
            <td style={cell}>{typeName(r.module, r.qType)}</td>
            <td style={num}>{r.questions}</td>
            <td style={num}>{r.people}</td>
            <td style={num}>{pct(r.rate)}</td>
          </tr>
        ))}
      </Table>
    )
  }

  const tabs = [
    { value: 'questions', label: '逐题' },
    { value: 'units', label: '单元' },
    { value: 'types', label: '题型' },
  ]
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <h1 style={{ margin: '24px 0 16px' }}>作答统计</h1>
        <p style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          {tabs.map((t) =>
            t.value === tab ? (
              <strong key={t.value}>{t.label}</strong>
            ) : (
              <Link href={href({ tab: t.value, sort: '', page: '' })} key={t.value}>
                {t.label}
              </Link>
            ),
          )}
        </p>
        <form action="/admin/stats" method="get" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <input name="tab" type="hidden" value={tab} />
          <Select name="exam" options={EXAMS} value={exam} />
          {tab !== 'types' && <Select name="module" options={MODULES} value={mod} />}
          {tab === 'questions' && (
            <Select name="type" options={[{ value: '', label: '全部题型' }, ...TYPES.map((t) => ({ value: t, label: readingType[t] }))]} value={type} />
          )}
          {tab !== 'types' && <Select name="tag" options={[{ value: '', label: '全部题集' }, ...SOURCE_TAGS.map((t) => ({ value: t, label: t }))]} value={tag} />}
          {tab === 'questions' && (
            <label>
              最少人数 <input defaultValue={min} min={0} name="min" style={{ width: 64 }} type="number" />
            </label>
          )}
          {tab === 'questions' && (
            <Select
              name="sort"
              options={[
                { value: 'rate', label: '正确率从低到高' },
                { value: 'count', label: '作答次数从多到少' },
              ]}
              value={q('sort') || 'rate'}
            />
          )}
          {tab === 'units' && (
            <Select
              name="sort"
              options={[
                { value: 'count', label: '作答次数从多到少' },
                { value: '-count', label: '作答次数从少到多' },
              ]}
              value={q('sort') || 'count'}
            />
          )}
          <button type="submit">筛选</button>
        </form>
        {body}
        {tab === 'questions' && (
          <p style={{ ...muted, marginTop: 16 }}>
            「首次作答」和正确率只算每人第一次做这个单元；「总作答」含重做。下架的单元不显示；题目增删、题号变化后，旧题号的数据不再显示。
          </p>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
