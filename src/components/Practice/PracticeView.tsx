'use client'

import { EyeOff, Flag } from 'lucide-react'
import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { Button } from '@/components/ui/button'
import { ExamTimer } from '@/components/Mock/ExamTimer'
import { bandFor, scoreUnit, type Answers, type PracticeUnit, type ScoreItem } from '@/exam/practice'
import type { Marks } from '@/practice/marks'
import { drawHref, safeScope } from '@/practice/randomPick'
import { addRecord, getProgress, load, save, setProgress } from '@/practice/store'
import { anchorOf, limitSeconds, toSaved, topTimes, type Clock, type TimerMode } from '@/practice/timer'
import { schedulePush, sync } from '@/practice/syncClient'
import { cn } from '@/utilities/ui'

import { AudioPlayer, type AudioControls, type AudioNav } from './AudioPlayer'
import { ListeningAside } from './ListeningAside'
import { ExplainPanel } from './ExplainPanel'
import { Highlighter } from './Highlighter'
import { explainOrder, type ExplainStop } from './explain'
import { PassageView, sentenceRange } from './PassageView'
import { locateLabel, QuestionGroup } from './QuestionGroup'
import { ResultBar } from './ResultBar'
import { ShareDialog } from './ShareDialog'
import { Timer } from './Timer'
import { TranslationButton, useHideStem } from './Translation'
import { currentIndex, nextStart, prevStart, timedLines, type TimedLine } from './sentences'
import { ShortcutHelp, type ShortcutHelpHandle } from './ShortcutHelp'
import { SubmitConfirm } from './SubmitConfirm'

// 练习页客户端部分：作答状态、本地进度、交卷判分、结果展示（contracts/practice-ui.md）
type Slot = { n: number; section: number; anchor: number; multi: boolean }

const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches

// 028 模考：exam = 考试中（到点交卷、不显示答案、关查词、标记复查，状态交给模考保存）；review = 成绩单里看解析
export type ExamState = { answers: Answers; marks: Marks; flags: number[]; elapsed: number; times: Record<number, number> }
export type ExamResult = { score: number; total: number; items: ScoreItem[]; answers: Answers; elapsed: number; times: Record<number, number>; auto: boolean }
export type ExamMode = {
  deadline: number
  initial: Partial<ExamState>
  onChange: (s: ExamState) => void
  onSubmit: (r: ExamResult) => void
  /** 听力：考试播放器，替换练习用的音频条 */
  audio?: React.ReactNode
}

