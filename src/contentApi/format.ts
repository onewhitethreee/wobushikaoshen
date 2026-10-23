// 029 内容接口的格式说明与完整示例（research R8）：唯一来源。GET /api/content-api/format 原样返回；
// tests/int/contentApi.int.spec.ts 保证 EXAMPLE 换个 sourceId 就能通过全部检查。改格式时两处一起改

export const EXAMPLE = {
  publish: false,
  data: [
    {
      module: 'reading',
      part: 1,
      title: 'The Secret Life of Urban Foxes',
      sourceType: 'ai_rewrite',
      sourceId: 'example-0001',
      sourceUrl: 'https://example.com/articles/urban-foxes',
      sourceSets: 'Example Science Weekly',
      passage: [
        {
          label: 'A',
          sentences: [
            { n: 0, text: 'Red foxes first moved into British towns in the 1930s, when new suburbs spread across former farmland.' },
            { n: 1, text: 'They were drawn by the food left in gardens and by the shelter offered under sheds and decking.' },
            { n: 2, text: 'Today an estimated 150,000 foxes live in urban areas, roughly one in six of the national population.' },
          ],
        },
        {
          label: 'B',
          sentences: [
            { n: 3, text: 'City foxes are not simply rural animals that have lost their way.' },
            { n: 4, text: 'Tracking studies show that they keep smaller territories than their country cousins, often no larger than a few streets.' },
            { n: 5, text: 'Their diet is also more varied, mixing scavenged scraps with insects, birds and fruit.' },
          ],
        },
        {
          label: 'C',
          sentences: [
            { n: 6, text: 'Residents tend to regard the animals with a mixture of affection and suspicion.' },
            { n: 7, text: 'Many enjoy seeing cubs play on summer evenings, yet complaints about noise and damaged bins are common.' },
            { n: 8, text: 'Researchers argue that removing foxes rarely works, because new animals quickly move into empty territories.' },
            { n: 9, text: 'Instead, they recommend securing rubbish and blocking access to spaces under buildings.' },
          ],
        },
      ],
      groups: [
        {
          type: 'tfng',
          instructions:
            'Do the following statements agree with the information given in Reading Passage 1?\nWrite TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, NOT GIVEN if there is no information on this.',
          questions: [
            {
              number: 1,
              prompt: 'Foxes began living in British towns before the 1940s.',
              answers: 'TRUE',
              explanation: 'A 段第一句：狐狸在 1930 年代进入城镇，早于 1940 年代。',
              quote: 'Red foxes first moved into British towns in the 1930s',
              evidence: '0',
              answerStatus: 'auto',
            },
            {
              number: 2,
              prompt: 'Urban foxes usually cover larger territories than rural foxes.',
              answers: 'FALSE',
              explanation: 'B 段说城市狐狸的领地比乡下的小（smaller territories），与题干相反。',
              tip: '注意比较方向：smaller 对 larger。',
              quote: 'they keep smaller territories than their country cousins',
              evidence: '4',
              answerStatus: 'auto',
            },
            {
              number: 3,
              prompt: 'Most urban foxes are born in the countryside.',
              answers: 'NOT GIVEN',
              explanation: '原文只说城市狐狸不是迷路的乡下动物，没有提出生地。',
              evidence: '3',
              answerStatus: 'auto',
            },
          ],
        },
        {
          type: 'completion',
          instructions: 'Complete the notes below.\nChoose NO MORE THAN TWO WORDS from the passage for each answer.',
          maxWords: 2,
          content: 'Urban foxes\n- attracted by food in {{4}}\n- diet includes scraps, insects, birds and {{5}}',
          questions: [
            {
              number: 4,
              answers: '(the) gardens',
              explanation: 'A 段第二句：food left in gardens。',
              evidence: '1',
              answerStatus: 'auto',
            },
            {
              number: 5,
              answers: 'fruit',
              explanation: 'B 段最后一句列出的食物：scraps, insects, birds and fruit。',
              evidence: '5',
              answerStatus: 'auto',
            },
          ],
        },
        {
          type: 'single_choice',
          instructions: 'Choose the correct letter, A, B, C or D.',
          questions: [
            {
              number: 6,
              prompt: 'What do researchers recommend?',
              options: [
                { key: 'A', text: 'removing foxes from residential areas' },
                { key: 'B', text: 'feeding foxes away from houses' },
                { key: 'C', text: 'making food and shelter harder to reach' },
                { key: 'D', text: 'moving foxes back to the countryside' },
              ],
              answers: 'C',
              explanation: 'C 段最后一句：securing rubbish and blocking access to spaces under buildings，即让食物和藏身处更难获得。',
              tip: 'A 是原文明确说没用的做法。',
              quote: 'they recommend securing rubbish and blocking access to spaces under buildings',
              evidence: '8-9',
              answerStatus: 'auto',
            },
          ],
        },
      ],
    },
  ],
}

