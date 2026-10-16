// 示例数据：001 后端完成后，用真实查询生成同样形状的数据替换本文件的调用点。
// 形状说明见 specs/002-frontend-visual-design/data-model.md

export type Cost = { kind: 'free' } | { kind: 'quota'; amount: number }

export type Action = {
  label: string
  /** 做过之后的按钮文字，如"再做一遍""再写一遍" */
  doneLabel?: string
  href: string
  cost: Cost
  desktopOnly?: boolean
}

export type PracticeRow = {
  id: string
  lead: string
  leadSub?: string
  title: string
  meta: string[]
  count?: number
  minutes?: number
  facets: Record<string, string>
  /** 上次记录的文字（筛选"已做 / 未做"与读屏用） */
  record?: string
  /** 有分数时栏目页画成图形（005 US6）；没有就显示 record 文字胶囊 */
  score?: RowScore
  actions: Action[]
}

export type RowScore =
  | { kind: 'ratio'; correct: number; total: number }
  | { kind: 'band'; items: { label: string; band: number }[] }

export type Filter = { id: string; label: string; options: string[] }

export type Tab = { id: string; label: string; match: Record<string, string>; filters: Filter[] }

export type SidebarModule =
  | { kind: 'mock'; title: string; meta: string; href: string }
  | { kind: 'accuracy'; rows: { label: string; percent: number; href: string }[] }
  | { kind: 'quota' }
  | { kind: 'note'; title: string; body: string; link?: { label: string; href: string } }

export type ColumnSlug = 'listening' | 'reading' | 'writing' | 'speaking' | 'mock'

export type ColumnConfig = {
  slug: ColumnSlug
  title: string
  cost: Cost
  /** 扣额度栏目在 h1 旁的标记前缀，如"批改" */
  costLabel?: string
  note: string
  tabs: Tab[]
  rows: PracticeRow[]
  sidebar: SidebarModule[]
  /** 退回示例数据时为 true，页面上标"示例数据" */
  isSample?: boolean
}

export type HomeData = {
  issueLine: string
  subjects: {
    slug: ColumnSlug
    name: string
    cost: Cost
    costLabel?: string
    desc: string
    items: { id: string; title: string; meta: string; count?: string }[]
    moreLabel: string
  }[]
  mock: { listening: string; reading: string; result: string }
  quotaWays: { title: string; desc: string; disabled?: boolean }[]
}

export const session = { loggedIn: false, balance: 3 }

const free: Cost = { kind: 'free' }
const quota1: Cost = { kind: 'quota', amount: 1 }

const status: Filter = { id: 'status', label: '状态', options: ['全部', '未做', '已做'] }

const practice = (slug: ColumnSlug, id: string): Action => ({
  label: '开始练习',
  doneLabel: '再做一遍',
  href: `/${slug}?start=${id}`,
  cost: free,
})

type G = [id: string, part: string, range: string, title: string, type: string, n: number, min: number, set: string, rec?: number]

const listeningGroups: G[] = [
  ['l1', '2', '11–20', '社区图书馆的会员新规', '填空', 10, 7, '第 12 套', 8],
  ['l2', '1', '1–10', '预订周末自行车之旅', '填空', 10, 6, '第 12 套'],
  ['l3', '2', '11–16', '自然保护区游客中心', '地图题', 6, 5, '第 11 套', 3],
  ['l4', '3', '21–30', '两名学生讨论市场调研作业', '单选', 10, 8, '第 11 套'],
  ['l5', '3', '25–30', '导师点评毕业论文提纲', '配对', 6, 5, '第 10 套', 5],
  ['l6', '4', '31–40', '城市屋顶农场的兴起', '填空', 10, 8, '第 10 套'],
  ['l7', '1', '1–10', '咨询短期租房', '填空', 10, 6, '第 9 套', 9],
  ['l8', '2', '17–20', '博物馆新馆导览', '多选', 4, 3, '第 9 套'],
  ['l9', '4', '31–40', '一位历史学家翻出十八世纪的航海日志，把船员随手记的风向和天气整理成气候数据', '填空', 10, 9, '第 8 套'],
  ['l10', '3', '21–24', '小组讨论校园咖啡馆的改造方案', '地图题', 4, 4, '第 8 套', 2],
]

const listeningTypeLabel: Record<string, string> = {
  填空: '笔记 / 表格填空',
  单选: '单选',
  多选: '多选',
  地图题: '地图题',
  配对: '配对',
}

