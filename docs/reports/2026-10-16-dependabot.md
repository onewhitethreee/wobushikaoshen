# 依赖漏洞修复报告（2026-10-16，v0.1.1）

来源：GitHub Dependabot 推送 v0.1.0 时报告了 8 条（2 严重、1 高危、5 中等），涉及 5 个漏洞公告。

## 结论

- 4 个公告已修复：升级直接依赖，或用 `pnpm-workspace.yaml` 的 `overrides` 强制间接依赖升级。
- 1 个公告（braces）上游还没有修复版本，评估后确认生产环境不受影响，保持打开，等上游发布修复。
- 涉及的包全部是开发、构建或测试工具，生产环境处理用户请求的代码路径都不经过它们。

## 明细

| Dependabot 编号 | 严重度 | 包 | 公告 | 原版本 | 处理 | 现版本 |
|---|---|---|---|---|---|---|
| #1 #4 | 严重 | vitest（直接，开发依赖） | GHSA-5xrq-8626-4rwp：Vitest UI 服务监听时可读取、执行任意文件 | 4.0.18 | `package.json` 升级 | 4.1.12 |
| #2 #5 #6 | 中等 | vitest、@vitest/mocker | GHSA-82fw-gwwq-j7x9：mock 重定向路径穿越，可读任意文件 | 4.0.18 | 同上 | 4.1.12 |
| #3 | 中等 | esbuild（间接：@payloadcms/db-postgres → drizzle-kit → @esbuild-kit/core-utils） | GHSA-67mh-4wv8-2f99：开发服务器可被任意网站跨域请求 | 0.18.20 | override `@esbuild-kit/core-utils>esbuild: ^0.25.0` | 0.25.12 |
| #8 | 中等 | postcss-selector-parser（间接：@tailwindcss/typography） | GHSA-rj75-hqrm-r3gf：解析平铺选择器时复杂度为平方级，可耗尽 CPU | 6.0.10 | override `@tailwindcss/typography>postcss-selector-parser: ^7.1.6` | 7.1.6 |
| #7 | 高危 | braces（间接，见下） | GHSA-vfj7-8cjw-p6xm（CVE-2026-93687）：深层嵌套的花括号模式导致栈溢出，进程崩溃 | 3.0.3 | **暂不修复**，上游没有修复版本 | 3.0.3 |

### braces 为什么暂不修复

- **来源**：
  - chokidar 3（sass、vite 的文件监听）
  - micromatch → fast-glob（eslint、next-sitemap）
  - micromatch → findup-sync（Payload 对象存储插件查找依赖目录）
- **影响范围**：这些调用的匹配模式都是写死在代码或配置里的。本站代码（`src/`、`scripts/`）没有直接使用 braces、micromatch 或 chokidar，用户输入到不了这些函数，外部无法构造恶意模式。
- **后续**：Dependabot 保持打开。上游发布修复版本后升级，或用 override 指定修复版本，然后关闭这条告警。

## 验证

| 检查 | 结果 |
|---|---|
| `pnpm why` 确认安装的版本 | vitest 4.1.12、@vitest/mocker 4.1.12、esbuild 0.25.12 / 0.28.2（已没有 0.18.x）、postcss-selector-parser 7.1.6 |
| 单元测试 `pnpm test:int` | 23 个文件、271 个测试全部通过 |
| e2e `pnpm test:e2e … --workers=1` | 98 个全部通过。其中包括开发服务器启动和数据库表结构同步，esbuild override 影响的就是这一步 |
| `pnpm lint` | 0 个错误（34 个警告，都是原来就有的） |
| Tailwind 编译 `globals.css` 前后对比 | 逐字节一致（94,322 字节，含 `@tailwindcss/typography` 生成的 `.prose` 样式），postcss-selector-parser 升级大版本没有改变样式 |

## 顺带发现

`pnpm ii`（`pnpm --ignore-workspace install`）会忽略 `pnpm-workspace.yaml`。这导致两个后果：

- `overrides` 不生效；
- `allowBuilds` 被改写成"set this to true or false"。

这次改用 `pnpm install` 安装。`pnpm-workspace.yaml` 中的 overrides 只有用 `pnpm install` 才会生效。
