# 题库导入格式说明

给站长和 AI 出题提示词用。一个导入包就是**一个文件夹**：根目录放 `import.json`，其余是它引用的音频和图片。
后台「套题 / 练习单元 / 写作题 / 口语题」列表页顶部点「导入文件夹」，选中整个文件夹即可。
大包（尤其带听力音频）在服务器上用命令导入，不经浏览器：在 `site/` 目录运行 `pnpm import:dir <导入包文件夹>`，输出与后台相同的结果。

导入规则：

- 先检查整个包，**任何一处有错就整包拒绝**，一次列出全部错误，不保存任何数据。
- 导入成功的内容默认是**草稿**，检查无误后在后台手动发布；顶层写 `"publish": true` 时，校验全过就直接发布（批量导入用）。
- 练习单元、写作题带 `sourceId` 时，库里已有同一 `sourceId` 就**更新**那一条（id 不变，本机做题记录仍对得上），否则新建。
- 套题编号 `code` 不能和已有套题重复。
- 文件路径都是相对 `import.json` 所在文件夹的路径，用 `/` 分隔，如 `audio/part1.mp3`。
- 音频只能是 mp3 / m4a，图片可以是 png / jpg / gif / webp / svg，单个文件不超过 50MB。
- 每条内容都要写 `sourceType`：`original`（原创）、`ai_rewrite`（AI 重写）、`repost`（转载）、`ai_generated`（AI 生成）；转载必须写 `sourceSets`（来源题集），供后台按题集筛选、整批下架。
- 前台文案不得出现考试主办方的英文商标。

完整可导入的示例见 `docs/import-example/`（套题）、`docs/writing-example/`、`docs/speaking-example/`。

## 顶层结构

```json
{ "kind": "test", "data": { } }
```

| kind | data |
|---|---|
| `test` | 一个套题对象 |
| `unit` | 练习单元数组（一篇阅读 / 一个听力 Part，不必凑整套） |
| `writing` | 写作题数组 |
| `speaking` | 口语题数组 |

## 套题（kind = test）

| 字段 | 必填 | 说明 |
|---|---|---|
| `code` | 是 | 编号，如 `T-012`，全站唯一 |
| `title` | 是 | 名称 |
| `sourceType` | 是 | `original`（原创）或 `ai_rewrite`（AI 重写） |
| `listening.parts` | 否 | 听力，有就必须恰好 4 个 Part，共 40 题 |
| `reading.passages` | 否 | 阅读，有就必须恰好 3 篇，共 40 题 |

听力和阅读可以只有一个；有的那个必须完整，题号 1–40 连续、不重复、每题都有答案。

### 听力 Part

```json
{ "audio": "audio/part1.mp3", "transcript": "原文……", "groups": [ 题组, … ] }
```

`audio`、`transcript` 必填。

### 阅读文章

```json
{
  "title": "How coral reefs repair themselves",
  "paragraphs": [ { "label": "A", "text": "……" }, { "label": "B", "text": "……" } ],
  "image": "img/figure.png",
  "groups": [ 题组, … ]
}
```

`title` 和至少一段正文必填；段落匹配、信息匹配题要给段落填 `label`（A、B、C…）。`image` 可选。

### 题组

```json
{
  "type": "completion",
  "instructions": "Complete the notes below. Write ONE WORD ONLY for each answer.",
  "content": "Main crop: {{32}}\nRoofs must support extra {{33}}",
  "image": "img/map.png",
  "maxWords": 1,
  "numberAllowed": false,
  "options": [ { "key": "A", "text": "……" } ],
  "questions": [ 题目, … ]
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `type` | 是 | 题型，见下表 |
| `instructions` | 是 | 题目说明原文 |
| `content` | 否 | 填空类的表格 / 笔记 / 摘要正文；空位写成 `{{题号}}` |
| `image` | 否 | 地图、平面图、流程图 |
| `maxWords` | 否 | 字数上限（填空、简答、标注） |
| `numberAllowed` | 否 | 题目说明含 "AND/OR A NUMBER" 时填 `true`，数字不计入字数 |
| `options` | 视题型 | 题组共用的选项表 |

### 题目

```json
{ "number": 14, "span": 1, "prompt": "题干", "options": [], "answers": "答案", "explanation": "解析" }
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `number` | 是 | 题号 1–40 |
| `span` | 否 | 默认 1；多选"选 N 项"填 N，占用 `number` 到 `number+N-1` |
| `prompt` | 否 | 题干；填空题的空位写在题组 `content` 里，可以不填 |
| `options` | 仅单选 | 本题自己的选项 |
| `answers` | 是 | 一行一个可接受答案（JSON 里用 `\n` 换行） |
| `explanation` | 否 | 解析 |

### 题型

| type | 名称 | 选项写在 | answers 写法 |
|---|---|---|---|
| `single_choice` | 单选 | 题目的 `options` | 一个字母，如 `B` |
| `multi_choice` | 多选（选 N 项） | 题组的 `options` | N 行字母，如 `A\nE`，`span` 填 N |
| `tfng` | TRUE / FALSE / NOT GIVEN | 固定，不用填 | `TRUE`、`FALSE` 或 `NOT GIVEN` |
| `ynng` | YES / NO / NOT GIVEN | 固定，不用填 | `YES`、`NO` 或 `NOT GIVEN` |
| `matching_headings` | 段落标题匹配 | 题组的 `options`（key 如 `i`、`iv`） | 一个 key |
| `matching_information` | 信息匹配 | 文章段落的 `label` | 一个段落字母 |
| `matching_features` | 特征匹配 | 题组的 `options` | 一个 key |
| `matching_endings` | 句子结尾匹配 | 题组的 `options` | 一个 key |
| `completion` | 填空 | 一般没有；带词库的摘要填空写题组 `options` | 可接受答案若干行 |
| `short_answer` | 简答 | 没有 | 可接受答案若干行 |
| `labelling` | 图表 / 地图标注 | 选字母时写题组 `options`，否则没有 | 字母，或可接受答案若干行 |