const readingGroups: G[] = [
  ['r1', '1', '1–13', '珊瑚礁如何自我修复', '判断', 13, 20, '第 12 套', 10],
  ['r2', '2', '14–27', '十九世纪的铁路与标准时间', '段落标题匹配', 14, 20, '第 12 套'],
  ['r3', '3', '28–40', '婴儿怎样学会语法', '摘要填空', 13, 20, '第 12 套', 9],
  ['r4', '1', '1–13', '城市里的野生狐狸', '信息匹配', 13, 20, '第 11 套'],
  ['r5', '2', '14–26', '蜂群如何做出集体决策', '单选', 13, 20, '第 11 套', 11],
  ['r6', '3', '27–40', '博物馆该不该归还文物', '判断', 14, 20, '第 11 套'],
  ['r7', '1', '1–13', '竹子作为建筑材料', '摘要填空', 13, 20, '第 10 套'],
  ['r8', '2', '14–27', '睡眠与记忆巩固', '段落标题匹配', 14, 20, '第 10 套', 8],
]

const groupRows = (slug: 'listening' | 'reading', groups: G[]): PracticeRow[] =>
  groups.map(([id, part, range, title, type, n, min, set, rec]) => ({
    id,
    lead: slug === 'listening' ? `P${part}` : `R${part}`,
    leadSub: `${range} 题`,
    title,
    meta: [slug === 'listening' ? (listeningTypeLabel[type] ?? type) : type, set],
    count: n,
    minutes: min,
    facets: { kind: 'group', type, part: slug === 'listening' ? `Part ${part}` : `Passage ${part}` },
    record: rec === undefined ? undefined : `上次 ${rec}/${n}`,
    score: rec === undefined ? undefined : { kind: 'ratio', correct: rec, total: n },
    actions: [practice(slug, id)],
  }))

const setRows = (slug: 'listening' | 'reading'): PracticeRow[] =>
  (
    [
      ['s12', '12', 31],
      ['s11', '11', undefined],
    ] as const
  ).map(([id, no, rec]) => ({
    id: `${slug}-${id}`,
    lead: no,
    leadSub: '整套',
    title: `第 ${no} 套${slug === 'listening' ? '听力' : '阅读'}`,
    meta: [slug === 'listening' ? '4 个 Part' : '3 篇文章'],
    count: 40,
    minutes: slug === 'listening' ? 30 : 60,
    facets: { kind: 'set' },
    record: rec === undefined ? undefined : `上次 ${rec}/40`,
    score: rec === undefined ? undefined : { kind: 'ratio', correct: rec, total: 40 },
    actions: [practice(slug, `${slug}-${id}`)],
  }))

const weakLink = (slug: ColumnSlug, type: string) =>
  `/${slug}?tab=type&type=${encodeURIComponent(type)}&status=${encodeURIComponent('未做')}`

const listening: ColumnConfig = {
  slug: 'listening',
  title: '听力',
  cost: free,
  note: '不登录也能做',
  tabs: [
    {
      id: 'type',
      label: '按题型练',
      match: { kind: 'group' },
      filters: [{ id: 'type', label: '题型', options: ['全部', '填空', '单选', '多选', '地图题', '配对'] }, status],
    },
    {
      id: 'part',
      label: '按 Part 练',
      match: { kind: 'group' },
      filters: [{ id: 'part', label: 'Part', options: ['全部', 'Part 1', 'Part 2', 'Part 3', 'Part 4'] }, status],
    },
    { id: 'set', label: '整套练', match: { kind: 'set' }, filters: [status] },
  ],
  rows: [...groupRows('listening', listeningGroups), ...setRows('listening')],
  sidebar: [
    { kind: 'mock', title: '整套听力模考', meta: '4 个 Part · 40 题 · 约 30 分钟 · 免费', href: '/mock' },
    {
      kind: 'accuracy',
      rows: [
        { label: '填空', percent: 78, href: weakLink('listening', '填空') },
        { label: '单选', percent: 64, href: weakLink('listening', '单选') },
        { label: '配对', percent: 70, href: weakLink('listening', '配对') },
        { label: '地图题', percent: 46, href: weakLink('listening', '地图题') },
      ],
    },
    {
      kind: 'note',
      title: '听力不扣额度',
      body: '额度只在写作和口语批改时用。发小红书笔记、邀请好友都能领。',
      link: { label: '怎么领额度', href: '/#quota' },
    },
  ],
}

