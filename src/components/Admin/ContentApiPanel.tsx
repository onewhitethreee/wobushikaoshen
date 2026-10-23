'use client'

import type { UIFieldClientComponent } from 'payload'
import React, { useCallback, useEffect, useState } from 'react'

// 029「内容接口」面板：密钥状态、生成 / 重新生成 / 停用（明文只显示一次）、今日与最近 7 天新建数。
// 每日上限是下方的普通字段，改了点页面右上角"保存"
type Status = {
  hasKey: boolean
  keyLast4: string | null
  keyCreatedAt: string | null
  lastUsedAt: string | null
  quota: { limit: number; used: number; remaining: number; resetAt: string }
  days: { date: string; count: number }[]
}

const time = (s: string | null) => (s ? new Date(s).toLocaleString('zh-CN', { hour12: false }) : '—')
const muted: React.CSSProperties = { color: 'var(--theme-elevation-600)' }

export const ContentApiPanel: UIFieldClientComponent = () => {
  const [status, setStatus] = useState<Status | null>(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/content-api/admin', { credentials: 'include' }).catch(() => null)
    if (res?.ok) setStatus((await res.json()) as Status)
    else setError('读取失败，请刷新页面')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (method: 'POST' | 'DELETE', confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    setError('')
    setKey('')
    const res = await fetch('/api/content-api/admin/key', { method, credentials: 'include' }).catch(() => null)
    const body = (await res?.json().catch(() => null)) as { key?: string; errors?: string[] } | null
    if (!res?.ok) setError(body?.errors?.[0] ?? '操作失败')
    else if (body?.key) setKey(body.key)
    await load()
    setBusy(false)
  }

  const copy = async () => {
    await navigator.clipboard?.writeText(key).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const max = Math.max(1, ...(status?.days.map((d) => d.count) ?? [1]))

  return (
    <div data-testid="content-api-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
      <p style={muted}>
        给站长的另一个 AI 上传阅读题用。把密钥交给它，并让它先请求 <code>GET /api/content-api/format</code> 读格式说明。步骤见仓库
        <code> docs/content-api.md</code>。
      </p>

      {status && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          {status.hasKey ? (
            <span data-testid="content-api-key-status">
              当前密钥 <code>cak_…{status.keyLast4}</code> · 生成于 {time(status.keyCreatedAt)} · 最近使用 {time(status.lastUsedAt)}
            </span>
          ) : (
            <span data-testid="content-api-key-status">还没有密钥（接口不可用）</span>
          )}
          <button
            className="btn btn--style-primary btn--size-small"
            data-testid="content-api-generate"
            disabled={busy}
            onClick={() => act('POST', status.hasKey ? '旧密钥会立即失效，确定重新生成？' : undefined)}
            type="button"
          >
            {status.hasKey ? '重新生成' : '生成密钥'}
          </button>
          {status.hasKey && (
            <button
              className="btn btn--style-secondary btn--size-small"
              data-testid="content-api-disable"
              disabled={busy}
              onClick={() => act('DELETE', '停用后接口立即不可用，确定？')}
              type="button"
            >
              停用
            </button>
          )}
        </div>
      )}

      {key && (
        <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, border: '1px solid var(--theme-warning-500)' }}>
          <strong>新密钥只显示这一次，请立即复制交给调用方：</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input
              aria-label="新密钥"
              data-testid="content-api-key"
              onFocus={(e) => e.target.select()}
              readOnly
              style={{ flex: '1 1 360px', padding: '6px 10px', fontFamily: 'monospace' }}
              value={key}
            />
            <button className="btn btn--style-secondary btn--size-small" onClick={copy} type="button">
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" style={{ color: 'var(--theme-error-500)' }}>
          {error}
        </p>
      )}

      {status && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span data-testid="content-api-today">
            今日已新建 {status.quota.used} / 上限 {status.quota.limit}（北京时间 0 点重置）
          </span>
          <table style={{ borderCollapse: 'collapse', maxWidth: 420 }}>
            <caption style={{ ...muted, textAlign: 'left', paddingBottom: 4 }}>最近 7 天新建数</caption>
            <tbody>
              {status.days.map((d) => (
                <tr key={d.date}>
                  <td style={{ padding: '2px 12px 2px 0', whiteSpace: 'nowrap', ...muted }}>{d.date.slice(5)}</td>
                  <td style={{ width: '100%' }}>
                    <span
                      aria-hidden="true"
                      style={{ display: 'inline-block', height: 10, width: `${(d.count / max) * 100}%`, minWidth: d.count ? 4 : 0, background: 'var(--theme-elevation-500)' }}
                    />
                  </td>
                  <td style={{ padding: '2px 0 2px 12px', textAlign: 'right' }}>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
