# YouTube Shorts Maker：竞品页面与关键词承接调研

调研日期：2026-09-27。范围：英语公开搜索结果与竞品官方网页正文；未固定国家定位。目的：决定 Scribix `/youtube-shorts-maker` 如何承接相关任务，以及参考哪些页面结构。仅调研，没有实施或部署页面。

## 结论

观察到的做法是多个落地页入口承接同一套或相近的剪辑能力，单页同时使用相关关键词。Vizard、Restream 均把 Shorts maker 与 YouTube clip maker 分成两个 URL；Vizard 和 OpusClip 另有 YouTube to TikTok 页面。不能据此认定每个关键词都必须拆页，也不能把四个关键词视为已验证的单一搜索意图。

Scribix 仍建议先制作一个以 Shorts 输出为中心的页面：主词 YouTube Shorts maker，兼顾 YouTube to Shorts 和 YouTube clip maker 中的长视频切片需求。YouTube video to TikTok 作为跨平台复用的辅助内容，不与主词同等定位。未来是否另建 TikTok 页，依据独立内容、产品流程和实际查询决定。这是当前产品阶段的编辑判断，不是已经验证的最优 SEO 架构。

此前对话中“一个页面覆盖所有四词”的结论过于笼统，应以本次核查为准：一个页面可以涵盖相关表达，但并不满足四词的所有任务，也不能承诺获得它们的全部搜索流量。

## 方法与证据边界

- 搜索四个完整词组：YouTube Shorts maker、YouTube to Shorts、YouTube clip maker、YouTube video to TikTok；补充 OpusClip、Vizard、VEED 的站内限定查询。
- 打开下方官方页面，核对主题、正文流程、可读 CTA、相关工具链接。网页文本提取不是视觉布局验收；Vizard 抓取含登录与安全检查模板，未取得可靠首屏 H1，因此不推断其实际首屏输入控件。
- 未操作登录、上传、付费或生成流程；功能与效果均为厂商页面声明，不是实测。未审计 canonical、索引、完整站点 URL 清单或搜索结果重合率。
- 未取得竞品页面级流量、排名、转化率；不能证明拆页比合页效果更好。此次没有新增搜索量或 KD。历史数字仍见 [9 月 23 日调研](2026-09-23-homepage-keyword-global-data.md)，不同来源、统计期不相加。

## 官方页面对照

