// 筛选用的题型短名（栏目页、错题本共用；不依赖服务端，客户端组件也能引用）
import type { QuestionType } from './scoring'

export const listeningType: Record<QuestionType, string> = {
  completion: '填空',
  short_answer: '填空',
  single_choice: '单选',
  multi_choice: '多选',
  labelling: '地图题',
  matching_features: '配对',
  matching_endings: '配对',
  matching_headings: '配对',
  matching_information: '配对',
  tfng: '判断',
  ynng: '判断',
}
export const readingType: Record<QuestionType, string> = {
  tfng: '判断',
  ynng: '判断',
  matching_headings: '段落标题匹配',
  matching_information: '信息匹配',
  matching_features: '特征匹配',
  matching_endings: '句子结尾匹配',
  completion: '填空',
  short_answer: '简答',
  labelling: '图表标注',
  single_choice: '单选',
  multi_choice: '多选',
}
