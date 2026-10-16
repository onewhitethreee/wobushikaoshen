'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Volume2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { isMember } from '@/practice/syncClient'
import { clean, formText, type DictResult } from '@/vocab/lookup'
import { STATUS_LABEL, status } from '@/vocab/schedule'
import { addWord, load, type AddResult, type Source } from '@/vocab/store'

// 双击查词（013 research R5、R7、R8，contracts/ui.md "查词卡片"）。全站只挂一个，不改正文组件；
// 只在有鼠标的设备上启用，输入框、可编辑区域、[data-no-lookup]（以后的机考模式）里不弹
const cache = new Map<string, DictResult | 'none'>()
const MAX_LINES = 6
const WIDTH = 320

const fetchWord = async (w: string): Promise<DictResult | 'none'> => {
  const key = w.toLowerCase()
  const hit = cache.get(key)
  if (hit) return hit
  const res = await fetch(`/api/dict?w=${encodeURIComponent(w)}`)
  if (res.status === 404 || res.status === 400) {
    cache.set(key, 'none')
    return 'none'
  }
  if (!res.ok) throw new Error(String(res.status))
  const d = (await res.json()) as DictResult
  cache.set(key, d)
  return d
}

export const speak = (word: string) => {
  if (!('speechSynthesis' in window)) return
  const lang = load().vocab.accent === 'us' ? 'en-US' : 'en-GB'
  const u = new SpeechSynthesisUtterance(word)
  u.lang = lang
  const voice = speechSynthesis.getVoices().find((v) => v.lang === lang && v.localService)
  if (voice) u.voice = voice
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
}

/** 原句和出处（research R5）：句子元素 #s{n} → #p{k}-s{n}；题目 [data-q] → #q-{n}；否则取最近段落里的那一句 */
const sourceOf = (node: Node): Omit<Source, 'at'> => {
  const el = node instanceof Element ? node : node.parentElement
  const title =
    (document.querySelector('[data-unit-title]') ?? document.querySelector('h1'))?.textContent
      ?.trim()
      .slice(0, 200) ?? ''
  const path = location.pathname
  const sentence = el?.closest<HTMLElement>('[id^="s"][id]')
  const section = el?.closest<HTMLElement>('[data-section]')?.dataset.section
  if (sentence && /^s\d+$/.test(sentence.id) && section !== undefined) {
    return {
      text: sentence.textContent!.trim().slice(0, 300),
      href: `${path}#p${section}-${sentence.id}`,
      title,
    }
  }
  const q = el?.closest<HTMLElement>('[data-q]')
  if (q)
    return {
      text: q.textContent!.replace(/\s+/g, ' ').trim().slice(0, 300),
      href: `${path}#q-${q.dataset.q}`,
      title,
    }
  const block = el?.closest('p, li') ?? el
  const text = block?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  const sel = getSelection()?.toString().trim() ?? ''
  const one = text.split(/(?<=[.!?])\s+/).find((s) => s.includes(sel)) ?? text
  return { text: one.slice(0, 300), href: path, title }
}

const FAIL: Partial<Record<AddResult, string>> = {
  unavailable: '这个浏览器不能保存单词本',
  quota: '单词本存不下了，请先移出一些单词',
  full: '单词本最多 5000 个词',
}

type Card = {
  x: number
  y: number
  above: boolean
  word: string
  src: Omit<Source, 'at'>
  data?: DictResult | 'none' | 'error'
}

