# 提交 PR 的要求

欢迎提 PR。为了让每个 PR 都能尽快审完、合并，请按下面的要求来。
开发环境和代码结构见 [docs/tech-manual.md](docs/tech-manual.md)。

## 开始之前

- **大改动先开 issue**：新功能、改数据结构、加依赖、改页面布局，先在 issue 里说清楚要做什么、为什么，确认方向后再写代码。
  修错别字、修明显的 bug 可以直接提 PR。
- **安全问题不要提 PR，也不要开公开 issue**：请走 GitHub 的 Private vulnerability reporting 私下报告。
- **不接受题库内容**：题目、文章、音频、解析，不论原创还是转载，都不要放进 PR。

## 分支与提交

- 从 `main` 拉分支，分支名用英文短横线，如 `fix-mistake-filter`、`add-shortcut-hint`。
- 一个 PR 只做一件事。顺手看到的其他问题，另开 PR。
- 提交信息格式为 `类型: 说明`，说明用中文写清楚改了什么。
  - 类型：`feat` 新功能、`fix` 修 bug、`docs` 文档、`refactor` 重构、`test` 测试、`chore` 杂项、`copy` 改文案。
  - 例：`fix: 错题本切换栏目后题型筛选未重置`
- 不要提交：`.env`、`node_modules/`、`.next/`、测试报告（`playwright-report/`、`test-results/`）、`*.tmp.spec.ts`。


## 提交前自查

```bash
pnpm lint
pnpm test:int
pnpm test:e2e $(git ls-files tests/e2e) --workers=1   # 改了页面或接口时必跑，需要本机起好 Postgres 和 Mailpit
pnpm check:secrets                                     # 改了构建、环境变量或服务端代码时跑
```

- 改了判分、同步、额度、权限这类逻辑，要补一个能跑的测试，在逻辑写错时会失败。
- 改了 collection 或 global 的字段：
  - 跑 `pnpm generate:types`，提交更新后的 `src/payload-types.ts`。
  - 生产需要的表结构变化，用 `pnpm payload migrate:create <名字>` 生成迁移，连同 `.json` 快照一起提交。
  - 本机不要跑 `pnpm payload migrate`。
- 测试会往当前数据库写临时数据，**不要连任何线上库跑测试**。

## PR 描述

照这个格式写：

```markdown
## 改了什么
一两句话。

## 为什么
要解决的问题；有 issue 就写 Closes #编号。

## 怎么验证
跑了哪些测试；手动验证的步骤。

## 截图
改了页面就必须附：电脑和手机（375px 宽）各一张，有深色模式的话也附上。

## 注意
有没有新迁移、新环境变量、新依赖（附理由）、需要站长在后台做的操作。没有就写"无"。
```

## 审核与合并

- 维护者会尽量在一周内回复。需要修改时，请在原分支上追加提交，不要强推覆盖历史，方便看改了什么。
- 合并方式为 squash，合并后的提交信息以 PR 标题为准，所以标题也请用 `类型: 说明` 格式。
- 提交 PR 即表示你同意以本项目的 AGPL-3.0 许可证发布你的贡献。
