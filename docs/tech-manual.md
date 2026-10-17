# 技术手册

给接手开发和运维的人看。部署细节见 [deploy.md](deploy.md)，题库导入格式见 [import-format.md](import-format.md)，考生侧功能见 [user-manual.md](user-manual.md)。

## 1. 总览

- **技术栈**：Payload CMS 3 + Next.js 16 单体应用，数据库是 Postgres 17，包管理用 pnpm。
  前台和后台（`/admin`）在同一个进程里。
- **部署形态**：一台服务器跑 `db` 和 `app` 两个容器，外层 nginx 负责 HTTPS。媒体存服务器磁盘（可选 S3 兼容存储）。
- **外部服务**：只有三个。
  - SMTP 发信：登录验证码。
  - AI 接口（DeepSeek，OpenAI 兼容）：题库转换，以后的写作批改。
  - 可选的对象存储。
- **项目约束**（改动前必须知道）：
  - 不产生 AI 成本的功能永久免费；调用 AI 的功能先扣额度再调用。
  - 额度只记只追加的流水，不存余额字段。
  - 单体应用，不拆服务，不加队列和缓存集群。
  - 用户生成的内容默认不公开，审核后才可见。
  - 全站不用紫色。
- 许可证：AGPL-3.0。

## 2. 本机开发

需要 Node（与 `Dockerfile` 中的版本一致）、pnpm、Docker。

```bash
# 数据库与收信工具（首次创建；之后 docker start ielts-pg ielts-mail）
docker run -d --name ielts-pg -e POSTGRES_USER=ielts -e POSTGRES_PASSWORD=<密码> -e POSTGRES_DB=ielts -p 5432:5432 postgres:17
docker run -d --name ielts-mail -e MP_SMTP_DISABLE_RDNS=true -p 1025:1025 -p 8025:8025 axllent/mailpit

cd site
cp .env.example .env      # DATABASE_URL 指向 ielts-pg；三个 SECRET 填 32 位以上随机串
pnpm install              # 安装依赖（不要用 pnpm ii：它忽略 pnpm-workspace.yaml 里的安全 overrides）
pnpm dev                  # http://localhost:3000，后台 /admin
```

- 第一次打开 `/admin` 时创建管理员。
- 进后台「邮件设置」，主用 SMTP 填 Mailpit：`127.0.0.1:1025`，不加密，不用账号。
  验证码邮件在 http://127.0.0.1:8025 查看。
- **本地不要跑 `pnpm payload migrate`**。`pnpm dev` 会自动把表结构推到本机库（push 模式），这时再跑迁移会报错。
  迁移文件只给生产用。
- 改了 collection 或 global 的字段之后：
  - `pnpm generate:types`：更新 `src/payload-types.ts`。
  - 新增了后台自定义组件时，再跑 `pnpm generate:importmap`。
  - 需要上生产的表结构变化：`pnpm payload migrate:create <名字>`，生成 `src/migrations/` 下的迁移，连同 `.json` 快照一起提交。

## 3. 代码结构（`src/`）

| 目录 | 内容 |
|---|---|
| `app/(frontend)/` | 前台页面：`listening` `reading` `writing` `speaking` `mock` 栏目页，`practice/[unit]` 练习页，`writing/[id]` 写作页（含 AI 批改），`login`，`me/mistakes`，`me/favorites`，`me/reviews`（写作批改记录） |
| `app/(payload)/` | Payload 后台与 REST API（GraphQL 已关闭） |
| `collections/` | 数据模型，见下表 |
| `globals/` | 全站唯一设置：`AiSettings`（AI 设置）、`MailSettings`（邮件设置）、`BandScales`（分数换算表） |
| `endpoints/` | 自定义接口：`auth`（验证码登录）、`memberData`（同步）、`import`（后台导入文件夹）、`mailTest`、`lookup`、`writingReviews`（写作批改）、`explanations`（错题讲解） |
| `account/` | 验证码签发与限频（`codes.ts`）、发信（`mail.ts`，主用失败切备用）、同步合并（`sync.ts`）、错题计算（`mistakes.ts`） |
| `ai/` | `chat.ts`：读「AI 设置」、发一次 OpenAI 兼容的 chat 请求（超时、max_tokens、用量）。批改、讲解、`chart:data` 共用 |
| `review/` | `writing.ts`（批改提示词、输出校验、总分、后台执行、超时扫描）、`explain.ts` / `explainKey.ts`（错题讲解：服务端判错、缓存键、出处句）、`charge.ts`（扣费 + 单用户每分钟 5 次限频，进程内计数） |
| `practice/` | 浏览器端作答存储（`store.ts`，本机 localStorage）与同步客户端（`syncClient.ts`） |
| `exam/` | 判分、题型名称、导入校验、分数换算默认值 |
| `import/` | 导入包解析与入库 |
| `content/columns.ts` | 栏目页的数据组装（练法、筛选、按钮与是否消耗额度） |
| `components/` | `Practice/`（练习页）、`Writing/`、`Account/`（登录、错题本、收藏）、`Journal/`（栏目页） |
| `access/` | 访问规则。`authenticated` 只认管理员（`users`），考生（`members`）不算 |
| `migrations/` | 生产迁移 |

### 数据模型

