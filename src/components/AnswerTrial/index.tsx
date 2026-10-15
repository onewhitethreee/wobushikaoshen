'use client'

import type { UIFieldClientComponent } from 'payload'
import { useFormFields } from '@payloadcms/ui'
import React, { useState } from 'react'

import { answerLines, isCorrect, scoreMulti, type QuestionType } from '@/exam/scoring'

// 答案试判（FR-071）：输入一个作答，立刻按判分规则显示对错，不发请求
export const AnswerTrial: UIFieldClientComponent = ({ path }) => {
  // path 形如 listening.parts.0.groups.1.questions.2.trial
  const qPath = path.slice(0, path.lastIndexOf('.'))
  const gPath = path.slice(0, path.lastIndexOf('.questions.'))
  const [response, setResponse] = useState('')

  const answers = useFormFields(([f]) => f[`${qPath}.answers`]?.value) as string | undefined
  const type = useFormFields(([f]) => f[`${gPath}.type`]?.value) as QuestionType | undefined
  const maxWords = useFormFields(([f]) => f[`${gPath}.maxWords`]?.value) as number | undefined
  const numberAllowed = useFormFields(([f]) => f[`${gPath}.numberAllowed`]?.value) as boolean | undefined

  let result = ''
  if (response.trim() && answers && type) {
    if (type === 'multi_choice') {
      result = `得 ${scoreMulti(response.split(/[,，\s]+/), answers)} / ${answerLines(answers).length} 分`
    } else {
      result = isCorrect(response, answers, { type, maxWords, numberAllowed }) ? '✓ 判对' : '✗ 判错'
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>答案试判</span>
        <input
          onChange={(e) => setResponse(e.target.value)}
          placeholder={type === 'multi_choice' ? '多个选项用逗号分隔' : '输入一个作答'}
          style={{ padding: '6px 10px', minWidth: 240 }}
          value={response}
        />
      </label>
      <output aria-live="polite">{result}</output>
    </div>
  )
}
