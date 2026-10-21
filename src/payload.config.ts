import { postgresAdapter } from '@payloadcms/db-postgres'
import { s3Storage } from '@payloadcms/storage-s3'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'
import { isAdmin } from './access/authenticated'
import { lockMembers } from './access/lockMembers'

import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { Members } from './collections/Members'
import { DictEntries } from './collections/DictEntries'
import { EmailSends } from './collections/EmailSends'
import { LoginCodes } from './collections/LoginCodes'
import { MemberData } from './collections/MemberData'
import { CreditEntries } from './collections/CreditEntries'
import { RedeemCodes } from './collections/RedeemCodes'
import { NoteScreenshots } from './collections/NoteScreenshots'
import { NoteSubmissions } from './collections/NoteSubmissions'
import { CreditSettings } from './globals/CreditSettings'
import { Tests } from './collections/Tests'
import { Units } from './collections/Units'
import { MockPapers } from './collections/MockPapers'
import { WritingTasks } from './collections/WritingTasks'
import { WritingReviews } from './collections/WritingReviews'
import { AnswerExplanations } from './collections/AnswerExplanations'
import { ExplanationUnlocks } from './collections/ExplanationUnlocks'
import { SpeakingQuestions } from './collections/SpeakingQuestions'
import { AiSettings } from './globals/AiSettings'
import { MailSettings } from './globals/MailSettings'
import { BandScales } from './globals/BandScales'
import { importEndpoint } from './endpoints/import'
import { mailTestEndpoint } from './endpoints/mailTest'
import { authEndpoints } from './endpoints/auth'
import { passwordEndpoint } from './endpoints/password'
import { memberDataEndpoint } from './endpoints/memberData'
import { lookupEndpoint } from './endpoints/lookup'
import { printEndpoint } from './endpoints/print'
import { playlistEndpoint } from './endpoints/playlist'
import { dictEndpoint } from './endpoints/dict'
import { creditsEndpoint, redeemEndpoint } from './endpoints/credits'
import { notesEndpoint } from './endpoints/notes'
import { writingReviewEndpoints } from './endpoints/writingReviews'
import { expireStale } from './review/writing'
import { expireStaleExplains } from './review/explain'
import { explanationEndpoints } from './endpoints/explanations'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'
import { checkSecrets } from './utilities/checkSecrets'

checkSecrets()

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    // 只有 pnpm dev（NODE_ENV=development）才自动同步表结构；tsx 脚本、测试不设 NODE_ENV 时也不 push，免得误改生产库
    push: process.env.NODE_ENV === 'development',
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  collections: [Pages, Posts, Media, Categories, Users, Members, EmailSends, LoginCodes, MemberData, CreditEntries, RedeemCodes, NoteSubmissions, NoteScreenshots, Tests, Units, MockPapers, WritingTasks, WritingReviews, AnswerExplanations, ExplanationUnlocks, SpeakingQuestions, DictEntries],
  cors: [getServerSideURL()].filter(Boolean),
  // 只认本站来源的 cookie：别的网站带着考生 / 管理员 cookie 发来的请求按未登录处理（010 attack-matrix A12）
  csrf: [getServerSideURL()].filter(Boolean),
  endpoints: [importEndpoint, mailTestEndpoint, ...authEndpoints, passwordEndpoint, memberDataEndpoint, lookupEndpoint, printEndpoint, playlistEndpoint, dictEndpoint, creditsEndpoint, redeemEndpoint, notesEndpoint, ...writingReviewEndpoints, ...explanationEndpoints],
  // 进程重启会丢掉进行中的批改 / 讲解：启动时把超时的改为失败并退回（015 research R2、data-model）
  onInit: async (payload) => {
    await expireStale(payload).catch((e) => payload.logger.error(e, '启动扫描批改失败'))
    await expireStaleExplains(payload).catch((e) => payload.logger.error(e, '启动扫描讲解失败'))
  },
  // 网站不用 GraphQL，关掉少一个对外接口（009 安全自查）
  graphQL: { disable: true },
  globals: [Header, Footer, BandScales, AiSettings, MailSettings, CreditSettings],
  plugins: [
    ...plugins,
    // 配置了 S3 时媒体放对象存储，浏览器直连 S3_PUBLIC_URL；未配置时存本地磁盘 public/media
    s3Storage({
      enabled: Boolean(process.env.S3_BUCKET),
      collections: {
        media: {
          disablePayloadAccessControl: true,
          generateFileURL: ({ filename, prefix }) =>
            `${process.env.S3_PUBLIC_URL}/${prefix ? prefix + '/' : ''}${filename}`,
        },
      },
      bucket: process.env.S3_BUCKET || '',
      config: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
      },
    }),
  ],
  upload: { limits: { fileSize: 50 * 1024 * 1024 } },
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (isAdmin(req.user)) return true

        const secret = process.env.CRON_SECRET
        if (!secret) return false

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${secret}`
      },
    },
    tasks: [],
  },
}).then(lockMembers)
