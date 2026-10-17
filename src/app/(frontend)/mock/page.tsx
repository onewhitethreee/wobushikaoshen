import type { Metadata } from 'next'

import React from 'react'

import { ColumnPage, type ColumnQuery } from '@/components/Journal/ColumnPage'
import { getColumn } from '@/content/columns'

export const metadata: Metadata = { title: '模考' }

export default async function Page({ searchParams }: { searchParams: Promise<ColumnQuery> }) {
  const query = await searchParams
  return <ColumnPage config={await getColumn('mock')} query={query} />
}
