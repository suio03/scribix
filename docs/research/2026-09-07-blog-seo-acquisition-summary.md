# Scribix 内容规划：Guides、长尾 SEO 与非广告获客

初始调研：2026-09-07；规划更新：2026-09-20。关键词范围：美国市场、英语搜索。关键词指标保留 9 月 7 日 Google Ads Keyword Planner、SEMrush、Similarweb 的原始口径，本次未重新测量。

本文是内容选题、优先级和执行路线的唯一维护入口。9 月 18 日竞品内容观察已合并；[竞品调研](2026-09-18-competitor-content-acquisition.md)仅保留证据，不维护另一份计划。

状态：2026-09-19 首批内容已上线 scribix.io：Guides、选片清单、TikTok 教程与播客功能页均覆盖六语言。教程使用真实截图、导出成片和截图动画演示；当前交付与验证结果统一见第 7 节。关键词原始记录见 [video-seo-keywords.json](2026-09-07-video-seo-keywords.json)。

## 1. 核心结论

Scribix 应围绕「把长视频变成可发布的短视频」建立内容中心。第一阶段组合是：少量高意图功能落地页、真实操作教程、问题修复、可复用清单与案例实测。内容入口使用 Guides，英语优先；同一份获授权素材用于文章、操作演示、修正前后对比和检查清单。

建议优先顺序：

1. **播客切片**：建立 podcast clip maker 页面，并用 TikTok / Instagram 操作教程支撑。
2. **横屏转竖屏**：建立功能页，展示人物、双人对话、演示文稿等实际构图结果。
3. **OpusClip 替代方案**：有搜索需求，且难度估计相对可控；首篇按官方功能、套餐和工作流选型比较，配产品演示。效果优劣结论仍须同素材实测。
4. **长视频转短视频**：由首页承接主词及同意图变体，教程解决具体操作问题。
5. **Reels 与 webinar**：第二批验证。Webinar 本次可见搜索量较小，不宜先作为主要内容支柱。

这些是根据产品匹配度、搜索意图、需求估计及内容制作成本作出的优先级判断，不代表排名或流量保证。

## 2. image-pdf 的内容是怎么做的

`/Users/laughingli/Documents/side-projects/image-pdf` 中有两个独立产品：图片工具 Tanumi 和 PDF 工具 Doruni。目前看到的是独立制作的内容页，还不是完整的通用 Blog / CMS。

| 项目 | 示例 | 内容特点 |
| --- | --- | --- |
| Tanumi | `apps/tanumi-web/app/[locale]/guides/how-to-make-a-gif-smaller/page.tsx` | 4 类 GIF 样本、32 个输出，比较压缩、缩放、裁剪及组合方案，并链接具体工具 |
| Doruni | `apps/doruni-web/app/[locale]/reference/pdf-mediabox-vs-cropbox/page.tsx` | PDF 示例、示意图、裁剪与恢复实验，以及 Adobe / Apple 来源，链接 PDF 裁剪工具 |

技术组织包括 Next.js 本地化路由、独立 `content.ts`、页面样式和本地示例资产；页面有 canonical、hreflang、社交分享元信息、Article / TechArticle 与面包屑结构化数据，并进入 sitemap。未看到通用文章索引、分类系统或编辑后台。

最值得借鉴的是**内容有独立价值和可检查的证据**：读者看完知道如何选择方法，也能看到处理结果，工具入口自然连接到操作步骤。

其内容边界记录在 `image-pdf/docs/research/keyword-to-content-center-contract.md`：教程、比较、故障排查、使用场景和参考资料可以成为独立内容；工具 FAQ 或关键词变体不自动成为一篇文章。

Scribix 可以先沿用代码管理内容的方式，补上文章索引和可复用文章模板。每篇内容至少包含具体问题、真实输入与输出、关键步骤或判断依据，以及相关功能入口。

## 3. Scribix 当前基础与内容边界

9 月 7 日研究时首页定位为 AI Video Clipper / Turn Long Videos into Shorts。现有 SEO 页面仍主要覆盖 video-to-text、audio-to-text、mp3-to-text、youtube-to-transcript 和 ai-note-taker，尚未看到 Blog 路由与内容索引。

