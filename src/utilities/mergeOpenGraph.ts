import type { Metadata } from 'next'
import { getServerSideURL } from './getURL'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description: '雅思学术类备考：听力、阅读练习和模考免费，不用注册。',
  images: [
    {
      url: `${getServerSideURL()}/logo-1024.png`,
    },
  ],
  siteName: '我不是考神',
  title: '我不是考神',
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
