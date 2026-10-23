# 内容接口（站长用）

让站长的另一个 AI 把每天取材、改写好的**阅读**（文章 + 题目 + 答案 + 中文解析）直接上传到本站。本站只收、校验、入库；取材、改写、出题都在那个 AI 那边。

字段和题型的写法**不在这里重复**：以接口 `GET /api/content-api/format` 返回的说明为准（源文件 `src/contentApi/format.ts`，里面的示例有自动测试保证能上传通过）。

## 1. 上线时

1. 跑迁移（`units` 加"原文链接""来自接口"两列，题集标签加"每日精选"，新增「内容接口」设置表）：
   `docker compose run --rm migrate`
2. 后台 → 设置 → **内容接口** → "生成密钥"。完整密钥**只显示这一次**，复制交给另一个 AI。
3. 同一页可以改"每日新建上限"（默认 20，0 = 暂停接收），改完点右上角"保存"。保存不会影响密钥。

## 2. 交给另一个 AI 的话

> 用 `Authorization: Bearer <密钥>` 调用 `https://<站点地址>/api/content-api`。
> 先 `GET /format` 读格式说明和完整示例，按示例组织数据，`POST /units` 上传；
> 返回 400 时按 errors 逐条修改后整包重发；上传前看返回里的 quota.remaining。
> 先用 `"publish": false` 存草稿，等我说可以了再改成 `true`。

## 3. 常用请求

```bash
K='cak_...'; B='https://<站点地址>/api/content-api'

# 格式说明 + 示例 + 今日额度
curl -H "Authorization: Bearer $K" "$B/format"

# 上传（body.json 的形状见 format 返回的 example）
curl -H "Authorization: Bearer $K" -H 'Content-Type: application/json' --data-binary @body.json "$B/units"

# 查询状态
curl -H "Authorization: Bearer $K" "$B/units?sourceId=daily-20261023-01,daily-20261023-02"
```

## 4. 复核与发布

- 后台「练习单元」列表用筛选"来自接口 = 是"找出接口上传的单元；侧栏有原文链接。
- 草稿：检查答案和解析，没问题点"发布"（或在列表里多选批量发布）。
- 已发布的单元被以草稿重传时，线上保持旧版本，新内容在版本记录里等你复核发布。
- 有问题的单元直接在后台改或下架。注意：对方再用同一个 sourceId 上传会覆盖你的修改，改完告诉它。
- 前台这些单元在阅读栏目的题集"每日精选"里，也会被随机模考抽到。
- 同义替换：发布后由每天的定时任务自动补上（`docs/deploy.md` 第 8 节）；没配定时任务就手动跑 `pnpm paraphrase`。
- 已经生成过同义替换的单元被对方用同一个 sourceId 重传改了题或原文时，旧的同义替换会留着（脚本默认跳过有数据的单元）：用 `pnpm paraphrase --redo <单元 id>` 重做。

## 5. 安全

- 密钥只能调内容接口这三个地址，碰不到后台其他功能和考生数据；数据库里只存摘要。
- 泄露了：后台点"重新生成"（旧的立即失效）或"停用"。
- 同一网络地址一小时内密钥错 20 次会被暂停一小时。
- 接口只能新建和更新自己传上来的单元；sourceId 撞上题库里原有的单元会被拒绝，原单元不受影响。
