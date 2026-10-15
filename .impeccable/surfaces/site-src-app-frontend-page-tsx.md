---
version: 1
slug: "site-src-app-frontend-page-tsx"
primary_target: "site/src/app/(frontend)/page.tsx"
related_targets: []
---

# Surface brief: 首页 + 五个栏目页

Scope: 首页（Persuade）与 听力 / 阅读 / 写作 / 口语 / 模考 栏目页（Operate）。考试模式不在本 brief 内（1:1 还原机考，不做自由设计）。

Audience / job: 小红书点进来的 A 类考生（首考与二战都有），手机上先开练，电脑上模考。
Action: 首页第一屏直接开始一组听力或阅读（免费、免注册）；栏目页按题型 / Part / 整套筛选后开练。
Proof: 只用可如实宣称的四点：听力阅读练习与模考永久免费、免注册、机考 1:1、无广告不要手机号。无用户数、好评。
Constraints: 不出现 "IELTS"；页脚声明；系统字体正文；标题与正文用系统无衬线字体，不加载网络字体（005 起）；375px 无横向滚动。

## Direction contract

THESIS: 一个让人想点开的学习 App，不是一本刊物的目录。拒绝满页黑白文字和细线；颜色、图形和动效承担信息，不只做装饰。

OWN-WORLD: 浅冷灰底（略带紫）上放白色圆角卡片（12–20px 圆角，柔和投影）。主色明亮蓝紫 #5048E5；四科各有一色（听力紫、阅读蓝、写作橙、口语粉），用作图标色块、标签和进度。免费 = 绿色胶囊带对勾；额度 = 琥珀胶囊带闪电。标题粗体系统无衬线，紧字距；不再用衬线字体。答对绿、答错红，带浅色底的反馈块。几张 SVG 物件插画（耳机、书本、答题卡）。

STORY: 访客一眼看到"听力阅读模考全部免费、不用注册"，在首屏卡片里选听力或阅读直接开做；往下看到四个彩色科目卡和模考横幅，明白写作口语按次用额度。

FIRST VIEWPORT: 左侧大号粗体标题两行 + 开练卡片（科目二选一分段控件 + 主色大按钮）；右侧是答题样张卡片，背后叠着插画物件。其下四个彩色科目卡片顶部进入首屏。

FORM: 站长指定方向，作为跳过 concept-seed 方向比选的明确依据（2026-10-08 两轮结构化提问的原话）：①"网站往哪个方向改？"→"友好的学习 App 风"；②"哪几个 App 的感觉最接近？"→"Notion / Linear 这类"；"主色调偏向？"→"明亮蓝 / 紫"；"插画和图形做到什么程度？"→"加几张简单插画"；另补充"没有过渡动画，东西都特别的生硬"。无 seed key。动效以首页首屏入场与交卷后的结果序列（得分环、反馈展开、题号回弹）为主，列表与题组不逐块入场；全部尊重 prefers-reduced-motion。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
