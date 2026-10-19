import type { MetadataRoute } from 'next'

import { SITE_DESCRIPTION, SITE_NAME, THEME_LIGHT } from '@/utilities/site'

// 019 可安装到主屏幕（research R2）：只有清单和图标，不注册 service worker
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: SITE_NAME,
    short_name: '考神',
    description: SITE_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'zh-CN',
    background_color: THEME_LIGHT,
    theme_color: THEME_LIGHT,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
