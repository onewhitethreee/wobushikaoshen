# 生产部署（Docker）

整站跑在一台服务器上：`db`（Postgres 17）和 `app`（Next.js + Payload）两个容器，外面一层 nginx 负责 HTTPS。
媒体（题目配图、听力音频，约 3.3GB）存在服务器磁盘 `public/media`，挂进 app 容器。
考生上传的小红书笔记截图存在 `private/note-screenshots`（不在 `public/` 下，只有本人和管理员能打开），同样挂进 app 容器。

配置文件：`Dockerfile`、`docker-compose.yml`、`.env.example`。

## 1. 准备

- 服务器：2 核 4GB 起，磁盘至少 40GB。
- 装好 Docker（带 compose 插件）、nginx、certbot。
- 域名 A 记录指向服务器 IP。
- 防火墙只开 22、80、443。compose 里数据库（5432）和 app（3000）都只绑 127.0.0.1，外网访问不到。

## 2. 代码与 `.env`

把 `site/` 放到服务器上（git clone 或 rsync，排除 `node_modules`、`.next`），复制 `.env.example` 为 `.env`，填：

```bash
DB_PASSWORD=<强密码>
# 构建时走宿主网络连库，所以这里写 127.0.0.1；容器运行时 compose 会自动改成连 db
DATABASE_URL=postgresql://postgres:<同一个强密码>@127.0.0.1:5432/ielts
PAYLOAD_SECRET=<openssl rand -hex 32>
CRON_SECRET=<openssl rand -hex 32>
PREVIEW_SECRET=<openssl rand -hex 32>
NEXT_PUBLIC_SERVER_URL=https://wobushikaoshen.com
```

- 三个 SECRET 必须是 32 位以上的随机串，否则 app 拒绝启动。
- `NEXT_PUBLIC_SERVER_URL` 必须是用户实际访问的地址：https，不带尾斜杠。它同时是 CSRF 白名单，填错了，所有登录后的写操作都会被当成未登录。这个值在构建时写进镜像，改了要重新构建。
- S3 那几项留空，媒体就存本地磁盘。

## 3. 首次部署

顺序不能乱：`next build` 构建时要查数据库，所以必须**先建库、导入数据，再构建 app**。

```bash
# ① 启动数据库并建表
docker compose up -d db
docker compose run --rm migrate          # 按顺序执行 src/migrations 里的全部迁移
```

### ② 导入题库（从本机搬过去；全新空站跳过这一步）

本机：

```bash
# 只导数据，不导表结构和迁移记录
MSYS_NO_PATHCONV=1 docker exec ielts-pg pg_dump -U ielts -d ielts --data-only \
  --exclude-table=payload_migrations -Fc -f /tmp/ielts-data.dump
docker cp ielts-pg:/tmp/ielts-data.dump .
scp ielts-data.dump <服务器>:~/site/
rsync -avP public/media/ <服务器>:~/site/public/media/
```

服务器：

```bash
docker compose cp ielts-data.dump db:/tmp/
docker compose exec db pg_restore -U postgres -d ielts --data-only --disable-triggers /tmp/ielts-data.dump
docker compose exec db psql -U postgres -d ielts -c "delete from users_sessions"   # 清掉本机带来的登录会话
docker compose exec db psql -U postgres -d ielts -c "select setval('payload_migrations_id_seq', (select max(id) from payload_migrations))"
```

- 最后一条不能省：导出时排除了 `payload_migrations` 的数据，但它的序列值还是会带过来，把服务器上的计数改回本机的值，下次 migrate 写记录时会报 `duplicate key ... payload_migrations_pkey`。

- 导出时 pg_dump 会提示 `circular foreign-key constraints`，这是正常的，`--disable-triggers` 就是用来处理它的。
- 本机库是 `pnpm dev` 自动同步出来的表结构，和迁移建的只差列顺序。pg_restore 按列名导入，不受影响。
- 测试数据（`e2e-`、`fixture-` 开头）测完会自动删除，导出前可以确认一下没有残留。

### ③ 导入词典（双击查词、单词本用）