实施时需要遵守以下事实边界：

- 首页当前使用本地文件上传。YouTube 字幕导入能力不能证明「粘贴 YouTube URL 自动切片」已可用；相关落地页必须先核实实际产品流程。
- 首页媒体的真实产品输出与演示素材有不同证据边界，见 [homepage-media.md](../homepage-media.md)。人工选择的片段不能描述成自动选片的效果证明。
- `free`、`no watermark`、导出额度、处理时长等承诺必须符合实际套餐和功能。
- 新文章只为实际发布的语言版本输出 hreflang，不能因为站点支持某语言就声明文章已有该翻译。
- 存在浏览器扩展发布资产，见 [browser-extension-publishing.md](../browser-extension-publishing.md)，但本次未核实各商店当前上架状态。

## 4. 关键词数据与优先级

### 4.1 数据口径

- **SEMrush**：美国数据库，月搜索量估计；完整记录的更新时间列显示约 1 个月。以下主表统一用这套数据便于比较。
- **Google Ads**：美国、英语、Google，2025-08 至 2026-07 的平均月搜索量区间。广告竞争程度不是 SEO 难度。
- **Similarweb**：美国、Google、All traffic；界面显示最近 28 天，截至 9 月 3 日；`Avg. volume` 的具体平均窗口未单独核实。
- **Google Autocomplete**：英语、美国参数，用于发现真实措辞与意图，不提供搜索量。
- 未取得 Ahrefs 数据和 Google Trends 时间序列。

不同工具的估计和时间窗口不能直接相加或取平均。同义变体可能重叠，不能把表内搜索量加总成可获得流量。缺失 KD 不等于难度为零。

### 4.2 主要机会

| 关键词 | SEMrush 月量估计 | KD | 页面与优先级建议 |
| --- | ---: | ---: | --- |
| podcast clip maker | 50 | 18 | 第一批播客功能页主词 |
| ai podcast clip generator | 70 | 29 | 与播客功能页合并承接 |
| podcast clipper | 30 | 23 | 同上，避免单独建同义页面 |
| podcast clipping | 40 | 12 | 同簇覆盖，结合结果页判断工具 / 服务意图 |
| how to clip podcasts for tiktok | 40 | 24 | 第一批操作教程 |
| convert landscape video to portrait | 110 | 27 | 第一批横屏转竖屏功能页 |
| horizontal video to vertical | 90 | 28 | 与上词合并承接 |
| opus clip alternative | 390 | 26 | 第一批比较方向，先做实测 |
| long video to short video ai | 260 | 38 | 首页核心词簇 |
| long video to shorts | 110 | 35 | 首页核心词簇 |
| ai video clipper | 320 | 76 | 首页定位词，竞争较高 |
| video to reels converter | 40 | 23 | 第二批，需准确匹配转换需求 |
| repurpose io alternative | 70 | 10 | 暂后置，跨平台分发意图与当前能力有差异 |
| vizard alternative | 20 | 缺失 | 后续实测比较，不因 KD 缺失判断容易 |
| webinar repurposing | 20 | 缺失 | 小规模试验，需求可能包含多种内容产出 |

补充观察：

- `add captions to video` 为 1,900 / KD 64，`auto captions` 为 1,900 / KD 76；量较大，但竞争也高，不宜作为第一阶段主攻方向。
- `youtube shorts maker` 为 590 / KD 61，`youtube to shorts` 为 90 / KD 52；后者尤其要确认用户对 URL 导入的预期。
- `how to make podcast clips for instagram` 与 `podcast clips for social media` 均为 20，KD 缺失，可作为后续教程方向。
- `repurpose webinar content` 为 20、`webinar clips` 为 10，KD 均缺失；`ai interview clip generator` 未取得指标，不代表零需求。

### 4.3 跨来源验证与差异