| collection | 说明 |
|---|---|
| `tests` | 套题：听力 4 Part / 阅读 3 篇，以及写作、口语部分 |
| `units` | 练习单元：一篇阅读或一个听力 Part，可以不属于整套题。`summary` 在保存时自动算，栏目页只读这个字段 |
| `writing-tasks` / `speaking-questions` | 写作题 / 口语题。Task 1 带 `chartData`（图表文字数据，批改用）、`chartChecked`、`chartSource` |
| `writing-reviews` | 写作批改记录：pending → done / failed，失败自动退回额度。考生只能经 `/api/me/writing-reviews` 读自己的 |
| `answer-explanations` | 错题讲解缓存：题组 + 题号 + 单元版本 + 规范化错误答案，考生共用 |
| `explanation-unlocks` | 讲解查看权：付过费的考生再看不扣 |
| `members` | 考生账号，只能用邮箱验证码登录。密码操作一律拒绝 |
| `member-data` | 考生的交卷记录、进度、草稿、收藏、错题（同步用） |
| `login-codes` / `email-sends` | 验证码记录、发信记录（限频与排错用） |
| `users` | 后台管理员（与考生完全分开） |
| `media` / `posts` / `pages` / `categories` | 媒体、备考文章，以及 Payload 模板自带的页面和分类 |

每条题目内容都带来源字段：`sourceType`，转载还要填 `sourceSets`。收到投诉时，可以按题集筛选后整批下架。

## 4. 题库：转换与导入

1. **转换**：把原始题目 JSON 转换成导入包。

   ```bash
   pnpm convert <writing|reading|listening> --src <原始题目目录> --out <导入包目录> [--batch N] [--no-ai]
   ```

   - AI 配置读本机库里的「AI 设置」。没填 key 或加了 `--no-ai` 时只跑规则，需要人工确认的题会变多。
   - 每次转换输出一份报告（`报告.md`），列出出错、去重丢弃和待确认的题。

2. **导入**：小包用后台列表页的「导入文件夹」。大包（带音频的）在服务器上用 `pnpm import:dir <导入包目录>`。
   - 只要有一处错误，整包都不导入。
   - 带 `sourceId` 的条目按 `sourceId` 更新，id 不变，考生的做题记录仍然对得上。
   - 格式见 [import-format.md](import-format.md)。

3. 导入后默认是草稿，在后台检查后发布（导入包写 `"publish": true` 时直接发布）。

4. 一次性脚本：`pnpm backfill:summary`，给老数据补算单元的 `summary`。

5. **Task 1 图表转文字**（写作批改要用）：`pnpm chart:data [--redo 4,12] [--only-failed] [--limit N]`。用「AI 设置」里的看图模型把已发布 Task 1 的图转成文字写进 `chartData`；默认只处理还没有的，失败的题号写进 `chart-data.failed.txt`。新导入 Task 1 后要再跑一次，然后在后台抽查、勾"图表数据已核对"。

## 5. 测试

```bash
pnpm test:int                                                   # vitest：判分、导入校验、同步合并、限频、访问规则等
docker start ielts-mail                                         # e2e 登录测试从 Mailpit 取验证码
pnpm test:e2e $(git ls-files tests/e2e) --workers=1             # playwright；会自动起 pnpm dev 或复用已开的
```

- **必须 `--workers=1`**：几个 e2e 文件共用同一份套题数据（EX-001），并发跑会互相删数据。
- `tests/e2e/*.tmp.spec.ts` 是本机的截图脚本，不提交。上面的命令用 `git ls-files` 把它们排除在外。
- 测试会往**当前数据库**写临时数据（`sourceId` 以 `e2e-`、`fixture-` 开头），测完删除。**绝不能连生产库跑测试。**
- 涉及额度流水、审核状态、权限的逻辑，至少要有一个可运行的检查。
- 发布前跑 `pnpm check:secrets`：检查构建产物里有没有泄露服务端密钥。

## 6. 部署与更新

完整步骤见 [deploy.md](deploy.md)。要点：

- 首次部署：`up -d db` → `run --rm migrate` → 导入数据和媒体 → `build app` → `up -d app`。
  构建时要连库，所以先建库再构建。
- 必须走 HTTPS。`NEXT_PUBLIC_SERVER_URL` 必须是实际访问地址（它也是 CSRF 白名单），这个值构建时写进镜像。
- nginx 必须设置 `X-Forwarded-For`，按 IP 限频靠它。
- 三个 SECRET 用 `openssl rand -hex 32` 生成。不足 32 位时 app 拒绝启动。
- 数据库每天 `pg_dump` 一份，存到另一处（额度流水上线后尤其重要）。

## 7. 后台运营（站长）

| 后台页 | 用途 |
|---|---|
| 套题 / 练习单元 / 写作题 / 口语题 | 导入、检查、发布、下架；可以按来源题集筛选 |
| 考生账号 | 查看考生；删除考生时连同学习数据一起删除（代用户注销） |
| 邮件设置 | 主用、备用两套 SMTP，各有"发送测试邮件"按钮，并显示最近一次失败的原因。密码不回显，留空保存表示不修改 |
| AI 设置 | 接口地址、模型（默认 `deepseek-chat`）、看图模型（`chart:data` 用）、API key。key 只在服务端使用 |
| 写作批改 / 错题讲解 | 批改记录只读（含失败原因和用量）；讲解可改正文、可删除（删掉后下次请求重新生成） |
| 分数换算表 | 听力、阅读原始分对应的 band |
| 发信记录 | 排查验证码收不到的问题 |

## 8. 安全要点

- 管理员与考生是两套账号：考生的令牌进不了后台，也读不到 AI key 和邮件密码，调不了导入接口。
  新增 collection 时，访问规则要用 `access/` 里现成的函数，不要写成"登录了就放行"。
- 验证码限频：同一邮箱 60 秒一封，每天 10 封；同一 IP 每小时 20 封。前面再加 CDN 时，要改 `account/codes.ts` 的 `clientIp`。
- 用户生成内容默认不公开。

## 9. 开发流程

- 从 `main` 拉功能分支，做完合并回 `main`。
- 合并前跑完单元测试和 e2e。
