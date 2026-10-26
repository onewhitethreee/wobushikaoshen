import type { Field } from 'payload'

// 033：单元、写作题共用。默认雅思，已有内容和雅思导入包不用改
export const examField: Field = {
  name: 'exam',
  label: '考试',
  type: 'select',
  required: true,
  defaultValue: 'ielts',
  index: true,
  options: [
    { label: '雅思', value: 'ielts' },
    { label: '四级', value: 'cet4' },
    { label: '六级', value: 'cet6' },
  ],
  admin: { position: 'sidebar' },
}

export const paperField: Field = {
  name: 'paper',
  label: '试卷',
  type: 'text',
  index: true,
  admin: { position: 'sidebar', description: '如 2024-06-1（年-月-第几套）；四 / 六级必填' },
}