| 页面 | 实际承接任务与内容重点 | 输入和转化入口（页面声明） | 对我们的启发 |
| --- | --- | --- | --- |
| [Vizard Shorts maker](https://vizard.ai/tools/youtube-video-editor/youtube-shorts-maker) | 现有视频生成 Shorts；模板、说话人构图、字幕、YouTube 导入与发布、引导观众回长视频；教程视频和 FAQ | 正文反复使用 create now；描述 YouTube 集成 | 专门解释 Shorts 场景，不能只替换通用长转短页面的标题 |
| [Vizard clip maker](https://vizard.ai/tools/youtube-video-editor/youtube-clip-maker) | 高光与预告片；自动选片、通过转写文本手动选择和裁剪、下载或发布；与 Shorts 页功能有明显交叉 | 正文描述链接输入及上传；CTA 为 CLIP NOW | 竞品确实拆页，但差异主要在叙述重点，不能将其当成任务完全不同的证明 |
| [Vizard YouTube to TikTok](https://vizard.ai/tools/repurpose-video/youtube-to-tiktok) | 9:16 适配、人物居中、选片和 TikTok 导出；有独立三步操作说明 | 文件上传或 YouTube 链接 | 跨平台方向可形成独立内容；目前无需为它在 Shorts 页堆同等分量 |
| [Restream Shorts maker](https://restream.io/tools/youtube-shorts-maker) | 长视频生成 Shorts、编辑个性化、发布、从 Studio 录制新内容；FAQ 解释讲话素材适配和免费体验 | 顶部 Upload video，明确 spoken audio 和文件限制 | 文件上传也可以做 Shorts maker；这是最贴近 Scribix 当前输入方式的参考 |
| [Restream clip maker](https://restream.io/tools/youtube-clip-maker) | 标题为 clip maker，首段和正文直接讲制作 Shorts；与 Shorts maker 页使用相近模块 | 同样是 Upload video | 两词有明显交叉，且 clip maker 不必然意味着 URL 输入 |
| [Restream video to TikTok](https://restream.io/tools/video-to-tiktok-converter) | 上传讲话视频，选片、竖屏、字幕和 TikTok 发布 | 同样的上传入口；相关工具区互链 | 多入口可以共用产品；这不是每页拥有不同产品的证据 |
| [OpusClip Shorts editing tool](https://www.opus.pro/tools/youtube-shorts-editing-tool) | 从已有 YouTube 视频提取片段；自动裁切、构图、字幕；功能、步骤、证明和 FAQ | 链接输入、Create YouTube Shorts、文件上传、演示入口 | 首屏可将输入、输出和示例放在一起，减少阅读后才理解任务的成本 |
| [OpusClip YouTube to TikTok](https://www.opus.pro/tools/turn-youtube-video-to-tiktok) | 独立强调 YouTube 来源到 TikTok 输出；9:16、字幕、导出或发布 | 链接输入，四步操作 | 这是与 Shorts 页分开的真实入口，不能声称竞品把所有平台词都压在一页 |
| [Opus Agent Shorts maker](https://www.opus.pro/agent/workflows/youtube-shorts-maker) | 提示词、脚本、提纲或文章生成新视频，包含配音与视觉素材 | Get started for free；描述创作想法 | 同名关键词混合生成和剪辑意图；Scribix 需在标题说明 from your videos |
| [VEED Shorts maker](https://www.veed.io/tools/ai-video/youtube-shorts-maker) | 同页同时讲长视频切片和文字生成新视频；三步流程、编辑功能、FAQ | 首部提取到 Make with AI；正文指向 AI Clips 的上传、生成、下载或编辑流程 | 可借鉴三步流程；不照搬超出 Scribix 能力的文字生成、配音等内容 |

Restream Shorts 页的相关工具区直接链接 clip maker 和 TikTok converter；Vizard 导航同时列出 clip maker 与 Shorts maker。这些是入口组织证据，不是排名效果证据。

## 四词如何处理

| 词 | 本次观察 | Scribix 本页建议 |
| --- | --- | --- |
| YouTube Shorts maker | 既有长视频切片，也有从文字生成新视频 | Title/H1 主词；副标题明确已有视频文件 |
| YouTube to Shorts | 转换已有素材；搜索抽样出现主打粘贴 YouTube 链接的专页 | 覆盖转换过程，但文件上传说明应靠近 CTA，不能只有 FAQ 才揭示限制 |
| YouTube clip maker | Vizard 侧重高光/文本选段，Restream 直接讲 Shorts | 自然用于选片说明；不用它再机械复制一页 |
| YouTube video to TikTok | OpusClip/Vizard 有独立平台转换页 | 本页仅放简短复用说明或 FAQ；后续有独立内容再拆 |

YouTube to Shorts 补充发现：[ChunkyMonkey](https://chunkymonkey.io/youtube-to-shorts) 搜索摘要主打链接输入；正文抓取失败，仅作候选表达证据，不采信数量或质量承诺。没有计算四组查询的固定地域前十结果重合率，因此不宣称已用 SERP 数据证明应合并或拆分。

## 建议页面 brief

- URL：`/youtube-shorts-maker`。
- Title 方向：`YouTube Shorts Maker — Turn Your Videos into Shorts | Scribix`。
- H1 方向：`YouTube Shorts Maker for Your Long Videos`。
- 首屏：说明从已有讲话视频中找片段；上传按钮；紧邻说明当前使用本地文件；放一个可播放的真实竖屏成片示例。
- 示例：长视频来源 → 一个完整观点或回答 → 竖屏成片。说明为何选择这个片段、开头是否可独立理解、结尾是否完整，不把人工选段演示当成 AI 效果实测。
- 三步：上传原文件 → 审阅 AI 候选并按权限调整 → 导出 MP4。清楚区分免费原始候选导出和付费编辑。
- Shorts 专属检查：开头上下文、切点、人物构图、字幕可读性、输出时长；平台允许范围和 Scribix 当前能力分开说明。
- 辅助复用：同一竖屏片段可作为 TikTok/Reels 素材，但须按目的地检查和发布；不承诺已完成全平台发布验收。
- FAQ：能否粘贴 YouTube 链接、支持什么素材、免费可做什么、能否调整切点和字幕、是否保证生成数量、是否可用于 TikTok。
- 内链：通用长转短页、播客功能页、横转竖 Guide、定价。通用长转短页解释整体任务，本页围绕 Shorts 成片和发布前检查建立独立价值。

## 不沿用的竞品说法

- 不复制固定成片数量、爆款概率、节省倍数和字幕准确率，除非另有可复核实测。
- Vizard Shorts FAQ 和 OpusClip 编辑页仍把 60 秒写成 Shorts 的平台上限；不能照搬。核查当日 [YouTube 官方说明](https://support.google.com/youtube/answer/15424877?hl=en) 支持最长三分钟，并说明正方形/竖屏及上传日期条件。Restream 的 60 秒可能是产品输出范围，不应一概判定为平台事实错误。
- 仓库 [产品状态](../roadmap/video-product-plan.md) 仍记载本地文件输入、原视频 URL 导入未接入；本地实现的时长选择/手动片段范围不等于已完成生产验收。写作前应核实实际可用流程，不把平台三分钟上限写成 Scribix 可生成三分钟。
- Shorts maker 和 clip maker 不等于原生 YouTube Clips 分享链接；不要混淆可下载新成片与平台自带的分享片段。

后续页面实施与上线状态仍在 [统一内容规划](2026-09-07-blog-seo-acquisition-summary.md) 维护。本记录仅提供研究与制作建议。