| 关键词 / 词簇 | 补充来源 | 解读 |
| --- | --- | --- |
| opus clip alternative | Google Ads：100–1,000 / 月 | 支持存在替代方案需求 |
| podcast clip maker | Google Ads：10–100 / 月 | 与 SEMrush 50 的量级一致 |
| horizontal video to vertical 及多个近义词 | Google Ads：100–1,000 / 月 | 支持词簇需求，但近义词不可相加；SEMrush 90 与区间存在差异 |
| ai podcast clip generator | Similarweb Avg. volume 212；最近 28 天 940 | 与 SEMrush 70 差异明显，不据此推断增长 |
| long video to shorts | Similarweb Avg. volume 196；最近 28 天 <50 | 与 SEMrush 110 不一致，保留各自口径 |
| how to turn long videos into shorts | Similarweb Avg. volume 131，KD 45；最近 28 天 <50 | 支持教程方向，不能把 131 当作已验证的近期月量 |

Google Ads 的粗区间会伴随 +900% / -90% 等变化显示，本次不将其解释为精确市场趋势。Similarweb 生成列表含不相关词及异常长句，未把列表总量当成产品机会规模。

### 4.4 意图与选题筛选

Autocomplete 出现了 `free`、`no watermark`、`online`、`for TikTok`、`for Instagram`、`CapCut`、`alternative` 等修饰词，可以用来理解顾虑和任务，但不应每个变体生成一个页面。

`podcast clips` 同时包含找娱乐片段、下载素材与制作切片的意图；`interview clips` 还有明显娱乐内容噪声。优先选择 maker、generator、how to 等更贴近创作任务的表达。

暂不优先覆盖：泛 AI video generator / faceless video、与产品无关的素材下载、未兑现的免费无水印承诺，以及只有泛定义或空泛 Top 10 列表的文章。泛知识更可能直接被搜索摘要回答，这是内容策略判断，本次未测量其 AI 搜索点击损失。

## 5. 网站结构与内容顺序

以下为统一路由规划；`/guides`、选片清单和 `/podcast-clip-maker` 已本地实现，其他页面按下文状态推进。

| 路径 | 承接意图 | 内容重点 |
| --- | --- | --- |
| `/` | ai video clipper / long video to shorts | 主功能、实际结果、开始处理入口 |
| `/podcast-clip-maker` | podcast clip maker / generator / clipper | 播客输入、选片、构图、字幕和导出示例 |
| `/horizontal-video-to-vertical` | landscape to portrait / horizontal to vertical | 不同画面类型的竖屏结果和调整方式 |
| `/alternatives/opus-clip-alternative` | opus clip alternative | 官方功能与套餐、工作流差异、适用人群；仅英文 |
| `/guides` 与 `/guides/...` | 教程、故障排查、参考与案例 | 有独立价值的解释和可复现证据 |

实际实现沿用 `app/[locale]` 和当前 URL / i18n 约定。相同意图的 maker、generator、clipper 等词由一个页面承接，避免重复内容和内部竞争。

教程、检查清单统一使用 Guides，不另建 Blog；对比内容单独使用 Alternatives 目录与页脚分组（2026-09-20 用户确认）。名称本身不代表 SEO 优势。Guides 基础设施应包括文章索引、统一布局、作者与日期、目录、相关内容、工具内链、metadata、canonical、按实际翻译生成的 hreflang、结构化数据与 sitemap。第一阶段不必引入编辑后台。

### 首批内容制作顺序

以下关键词量沿用第 4 节，完整标题没有自动继承精确搜索量。发布以证据齐备为准，不强制等前一篇完成才推进独立任务。

| 顺序 | 内容 | 需求依据 | 交付与证据 |
| --- | --- | --- | --- |
| 1 | How to Clip Podcasts for TikTok | SEMrush 40 / KD 24 | `/guides/how-to-clip-podcasts-for-tiktok`；获授权输入、选片理由、边界修正、构图、字幕、真实导出；配套操作演示 |
| 2 | How to Convert Horizontal Video to Vertical Without Cutting Off Speakers | 横屏转竖屏词簇；完整标题未量测 | 裁切与保留全画面的对照；单人、双人和屏幕内容按实际能力说明，不承诺不存在的布局 |
| 3 | Podcast Clip Checklist | 编辑选题，未验证搜索量 | 指代、上下文、答案完整性、广告、重复、标题忠实度的检查方法；正文直接可用，附可打印／下载清单，初期不强制留邮箱 |
| 4 | 一期访谈最终保留哪些片段，为什么 | 编辑选题，未验证搜索量 | 同素材案例、保留／放弃理由和修正前后结果；只有完整计时才写耗时；自有实验不称客户案例 |
| 5 | OpusClip Alternatives for Podcast Clips | opus clip alternative 390 / KD 26；完整标题未量测 | 比较 Scribix、Vizard、quso.ai 与 OpusClip 的官方功能和套餐；复用 Guide 媒体制作专业流程演示，不声称同素材性能测试 |

