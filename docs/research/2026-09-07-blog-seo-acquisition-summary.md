# Scribix Blog、长尾 SEO 与非广告获客调研总结

调研日期：2026-09-07。关键词范围：美国市场、英语搜索。本文整理本次项目代码检查、竞品公开页面研究，以及用户已打开的 Google Ads Keyword Planner、SEMrush、Similarweb 数据。

状态：研究与建议，尚未实现或发布本文提出的页面。关键词原始记录见 [video-seo-keywords.json](./2026-09-07-video-seo-keywords.json)。

## 1. 核心结论

Scribix 应围绕「把长视频变成可发布的短视频」建立内容中心。第一阶段组合是：少量高意图功能落地页、包含真实操作证据的教程与比较文章，再把这些内容用于 YouTube 演示、社区答疑和客户案例传播。

建议优先顺序：

1. **播客切片**：建立 podcast clip maker 页面，并用 TikTok / Instagram 操作教程支撑。
2. **横屏转竖屏**：建立功能页，展示人物、双人对话、演示文稿等实际构图结果。
3. **OpusClip 替代方案**：有搜索需求，且难度估计相对可控；完成同素材实测后再发布比较页。
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

研究时首页定位为 AI Video Clipper / Turn Long Videos into Shorts。现有 SEO 页面仍主要覆盖 video-to-text、audio-to-text、mp3-to-text、youtube-to-transcript 和 ai-note-taker，尚未看到 Blog 路由与内容索引。

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

## 5. 建议的网站与 Blog 结构

以下路径均为建议，尚未实现。

| 路径 | 承接意图 | 内容重点 |
| --- | --- | --- |
| `/` | ai video clipper / long video to shorts | 主功能、实际结果、开始处理入口 |
| `/podcast-clip-maker` | podcast clip maker / generator / clipper | 播客输入、选片、构图、字幕和导出示例 |
| `/horizontal-video-to-vertical` | landscape to portrait / horizontal to vertical | 不同画面类型的竖屏结果和调整方式 |
| `/alternatives/opus-clip` | opus clip alternative | 同素材实测、工作流差异、适用人群 |
| `/blog` 与 `/blog/...` | 教程、故障排查、参考与案例 | 有独立价值的解释和可复现证据 |

实际实现沿用 `app/[locale]` 和当前 URL / i18n 约定。相同意图的 maker、generator、clipper 等词由一个页面承接，避免重复内容和内部竞争。

Blog 基础设施应包括文章索引、统一布局、作者与日期、目录、相关内容、工具内链、metadata、canonical、按实际翻译生成的 hreflang、结构化数据与 sitemap。第一阶段不必引入编辑后台。

### 第一批四篇内容

| 内容 | 需求依据 | 必须准备的证据 |
| --- | --- | --- |
| How to clip podcasts for TikTok | SEMrush 40 / KD 24 | 原始素材、选片理由、构图、字幕、导出完整过程 |
| How to turn long videos into shorts | Similarweb Avg. volume 131 / KD 45，最近 28 天 <50 | 展示为什么选择这些片段，以及何时需要调整 |
| How to convert horizontal video to vertical without cutting off speakers | 来自横屏转竖屏词簇；完整标题不是已验证的精确关键词 | 单人、双人、演示文稿的实际处理结果 |
| OpusClip vs Scribix for podcast clips | 来自 opus clip alternative 390 / KD 26；完整标题未单独量测 | 同一输入素材，记录日期、套餐、步骤、输出与限制 |

OpusClip 比较文章与替代方案落地页内容重叠时，应先做一个完整页面；有独立搜索意图和内容价值时再拆分。

后续可探索字幕安全区、自动与人工选片、webinar 切片案例、发布前检查表。没有实测搜索量的标题应标记为编辑选题，不能包装成已验证关键词。

## 6. 竞品的非广告获客方式

以下依据公开渠道和页面观察，证明竞品正在使用这些方式；本次没有取得渠道贡献、转化率或 ROI 数据。长尾页和比较页本身属于 SEO，另列渠道是为了区分内容建设和内容分发。

