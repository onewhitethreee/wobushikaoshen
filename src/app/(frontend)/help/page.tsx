import type { Metadata } from 'next'
import configPromise from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import { getSettings } from '@/account/credits'
import { noteText, platformName } from '@/account/notePlatform'

// 使用说明与常见问题（页脚"帮助"入口）。浓缩自 docs/user-manual.md，功能变了两边一起改；额度数字读「额度设置」
export const revalidate = 600

export const metadata: Metadata = {
  title: '使用说明与常见问题',
  description: '雅思学术类备考网站的使用说明：怎么找题、做题交卷、全真模考、写作 AI 批改、登录同步、领额度，以及常见问题。',
  alternates: { canonical: '/help' },
}

const A: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <Link className="underline underline-offset-4 hover:text-foreground" href={href}>
    {children}
  </Link>
)

const Section: React.FC<{ id: string; title: string; children: React.ReactNode }> = ({ id, title, children }) => (
  <section aria-labelledby={id} className="flex flex-col gap-3">
    <h2 className="text-[22px] font-medium" id={id}>
      {title}
    </h2>
    <div className="flex flex-col gap-3 text-[15px] leading-[1.8] [&_li]:ml-5 [&_ul]:list-disc">{children}</div>
  </section>
)

export default async function Page() {
  const s = await getSettings(await getPayload({ config: configPromise }))
  // 笔记换额度的平台（032）：关闭时不提笔记；不是小红书时邀请那条也不提小红书
  const platform = platformName(s)

  const faq: [string, React.ReactNode][] = [
    ['要花钱吗？', '不用。题库浏览、听力、阅读、写作练习、全真模考都免费，也不用注册。只有写作 AI 批改、错题 AI 讲解会调用 AI，每次用 1 额度，额度靠下面几种方式领，不能花钱买。'],
    [
      '额度怎么领？',
      <ul key="quota">
        <li>新用户注册送 {s.signupReward} 额度。</li>
        <li>
          邀请好友：好友用新邮箱注册，好友得 {s.inviteeReward}、你得 {s.inviterReward}（你最多得 {s.inviterCap} 次）。在
          <A href="/me/credits">「我的额度」</A>复制邀请链接，或者把邀请码发给好友。
        </li>
        {platform && <li>{noteText('发一篇小红书笔记，在「我的额度」提交链接和截图，审核通过后发额度。', platform)}</li>}
        <li>兑换码：在「我的额度」兑换。兑换码不出售。</li>
      </ul>,
    ],
    ['好友注册了，邀请却没算上？', `好友在${platform === '小红书' ? '微信 / 小红书' : '微信等 App '}里打开链接、换了浏览器注册，邀请会丢。让好友注册时在登录页点"有好友的邀请码？"，填上你「我的额度」里的 8 位邀请码，就算你的邀请。只有新注册的账号算。`],
    ['验证码一直收不到', '先查垃圾邮件；还是没有就过几分钟再试，或者换一个邮箱。60 秒内只能发一次，一个邮箱一天最多 10 封。'],
    ['换了设备，记录不见了', '在新设备上登录同一个邮箱。未登录时的记录只存在原来那台设备上，登录后会合并进账号。'],
    ['页面提示"本机存储不可用"', '浏览器开了隐私模式或禁用了站点数据。题照常能做，只是记录不保存；登录后记录会存到账号里。'],
    ['手机上打不开模考', '模考只支持电脑，和真实机考一致。练习在手机上都能做。'],
    ['模考时不小心关了页面', '重新打开那场模考接着考；时间没有停，按真实时间算。'],
    ['交卷后找不到"精听 / 听写"', '这套题没有逐句时间（老套题都没有），用不了精听。'],
    ['AI 批改的分数准吗？', 'AI 按官方公开的评分标准给分，只供参考，和真实考试可能有出入。批改失败会自动退回额度；同一篇没改过再点批改，直接显示上次的结果，不扣额度。'],
    ['发现题目或答案有错', '答案判错了：交卷后在解析里点"答案有问题"举报，审核通过奖励额度。题目本身有错：用页脚的"反馈与投诉"邮箱告诉我们，写上题目所在的页面链接和题号。'],
  ]

  return (
    <div className="container py-10 md:py-14">
      <article className="mx-auto flex max-w-3xl flex-col gap-10">
        <header className="flex flex-col gap-2">
          <nav aria-label="当前位置" className="text-[13px] text-muted-foreground">
            <Link className="inline-flex min-h-11 items-center hover:text-foreground" href="/">
              首页
            </Link>{' '}
            / 使用说明
          </nav>
          <h1 className="text-[clamp(32px,4vw,48px)] leading-tight font-medium tracking-[-0.02em]">使用说明与常见问题</h1>
          <p className="text-[15px] text-muted-foreground">
            雅思学术类（A 类）备考网站。练习全部免费，不用注册就能做。
            <a className="ml-1 underline underline-offset-4 hover:text-foreground" href="#faq">
              直接看常见问题 ↓
            </a>
          </p>
        </header>

        <Section id="find" title="找题">
          <p>
            页头有五个栏目：<A href="/listening">听力</A>、<A href="/reading">阅读</A>、<A href="/writing">写作</A>、
            <A href="/speaking">口语</A>、<A href="/mock">模考</A>。考后回忆和高频题在<A href="/jijing">机经</A>。
          </p>
          <ul>
            <li>听力 / 阅读可以按题型练、按 Part（篇目）练、整个 Part（整篇）练、整套练。</li>
            <li>左侧按题型、Part、题集、做没做过筛选；做过的题显示上次成绩。</li>
            <li>写作按 Task 1 / Task 2 和题目分类筛选。</li>
            <li>列表上方的“随机一题”在当前练法和筛选下随机打开一道，优先没做过的；交卷后可以“再抽一题”。</li>
          </ul>
        </Section>

        <Section id="practice" title="做题与交卷">
          <ul>
            <li>作答自动保存，关掉页面再打开会恢复。做完点“交卷”看得分。</li>
            <li>交卷后每题标出对错，解析里有正确答案、出处定位、题干和原文的同义替换对照。</li>
            <li>听力交卷后原文跟着音频走，点任意一句从这句开始播；还能“精听 / 听写”逐句练。</li>
            <li>底栏可以正计时、倒计时或隐藏；倒计时到点只提示，什么时候交卷自己定。</li>
            <li>电脑上选中文字右键可以高亮，双击单词查释义、加入单词本。</li>
            <li>做错的题自动进错题本（账号菜单里），可以重做、打印。</li>
          </ul>
        </Section>

        <Section id="mock" title="全真模考">
          <ul>
            <li>只支持电脑，流程和真实机考一样：听力 4 个 Part 只放一次，到点自动交卷；阅读 60 分钟。</li>
            <li>“随机模考”每次抽 4 个 Part 和 3 篇文章，优先没做过的。</li>
            <li>刷新、断网都能接着考，时间按真实时间走。</li>
          </ul>
        </Section>

        <Section id="writing" title="写作与 AI 批改">
          <ul>
            <li>写作页实时显示词数，草稿自动保存。</li>
            <li>
              “AI 批改”要登录，每次 1 额度：给总分、四项分和理由、逐段建议和改写示例。Task 1 至少 50 词、Task 2 至少 80
              词才能批改。
            </li>
          </ul>
        </Section>

        <Section id="account" title="登录与同步">
          <ul>
            <li>不登录也能做所有练习。登录用邮箱验证码，第一次登录自动注册；之后可以在账号菜单里设密码。</li>
            <li>登录后交卷记录、作答进度、写作草稿、错题、收藏、单词本、备考计划在设备之间同步。</li>
            <li>退出登录会清空这台设备上的记录，账号里有完整备份，下次登录拉回来。</li>
          </ul>
        </Section>

        <Section id="faq" title="常见问题">
          <dl className="flex flex-col border-t border-border" data-testid="help-faq">
            {faq.map(([q, a]) => (
              <div className="flex flex-col gap-1 border-b border-border py-4" key={q}>
                <dt className="font-semibold">{q}</dt>
                <dd className="text-muted-foreground">{a}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </article>
    </div>
  )
}