OpusClip 比较文章与替代方案落地页内容重叠时，先做一个完整页面；有独立搜索意图和内容价值时再拆分。9 月 16 日竞品操作记录是准备材料，尚不足以证明 Scribix 与竞品最终输出的全面对比。

对比内容语言规则（2026-09-20 用户确认）：alternatives / vs 对比文章和落地页仅发布英文，不安排翻译。对比页面在桌面及移动端均不显示语言切换器；仅生成英文 URL、自引用 canonical 和英文 sitemap 条目，不生成其他语言版本或指向这些版本的 hreflang。此规则适用于对比内容，无论放在 `/guides` 还是 `/alternatives`；教程、检查清单及 Guides 索引继续沿用现有多语言规则。首篇已本地实现；带 locale 前缀的 alternatives URL 重定向到英文地址。

对比内容外链规则（2026-09-20 用户确认）：公开页面不添加竞品 URL 或外链；保留来源名称与核查日期，完整来源 URL 只在内部研究／内容记录中维护。

首篇展示口径（2026-09-20 用户确认）：复用现有 Guide 的截图参考、成片与素材，通过重新排版的界面示意、重点标注和交互演示解释功能，不要求重新录制真实操作过程。官方功能比较不以竞品同素材实测为前置；若后续加入准确率、速度或效果优劣结论，则需补对应测试证据。

How to Turn Long Videos into Shorts 改为后续总览候选：原 Similarweb Avg. volume 131 / KD 45、最近 28 天 <50 的证据保留，有独立材料再做，避免与首篇只是换标题。

### 后续选题与维护边界

- 优先围绕播客／访谈的连续任务延伸：开头缺上下文、人物裁掉、字幕挡脸、发布前检查。先用案例中的章节回答，再按独立意图决定是否拆页。
- 平台规格、字幕安全区可小范围做，发布前核查官方来源，标明核查日期；需随规则变化维护。
- Reels、webinar、客户故事按产品能力、授权素材和使用数据再扩展。
- 泛社媒灵感、热点、大规模行业内容和数据研究后置；小样本实验不能包装成行业普遍规律。
- 价格、免费额度和竞品功能比较定期复核；不直接复制竞品过期表格。

## 6. 竞品的非广告获客方式

以下结合 9 月 7 日与 9 月 18 日公开页面观察，证明相关内容和入口存在；历史培训或社群入口不证明当前持续运营。本次没有取得页面流量、渠道贡献、转化率或 ROI 数据。长尾页和比较页本身属于 SEO，另列渠道是为了区分内容建设和内容分发。

| 方式 | 观察到的竞品实践 | Scribix 可以怎么做 |
| --- | --- | --- |
| 平台问题与垂直内容 | Quso 的灵感文章、sermon 任务内容簇；Vizard 的 Shorts 问题指南 | 围绕播客连续任务组织内容，避免无差别扩展泛流量主题 |
| 数据研究 | Opus Research Hub 覆盖发布时间、时长和标签；样本量为厂商自报 | 后续积累透明实验与数据，不把厂商成绩作为我们的效果承诺 |
| 联盟推荐 | 三家都有 affiliate；Repurpose 与 Opus 提供推广素材 / 资源 | 产品转化稳定后找垂直创作者合作；佣金属于获客成本 |
| 免费工具入口 | Repurpose 免费工具库、Vizard 工具矩阵、Opus 工具页 | 优先使用现有可独立完成任务的能力，入口连接切片主流程 |
| 教学视频与培训 | Opus Learning Center；Vizard 工具页教程；Repurpose 支持与培训内容 | 同一份实测素材用于教程文章、YouTube 演示和短片 |
| 社区答疑 | Vizard Discord 入口、Repurpose 培训 / office hours 相关内容 | 先参与现有播客、创作者社区，回答具体问题 |
| 客户故事 | Vizard User Story 内容、Repurpose 客户案例入口 | 经用户授权记录从长视频到发布片段的真实工作流 |
| 可下载资料 | Repurpose 视频规格与变现指南 / cheat sheet | 制作短视频发布检查表、字幕安全区示意、播客选片清单 |
| 平台与生态合作 | Repurpose 跨平台分发定位、YouTube Shorts 专题活动 | 长期方向；先验证产品与目标工作流的匹配 |