const reading: ColumnConfig = {
  slug: 'reading',
  title: '阅读',
  cost: free,
  note: '学术类长文，不登录也能做',
  tabs: [
    {
      id: 'type',
      label: '按题型练',
      match: { kind: 'group' },
      filters: [
        { id: 'type', label: '题型', options: ['全部', '判断', '段落标题匹配', '信息匹配', '摘要填空', '单选'] },
        status,
      ],
    },
    {
      id: 'part',
      label: '按 Passage 练',
      match: { kind: 'group' },
      filters: [{ id: 'part', label: 'Passage', options: ['全部', 'Passage 1', 'Passage 2', 'Passage 3'] }, status],
    },
    { id: 'set', label: '整套练', match: { kind: 'set' }, filters: [status] },
  ],
  rows: [...groupRows('reading', readingGroups), ...setRows('reading')],
  sidebar: [
    { kind: 'mock', title: '整套阅读模考', meta: '3 篇文章 · 40 题 · 60 分钟 · 免费', href: '/mock' },
    {
      kind: 'accuracy',
      rows: [
        { label: '判断', percent: 61, href: weakLink('reading', '判断') },
        { label: '段落标题匹配', percent: 48, href: weakLink('reading', '段落标题匹配') },
        { label: '摘要填空', percent: 72, href: weakLink('reading', '摘要填空') },
        { label: '单选', percent: 69, href: weakLink('reading', '单选') },
      ],
    },
    {
      kind: 'note',
      title: '阅读不扣额度',
      body: '额度只在写作和口语批改时用。发小红书笔记、邀请好友都能领。',
      link: { label: '怎么领额度', href: '/#quota' },
    },
  ],
}

/** 从示例记录文字里取出 band 分：如"已批改 6.5"、"上次 听力 6.5 · 阅读 7.0"；没有分数返回 undefined */
const bandScore = (rec: string | undefined, labels: string[]): RowScore | undefined => {
  const items = labels.flatMap((label) => {
    const m = rec && new RegExp(`${label}\\s*(\\d(?:\\.\\d)?)`).exec(rec)
    return m ? [{ label, band: Number(m[1]) }] : []
  })
  return items.length ? { kind: 'band', items } : undefined
}

type W = [id: string, task: '1' | '2', category: string, title: string, rec?: string]

const writingTasks: W[] = [
  ['w1', '1', '柱状图', '三国家庭能源消耗对比', '已批改 6.5'],
  ['w2', '1', '线图', '一座海滨小镇三十年的游客人数'],
  ['w3', '1', '流程图', '再生纸的生产过程'],
  ['w4', '2', '观点', '远程办公利大于弊吗', '已写 · 未批改'],
  ['w5', '2', '讨论', '政府是否应该资助艺术'],
  ['w6', '2', '原因解决', '城市年轻人为什么越来越晚买房'],
]

const writing: ColumnConfig = {
  slug: 'writing',
  title: '写作',
  cost: quota1,
  costLabel: '批改',
  note: '看题、限时写都免费，提交 AI 批改时扣额度',
  tabs: [
    {
      id: 't1',
      label: 'Task 1',
      match: { task: '1' },
      filters: [
        { id: 'category', label: '图表', options: ['全部', '柱状图', '线图', '饼图', '表格', '流程图', '地图'] },
        status,
      ],
    },
    {
      id: 't2',
      label: 'Task 2',
      match: { task: '2' },
      filters: [
        { id: 'category', label: '题型', options: ['全部', '观点', '讨论', '利弊', '原因解决', '双问题'] },
        status,
      ],
    },
  ],
  rows: writingTasks.map(([id, task, category, title, rec]) => ({
    id,
    lead: `T${task}`,
    leadSub: task === '1' ? '150 词' : '250 词',
    title,
    meta: [category],
    minutes: task === '1' ? 20 : 40,
    facets: { task, category },
    record: rec,
    score: bandScore(rec, ['已批改']),
    actions: [
      { label: '开始写', doneLabel: '再写一遍', href: `/writing?start=${id}`, cost: free },
      { label: 'AI 批改', href: `/writing?review=${id}`, cost: quota1 },
    ],
  })),
  sidebar: [
    { kind: 'quota' },
    {
      kind: 'note',
      title: '先写，再决定要不要批改',
      body: '写作本身不扣额度。写完可以先自己对照范文，觉得需要再交给 AI 批改。',
    },
  ],
}

type S = [id: string, part: '1' | '2' | '3', topic: string, title: string, sub: string, n?: number]

const speakingQs: S[] = [
  ['k1', '1', '日常', '家乡', '5 题', 5],
  ['k2', '1', '学习工作', '你的专业', '4 题', 4],
  ['k3', '2', '人物', '一次改变你看法的谈话', '题卡'],
  ['k4', '2', '地点', '一个你想再去一次的安静地方', '题卡'],
  ['k5', '3', '科技', '科技与人际交流', '4 题', 4],
  ['k6', '3', '教育', '线上课程会取代课堂吗', '4 题', 4],
]