选择、判断、匹配类的答案必须出现在对应的选项里，否则导入会报错。

### 可接受答案的写法（判分规则）

- 大小写、首尾空格不影响判分。
- 一行一个可接受答案，答对任意一个即算对：`15 March\nMarch 15`。
- 可选词放括号：`(the) river bank` 表示 `river bank` 和 `the river bank` 都对。
- 数字和英文写法自动互通：答案写 `15`，作答 `fifteen` 也对。
- 超过 `maxWords` 的作答直接判错；带连字符的词算一个词。
- 拼写必须正确；英美拼写差异要分两行写：`colour\ncolor`。
- 可接受答案本身也不能超过 `maxWords`（多半是录错了，导入会报错）。
- `numberAllowed` 为 `true` 时，含数字的部分不计字数：`22nd January`、`£8.50`、`4.30pm`、邮编 `HE25 4EU` 都按"一个词加数字"以内算。

## 练习单元（kind = unit）

`data` 是数组，每项一篇阅读或一个听力 Part。题组、题目、题型和套题完全相同，另有以下字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `module` | 是 | `reading` 或 `listening` |
| `part` | 是 | 阅读 Passage 1–3，听力 Part 1–4 |
| `title` | 是 | 标题 |
| `sourceType` / `sourceSets` | 是 / 转载必填 | 见上文；`sourceSets` 写完整题集名，多个用逗号分隔，只在后台显示 |
| `sourceId` | 是 | 原始数据编号，再次导入按它更新 |
| `sourceTag` | 否 | 前台中性标签：`9月高频` `9月中频` `10月高频` `10月中频` `全年高频` `增补` |
| `passage` | 阅读必填 | `[{ "label": "A", "sentences": [{ "n": 0, "text": "…" }] }]`，`n` 全文从 0 连续 |
| `audio` | 听力必填 | 音频路径 |
| `transcript` | 听力必填 | `[{ "n": 0, "speaker": "Speaker 1", "start": 3.4, "end": 4.6, "text": "…", "announce": true }]`；`announce` 标播报语（显示为弱文字色），`start` / `end` 秒，可缺 |

题目额外可写：

| 字段 | 说明 |
|---|---|
| `tip` | 易错点，交卷后显示在解析下方 |
| `quote` | 引用原句 |
| `evidence` | 出处句号 `7` 或 `10-16`，对应 `passage` / `transcript` 的 `n`；有它时"在原文中定位"高亮这些句子 |
| `answerStatus` | `auto`（自动通过）或 `confirmed`（人工确认）；不能是 `pending`，待确认的题不得导入 |

题号在单元内连续、不重复即可，不要求从 1 开始（Part 2 就是 11–20）。示例：`tests/fixtures/unit-pack/`。

第三方题库由离线转换脚本 `pnpm convert <writing|reading|listening>` 生成导入包与复核表，用法见 `scripts/convert/index.ts` 文件头。

## 写作题（kind = writing）

`data` 是数组，每项一道题：

| 字段 | 必填 | 说明 |
|---|---|---|
| `taskType` | 是 | `task1` 或 `task2` |
| `title` | 是 | 列表里显示的标题，如"三国家庭能源消耗对比" |
| `prompt` | 是 | 题目原文 |
| `image` | task1 必填 | 图表图片路径 |
| `minWords` | 否 | 不填时 task1 = 150、task2 = 250 |
| `suggestedMinutes` | 否 | 不填时 task1 = 20、task2 = 40 |
| `sampleAnswer` | 否 | 范文 |
| `sourceType` | 是 | 见上文 |
| `category` | 否 | Task 1：`data` `map` `process` `diagram`；Task 2：`opinion` `discussion` `report` `mixed` `comparison` `advantage` |
| `titleZh` | 否 | 中文标题 |
| `sourceId` / `sourceSets` | 否 / 转载必填 | 同练习单元 |

## 口语题（kind = speaking）

`data` 是数组，每项一道题：

| 字段 | 必填 | 说明 |
|---|---|---|
| `part` | 是 | `"1"`、`"2"` 或 `"3"`（字符串） |
| `topic` | 是 | 话题，如 `Hometown` |
| `questions` | Part 1 / 3 必填 | `[{ "text": "Where is your hometown?" }]`，至少 1 条 |
| `cueCard` | Part 2 必填 | 题卡主题句 "Describe a …" |
| `cuePoints` | 否 | Part 2 的要点：`[{ "text": "who it was" }]` |
| `followUps` | 否 | Part 2 关联的 Part 3 追问，写同一批数组里 Part 3 题目的下标：`[{ "ref": 3 }]` |
| `season` | 否 | 题季，如 `2026年9-12月` |
| `sampleAnswer` | 否 | 参考回答 |
| `sourceType` | 是 | `original` 或 `ai_rewrite` |

套题里的写作 / 口语引用不在导入里写：先导入写作题、口语题，再在后台套题的「写作」「口语」标签页里选择。

## 整批下架某个来源题集

1. 后台进入「练习单元」（或「写作题」）列表。
2. 点「筛选」，选字段「来源题集」→「包含」→ 输入题集名（如 `Z家阅读9月高频`）。
3. 勾选表头的全选框（跨页时点「选择全部 N 条」）。
4. 点「取消发布」：这批内容立即从前台消失，数据保留，可随时重新发布；要彻底删除则点「删除」。