9 月 18 日逐项页面、日期和证据限制见 [竞品内容调研](2026-09-18-competitor-content-acquisition.md)。其新增结论已体现在第 5 节制作顺序和第 7 节执行路线。

9 月 7 日来源：

- Repurpose：[免费工具](https://repurpose.io/freetools/)、[联盟推广工具包](https://repurpose.io/your-affiliate-toolkit/)、[YouTube Shorts 专题](https://repurpose.io/grow-youtube-shorts/)、[视频尺寸与时长资料](https://support.repurpose.io/en/article/video-sizes-and-max-lengths-19sx2ra/)、[2026 变现指南](https://repurpose.io/2026-social-media-monetization-guide-cheat-sheet/)、[支持与培训入口](https://support.repurpose.io/en/)。
- OpusClip：[联盟计划](https://www.opus.pro/affiliate)、[联盟资源](https://affiliateresources.opus.pro/)、[Learning Center](https://www.opus.pro/learning-center)、[播客切片工具页](https://www.opus.pro/tools/ai-podcast-clip-generator)。
- Vizard：[联盟计划](https://vizard.ai/affiliate)、[工具库](https://vizard.ai/tools)、[Opus 比较页](https://vizard.ai/alternatives/opus)、[用户故事](https://vizard.ai/blog/category/user-story)、[Webinar 工具页](https://vizard.ai/tools/webinar-repurposing)。

### Scribix 的渠道投入顺序

1. **实操演示、可复用清单、已有社区中的具体问题答疑**：和首批教程共用素材，先验证能否带来实际使用；对外发布按实际授权执行。
2. **浏览器扩展商店入口**：利用现有扩展资产；先核实上架状态、描述和跳转流程，同时考虑字幕用户与切片用户的需求差异。
3. **真实客户案例**：积累可检查、获授权的结果，再用于页面与分发。
4. **小规模联盟推荐、邮件订阅资料**：在转化路径明确后试验；首批无邮箱门槛的清单不等待此阶段，邮件后续触达需用户主动订阅。
5. **自建社区、大型平台合作**：后置，避免初期承担过多持续运营成本。

## 7. 执行路线与当前起步任务

### 按交付条件推进

| 阶段 | 交付内容 | 完成条件 |
| --- | --- | --- |
| 首批 | Guides 基础、播客功能页、TikTok 播客教程、检查清单与配套演示 | 内容与产品事实一致；真实素材和导出可核查；页面及从内容到上传、首次导出的路径可用 |
| 第二批 | 横屏转竖屏功能页与教程、同素材案例；补齐竞品对照实验 | 画面取舍和选片理由有实例；记录限制与人工修正；不以演示代替实测 |
| 证据成熟后 | 发布比较内容；按查询与使用数据决定 Reels / webinar / 字幕内容 | 功能比较核对当日官方资料，效果比较核对实测文件；选题有独立价值，已有页面及时更新 |

这是实施顺序，不是已经完成的交付或固定周数承诺。衡量重点应是首次导出、重复使用和付费转化，同时用搜索曝光、查询词与点击判断覆盖效果。低流量阶段需要积累样本，不能凭几次访问决定方向。

### 首批内容交付状态 — 2026-09-19

本节是内容交付状态的唯一维护入口。Guides、两篇文章和播客功能页已部署到 `https://scribix.io`，覆盖 en/fr/es/it/ja/de，共 24 个页面。

| 内容 | 当前交付 |
| --- | --- |
| Guides 索引与模板 | 两篇同规格卡片、文章目录、作者／日期、工具入口；首页及页脚接入 |
| Podcast Clip Checklist | 7 个审阅章节、16 个勾选项、示意文本及打印／另存 PDF 版式 |
| TikTok 播客教程 | 已公开并进入 sitemap；41 秒截图动画演示、4 张可放大截图、57.43 秒真实成片，可播放及下载 |
| 播客功能页 | 上传入口、清单、套餐互链；免费分钟数由 `lib/plans.ts` 注入 |

正文只维护在 `lib/guides/locales/*.json`，路由、顺序和媒体由 `lib/guides/registry.ts` 统一定义。教程已移除预览标签与 noindex；所有页面使用各语言自引用 canonical 和对应 hreflang，公开文章包含 Article／面包屑结构化数据。五个非英语落地页的重复品牌标题已修正。

发布代码已推送 `origin/main`（`0cf1dc2`、`a2deda2`）；最终 Cloudflare 版本为 `229bd146-643b-4095-bc07-da62983fb18b`。生产构建、六语言字典校验通过；线上 24 个页面及六语言教程 sitemap 已验证，七个 MP4 均可下载，Chrome 中 41 秒演示与 57.43 秒成片可播放。线上媒体 Range 请求返回完整文件，尚未确认分段传输；本地 Range 验证不代表线上支持。搜索引擎实际收录与真实用户性能尚未验证。

演示复用已有项目，没有重新上传、改写字幕或制造前后对照。原始录音、字幕和截图保留原语；用户明确授权使用现有素材上线，但未独立核验源视频的公开再分发许可。素材记录与重制方法见[教程制作备注](../content/how-to-clip-podcasts-for-tiktok.md)，不另建进度表。

素材起点：检查 [首页素材记录](../homepage-media.md) 中的获授权访谈／讲座原片及本地 master 是否仍可用。首页十秒静音循环只适合画面演示，不替代完整有声教程输入；真实项目输出与人工选段展示继续保持区分。先前测试视频也不能仅因用于内部调研就认定可公开使用。

教程先覆盖上传、调整和导出；直接发布到 TikTok 等外部平台的步骤，需相应真实账号全流程验收后再写入。功能、部署与验收状态以 [产品 plan](../roadmap/video-product-plan.md) 和对应技术记录为准。

分析沿用现有平台和事件体系，遵守 [tracking.md](../video-workspace/tracking.md) 与 `lib/video-workspace/analytics-contract.ts`，不新增追踪表或回放基础设施。

### 英文对比页 — 2026-09-20 本地完成，尚未部署

- `/alternatives/opus-clip-alternative` 比较四家工具的适用流程、免费限制、月付价格、编辑与输出；标注官方来源与核查日期。正文和套餐快照在 `lib/alternatives/opus-clip.ts`，Scribix 分钟数和价格引用 `lib/plans.ts`。
- 专业流程演示使用 React/CSS 重排选片、边界／构图、字幕三个场景；复用 Guide 的 export poster 与 57.43 秒成片。没有重新剪片、转写、生成图片或提交社交平台。
- 独立 `/alternatives` 汇总页和页脚 Alternatives 分组；已从 Guides 卡片及 CollectionPage 移除比较文章。对比页导航、返回入口和面包屑归属 Alternatives，正文保留相关教程链接。目录与文章均仅英文、隐藏语言切换器、各自单一 sitemap URL；六种 locale 前缀回到英文 URL，法语 Cookie / Accept-Language 不产生翻译页或 hreflang。
- 验证：`npm run build`（含六语言校验）通过；Chrome ai-publisher 中桌面／390px 手机布局、浅深色演示、点击／键盘切换、FAQ、真实视频播放已检查。独立 localhost 生产预览验证英文路由、索引和 sitemap；无新部署。
- 制作与来源记录见 [对比页内容备注](../content/opus-clip-alternatives.md)。

## 8. 后续需要补齐的证据

- 若新增效果优劣结论，补 OpusClip 与 Scribix 同素材、同任务的实际比较，尤其是选片质量、构图、字幕调整和导出流程；不阻塞当前功能选型文章。
- 当前产品对横屏转竖屏、免费额度、水印、URL 输入等能力和限制的逐项确认。
- 浏览器扩展各商店的实际可访问状态及其到主功能的转化路径。
- 内容上线后的真实查询、点击和使用数据，用于调整优先级。
- 竞品非广告渠道的实际流量贡献与转化数据；现有公开页面证据不足以推断哪个渠道最有效。

原始关键词记录保留了 31 个 SEMrush 候选、Google Ads 区间、Similarweb 选定记录、来源差异与 12 个 Autocomplete 种子结果，见 [研究数据 JSON](2026-09-07-video-seo-keywords.json)。


### 六语言本地化 — 2026-09-18

用户确认直接覆盖现有六语言；随后明确原始播客字幕不需翻译，本轮不再进行音频转写或字幕改写。范围为 Guides 索引、TikTok 教程、可打印检查清单、播客功能页、媒体说明、导航及演示外层文案。源视频、源字幕和真实产品截图共用，页面说明其保留原语。六语言内容已上线，当前状态见上方交付表。

调研针对表达与意图，不包含搜索量、难度或母语用户访谈。法语以法国、日语以日本、德语以德国、意大利语以意大利的材料为主；西语跨地区参考，正文选用易理解的通用表达（video、subir、descargar），不声称代表每个国家的首选词。

| 语言 | 采用的表达与区别 | 直接证据（本轮核查） |
| --- | --- | --- |
| fr | `extraits de podcast` 描述内容片段；`clip vidéo` 表示输出；`cadrage` / `sous-titres`；教程用 créer、importer、télécharger | [Ausha 帮助](https://help.ausha.co/fr/articles/5159114-comment-creer-personnaliser-et-telecharger-le-clip-video-d-un-episode)、[Riverside 法语站](https://riverside.com/fr) |
| es | `clips de podcast` / `videos cortos`；动作用 crear、subir、descargar；`subtítulos` 不与社交帖文说明混淆 | [Clippum](https://www.clippum.com/)、[Filmora 西语创作者教程](https://www.youtube.com/watch?v=YrVRqmihjfs) |
| it | `clip` / `videopodcast` / `video brevi`；动作用 creare、caricare、esportare；画面用 inquadratura | [Spotify 意大利语帮助](https://support.spotify.com/it/creators/article/clips/)、[Francesco Oggiano 的实际创作者用法](https://fraoggiano.substack.com/p/siamo-nella-clip-economy)、[Rai Clip 栏目](https://www.raiplaysound.it/programmi/radio2socialclub/clip/archivio) |
| de | `Podcast-Clips` 为主，`Kurzvideos` / `Hochkantvideo` 说明格式；`Bildausschnitt` / `Untertitel`；直接使用 du | [Podigee 创作者指南](https://www.podigee.com/de/geld-verdienen-mit-podcasts-der-ultimative-guide/)、[ClipFlap 德语页面](https://clipflap.com/de) |
| ja | `切り抜き動画` 表示剪出片段，`ショート動画` 表示短视频格式；`縦型動画` / `字幕` / `書き出す`；避免机械写成「クリップメーカー」 | [日本创作者实操文章](https://note.com/arkb/n/nf349a4d3e411)、[Radio Choppit](https://radio.choppit.studio/) |

以上页面只提供用词证据，不把竞品的音频转视频、链接导入或效果承诺移植到 Scribix。尤其日语与法语资料中有音频可视化场景，本文仍限定视频源剪辑。标题保留具体教程意图，不声称某词搜索量最高。

维护入口：`lib/guides/locales/*.json` 仅存可翻译内容；路由、章节 ID、素材、顺序和草稿状态统一在 `lib/guides/registry.ts`。新增字典已纳入 `npm run check-locales` 的字段、数组与占位符校验。各语言套餐分钟数仍由 `lib/plans.ts` 注入。教程、检查清单和功能页使用同语言链接，所有公开 Guide 内容使用 reciprocal hreflang 与自引用 canonical；草稿仍排除 sitemap。

本地化验收：六语言字典通过字段、类型、数组长度及占位符校验；五个本地化演示均为 41 秒 1920×1080 静音视频并完整解码。Chrome 验证日语／德语 390px 无横向溢出、语言切换保持文章路径、德语视频播放、清单 16 项勾选及 7 节打印内容。生产验证结果统一见上方交付状态。
