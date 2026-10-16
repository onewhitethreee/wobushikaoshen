import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // 每个测试文件各起一个 Payload（连接池最多 10 个连接）；本机 Postgres 上限 100，24 核默认并发会挤爆（too many clients）
    maxWorkers: 6,
  },
})
