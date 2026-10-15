'use client'

import React, { useRef, useState } from 'react'

type Result =
  | { ok: true; created: { collection: string; id: number | string; label: string }[] }
  | { ok: false; errors: string[] }

// 列表页顶部的"导入"：选择整个文件夹（含 import.json 和它引用的音频、图片），提交到 /api/import
export const ImportButton: React.FC = () => {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const upload = async (list: FileList | null) => {
    if (!list?.length) return
    const body = new FormData()
    for (const f of Array.from(list)) {
      // webkitRelativePath 形如 "T-012/audio/part1.mp3"，去掉第一级目录名
      const rel = (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name
      body.append('files', f, rel)
    }
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/import', { method: 'POST', body, credentials: 'include' })
      setResult((await res.json()) as Result)
    } catch (e) {
      setResult({ ok: false, errors: [`上传失败：${(e as Error).message}`] })
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <input
        hidden
        multiple
        onChange={(e) => upload(e.target.files)}
        ref={input}
        type="file"
        // @ts-expect-error 非标准属性：选择整个文件夹
        webkitdirectory=""
      />
      <button
        className="btn btn--style-secondary btn--size-small"
        disabled={busy}
        onClick={() => input.current?.click()}
        type="button"
      >
        {busy ? '导入中…' : '导入文件夹'}
      </button>
      {result?.ok && (
        <p>
          导入成功，已保存为草稿：
          {result.created.map((c) => (
            <a href={`/admin/collections/${c.collection}/${c.id}`} key={c.id} style={{ marginLeft: 8 }}>
              {c.label}
            </a>
          ))}
        </p>
      )}
      {result && !result.ok && (
        <div role="alert">
          <p>导入失败，没有保存任何数据。请修正以下问题后重新导入：</p>
          <ul>
            {result.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
