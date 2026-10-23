import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import { getSettings } from '@/account/credits'
import { INVITE_COOKIE, normalizeInviteCode } from '@/account/invite'
import { LoginForm } from '@/components/Account/LoginForm'

export const metadata: Metadata = { title: '登录', robots: { index: false, follow: false } }

/** 从邀请链接来的（?invite= 或邀请链接留下的 cookie）：码对得上邀请人才显示提示和预填，免得把乱填的码当真 */
const findInvite = async (raw: string) => {
  const code = normalizeInviteCode(raw)
  if (!code) return null
  const payload = await getPayload({ config: configPromise })
  const found = await payload.find({ collection: 'members', overrideAccess: true, depth: 0, limit: 1, where: { inviteCode: { equals: code } } })
  if (!found.docs[0]) return null
  const s = await getSettings(payload)
  return { code, reward: s.signupReward + s.inviteeReward, inviterReward: s.inviterReward }
}

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; invite?: string }> }) {
  const { next, invite: inviteParam } = await searchParams
  const invite = await findInvite(inviteParam || (await cookies()).get(INVITE_COOKIE)?.value || '')
  return (
    <section className="container py-12 md:py-20">
      <div className="mx-auto flex max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-[24px] font-medium tracking-[-0.01em]">登录</h1>
          <p className="text-[15px] leading-[1.7] text-muted-foreground">
            第一次登录会自动注册。登录后换设备也能看到做题记录、错题本、收藏和单词本。
          </p>
        </div>
        {invite && (
          <p className="bg-success-soft px-5 py-4 text-[15px] leading-[1.7] text-success" data-testid="invite-banner">
            好友邀请你来练题。用验证码登录（第一次会自动注册），你得 {invite.reward} 额度
            {invite.inviterReward > 0 && `，好友也得 ${invite.inviterReward}`}。
          </p>
        )}
        <LoginForm invite={invite?.code} next={next} />
        <p className="border-t border-border pt-4 text-[13px] text-muted-foreground">
          不登录也能做题。{' '}
          <Link className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4" href="/listening">
            先去做题 ↗
          </Link>
          <br />
          错题本、收藏和单词本不登录也能用：
          <Link className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4" href="/me/mistakes">
            错题本
          </Link>
          {' · '}
          <Link className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4" href="/me/favorites">
            我的收藏
          </Link>
          {' · '}
          <Link className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4" href="/me/words">
            单词本
          </Link>
        </p>
      </div>
    </section>
  )
}
