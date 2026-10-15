'use client'

import type { UIFieldClientComponent } from 'payload'
import React, { useState } from 'react'

// 「邮件设置」每组底部的"发送测试邮件"（009 FR-013）：用已保存的这一套配置发一封，显示成功或失败原因
export const MailTestButton: UIFieldClientComponent = ({ path }) => {
  const which = path.split('.')[0] as 'primary' | 'backup'
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')

  const run = async () => {
    setBusy(true)
    setResult('')
    try {
      const res = await fetch('/api/mail-settings/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ which, to }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setResult(res.ok ? '✓ 已发出，请到收件箱查看' : `✗ ${body.error ?? res.status}`)
    } catch {
      setResult('✗ 网络错误')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      <input
        aria-label="测试收件地址"
        onChange={(e) => setTo(e.target.value)}
        placeholder="测试收件地址"
        style={{ padding: '6px 10px', minWidth: 240 }}
        type="email"
        value={to}
      />
      <button className="btn btn--style-secondary btn--size-small" disabled={busy || !to} onClick={run} type="button">
        {busy ? '发送中…' : '发送测试邮件'}
      </button>
      <span style={{ color: 'var(--theme-elevation-600)' }}>先保存，再测试</span>
      <output aria-live="polite">{result}</output>
    </div>
  )
}
