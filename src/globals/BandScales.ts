import type { GlobalConfig } from 'payload'
import { APIError } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { listeningDefaults, readingDefaults } from '../exam/bandScaleDefaults'
import { validateBandScale, type BandRow } from '../exam/validate'

const scale = (name: string, label: string, defaultValue: BandRow[]) => ({
  name,
  label,
  type: 'array' as const,
  defaultValue,
  fields: [
    {
      type: 'row' as const,
      fields: [
        { name: 'min', label: '原始分起', type: 'number' as const, required: true, min: 0, max: 40 },
        { name: 'max', label: '原始分止', type: 'number' as const, required: true, min: 0, max: 40 },
        { name: 'band', label: 'band', type: 'number' as const, required: true, min: 0, max: 9 },
      ],
    },
  ],
})

// 原始分 → band 换算表，全站一份（FR-072 / FR-073）
export const BandScales: GlobalConfig = {
  slug: 'band-scales',
  label: '分数换算表',
  access: { read: anyone, update: authenticated },
  fields: [scale('listening', '听力', listeningDefaults), scale('reading', '阅读（学术类）', readingDefaults)],
  hooks: {
    beforeChange: [
      ({ data }) => {
        const errors = [
          ...validateBandScale(data.listening, '听力'),
          ...validateBandScale(data.reading, '阅读'),
        ]
        if (errors.length) throw new APIError(errors.join('\n'), 400, null, true)
        return data
      },
    ],
  },
}
