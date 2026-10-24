// 笔记换额度的平台（032 research R2）：纯函数，前后端共用；读设置的 getPlatform 在 credits.ts
export type NoteMode = 'xhs' | 'other' | 'off'

/** 当前平台名；关闭（或其他平台没填名称）时为 null */
export const platformName = (s: { noteMode?: NoteMode | null; notePlatform?: string | null }): string | null => {
  if (s.noteMode === 'off') return null
  if (s.noteMode === 'other') return s.notePlatform?.trim() || null
  return '小红书'
}

/** 文案里的"小红书"换成当前平台名 */
export const noteText = (text: string, name: string) => text.replaceAll('小红书', name)
