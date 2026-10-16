import type { Metadata } from 'next'

import React from 'react'

import { PasswordForm } from '@/components/Account/PasswordForm'

export const metadata: Metadata = { title: '设置密码', robots: { index: false, follow: false } }

export default function Page() {
  return (
    <section className="container py-12 md:py-20">
      <div className="mx-auto max-w-sm">
        <PasswordForm />
      </div>
    </section>
  )
}
