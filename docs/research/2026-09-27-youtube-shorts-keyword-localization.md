# YouTube Shorts maker：五语言本地化依据

调研与实现日期：2026-09-27。使用 `lyl-keyword-localizer` 与 `lyl-landing-page`。用户在英文验收阶段后要求开始翻译；按现有站点范围完成 fr / es / it / de / ja，保留英文。不包含发布。

## Localization Handoff Brief

- 用户目标：把已完成的 YouTube Shorts maker 功能页翻译到站点现有语言。
- 核心任务：上传已有的长视频文件，选择 AI 提议的片段，审阅并下载；付费后可调整字幕、剪辑与竖屏画面。
- 来源词群：YouTube Shorts maker、YouTube to Shorts。这里不新建 YouTube clip maker 或 YouTube to TikTok 页面。
- 搜索意图：工具为主，辅以操作说明；「generator」的结果常同时包含文字生成视频，必须明确输入为已有视频。
- 市场：法国法语、以西班牙表达为主的西语、意大利意语、德国德语、日本日语。语言页面并非各国家分别建站；未验证加拿大法语、拉美各国或德语国家之间的需求差异。
- 数据边界：本轮是术语和意图研究，没有测量搜索量、KD、本地排名或转化率。不能给这些译词套用英文词的流量。