export const WordLookup: React.FC = () => {
  const [card, setCard] = useState<Card | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [msg, setMsg] = useState('')
  const [member, setMember] = useState(true)
  const [tick, setTick] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  // 打开时焦点移进卡片（键盘可直接 Tab 到按钮），Esc 关闭后还给原来的元素
  const opener = useRef<HTMLElement | null>(null)
  const opened = !!card
  useEffect(() => {
    if (!opened) return
    opener.current = document.activeElement as HTMLElement | null
    box.current?.focus({ preventScroll: true })
    return () => opener.current?.focus({ preventScroll: true })
  }, [opened])

  const close = useCallback(() => {
    setCard(null)
    setExpanded(false)
    setMsg('')
  }, [])

  useEffect(() => {
    const mq = matchMedia('(hover: hover) and (pointer: fine)')
    const onDbl = (e: MouseEvent) => {
      if (!mq.matches) return
      const t = e.target as Element | null
      if (
        t?.closest(
          'input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-no-lookup], [data-lookup-card]',
        )
      )
        return
      const sel = getSelection()
      const word = sel && sel.rangeCount ? clean(sel.toString()) : null
      if (!sel || !word) return
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      const w = Math.min(WIDTH, innerWidth - 32)
      const x = Math.min(Math.max(16, rect.left), innerWidth - w - 16)
      const above = rect.bottom + 8 + 260 > innerHeight && rect.top > 260
      setExpanded(false)
      setMsg('')
      setCard({
        x,
        y: above ? rect.top - 8 : rect.bottom + 8,
        above,
        word,
        src: sourceOf(sel.anchorNode!),
      })
      fetchWord(word)
        .then((data) => setCard((c) => (c && c.word === word ? { ...c, data } : c)))
        .catch(() => setCard((c) => (c && c.word === word ? { ...c, data: 'error' } : c)))
      isMember().then(setMember)
    }
    document.addEventListener('dblclick', onDbl)
    return () => document.removeEventListener('dblclick', onDbl)
  }, [])

  useEffect(() => {
    if (!card) return
    const shut = () => {
      getSelection()?.removeAllRanges()
      close()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && shut()
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && close()
    const onScroll = (e: Event) => !box.current?.contains(e.target as Node) && shut()
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [card, close])

  // 状态播报：区域一直挂着，内容变化读屏才会读出来
  const live = (text: string) => (
    <p aria-live="polite" className="sr-only">
      {text}
    </p>
  )
  if (!card) return <>{live('')}</>
  const d = card.data
  const entry = d && d !== 'none' && d !== 'error' ? d : null
  const saved = entry ? load().words[entry.word] : undefined
  const inBook = saved?.on
  const knowsSentence = inBook && saved.src?.some((s) => s.text === card.src.text)
  void tick

  const add = () => {
    if (!entry) return
    const r = addWord(entry, { ...card.src, at: Date.now() })
    setMsg(FAIL[r] ?? '')
    setTick((n) => n + 1)
  }

  const said = !d
    ? '正在查词'
    : d === 'none'
      ? '词典里没有这个词'
      : d === 'error'
        ? '查词失败'
        : msg || `${d.word} ${d.meanings[0] ?? ''}`
  return (
    <>
      {live(said)}
      <div
        aria-label="释义"
        className="fixed z-30 flex flex-col gap-2 border border-border bg-background p-4 text-[15px] shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)] outline-none"
        data-lookup-card
        data-testid="lookup-card"
        ref={box}
        role="dialog"
        tabIndex={-1}
        style={{
          left: card.x,
          top: card.y,
          width: Math.min(WIDTH, innerWidth - 32),
          transform: card.above ? 'translateY(-100%)' : undefined,
        }}
      >
        {!d && <p className="text-muted-foreground">正在查词…</p>}
        {d === 'none' && <p className="text-muted-foreground">词典里没有这个词</p>}
        {d === 'error' && <p className="text-muted-foreground">查词失败，请稍后再试</p>}
        {entry && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-semibold">{entry.word}</span>
              {entry.phonetic && <span className="text-muted-foreground">/{entry.phonetic}/</span>}
              {typeof window !== 'undefined' && 'speechSynthesis' in window && (
                <button
                  aria-label="发音"
                  className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                  data-testid="lookup-speak"
                  onClick={() => speak(entry.word)}
                  type="button"
                >
                  <Volume2 aria-hidden="true" className="size-5" strokeWidth={1.5} />
                </button>
              )}
            </div>
            {entry.form && (
              <p className="text-[13px] text-muted-foreground">
                {formText(entry.form, entry.word)}
              </p>
            )}
            <ul className="flex flex-col gap-0.5 leading-[1.6]">
              {(expanded ? entry.meanings : entry.meanings.slice(0, MAX_LINES)).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            {!expanded && entry.meanings.length > MAX_LINES && (
              <button
                className="min-h-11 self-start text-[13px] text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded(true)}
                type="button"
              >
                更多
              </button>
            )}
            {inBook ? (
              <div className="flex flex-wrap items-center gap-x-4 text-[13px] text-muted-foreground">
                <span data-testid="lookup-in-book">已在单词本 · {STATUS_LABEL[status(saved)]}</span>
                {!knowsSentence && (
                  <button
                    className="min-h-11 text-foreground underline underline-offset-4"
                    onClick={add}
                    type="button"
                  >
                    再记一句
                  </button>
                )}
              </div>
            ) : (
              <Button data-testid="lookup-add" onClick={add} type="button">
                加入单词本
              </Button>
            )}
            {msg && <p className="text-[13px] text-error">{msg}</p>}
            {inBook && !member && (
              <p className="text-[13px] text-muted-foreground">登录后换设备也能看到</p>
            )}
          </>
        )}
      </div>
    </>
  )
}
