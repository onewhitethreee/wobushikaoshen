'use client'

import { CircleAlert, Headphones } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { PracticeView, type ExamResult, type ExamState } from '@/components/Practice/PracticeView'
import { Button } from '@/components/ui/button'
import type { MockPaperView } from '@/content/mockPaper'
import { bandOf } from '@/exam/mock'
import { scoreUnit } from '@/exam/practice'
import {
  activeAttempt,
  attemptId,
  expired,
  lockedByOther,
  next,
  partFallback,
  RANDOM_NO,
  sameExam,
  readLock,
  startAttempt,
  writeLock,
  LOCK_KEY,
  type MockAttempt,
  type SectionState,
} from '@/practice/mockAttempt'
import { addRecord, load, save, saveAttempt } from '@/practice/store'
import { schedulePush, sync } from '@/practice/syncClient'

import { ExamAudio } from './ExamAudio'
import { MockReport } from './MockReport'

const CHECK_SECONDS = 120
const READING_SECONDS = 3600

/** 读一个音频的时长（秒）；读不到用原文末句 + 5 秒或 600 秒 */
const probe = (src: string | undefined, fallback: number) =>
  new Promise<number>((resolve) => {
    if (!src) return resolve(fallback)
    const a = new Audio()
    const done = (v: number) => {
      clearTimeout(t)
      a.removeAttribute('src')
      resolve(v)
    }
    const t = setTimeout(() => done(fallback), 8000)
    a.preload = 'metadata'
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : fallback)
    a.onerror = () => done(fallback)
    a.src = src
  })

// 标签页标识：存 sessionStorage，刷新后不变（否则刷新会把自己锁在外面）
const tabId = () => {
  try {
    const k = 'ybz:mock-tab'
    const v = sessionStorage.getItem(k) ?? Math.random().toString(36).slice(2)
    sessionStorage.setItem(k, v)
    return v
  } catch {
    return Math.random().toString(36).slice(2)
  }
}

const lastEnd = (t: unknown) => (Array.isArray(t) ? (t[t.length - 1] as { end?: number } | undefined)?.end : undefined)