| 市场 | 主关键词／页面表达 | 自然修饰与格式词 | 场景与相邻意图 | 独立证据 |
| --- | --- | --- | --- | --- |
| 法国 / fr | créer des Shorts YouTube；créateur de Shorts YouTube | à partir de vos vidéos；vidéos longues；format vertical；sous-titres | 现有长视频重剪；文本生成视频是相邻意图 | [YouTube 法语说明](https://support.google.com/youtube/answer/12836917?hl=fr) 用「Créer des Shorts…à partir de vos vidéos」，正文覆盖长视频；[Canva 法语产品页](https://www.canva.com/fr_fr/creer/video-courte/) 使用 créateur / Shorts YouTube / format vertical；[VEED 法语工具页](https://www.veed.io/fr-FR/creer/videos-courtes) 覆盖长视频转短片与 sous-titres。 |
| 西班牙 / es | crear Shorts de YouTube；creador de Shorts de YouTube | convertir vídeos largos en Shorts；formato vertical | 长视频转换；模板创作、TikTok 是相邻意图 | [YouTube 西语说明](https://support.google.com/youtube/answer/12836917?hl=es) 覆盖 crear / convertir / vídeos largos；[Canva 西班牙页](https://www.canva.com/es_es/crear/shorts-youtube/) 覆盖 creador、crear shorts、formato vertical。 |
| 意大利 / it | creare YouTube Shorts；creare Short di YouTube | dai tuoi video；video lungo；formato verticale；sottotitoli | 已有录制、教程片段；AI 文字生视频需明确区分 | [YouTube 意语说明](https://support.google.com/youtube/answer/12836917?hl=it) 用「Creare Short…a partire dai tuoi video」；[Canva 意语工具页](https://www.canva.com/it_it/strumenti/ai-shorts-generator/) 同时覆盖已有长视频提取与文本生成，支持 video lungo / formato verticale / sottotitoli。 |
| 德国 / de | YouTube Shorts erstellen | aus deinen Videos；lange Videos；mit KI；Hochformat；Untertitel | 长视频提取；Skript zu Video 属于另一类任务 | [YouTube 德语说明](https://support.google.com/youtube/answer/12836917?hl=de) 用 Shorts erstellen / lange Videos in Shorts umwandeln；[CapCut 德语说明](https://www.capcut.com/de-de/resource/ai-shorts-maker) 分开介绍 script-to-video 与 long-video-to-shorts，后者提供上传与剪辑流程。该页部分措辞生硬，只采用与官方用语一致的词，不模仿句法。 |
| 日本 / ja | YouTubeショート作成；ショート動画作成 | 長い動画／長尺動画；切り抜き；縦型；字幕 | 讲解、访谈、已有视频片段；泛 AI 视频生成是相邻意图 | [YouTube 日语说明](https://support.google.com/youtube/answer/12836917?hl=ja) 支持已有视频制作ショート；[YouTube Studio 日语说明](https://support.google.com/youtube/answer/15824265?hl=ja) 支持 長尺動画 / 切り抜き；[Canva 日语工具页](https://www.canva.com/ja_jp/create/short-videos/) 支持 ショート動画作成 / 縦動画；[Canva 编辑页](https://www.canva.com/ja_jp/video-editor/) 覆盖长视频剪成短片与字幕。 |

以上页面均在本轮打开核对正文。CapCut `/de-de/create/youtube-shorts-maker` 与 ClapClip `/ja/shorts` 正文抓取失败，不作为唯一或关键证据；改用表中可读取的独立来源。Canva 法语／西语页包含旧的平台时长信息，仅作语言证据，不采用其平台限制或产品承诺。

## CTA、语气与页面取舍

- 法语：Canva 明确使用从设备导入的表达；沿用站内 `Importer une vidéo`，正文用 vous。
- 西语：官方使用 subir，Canva 也以 sube 描述输入；站内按钮为 `Subir un video`，本页正文采用西班牙常见的 vídeo 拼写。共享按钮保持现有站点文案。
- 意语：官方与 Canva 用 caricare / carica；沿用 `Carica un video` 和 tu。
- 德语：官方采用 du，CapCut 使用 Video hochladen；沿用站内 du 和上传按钮，避免冗长的「Hersteller／Schöpfer」式直译。
- 日语：Canva 的输入动作是「デバイスからアップロード」；沿用「動画をアップロード」，说明采用です／ます体。
- 上传动作措辞有来源支持，但这些 CTA 的转化效果、地区偏好强弱均未验证。
- 不把 maker 机械译成每种语言的「制造器」。标题写当地自然的创建／转换任务；德语 KI、法西意 IA、日语 AI 与各页面语境一致。
- 保留英文版的信息架构与演示对比；非英文标题独立措辞，日语尤其不直译舞台、画布等隐喻。手机标题按本地脚本调整字号。
- 本轮没有研究本地隐私、税费或服务所在地偏好，也没有新增这类承诺。

## 产品事实核对

事实来源：`lib/plans.ts`、`docs/video-workspace/editing-and-framing.md`、`docs/roadmap/video-product-plan.md` 与已经验收的英文稿。

- 输入：本地原始视频文件；不可粘贴 YouTube URL 导入源视频。字幕导入工具不是视频剪辑输入。
- 配额：免费分钟数与上传大小由 `PLANS.free` 插值；一次性免费额度，不宣称每月续领。
- 免费／付费：原始候选片段可免费导出；切点、字幕、画面编辑需要付费。
- 输出：下载 MP4；候选数可能为零；不承诺固定数量、速度、播放量或自动发布。
- 演示：此页面新找的 Pexels 4540152，同一新素材在五语言中重新渲染示例字幕；不是实际转录或 Scribix 项目导出，不暗示出镜者代言。
- CTA：复用现有登录／新建项目流程，不新增账号连接或外部上传。

## 实现与交付

- 运行时文案：`messages/{en,fr,es,it,de,ja}.json` 的 `YouTubeShortsLanding`（原文 84 个稳定键；上线准备另增 navLabel）。
- 可读译稿：`docs/landing-page-{fr,es,it,de,ja}-youtube-shorts-maker.md`。运行时字典是后续改稿的唯一执行来源。
- 路由：`/youtube-shorts-maker` 和五个语言前缀版本；恢复语言菜单，分别设置 canonical，并列出六语言及 x-default。
- 初稿保留 noindex 且不加入导航／sitemap；2026-09-27 用户授权上线准备后，已移除 noindex，加入六语言 sitemap、Footer 和 long-video 入站链接。仍未部署。