下载 [ECDICT](https://github.com/skywind3000/ECDICT)（MIT 许可，约 66 MB；固定到某次提交并核对校验值），用 `migrate` 服务的镜像导入，约 40 万条、1 分钟以内：

```bash
curl -L -o ecdict.csv https://raw.githubusercontent.com/skywind3000/ECDICT/82c9872576b23118d7c42e920c11beb77f510ae2/ecdict.csv
echo "1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf  ecdict.csv" | sha256sum -c
docker compose run --rm -v "$PWD/ecdict.csv:/tmp/ecdict.csv:ro" migrate pnpm import:dict /tmp/ecdict.csv
rm ecdict.csv
```

导入是整表替换，可以重复执行。没导入词典时，网站其他功能照常，只是双击查词都显示"词典里没有这个词"。

### ③b Task 1 图表数据（写作 AI 批改用）

从本机搬数据（②）时图表数据已经带过来了，跳过这一步。全新空站、或以后新导入了 Task 1 时，在后台「AI 设置」填好 key 和看图模型后执行（要读图片，所以挂上媒体目录）：

```bash
docker compose run --rm -v "$PWD/public/media:/app/public/media:ro" migrate pnpm chart:data
```

- 只处理还没有图表数据的已发布 Task 1，可以重复执行。118 道大约 10 分钟、50 万 token。
- 失败的题号会打印出来；`--only-failed` 只重跑失败的（失败清单在容器里，容器删掉后用 `--redo 4,12` 指定题号）。
- 跑完在后台「写作题」随机抽查几道：对照图片看"图表数据"，没问题勾"图表数据已核对"，有错直接改。没有图表数据的 Task 1 不能批改，页面上按钮是灰的。

### ③c 模考卷（全真模考用）

从本机搬数据（②）时模考卷已经带过来了，跳过这一步。全新空站、或以后导入了新的练习单元时执行：

```bash
docker compose run --rm migrate pnpm mock:compose --dry-run   # 先看能组几张
docker compose run --rm migrate pnpm mock:compose             # 建草稿卷
```

- 每张卷子 = 听力 Part 1–4 + 阅读 Passage 1–3，只用还没进过任何卷子的已发布单元，已有卷子不动，可以重复执行。
- 建出来的是草稿。在后台「模考卷」抽看几张（可以换掉某个 Part / 篇），然后批量发布。卷子里有单元未发布时，这张卷子不会出现在 `/mock`。

### ④ 媒体目录权限、构建、启动

```bash
mkdir -p public/media && sudo chown -R 1001:1001 public/media   # 容器以 uid 1001 运行，不改的话后台上传会失败
mkdir -p private/note-screenshots && sudo chown -R 1001:1001 private   # 笔记截图，同理
docker compose build app
docker compose up -d app
docker compose logs -f app       # 看到 Ready 即可
```

## 4. nginx 与 HTTPS

`/etc/nginx/sites-available/ielts`：

```nginx
server {
  listen 80;
  server_name wobushikaoshen.com;
  client_max_body_size 50m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;   # 按 IP 限频靠它
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ielts /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d wobushikaoshen.com      # 自动改成 443 并续期
```

必须走 HTTPS：生产环境的登录 cookie 带 `Secure`，用 http 访问会出现"登录成功但仍未登录"。
如果前面再套一层 CDN，真实 IP 的取法要改 `src/account/codes.ts` 的 `clientIp`。

## 5. 上线后马上做

1. 打开 `/admin`：
   - 库里还没有管理员时，页面会开放"创建第一个用户"，立刻把管理员建好。
   - 管理员是从本机带过来的，先登录，把密码改成强密码。
2. 后台「邮件设置」：
   - 主用填阿里云或腾讯云邮件推送的 SMTP，备用填 QQ 邮箱授权码。
   - 点"发送测试邮件"确认能收到。
   - 本机带过来的配置指向 Mailpit，生产上不能用，必须改掉。
3. 后台「AI 设置」：确认 DeepSeek key 已填好。写作批改和错题讲解都靠它；没填 key 时这两个按钮会提示暂时不可用，不扣额度。
4. 用一个新邮箱走一遍完整流程：注册登录、做写作 / 阅读 / 听力各一套、收藏、错题本、退出。后台给这个账号加 2 额度，交一篇作文点 AI 批改、在一道错题上点 AI 讲解，确认都出结果、流水里各有一条 −1。

## 6. 更新代码

```bash
git pull                                  # 或 rsync 新代码
docker compose run --rm --build migrate   # 有新迁移时才需要；没有新迁移，跑了也无害
docker compose build app && docker compose up -d app
```

- `migrate` 一定要带 `--build`：它用的是单独的镜像，不重新构建就还是旧代码、旧迁移。之后用它跑 `import:dict`、`chart:data` 也一样。
- 构建期间旧容器继续提供服务，`up -d` 换新容器时会断几秒。
- 词典只在第一次部署时导入；以后换新版 ECDICT 时，按 3 ③ 的命令重新导入即可。
- 安全修复要**先部署上线，再同步公开仓库**。

## 7. 备份

```bash
# 数据库，每天一份（加到 crontab）
docker compose exec -T db pg_dump -U postgres -d ielts -Fc > backup/ielts-$(date +%F).dump
# 媒体：增量同步到别的机器或对象存储
rsync -a public/media/ <备份位置>/media/
# 笔记截图（永久保留，审核凭证）
rsync -a private/ <备份位置>/private/
```

词典（`dict_entries` 表）可以随时从 ECDICT 重新导入，不必单独备份；整库备份里带着它也无妨（约 60 MB）。

恢复整库：在空库上执行 `pg_restore -U postgres -d ielts --clean --if-exists <文件>`。这是整库备份，带表结构，不需要先跑 migrate。

## 常见问题

| 现象                            | 原因                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| 构建报连不上数据库 / 表不存在   | 没先 `up -d db` 和 `run --rm migrate`；或者 `.env` 的 `DATABASE_URL` 没写 127.0.0.1 |
| app 启动即退出，日志提示 SECRET | 三个 SECRET 不足 32 位，或者还是示例值                                                      |
| 登录成功但刷新后仍未登录        | 没走 HTTPS，或者 `NEXT_PUBLIC_SERVER_URL` 和实际访问地址不一致                            |
| 后台上传图片 / 音频失败         | `public/media` 没有 `chown 1001:1001`                                                   |
| 考生提交笔记时上传截图失败      | `private` 没有 `chown 1001:1001`                                                        |
| 验证码限频把所有人当成同一个 IP | nginx 没设 `X-Forwarded-For`                                                              |