export const FORMAT = `# 内容接口格式说明（阅读）

给本站上传雅思学术类阅读（一篇文章 + 题目 + 答案 + 中文解析）。本说明和接口返回的 example 是唯一依据。

## 调用

- 基础地址：\`{站点地址}/api/content-api\`，每个请求带请求头 \`Authorization: Bearer <密钥>\`，正文用 JSON（UTF-8）。
- \`GET /format\`：本说明 + 完整示例 + 今日额度。
- \`POST /units\`：上传 1–10 篇。
- \`GET /units?sourceId=a,b\`：查询状态（一次最多 50 个）。

## 上传请求

\`\`\`
{ "publish": false, "data": [ 单元, … ], "files": [ { "name": "fox-map.png", "data": "<base64>" } ] }
\`\`\`

- \`publish\`：false（默认）存草稿，站长后台复核后发布；true 校验全过直接发布。
- \`data\`：1–10 个单元。任何一项有错，整包拒绝，什么都不保存；按返回的错误逐条改好再整包重发。
- \`files\`：可选，配图。见"配图"。
- 整个请求不超过 20 MB。

## 单元字段

| 字段 | 必填 | 说明 |
|---|---|---|
| module | 是 | 固定 "reading" |
| part | 是 | Passage 编号 1–3（难度 / 长度对应真题第几篇） |
| title | 是 | 文章英文标题 |
| sourceType | 是 | "ai_rewrite"（改写自原文）或 "ai_generated"（AI 原创，参考了原文） |
| sourceId | 是 | 你自己定的唯一编号，如 "daily-20261023-01"。再次上传同一个 sourceId = 更新这篇 |
| sourceUrl | 是 | 取材原文网址，http:// 或 https:// 开头 |
| sourceSets | 否 | 取材出处名（如媒体名），只在后台显示；不填为"内容接口" |
| passage | 是 | 正文，见下 |
| groups | 是 | 题组，见下 |

服务端会忽略或改写：summary、pendingCount、paraphrases、paraphraseChecked、viaApi、_status、id、createdAt、updatedAt；前台题集标签固定为"每日精选"。
注意：站长在后台改过的单元，你再用同一个 sourceId 上传会被你的内容覆盖。

## 正文 passage

\`\`\`
[ { "label": "A", "sentences": [ { "n": 0, "text": "…" }, { "n": 1, "text": "…" } ] }, { "label": "B", … } ]
\`\`\`

- 每段一个对象，label 是段落字母（A、B、C…，信息匹配题的答案就是它）。
- 每句一个对象，n 是全文唯一的句号，从 0 起递增，跨段接着编。题目的出处（evidence）指向它。
- text 只放这一句，不要带段落字母。

## 题组 groups

\`\`\`
{ "type": "tfng", "instructions": "…", "content": null, "image": null, "maxWords": null, "numberAllowed": false, "options": [], "questions": [ … ] }
\`\`\`

- type：题型，见下表。
- instructions：题目说明（英文，原样显示），可用 \\n 换行。
- content：填空 / 摘要 / 表格类题组的正文，空位写 {{题号}}，如 "food in {{4}}"。
- image：配图文件名（对应 files 里的 name），没有就 null。
- maxWords：字数上限（NO MORE THAN TWO WORDS → 2）；numberAllowed：说明里有 AND/OR A NUMBER 时为 true。
- options：题组共用的选项表 [{ "key": "A", "text": "…" }]，匹配类、多选、带词库的填空用。

## 题目 questions

| 字段 | 必填 | 说明 |
|---|---|---|
| number | 是 | 题号。本篇内从 1（或接着上一篇）起连续，不能重复、不能缺号 |
| span | 否 | 占几个题号，默认 1；多选题"选两项"写 2，题号占 number 和 number+1 |
| prompt | 视题型 | 题干；填空题空位已在 content 里时可不填 |
| options | 视题型 | 只有 single_choice 用：本题自己的选项 [{ key, text }] |
| answers | 是 | 标准答案，一行一个可接受答案（用 \\n 分隔）；括号里的词可写可不写，如 "(the) gardens" |
| explanation | 是 | 中文解析：答案依据、原文对应说法 |
| tip | 否 | 易错点 / 干扰项提示（中文） |
| quote | 否 | 引用的原文句子 |
| evidence | 是 | 出处句号："7" 或范围 "10-16"，必须是正文里存在的 n |
| answerStatus | 是 | 写 "auto"。不允许 "pending"（没把握的题不要上传） |

## 题型与答案写法

| type | 题型 | answers |
|---|---|---|
| tfng | 判断（TRUE / FALSE / NOT GIVEN） | 三者之一 |
| ynng | 判断（YES / NO / NOT GIVEN） | 三者之一 |
| single_choice | 单选 | 本题 options 里的 key，如 "C" |
| multi_choice | 多选 | 题组 options 的 key，选几项写几行，行数 = span |
| matching_headings | 段落标题匹配 | 题组 options（标题表，key 用 i、ii、iii…）的 key |
| matching_information | 信息匹配（哪段包含） | 段落 label，如 "B" |
| matching_features | 特征匹配 | 题组 options 的 key |
| matching_endings | 句子结尾匹配 | 题组 options 的 key |
| completion | 填空（句子 / 摘要 / 笔记 / 表格） | 原文单词，不超过 maxWords 个词；有词库时写 options 的 key |
| short_answer | 简答 | 原文单词，不超过 maxWords 个词 |
| labelling | 图表标注 | 原文单词或 options 的 key；配图放 image |

## 配图

- files 里每张图 { "name": "fox-map.png", "data": "<base64>" }，data 可以带 "data:image/png;base64," 前缀。
- 只收 png / jpg / jpeg / webp，单张不超过 2 MB，文件内容必须和扩展名一致；文件名只用字母、数字、_ . -。
- 题组 image 写同一个 name。没被任何题组引用的图不会保存。

## 每日上限

- 每天（北京时间 0 点重置）最多新建若干篇，数量由站长设置；更新已有的不计。
- 每个接口都返回 quota：{ limit, used, remaining, resetAt }，上传前先看 remaining。

## 返回与错误

成功（201）：{ "ok": true, "created": [ { "sourceId", "id", "status": "draft" | "published", "hasDraft", "updated", "adminUrl" } ], "quota": { … } }
已发布的篇目用 publish: false 重传时，线上保持原样，新内容成为待复核草稿（status 仍是 published，hasDraft 为 true）。

失败：{ "ok": false, "errors": [ "第 2 项（daily-20261023-02）：第 5 题：出处句号「12」不在原文里（原文句号 0–9）" ] }

| 状态码 | 情况 |
|---|---|
| 400 | JSON 不合法、字段缺失或不合规、题目校验没过、sourceId 已被题库其他内容占用（换一个） |
| 401 | 没带密钥、密钥错误或已停用 |
| 413 | 请求超过 20 MB（少放图或分批） |
| 429 | 超过每日上限（看 quota.resetAt）；或密钥错误次数太多（看 retryIn 秒） |
| 500 | 服务器写入失败，什么都没保存，可以原样重试 |
`