// 028 模考流程（contracts「考试页阶段」）：说明 → 听力 → 过渡 → 阅读 → 成绩单。
// 一场考试存在本机 Store.mocks，随账号同步；截止时间按真实时间算，打开时已过截止就按存下的作答交卷
export const MockExam: React.FC<{ paper: MockPaperView; view?: number }> = ({ paper, view }) => {
  const [attempt, setAttempt] = useState<MockAttempt | null>(null)
  const [other, setOther] = useState<MockAttempt | null>(null)
  const [resumed, setResumed] = useState(false)
  const [starting, setStarting] = useState(false)
  const [abandoning, setAbandoning] = useState(false)
  const [elsewhere, setElsewhere] = useState(false)
  const router = useRouter()
  const live = useRef<MockAttempt | null>(null)
  const opened = useRef(false)
  const tab = useRef('')

  const persist = useCallback((a: MockAttempt, render = true) => {
    live.current = a
    const { store } = load()
    saveAttempt(store, a)
    save(store)
    schedulePush()
    if (render) setAttempt(a)
  }, [])

  // 交卷一科：写成绩、写交卷记录（错题本 / 进步曲线用），进入下一阶段
  const submit = useCallback(
    (a: MockAttempt, mod: 'l' | 'r', r: Omit<ExamResult, 'items'> & { items: ExamResult['items'] }) => {
      const unit = mod === 'l' ? paper.l : paper.r
      const sec = a[mod]!
      const now = Date.now()
      const band = bandOf(r.score, r.total, unit.bandScale)
      const { store } = load()
      addRecord(store, {
        unitId: unit.id,
        module: mod,
        at: now,
        score: r.score,
        total: r.total,
        items: r.items,
        answers: r.answers,
        duration: r.elapsed,
        times: r.times,
        limit: Math.round((sec.deadline - sec.startedAt) / 1000),
      })
      save(store)
      const done: SectionState = { ...sec, answers: r.answers, elapsed: r.elapsed, times: r.times, submittedAt: now, score: r.score, total: r.total, band, auto: r.auto }
      return next({ ...a, [mod]: done }, mod === 'l' ? 'break' : 'done', now)
    },
    [paper],
  )

  // 打开页面：看成绩 / 接着考 / 到点补交 / 别的卷子在考
  useEffect(() => {
    // 只跑一次：开发模式下 effect 会跑两遍，第二遍会把刚补交完的这一场当成"没有进行中的"而另开一场
    if (opened.current) return
    opened.current = true
    tab.current = tabId()
    const open = () => {
      const { store } = load()
      if (view) {
        const a = store.mocks[attemptId({ no: paper.no, startedAt: view })]
        if (a?.stage === 'done') return setAttempt((live.current = a))
      }
      const act = activeAttempt(store.mocks)
      if (act && !sameExam(act, paper)) return setOther(act)
      if (!act) return setAttempt((live.current = startAttempt(paper.no, paper.version, Date.now(), paper.units)))
      let a = act
      // 已过截止：按存下的作答交卷（听力过期停在过渡页，阅读要考生点开始才计时）
      for (const mod of ['l', 'r'] as const) {
        const sec = a[mod]
        const stage = mod === 'l' ? 'listening' : 'reading'
        if (a.stage === stage && sec && expired(sec)) {
          const unit = mod === 'l' ? paper.l : paper.r
          a = submit(a, mod, { ...scoreUnit(unit, sec.answers), answers: sec.answers, elapsed: sec.elapsed ?? 0, times: sec.times ?? {}, auto: true })
        }
      }
      if (a !== act) persist(a)
      else setAttempt((live.current = a))
      setResumed(a.stage === 'listening')
      if (lockedByOther(readLock(), tab.current)) setElsewhere(true)
    }
    open()
    // 已登录时取回账号上的数据（别的设备可能在考 / 考过）：还停在没存过的说明页就重新判断一次，否则用更新的那份
    void sync().then(() => {
      const cur = live.current
      if (!cur) return
      if (cur.stage === 'intro') return open()
      const fresh = load().store.mocks[attemptId(cur)]
      if (fresh && fresh.at > cur.at) {
        live.current = fresh
        setAttempt(fresh)
      }
    })
  }, [paper, view, persist, submit])

  // 标签页锁（research R6）：考试中每 2 秒续一次；被别的标签页抢走就停下
  const examining = attempt?.stage === 'listening' || attempt?.stage === 'reading'
  useEffect(() => {
    if (!examining || elsewhere) return
    writeLock(tab.current)
    const id = setInterval(() => writeLock(tab.current), 2000)
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCK_KEY && lockedByOther(readLock(), tab.current)) setElsewhere(true)
    }
    window.addEventListener('storage', onStorage)
    return () => {
      clearInterval(id)
      window.removeEventListener('storage', onStorage)
    }
  }, [examining, elsewhere])

  const writeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const flush = useCallback(() => {
    clearTimeout(writeTimer.current)
    if (live.current) persist(live.current, false)
  }, [persist])
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [flush])

  const onChange = useCallback(
    (s: ExamState) => {
      const a = live.current
      if (!a || elsewhere) return
      const mod = a.stage === 'listening' ? 'l' : a.stage === 'reading' ? 'r' : null
      if (!mod || !a[mod]) return
      // 先记在内存里，400ms 后写本机（每次写都要序列化整个本机数据）；离开页面时立即写
      live.current = { ...a, at: Date.now(), [mod]: { ...a[mod], ...s } }
      clearTimeout(writeTimer.current)
      writeTimer.current = setTimeout(flush, 400)
    },
    [elsewhere, flush],
  )

  const onSubmit = useCallback(
    (r: ExamResult) => {
      const a = live.current
      if (!a || elsewhere) return
      const mod = a.stage === 'listening' ? 'l' : a.stage === 'reading' ? 'r' : null
      if (!mod) return
      clearTimeout(writeTimer.current)
      persist(submit(a, mod, r))
      setResumed(false)
      window.scrollTo({ top: 0 })
    },
    [persist, submit, elsewhere],
  )

  const startListening = async () => {
    if (!attempt) return
    setStarting(true)
    const durations = await Promise.all(paper.l.sections.map((s) => probe(s.audioUrl, partFallback(lastEnd(s.transcript)))))
    const now = Date.now()
    const total = durations.reduce((x, y) => x + y, 0)
    const a = next({ ...attempt, startedAt: attempt.startedAt, l: { startedAt: now, deadline: now + (total + CHECK_SECONDS) * 1000, durations, answers: {} } }, 'listening', now)
    persist(a)
    setStarting(false)
  }

  const startReading = () => {
    if (!attempt) return
    const now = Date.now()
    persist(next({ ...attempt, r: { startedAt: now, deadline: now + READING_SECONDS * 1000, answers: {} } }, 'reading', now))
  }

  const abandon = (a: MockAttempt) => {
    persist(next(a, 'abandoned'), false)
    router.push('/mock')
  }

  const retry = () => {
    // 随机一场：再考一次就重新抽
    if (paper.no === RANDOM_NO) return router.push('/mock/random')
    const a = startAttempt(paper.no, paper.version)
    live.current = a
    setAttempt(a)
    window.history.replaceState(null, '', `/mock/${paper.no}`)
    window.scrollTo({ top: 0 })
  }

  // 已在别处打开：在这里继续 = 抢锁
  const takeOver = () => {
    writeLock(tab.current)
    setElsewhere(false)
    window.location.reload()
  }

  let body: React.ReactNode = null
  if (other)
    body = (
      <Notice>
        <p>你还有一场「{other.no === RANDOM_NO ? '随机模考' : `模考 ${other.no}`}」没考完，同一时间只能考一场。</p>
        <div className="flex flex-wrap gap-3">
          <Link className="inline-flex min-h-11 items-center bg-primary px-4 font-semibold text-primary-foreground" href={other.no === RANDOM_NO ? '/mock/random' : `/mock/${other.no}`}>
            继续那一场
          </Link>
          <Button
            onClick={() => {
              const { store } = load()
              const a = store.mocks[attemptId(other)]
              if (a) persist(next(a, 'abandoned'), false)
              setOther(null)
              setAttempt((live.current = startAttempt(paper.no, paper.version, Date.now(), paper.units)))
            }}
            type="button"
            variant="outline"
          >
            放弃那一场
          </Button>
        </div>
      </Notice>
    )
  else if (elsewhere)
    body = (
      <Notice>
        <p>这场考试已在别的窗口打开。</p>
        <Button onClick={takeOver} type="button">
          在这里继续
        </Button>
      </Notice>
    )
  else if (attempt?.stage === 'intro') body = <Intro onStart={startListening} paper={paper} starting={starting} />
  else if (attempt?.stage === 'listening' && attempt.l)
    body = (
      <PracticeView
        exam={{
          deadline: attempt.l.deadline,
          initial: attempt.l,
          onChange,
          onSubmit,
          audio: (
            <ExamAudio
              autoStart={!resumed}
              durations={attempt.l.durations ?? []}
              srcs={paper.l.sections.map((s) => s.audioUrl ?? '')}
              startedAt={attempt.l.startedAt}
            />
          ),
        }}
        key="l"
        unit={paper.l}
      />
    )
  else if (attempt?.stage === 'break')
    body = (
      <Notice>
        <h1 className="text-[22px] font-medium">听力已交卷</h1>
        {attempt.l?.auto && <p className="text-warning">时间到，已自动交卷。</p>}
        <p className="text-muted-foreground">接下来是阅读：3 篇文章，40 题，60 分钟。点开始后计时。</p>
        <Button onClick={startReading} type="button">
          开始阅读（60 分钟）
        </Button>
      </Notice>
    )
  else if (attempt?.stage === 'reading' && attempt.r)
    body = <PracticeView exam={{ deadline: attempt.r.deadline, initial: attempt.r, onChange, onSubmit }} key="r" unit={paper.r} />
  else if (attempt?.stage === 'done') body = <MockReport attempt={attempt} onRetry={retry} paper={paper} />

  const active = attempt && (attempt.stage === 'listening' || attempt.stage === 'break' || attempt.stage === 'reading')

  return (
    <>
      <div className="container lg:hidden">
        <div className="flex flex-col gap-3 bg-muted px-5 py-6">
          <p className="font-semibold">模考请用电脑打开</p>
          <p className="text-sm text-muted-foreground">考试界面按电脑机考还原，手机上没法正常作答。</p>
          <Link className="inline-flex min-h-11 items-center text-sm underline underline-offset-4" href="/mock">
            回到模考列表
          </Link>
        </div>
      </div>
      <div className="hidden lg:block">
        {active && !elsewhere && (
          <div className="container flex flex-wrap items-center gap-3 pt-2 text-sm">
            {attempt.stage !== 'break' && (
              <h1 className="text-sm font-normal text-muted-foreground">
                {paper.title} · {attempt.stage === 'reading' ? '阅读' : '听力'}
              </h1>
            )}
            {abandoning ? (
              <span className="ml-auto flex items-center gap-2" role="alert">
                放弃后这场不留成绩。
                <Button onClick={() => abandon(attempt)} type="button" variant="outline">
                  确定放弃
                </Button>
                <Button onClick={() => setAbandoning(false)} type="button">
                  继续考试
                </Button>
              </span>
            ) : (
              <button className="ml-auto inline-flex min-h-11 items-center px-2 text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={() => setAbandoning(true)} type="button">
                放弃这场
              </button>
            )}
          </div>
        )}
        {body}
      </div>
    </>
  )
}