export const PracticeView: React.FC<{
  unit: PracticeUnit
  exam?: ExamMode
  review?: { answers: Answers; times?: Record<number, number> }
  /** 030：网址里的 pick（从"随机一题"进来）；模考不用 */
  pickScope?: string
}> = ({ unit, exam, review, pickScope }) => {
  const isL = unit.module === 'listening'
  const scope = exam ? null : safeScope(pickScope)
  const [answers, setAnswers] = useState<Answers>(() => exam?.initial.answers ?? review?.answers ?? {})
  const [submitted, setSubmitted] = useState(Boolean(review))
  const [sectionIndex, setSectionIndex] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState<'restored' | 'unavailable' | null>(null)
  // 手机端默认面：阅读先看原文，听力先看题目（008 FR-016）
  const [pane, setPane] = useState<'passage' | 'questions'>(isL ? 'questions' : 'passage')
  const [highlight, setHighlight] = useState<string>()
  const [current, setCurrent] = useState<number>()
  // 解析面板（008 data-model）：当前题锚点、手机端是否弹出、电脑端是否收起
  const [explainAt, setExplainAt] = useState<number>()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [transcriptHidden, setTranscriptHidden] = useState(false)
  // 014 做题高亮：交卷前随作答进度保存，交卷后只在当前页面
  const [marks, setMarks] = useState<Marks>(() => exam?.initial.marks ?? {})
  const [flags, setFlags] = useState<number[]>(() => exam?.initial.flags ?? [])
  // 020 做题计时：计时状态放 ref（每秒不重绘整页），交卷时的用时放 state 给成绩条和解析面板
  const clock = useRef<Clock>({ elapsed: exam?.initial.elapsed ?? 0, times: { ...exam?.initial.times } })
  const timerMode = useRef<TimerMode>('up')
  const toTimes = () => {
    const t = toSaved(clock.current)
    return { elapsed: t.elapsed, times: t.times }
  }
  const [sharing, setSharing] = useState(false)
  const [submittedAt, setSubmittedAt] = useState(0)
  const [lastTime, setLastTime] = useState<{ duration: number; limit?: number; times: Record<number, number> } | null>(() =>
    review?.times ? { duration: Object.values(review.times).reduce((a, b) => a + b, 0), times: review.times } : null,
  )
  const limit = useMemo(() => limitSeconds(unit), [unit])
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const audioBar = useRef<HTMLDivElement>(null)
  const [audioH, setAudioH] = useState(0)
  const [panelH, setPanelH] = useState(0)

  useEffect(() => {
    const el = audioBar.current
    if (!el) return
    const ro = new ResizeObserver(() => setAudioH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 电脑端面板盖在题目栏底部，题目栏留出同样高度的空白，最后一题能滚到面板上方
  useEffect(() => {
    const el = panelRef.current
    if (!el) return setPanelH(0)
    const ro = new ResizeObserver(() => setPanelH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [submitted])
  const storageOk = useRef(true)
  const ready = useRef(false)
  // 用户动过（作答、高亮、重做）才写本机：打开页面时不写，否则会删掉同步刚取回的其他设备进度
  const touched = useRef(false)
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // 004 听力按句控制：播放器、当前时间、单句循环（只对开启时所在的 Part 生效）、跟随暂停
  const player = useRef<AudioControls>(null)
  const help = useRef<ShortcutHelpHandle>(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState<{ section: number; line: TimedLine } | null>(null)
  const [followPaused, setFollowPaused] = useState(false)
  const followPausedUntil = useRef(0)
  const followTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // 恢复本机进度（FR-050、FR-053）；模考的作答由模考自己存
  useEffect(() => {
    if (exam || review) {
      ready.current = true
      return
    }
    const { store: s, ok } = load()
    storageOk.current = ok
    const p = getProgress(s, unit.id, unit.version)
    if (!ok) setNotice('unavailable')
    else if (p && Object.keys(p.answers).length) {
      setAnswers(p.answers)
      setNotice('restored')
    }
    if (p?.marks) setMarks(p.marks)
    if (p?.elapsed) clock.current = { elapsed: p.elapsed, times: { ...p.times } }
    ready.current = true
    void sync() // 已登录时取回其他设备的记录（009）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- exam / review 只看打开时
  }, [unit.id, unit.version])

  // 模考：作答、高亮、标记一变就交给模考（模考那边节流写本机）
  const examChange = exam?.onChange
  useEffect(() => {
    if (!examChange || submitted || !touched.current) return
    examChange({ answers, marks, flags, ...toTimes() })
  }, [answers, marks, flags, submitted, examChange])

  // 作答变化 500ms 后写入本机
  useEffect(() => {
    if (!ready.current || submitted || !touched.current || exam) return
    const t = setTimeout(() => {
      // 每次都重读本机：同步可能刚合并进别的设备的数据，不能用旧副本覆盖
      const { store } = load()
      if (Object.keys(answers).length || Object.values(marks).some((l) => l.length))
        setProgress(store, unit.id, unit.version, answers, marks, toSaved(clock.current))
      else delete store.progress[unit.id]
      if (save(store)) schedulePush()
      else if (storageOk.current) {
        storageOk.current = false
        setNotice('unavailable')
      }
    }, 500)
    return () => clearTimeout(t)
  }, [answers, marks, submitted, unit.id, unit.version, exam])

  // 离开页面 / 切到后台时补存一次用时（020 research R5）：只在已有作答时，规则同上
  useEffect(() => {
    if (submitted) return
    const flush = (e: Event) => {
      if (e.type === 'visibilitychange' && document.visibilityState !== 'hidden') return
      if (exam) return examChange?.({ answers, marks, flags, ...toTimes() })
      if (!touched.current || !Object.keys(answers).length) return
      const { store } = load()
      setProgress(store, unit.id, unit.version, answers, marks, toSaved(clock.current))
      if (save(store)) schedulePush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [answers, marks, flags, submitted, unit.id, unit.version, exam, examChange])

  const slots = useMemo<Slot[]>(
    () =>
      unit.sections.flatMap((s, section) =>
        s.groups.flatMap((g) =>
          g.questions.flatMap((q) =>
            Array.from({ length: q.span }, (_, i) => ({
              n: q.number + i,
              section,
              anchor: q.number,
              multi: g.type === 'multi_choice',
            })),
          ),
        ),
      ),
    [unit],
  )
  const answered = (s: Slot) => {
    const a = answers[s.anchor]
    return s.multi ? Array.isArray(a) && a.length > s.n - s.anchor : typeof a === 'string' && a.trim() !== ''
  }
  const left = slots.filter((s) => !answered(s)).length

  const order = useMemo(() => explainOrder(unit), [unit])
  const findQ = (stop: ExplainStop) => {
    for (const g of unit.sections[stop.section].groups) {
      const q = g.questions.find((x) => x.number === stop.anchor)
      if (q) return { group: g, q }
    }
  }

  const isPlaying = () => player.current?.element()?.paused === false

  // 只滚原文栏、不动整页；手机上原文栏不是滚动容器，退回滚整页。原文栏没显示（手机在「题目」面）时不滚
  const scrollPaneTo = (el: HTMLElement | null) => {
    const pane = el?.closest<HTMLElement>('[data-testid="passage-pane"]')
    if (!el || !pane || !el.offsetParent) return
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    if (getComputedStyle(pane).overflowY === 'auto')
      pane.scrollTo({ top: pane.scrollTop + el.getBoundingClientRect().top - pane.getBoundingClientRect().top - pane.clientHeight / 3, behavior })
    else el.scrollIntoView({ block: 'center', behavior })
  }

  // 查看某题解析时自动在原文里定位（电脑端两栏同屏时才做；原文被隐藏时不做）：只滚原文栏，不动整页
  // 播放中不做（原文栏在跟随声音，004 FR-013）
  const showSource = (s: ExplainStop) => {
    const found = findQ(s)
    const label = found && locateLabel(found.group, found.q)
    if (!label || !isDesktop() || (isL && transcriptHidden) || isPlaying()) return
    clearTimeout(highlightTimer.current)
    flushSync(() => setHighlight(label))
    const range = sentenceRange(label)
    scrollPaneTo(document.getElementById(range ? `s${range[0]}` : `para-${label}`))
  }

  const result = useMemo(() => (submitted ? scoreUnit(unit, answers) : null), [submitted, unit, answers])
  const correct = new Map(result?.items.map((i) => [i.number, i.correct]))

  const onAnswer = (n: number, v: string | string[]) => {
    touched.current = true
    setAnswers((a) => ({ ...a, [n]: v }))
  }
  const onMarks = (m: Marks) => {
    touched.current = true
    setMarks(m)
  }

  const doSubmit = (auto = false) => {
    const r = scoreUnit(unit, answers)
    if (exam) {
      setConfirming(false)
      exam.onSubmit({ ...r, answers, ...toTimes(), auto })
      return
    }
    // 电脑端交卷后面板停在第一道错题，全对停在第一题（008 research R4）
    const wrong = order.find((o) => {
      const span = findQ(o)?.q.span ?? 1
      return r.items.some((i) => !i.correct && i.number >= o.anchor && i.number < o.anchor + span)
    })
    const first = wrong ?? order[0]
    setExplainAt(first?.anchor)
    setSheetOpen(false)
    setCollapsed(false)
    setTranscriptHidden(false)
    const saved = toSaved(clock.current)
    const time = { duration: saved.elapsed, times: saved.times, ...(timerMode.current === 'down' ? { limit } : {}) }
    setLastTime(time)
    setSubmittedAt(Date.now())
    const { store } = load()
    addRecord(store, {
      unitId: unit.id,
      module: isL ? 'l' : 'r',
      ...(unit.exam ? { exam: unit.exam } : {}),
      at: Date.now(),
      score: r.score,
      total: r.total,
      items: r.items,
      answers,
      ...time,
    })
    save(store)
    schedulePush()
    flushSync(() => {
      setSubmitted(true)
      setConfirming(false)
      setNotice((n) => (n === 'restored' ? null : n))
    })
    window.scrollTo({ top: 0 })
    if (first) showSource(first)
  }

  const restart = () => {
    touched.current = true
    clock.current = { elapsed: 0, times: {} }
    setLastTime(null)
    setAnswers({})
    setMarks({})
    setSubmitted(false)
    setConfirming(false)
    setHighlight(undefined)
    setExplainAt(undefined)
    setSheetOpen(false)
    setCollapsed(false)
    setTranscriptHidden(false)
    setLoop(null)
    setNotice((n) => (n === 'restored' ? null : n))
    window.scrollTo({ top: 0 })
  }

  const goTo = (s: ExplainStop) => {
    if (!submitted) clock.current.current = s.anchor
    flushSync(() => {
      setSectionIndex(s.section)
      setPane('questions')
    })
    const el = document.getElementById(`q-${s.anchor}`)
    el?.scrollIntoView({ block: submitted ? 'start' : 'center' })
    if (!submitted && el instanceof HTMLInputElement) el.focus({ preventScroll: true })
  }

  // 013 单词本"回到原文"：#p{k}-s{n} 定位第 k 个 Part 的句子，#q-{n} 定位题目；短暂高亮（research R5）。
  // 听力原文交卷后才显示，没交卷时找不到句子就只打开页面
  useEffect(() => {
    const m = /^#(?:p(\d+)-(s\d+)|q-(\d+))$/.exec(location.hash)
    if (!m) return
    const t = setTimeout(() => {
      if (m[3]) {
        const stop = order.find((o) => o.anchor === Number(m[3]))
        if (stop) goTo(stop)
        return
      }
      if (!unit.sections[Number(m[1])]) return
      flushSync(() => {
        setSectionIndex(Number(m[1]))
        setPane('passage')
        setHighlight(m[2])
      })
      document.getElementById(m[2])?.scrollIntoView({ block: 'center' })
      highlightTimer.current = setTimeout(() => setHighlight(undefined), 2000)
    })
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在打开页面时按 hash 定位一次
  }, [])

  const openExplain = (anchor: number) => {
    const stop = order.find((o) => o.anchor === anchor)
    if (!stop) return
    setExplainAt(anchor)
    setSheetOpen(true)
    setCollapsed(false)
    goTo(stop)
    showSource(stop)
  }

  const stopIndex = order.findIndex((o) => o.anchor === explainAt)
  const stop = order[stopIndex]
  const explained = stop && findQ(stop)
  // 026：定位时在出处句里标出这题的同义替换原文说法（交卷后才有高亮，所以交卷前不会显示）
  const phraseMarks = submitted && highlight ? explained?.q.paraphrases?.map((p) => p.s) : undefined
  const step = (d: number) => {
    const next = order[stopIndex + d]
    if (!next) return
    setExplainAt(next.anchor)
    goTo(next)
    showSource(next)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="feedback-${explainAt}"]`)?.focus())
  }

  // 手机端弹出时焦点移进面板
  useEffect(() => {
    if (sheetOpen && !isDesktop()) panelRef.current?.focus({ preventScroll: true })
  }, [sheetOpen, explainAt])

  const locate = (target: string) => {
    pauseFollow()
    flushSync(() => {
      if (stop) setSectionIndex(stop.section)
      setTranscriptHidden(false)
      if (!isDesktop()) setSheetOpen(false)
      if (!isDesktop()) setPane('passage')
      setHighlight(target)
    })
    const range = sentenceRange(target)
    document.getElementById(range ? `s${range[0]}` : `para-${target}`)?.scrollIntoView({ block: 'center' })
    clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlight(undefined), 2000)
  }

  const section = unit.sections[sectionIndex] ?? unit.sections[0]
  // 022 磨耳朵入口：套题按当前 Part 号连播
  const radioPart = Number(/\d+/.exec(section.label)?.[0] ?? 1)

  // —— 004 按句控制 ——
  const lines = useMemo(() => (isL ? timedLines(section.transcript) : []), [isL, section])
  const curLine = lines[currentIndex(lines, time)]
  const looping = submitted && loop?.section === sectionIndex ? loop.line : undefined

  const jump = (t: number | null) => {
    if (t === null) return
    player.current?.seek(t)
    player.current?.play()
    const line = lines[currentIndex(lines, t)]
    if (looping && line) setLoop({ section: sectionIndex, line })
  }
  const goPrev = () => (lines.length ? jump(prevStart(lines, player.current?.currentTime() ?? 0)) : player.current?.skip(-5))
  const goNext = () => (lines.length ? jump(nextStart(lines, player.current?.currentTime() ?? 0)) : player.current?.skip(5))
  const toggleLoop = () => {
    if (!submitted || !lines.length) return
    setLoop(looping ? null : { section: sectionIndex, line: lines[Math.max(currentIndex(lines, player.current?.currentTime() ?? 0), 0)] })
  }
  const pick = (n: number) => {
    resumeFollow()
    jump(lines.find((l) => l.n === n)?.start ?? null)
  }
  const onTime = (t: number) => {
    setTime(t)
    // ponytail: 靠 timeupdate（约 250ms 一次）判断句末，偏差超过 0.3 秒时改用 requestAnimationFrame
    if (looping && t >= looping.end - 0.05) player.current?.seek(looping.start)
  }

  // 手动滚动原文栏或"在原文中定位"后，暂停跟随 5 秒（004 FR-012）
  const pauseFollow = () => {
    followPausedUntil.current = Date.now() + 5000
    setFollowPaused(true)
    clearTimeout(followTimer.current)
    followTimer.current = setTimeout(() => setFollowPaused(false), 5000)
  }
  const resumeFollow = () => {
    followPausedUntil.current = 0
    setFollowPaused(false)
    clearTimeout(followTimer.current)
  }

  // 交卷后原文跟随播放：当前句变化时只滚原文栏
  useEffect(() => {
    if (!submitted || !playing || transcriptHidden || !curLine || Date.now() < followPausedUntil.current) return
    scrollPaneTo(document.getElementById(`s${curLine.n}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在当前句或播放状态变化时跟随
  }, [curLine?.n, playing, submitted, transcriptHidden])

  const nav: AudioNav = lines.length
    ? {
        onPrev: goPrev,
        onNext: goNext,
        prevLabel: '上一句',
        nextLabel: '下一句',
        prevTitle: '回到句首 / 上一句（←）',
        nextTitle: '下一句（→）',
        loop: submitted ? { on: Boolean(looping), toggle: toggleLoop } : undefined,
      }
    : { onPrev: goPrev, onNext: goNext, prevLabel: '后退 5 秒', nextLabel: '前进 5 秒', prevTitle: '后退 5 秒（←）', nextTitle: '前进 5 秒（→）' }

  // 快捷键（004 research R5）：输入框、组合键、输入法组字中一律不拦截；空格在按钮 / 选项上保留原生点按
  useEffect(() => {
    if (!isL || exam) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
      const t = e.target as HTMLElement
      if (t.closest?.('input, textarea, select, dialog, [contenteditable=""], [contenteditable="true"]')) return
      if (e.code === 'Space') {
        if (t.closest?.('button, a, summary, [role="radio"], [role="checkbox"], [role="button"]')) return
        e.preventDefault()
        if (!e.repeat) player.current?.toggle()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      } else if (e.key.toLowerCase() === 'r' && !e.repeat) toggleLoop()
      else if (e.key === '?') help.current?.open()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const band = unit.whole && result ? bandFor(result.score, unit.bandScale) : null

  // 033 四 / 六级听力：试卷上不印题干，默认隐藏，可切换
  const stemToggle = Boolean(unit.exam) && isL
  const [hideStem, toggleStem] = useHideStem()
  const groups = section.groups.map((g) => (
    <QuestionGroup
      hidePrompt={stemToggle && hideStem}
      answers={answers}
      group={g}
      items={result?.items.filter((i) => i.groupKey === g.key)}
      key={g.key}
      hideMedia={isL}
      onAnswer={onAnswer}
      onExplain={openExplain}
      submitted={submitted}
    />
  ))

  const panel = submitted && explained && (
    <ExplainPanel
      answer={answers[explained.q.number]}
      collapsed={collapsed}
      group={explained.group}
      items={result?.items ?? []}
      key="explain"
      onClose={closeSheet}
      onLocate={locate}
      onNext={stopIndex < order.length - 1 ? () => step(1) : undefined}
      onPrev={stopIndex > 0 ? () => step(-1) : undefined}
      onToggle={() => setCollapsed((c) => !c)}
      open={sheetOpen}
      seconds={lastTime ? (lastTime.times[explained.q.number] ?? 0) : undefined}
      q={explained.q}
      ref={panelRef}
      // 模考的题来自各个单元：AI 讲解按题所属的单元取题（题组键 u{id}-g{k} 去掉 -g{k}）
      unitId={unit.source === 'mock' ? explained.group.key.replace(/-g\d+$/, '') : unit.id}
    />
  )

  const spanOf = (anchor: number) => unit.sections.flatMap((s) => s.groups).flatMap((g) => g.questions).find((q) => q.number === anchor)?.span ?? 1

  // 到点自动交卷：ExamTimer 只回调一次，这里拿最新的作答
  const submitRef = useRef(doSubmit)
  useEffect(() => {
    submitRef.current = doSubmit
  })
  const onExpire = useCallback(() => submitRef.current(true), [])

  const onTimerMode = useCallback((m: TimerMode) => {
    timerMode.current = m
  }, [])

  // 028 标记复查：标记当前题（官方机考底栏的 Review），没选过题时标第一题
  const flagTarget = current !== undefined ? (anchorOf(unit, current) ?? current) : slots[0]?.anchor
  const toggleFlag = () => {
    if (flagTarget === undefined) return
    touched.current = true
    setFlags((f) => (f.includes(flagTarget) ? f.filter((n) => n !== flagTarget) : [...f, flagTarget].sort((a, b) => a - b)))
  }
  const isFlagged = (s: Slot) => flags.includes(s.anchor)

  const trackCurrent = (e: React.SyntheticEvent) => {
    const q = (e.target as HTMLElement).closest<HTMLElement>('[data-q]')?.dataset.q
    if (!q) return
    setCurrent(Number(q))
    // 020：每题用时算给"当前题"（点击、输入、聚焦，research R3）
    if (!submitted) clock.current.current = anchorOf(unit, Number(q))
  }

  return (
    <div
      data-no-lookup={exam ? '' : undefined}
      ref={rootRef}
      style={{ '--audio-h': `${audioH}px`, '--panel-h': `${panelH}px` } as React.CSSProperties}
    >
      {((result && !review) || notice) && (
        <div className="mx-auto flex max-w-[77.5rem] flex-col gap-3 px-[clamp(1rem,4vw,2.5rem)] pt-5">
          {result && !review && (
            <ResultBar
              band={band}
              listHref={scope ?? (unit.exam ? `/${unit.exam}` : isL ? '/listening' : '/reading')}
              pickAgainHref={scope ? drawHref(scope) : undefined}
              onPick={openExplain}
              onRetry={restart}
              onShare={() => setSharing(true)}
              score={result.score}
              time={
                lastTime && {
                  duration: lastTime.duration,
                  limit: lastTime.limit,
                  slow: topTimes(lastTime.times).map(([anchor, sec]) => ({ anchor, sec, span: spanOf(anchor) })),
                }
              }
              total={result.total}
            />
          )}
          {result && !review && (
            <ShareDialog
              onClose={() => setSharing(false)}
              open={sharing}
              result={{
                module: unit.module,
                part: unit.whole ? (isL ? '整套听力' : '整套阅读') : unit.sections[0].label,
                title: unit.title.replace(/ · (听力 |阅读 )?(Part|Passage) \d+.*$/, ''),
                score: result.score,
                total: result.total,
                band,
                duration: lastTime?.duration,
                at: submittedAt,
              }}
            />
          )}
          {notice && (
            <p
              className={cn(
                'flex animate-reveal flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-5 py-2 text-sm',
                notice === 'restored' ? 'bg-primary-soft text-primary-text' : 'bg-warning-soft text-warning',
              )}
              role="status"
            >
              {notice === 'restored' ? '已恢复上次的作答' : '这次作答没法保存，刷新或离开页面后会丢失。'}
              {notice === 'restored' && (
                <button className="min-h-11 rounded-lg px-2 font-semibold hover:bg-card" onClick={restart} type="button">
                  重新开始
                </button>
              )}
            </p>
          )}
        </div>
      )}

      {unit.sections.length > 1 && (
        <div className="container mt-4">
          <div aria-label="选择 Part" className="flex max-w-full gap-x-7 overflow-x-auto border-b border-border" role="tablist">
            {unit.sections.map((s, i) => (
              <button
                aria-selected={i === sectionIndex}
                className={cn(
                  'min-h-11 whitespace-nowrap text-[15px]',
                  i === sectionIndex
                    ? 'font-semibold text-foreground shadow-[inset_0_-2px_0_var(--foreground)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                key={s.label}
                onClick={() => setSectionIndex(i)}
                role="tab"
                type="button"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 听力音频条固定在顶部（008 FR-011），高度写进 --audio-h 供切换栏和两栏高度使用 */}
      {isL && (
        <div className="sticky top-0 z-20 bg-background" ref={audioBar}>
          {exam?.audio ? (
            exam.audio
          ) : section.audioUrl ? (
            <AudioPlayer nav={nav} onPlayingChange={setPlaying} onTime={onTime} ref={player} src={section.audioUrl}>
              <ShortcutHelp ref={help} />
              {unit.source !== 'mock' && <Link
                className="inline-flex min-h-11 items-center px-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                data-testid="radio-link"
                href={`${unit.exam ? `/${unit.exam}` : '/listening'}/play?start=${unit.source === 'unit' ? `u${unit.docId}` : `t${unit.docId}-l${radioPart}`}`}
              >
                磨耳朵
              </Link>}
              {submitted && unit.source === 'unit' && lines.length > 0 && (
                <Link
                  className="inline-flex min-h-11 items-center px-2 text-sm font-semibold underline underline-offset-4"
                  data-testid="dictation-link"
                  href={`/listening/dictation?u=u${unit.docId}`}
                >
                  精听 / 听写
                </Link>
              )}
            </AudioPlayer>
          ) : (
            <p className="container py-3 text-sm text-muted-foreground">这个 Part 暂无音频。</p>
          )}
        </div>
      )}

      <div className="container py-4">
        <div aria-label="原文 / 题目" className="sticky top-(--audio-h) z-10 mb-3 flex gap-x-7 border-b border-border bg-background lg:hidden" role="group">
          {(['passage', 'questions'] as const).map((p) => (
            <button
              aria-pressed={pane === p}
              className={cn(
                'min-h-11 text-[15px]',
                pane === p ? 'font-semibold text-foreground shadow-[inset_0_-2px_0_var(--foreground)]' : 'text-muted-foreground',
              )}
              key={p}
              onClick={() => setPane(p)}
              type="button"
            >
              {p === 'passage' ? '原文' : '题目'}
            </button>
          ))}
        </div>
        <div className="lg:grid lg:grid-cols-2 lg:gap-6" data-section={sectionIndex}>
          <div
            className={cn(pane === 'passage' ? 'block' : 'hidden', 'lg:block lg:h-[calc(100dvh-8rem-var(--audio-h))] lg:overflow-y-auto')}
            data-testid="passage-pane"
            onTouchMove={submitted && playing ? pauseFollow : undefined}
            onWheel={submitted && playing ? pauseFollow : undefined}
          >
            {isL ? (
              <ListeningAside
                current={submitted && (playing || time > 0) ? curLine?.n : undefined}
                highlight={highlight}
                marks={phraseMarks}
                onPick={submitted && lines.length ? pick : undefined}
                onResume={
                  followPaused && playing
                    ? () => {
                        resumeFollow()
                        if (curLine) scrollPaneTo(document.getElementById(`s${curLine.n}`))
                      }
                    : undefined
                }
                onToggleTranscript={() => setTranscriptHidden((h) => !h)}
                section={section}
                submitted={submitted}
                transcriptHidden={transcriptHidden}
              />
            ) : (
              section.passage && <PassageView highlight={highlight} marks={phraseMarks} passage={section.passage} />
            )}
          </div>
          <div
            className={cn(
              pane === 'questions' ? 'flex' : 'hidden',
              'flex-col gap-5 lg:flex lg:h-[calc(100dvh-8rem-var(--audio-h))] lg:overflow-y-auto lg:pb-(--panel-h)',
            )}
            data-hl="q"
            data-testid="questions-pane"
            onFocus={trackCurrent}
            onInput={trackCurrent}
            onPointerDown={trackCurrent}
          >
            {stemToggle && <TranslationButton icon={EyeOff} label="隐藏题干" on={hideStem} onToggle={toggleStem} testId="stem-toggle" />}
            {groups}
          </div>
        </div>
      </div>

      <Highlighter marks={marks} onChange={onMarks} root={rootRef} />

      <div className="sticky bottom-0 z-10">
        {/* 解析面板与两栏同一网格，电脑端落在题目栏下方、题号条上方 */}
        {panel && (
          <div className="pointer-events-none container pb-2 lg:grid lg:grid-cols-2 lg:gap-6">
            <div className="hidden lg:block" />
            {panel}
          </div>
        )}
        <div className="border-t border-border bg-background">
          {confirming && !submitted && (
            <SubmitConfirm flagged={flags.length} left={left} onCancel={() => setConfirming(false)} onConfirm={() => doSubmit()} />
          )}
          <div className="container flex items-center gap-3 py-2">
            <nav aria-label="题号" className="-my-1 flex min-w-0 flex-1 gap-1 overflow-x-auto py-1">
              {slots.map((s) => {
                const done = answered(s)
                const wrong = submitted && !correct.get(s.n)
                const flagged = !submitted && isFlagged(s)
                return (
                  <button
                    aria-label={`跳到第 ${s.n} 题${submitted ? (wrong ? '，错误' : '，正确') : done ? '，已答' : ''}${flagged ? '，已标记' : ''}`}
                    className={cn(
                      'relative min-h-11 min-w-11 shrink-0 rounded-lg border text-[13px] font-semibold tabular-nums',
                      submitted
                        ? wrong
                          ? 'border-error bg-error text-background'
                          : 'border-success/50 bg-card text-success'
                        : done
                          ? 'animate-pop border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary-text',
                      (submitted ? explainAt : current) === s.anchor && 'ring-4 ring-primary/25',
                    )}
                    key={s.n}
                    onClick={() => (submitted ? openExplain(s.anchor) : goTo(s))}
                    type="button"
                  >
                    {s.n}
                    {flagged && (
                      <Flag aria-hidden="true" className="absolute -top-1 -right-1 size-3.5 fill-warning text-warning" data-testid={`flag-${s.n}`} strokeWidth={2.5} />
                    )}
                  </button>
                )
              })}
            </nav>
            {exam && !submitted && (
              <Button
                aria-pressed={flagTarget !== undefined && flags.includes(flagTarget)}
                className="shrink-0"
                data-testid="flag-toggle"
                disabled={flagTarget === undefined}
                onClick={toggleFlag}
                type="button"
                variant="outline"
              >
                <Flag aria-hidden="true" className="size-4" />
                标记第 {flagTarget} 题
              </Button>
            )}
            {exam && !submitted && <ExamTimer clock={clock} deadline={exam.deadline} onExpire={onExpire} />}
            {!exam && !submitted && <Timer clock={clock} limit={limit} onMode={onTimerMode} running={!submitted} />}
            {!submitted && (
              <Button
                className="shrink-0"
                onClick={() => ((left > 0 || exam) && !confirming ? setConfirming(true) : doSubmit())}
                type="button"
              >
                交卷
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