const speaking: ColumnConfig = {
  slug: 'speaking',
  title: '口语',
  cost: quota1,
  costLabel: '批改',
  note: '题目和思路免费看，口语批改按次扣额度',
  tabs: (['1', '2', '3'] as const).map((p) => ({
    id: `p${p}`,
    label: `Part ${p}`,
    match: { part: p },
    filters: [
      { id: 'topic', label: '话题', options: ['全部', '日常', '学习工作', '人物', '地点', '科技', '教育'] },
      status,
    ],
  })),
  rows: speakingQs.map(([id, part, topic, title, sub, n], i) => ({
    id,
    lead: `P${part}`,
    leadSub: sub,
    title,
    meta: part === '2' ? [topic, '附 3 道 Part 3 追问'] : [topic],
    count: n,
    facets: { part, topic },
    record: i === 0 ? '已练 · 未模考' : undefined,
    actions: [
      { label: '看题', doneLabel: '再看一遍', href: `/speaking?start=${id}`, cost: free },
      { label: '口语批改', href: `/speaking?mock=${id}`, cost: quota1 },
    ],
  })),
  sidebar: [
    { kind: 'quota' },
    {
      kind: 'note',
      title: '口语批改需要录音',
      body: '找个安静的地方。看题准备思路不扣额度，开始口语批改才扣。',
    },
  ],
}

const mockSets: [id: string, no: string, full: boolean, rec?: string][] = [
  ['m12', '12', false, '上次 听力 6.5 · 阅读 7.0'],
  ['m11', '11', true],
  ['m10', '10', false],
  ['m9', '9', true],
]

const mock: ColumnConfig = {
  slug: 'mock',
  title: '模考',
  cost: free,
  note: '界面按电脑考试 1:1 还原，请用电脑打开',
  tabs: [
    {
      id: 'all',
      label: '全部套题',
      match: { kind: 'set' },
      filters: [{ id: 'scope', label: '科目', options: ['全部', '听力阅读', '四科'] }, status],
    },
  ],
  rows: mockSets.map(([id, no, full, rec]) => ({
    id,
    lead: no,
    leadSub: '套',
    title: full ? '听力 + 阅读 + 写作 + 口语' : '听力 + 阅读',
    meta: full ? ['听力阅读免费，写作口语批改用额度'] : ['免费'],
    count: 80,
    minutes: 90,
    facets: { kind: 'set', scope: full ? '四科' : '听力阅读' },
    record: rec,
    score: bandScore(rec, ['听力', '阅读']),
    actions: [{ label: '进入模考', doneLabel: '再考一次', href: `/mock?start=${id}`, cost: free, desktopOnly: true }],
  })),
  sidebar: [
    {
      kind: 'note',
      title: '考前准备',
      body: '听力音频只播放一次，和考场一样。',
    },
    { kind: 'quota' },
  ],
}

export const columns: Record<ColumnSlug, ColumnConfig> = { listening, reading, writing, speaking, mock }

export const home: HomeData = {
  issueLine: '',
  subjects: [
    {
      slug: 'listening',
      name: '听力',
      cost: free,
      desc: '按 Part、按题型练，做完看原文和解析。',
      items: [
        { id: 'l1', title: '社区图书馆的会员新规', meta: 'Part 2 · 表格填空', count: '10 题' },
        { id: 'l6', title: '城市屋顶农场的兴起', meta: 'Part 4 · 笔记填空', count: '10 题' },
      ],
      moreLabel: '全部听力练习',
    },
    {
      slug: 'reading',
      name: '阅读',
      cost: free,
      desc: '学术类长文，判断、匹配、填空都有。',
      items: [
        { id: 'r1', title: '珊瑚礁如何自我修复', meta: '判断题', count: '13 题' },
        { id: 'r2', title: '十九世纪的铁路与标准时间', meta: '段落标题匹配', count: '14 题' },
      ],
      moreLabel: '全部阅读练习',
    },
    {
      slug: 'writing',
      name: '写作',
      cost: quota1,
      costLabel: '批改',
      desc: '写作免费，交给 AI 批改时扣额度。',
      items: [
        { id: 'w1', title: '三国家庭能源消耗对比', meta: 'Task 1 · 柱状图' },
        { id: 'w4', title: '远程办公利大于弊吗', meta: 'Task 2 · 观点类' },
      ],
      moreLabel: '全部写作题',
    },
    {
      slug: 'speaking',
      name: '口语',
      cost: quota1,
      costLabel: '批改',
      desc: '看题免费，口语批改按次扣额度。',
      items: [
        { id: 'k1', title: '家乡', meta: 'Part 1', count: '5 题' },
        { id: 'k3', title: '一次改变你看法的谈话', meta: 'Part 2 题卡' },
      ],
      moreLabel: '全部口语题',
    },
  ],
  mock: { listening: '40 题 · 约 30 分钟', reading: '40 题 · 60 分钟', result: '交卷即出分' },
  quotaWays: [
    { title: '发一篇小红书备考笔记', desc: '审核通过后发放额度' },
    { title: '邀请好友注册', desc: '好友用你的链接注册后发放额度' },
    { title: '直接购买', desc: '即将开放', disabled: true },
  ],
}