const Notice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="container py-10">
    <div className="flex max-w-xl flex-col items-start gap-4">{children}</div>
  </div>
)

const RULES = ['听力音频只播放一次，不能暂停、拖动', '到点自动交卷，已填的答案都算', '交卷后不能回到上一科', '考试中不能查词，可以选中文字高亮']

const Intro: React.FC<{ paper: MockPaperView; starting: boolean; onStart: () => void }> = ({ paper, starting, onStart }) => {
  const test = useRef<HTMLAudioElement>(null)
  const [testing, setTesting] = useState(false)
  const approx = Math.round(
    paper.l.sections.reduce((s, x) => s + partFallback(lastEnd(x.transcript)), 0) / 60 + CHECK_SECONDS / 60,
  )
  const tryAudio = () => {
    const a = test.current
    if (!a) return
    a.currentTime = 0
    void a.play().catch(() => {})
    setTesting(true)
    setTimeout(() => {
      a.pause()
      setTesting(false)
    }, 3000)
  }
  return (
    <div className="container flex flex-col gap-8 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-[clamp(28px,3vw,40px)] leading-tight font-medium tracking-[-0.02em]">{paper.title}</h1>
        <p className="text-muted-foreground">听力 + 阅读，免费</p>
      </header>
      <ol className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <li className="border-t-2 border-foreground pt-3">
          <p className="font-semibold">1 · 听力</p>
          <p className="text-sm text-muted-foreground tabular-nums">4 个 Part，40 题，约 {approx} 分钟（音频 + 2 分钟检查）</p>
        </li>
        <li className="border-t-2 border-foreground pt-3">
          <p className="font-semibold">2 · 阅读</p>
          <p className="text-sm text-muted-foreground tabular-nums">3 篇文章，40 题，{READING_SECONDS / 60} 分钟</p>
        </li>
      </ol>
      <ul className="flex max-w-3xl flex-col gap-2">
        {RULES.map((r) => (
          <li className="flex items-start gap-2" key={r}>
            <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0 text-warning" />
            {r}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-4">
        <audio preload="none" ref={test} src={paper.l.sections[0]?.audioUrl} />
        <Button disabled={testing} onClick={tryAudio} type="button" variant="outline">
          <Headphones aria-hidden="true" className="size-4" />
          {testing ? '试音中…' : '试音 3 秒'}
        </Button>
        <span className="text-sm text-muted-foreground">建议戴耳机，先把音量调好</span>
      </div>
      <div>
        <Button data-testid="start-listening" disabled={starting} onClick={onStart} size="lg" type="button">
          {starting ? '正在准备音频…' : '开始听力'}
        </Button>
      </div>
    </div>
  )
}