| 方式 | 观察到的竞品实践 | Scribix 可以怎么做 |
| --- | --- | --- |
| 联盟推荐 | 三家都有 affiliate；Repurpose 与 Opus 提供推广素材 / 资源 | 产品转化稳定后找垂直创作者合作；佣金属于获客成本 |
| 免费工具入口 | Repurpose 免费工具库、Vizard 工具矩阵、Opus 工具页 | 优先使用现有可独立完成任务的能力，入口连接切片主流程 |
| 教学视频与培训 | Opus Learning Center；Vizard 工具页教程；Repurpose 支持与培训内容 | 同一份实测素材用于教程文章、YouTube 演示和短片 |
| 社区答疑 | Vizard Discord 入口、Repurpose 培训 / office hours 相关内容 | 先参与现有播客、创作者社区，回答具体问题 |
| 客户故事 | Vizard User Story 内容、Repurpose 客户案例入口 | 经用户授权记录从长视频到发布片段的真实工作流 |
| 可下载资料 | Repurpose 视频规格与变现指南 / cheat sheet | 制作短视频发布检查表、字幕安全区示意、播客选片清单 |
| 平台与生态合作 | Repurpose 跨平台分发定位、YouTube Shorts 专题活动 | 长期方向；先验证产品与目标工作流的匹配 |

来源：

- Repurpose：[免费工具](https://repurpose.io/freetools/)、[联盟推广工具包](https://repurpose.io/your-affiliate-toolkit/)、[YouTube Shorts 专题](https://repurpose.io/grow-youtube-shorts/)、[视频尺寸与时长资料](https://support.repurpose.io/en/article/video-sizes-and-max-lengths-19sx2ra/)、[2026 变现指南](https://repurpose.io/2026-social-media-monetization-guide-cheat-sheet/)、[支持与培训入口](https://support.repurpose.io/en/)。
- OpusClip：[联盟计划](https://www.opus.pro/affiliate)、[联盟资源](https://affiliateresources.opus.pro/)、[Learning Center](https://www.opus.pro/learning-center)、[播客切片工具页](https://www.opus.pro/tools/ai-podcast-clip-generator)。
- Vizard：[联盟计划](https://vizard.ai/affiliate)、[工具库](https://vizard.ai/tools)、[Opus 比较页](https://vizard.ai/alternatives/opus)、[用户故事](https://vizard.ai/blog/category/user-story)、[Webinar 工具页](https://vizard.ai/tools/webinar-repurposing)。

### Scribix 的渠道投入顺序

1. **YouTube 实操演示、已有社区中的具体问题答疑**：和首批教程共用素材，先验证能否带来实际使用。
2. **浏览器扩展商店入口**：利用现有扩展资产；先核实上架状态、描述和跳转流程，同时考虑字幕用户与切片用户的需求差异。
3. **真实客户案例**：积累可检查、获授权的结果，再用于页面与分发。
4. **小规模联盟推荐、可下载资料**：在转化路径明确后试验；邮件后续触达需用户主动订阅。
5. **自建社区、大型平台合作**：后置，避免初期承担过多持续运营成本。

## 7. 建议执行路线

| 阶段 | 交付内容 | 验证重点 |
| --- | --- | --- |
| 第 1–2 周 | Blog 基础、播客功能页、TikTok 播客教程及配套演示视频 | 页面可索引；从内容到上传和首次导出的路径可用 |
| 第 3–4 周 | 横屏转竖屏功能页与教程；完成 OpusClip 同素材测试 | 结果准确、内容与功能匹配、比较有证据 |
| 第 2 个月 | 发布比较内容，按实际数据决定 Reels / webinar / 字幕选题 | 查询词、内容引流后的首次导出、重复使用与付费转化 |

这是建议排期，不是已经开始执行的计划。衡量重点应是首次导出、重复使用和付费转化，同时用搜索曝光、查询词与点击判断覆盖效果。低流量阶段需要积累样本，不能凭几次访问决定方向。

分析沿用现有平台和事件体系，遵守 [tracking.md](../video-workspace/tracking.md) 与 `lib/video-workspace/analytics-contract.ts`，不新增追踪表或回放基础设施。

## 8. 后续需要补齐的证据

- OpusClip 与 Scribix 同素材、同任务的实际比较，尤其是选片质量、构图、字幕调整和导出流程。
- 当前产品对横屏转竖屏、免费额度、水印、URL 输入等能力和限制的逐项确认。
- 浏览器扩展各商店的实际可访问状态及其到主功能的转化路径。
- 内容上线后的真实查询、点击和使用数据，用于调整优先级。
- 竞品非广告渠道的实际流量贡献与转化数据；现有公开页面证据不足以推断哪个渠道最有效。

原始关键词记录保留了 31 个 SEMrush 候选、Google Ads 区间、Similarweb 选定记录、来源差异与 12 个 Autocomplete 种子结果，见 [研究数据 JSON](./2026-09-07-video-seo-keywords.json)。
