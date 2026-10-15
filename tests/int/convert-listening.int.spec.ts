import { describe, expect, it } from 'vitest'

import { convertGroup } from '../../scripts/convert/questions'
import { toTranscript } from '../../scripts/convert/transcript'

// 007 听力转换（T035），原创示例
const s = (i: number, text: string, start = i * 2) => ({ i, speaker: 'Speaker 0', start, end: start + 1, text })

describe('听力原文', () => {
  it('标出开头、中途、结尾的播报语', () => {
    const { transcript, issues } = toTranscript([
      s(0, 'Part one.'),
      s(1, 'You will hear a man booking a room.'),
      s(2, 'First, you have some time to look at questions one to five.'),
      s(3, 'Now listen carefully and answer questions one to five.'),
      s(4, 'Hello, I would like to book a room.'),
      s(5, 'Before you hear the rest of the conversation, you have some time to look at questions six to ten.'),
      s(6, 'That is the end of my booking, thanks.'),
      s(7, 'That is the end of part one.'),
      s(8, 'You now have one minute to check your answers.'),
    ])
    expect(transcript.filter((x) => x.announce).map((x) => x.n)).toEqual([0, 1, 2, 3, 5, 7, 8])
    expect(transcript[4]).toEqual({ n: 4, speaker: 'Speaker 0', start: 8, end: 9, text: 'Hello, I would like to book a room.' })
    expect(issues).toEqual([])
  })

  it('时间戳缺失或倒序只报告，不算错误', () => {
    expect(toTranscript([s(0, 'Hi.', 5), s(1, 'Bye.', 2)]).issues.join()).toContain('无逐句时间轴')
    expect(toTranscript([{ i: 0, text: 'Hi.' }]).issues.join()).toContain('无逐句时间轴')
    expect(toTranscript([s(1, 'Hi.')]).issues).toContain('句子编号不是从 0 连续')
  })
})

describe('听力地图题', () => {
  it('题组选项取第一题的图上字母，按字母判', () => {
    const c = convertGroup(
      {
        type: 'map',
        instructions: 'Label the map below. Write the correct letter, A-C.',
        image: 'map.png',
        questions: [
          { no: '15', question: 'the bank', options: ['A', 'B', 'C'] },
          { no: '16', question: 'the park' },
        ],
      },
      'listening',
    )
    expect(c.group).toMatchObject({ type: 'labelling', image: 'map.png', options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }] })
    expect(c.group.maxWords).toBeUndefined()
    expect(c.group.questions.map((q) => q.prompt)).toEqual(['the bank', 'the park'])
    expect(c.issues).toEqual([])
  })

  it('去掉正文里的网页残留', () => {
    const c = convertGroup(
      { type: 'fill-in-the-blank', instructions: 'ONE WORD ONLY', content: 'Preview\nbody{font-family:Arial;margin:24px;}\nLocated in the [31]', questions: [{ no: '31' }] },
      'listening',
    )
    expect(c.group.content).toBe('Located in the {{31}}')
  })

  it('说明里没写字数限制时不算错', () => {
    const c = convertGroup({ type: 'fill-in-the-blank', instructions: 'Questions 31-40', content: 'a [31]', questions: [{ no: '31' }] }, 'listening')
    expect(c.issues).toEqual([])
    expect(c.group.maxWords).toBeUndefined()
  })
})
