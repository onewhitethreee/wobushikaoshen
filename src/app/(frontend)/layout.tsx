import type { Metadata, Viewport } from 'next'

import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { WordLookup } from '@/components/Vocab/WordLookup'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'
import { SITE_DESCRIPTION, SITE_NAME, THEME_DARK, THEME_LIGHT } from '@/utilities/site'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <InitTheme />
        {/* 模板用 html{opacity:0} 防深浅闪烁，禁用 JS 时要恢复可见 */}
        <noscript>
          <style>{'html{opacity:1}'}</style>
        </noscript>
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <link href="/apple-touch-icon.png" rel="apple-touch-icon" />
      </head>
      <body>
        <Providers>
          <a
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-card focus:px-4 focus:py-3 focus:font-semibold"
            href="#main"
          >
            跳到正文
          </a>
          <AdminBar
            adminBarProps={{
              preview: isEnabled,
            }}
          />

          <Header />
          <main className="flex grow flex-col" id="main">
            {children}
          </main>
          <Footer />
          <WordLookup />
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // 019：iOS 添加到主屏幕后全屏打开；状态栏按系统浅色 / 深色自动切换
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'default' },
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
  },
}

// 019：浏览器顶部栏颜色 = 网站背景色（--gray-1）；浏览器只能按系统设置区分浅色 / 深色
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_LIGHT },
    { media: '(prefers-color-scheme: dark)', color: THEME_DARK },
  ],
}
