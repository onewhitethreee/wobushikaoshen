# 生产镜像。用法见 docker-compose.yml 顶部注释

FROM node:22.17.0-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable && corepack prepare pnpm@11.1.2 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm i --frozen-lockfile

# 完整源码 + 全部依赖：compose 的 migrate 服务用它跑 `pnpm payload migrate`
FROM base AS source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next build 会预渲染页面、查数据库，所以构建时要连得上已建表的库
FROM source AS builder
ARG DATABASE_URL
ARG PAYLOAD_SECRET
ARG NEXT_PUBLIC_SERVER_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22.17.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
