# Long Video to Short Video AI：引用核查与内容建议

本轮建议：继续做独立 `/long-video-to-short-video-ai` 功能页，优先呈现真实的「长素材 → AI 候选 → 人工修正 → 竖屏成片」过程。页面应回答素材适用范围、选择依据、可修改项和导出限制。完成真实示例后，再配一篇操作教程。

这是根据本轮可观察回答提出的内容建议，不是 AI 推荐机制或排名因素的因果结论。

## 范围与证据口径

- 关键词：`long video to short video AI`，英文问答，不附加国家限制。
- 用户确认 Q1：**What AI tools can turn a long video into short clips?**
- 用户确认 Q2：**How do I turn a one-hour video into short videos for social media?**
- 采样／核查日期：2026-09-23，Australia/Melbourne（AEST，UTC+10）。
- 有效样本：**6 / 6**；每题分别在 Claude、Gemini、ChatGPT 的空白新对话提交一次，未追问或重生成。
- 模式：Claude Opus 5.5 / Medium / Manual；Gemini Flash-Lite；ChatGPT 可见 Medium，未显示模型名。未更改既有设置。
- 全部回答为英文。Gemini 回答末尾的澄清问题原样保存，未继续回答。
- 来源：74 条主采集记录，去重 **58 个网页**；Claude 答案末尾另有 7 条重复来源，合计 81 次可见网页来源出现。ChatGPT 的 1 条记忆来源单独计算。
- 核查：**18 个正文直接引用网页全部已读取**；另读 **1 个仅列表出现的对照网页**；共 19 个网页。其余 39 个只在列表出现的网页未逐页核查。优先核查正文断言，对照选择跨平台重复出现的 Vizard 榜单。
- 补充阅读 2 份本地产品记录；它们不是 AI 回答引用来源，也不算网页核查数量。

## 主要发现

### 1. 工具发现和操作问题需要不同深度的答案

| 样本 | 主要结果 | 引用情况 |
|---|---|---|
| Claude Q1 | 最后建议 OpusClip、Choppity、Loopdesk、CapCut；正文另列多款工具 | 7 个直接引用网页，多为厂商榜单 |
| Gemini Q1 | 推荐 OpusClip、Klap、CapCut、Vmaker AI、FlexClip、Adobe Express | 5 个直接引用网页，均为产品功能页；Adobe Express 没有对应自家来源 |
| ChatGPT Q1 | 首选比较 OpusClip、Vizard、Klap；另列 Submagic、Descript、quso.ai | 6 个已确认直接引用网页，另有 1 个未知折叠映射；来源面板 49 行 |
| Claude Q2 | 转写、选完整片段、裁切、字幕、包装、导出；推荐自动与手动工具 | 无可见网页引用 |
| Gemini Q2 | 自动与手动两种路径，含人工复核步骤 | 3 个直接引用网页 |
| ChatGPT Q2 | 八步工作流，强调片段能独立理解与人工审核 | 未点名具体工具，无可见网页引用 |

观察：Q1 三家都推荐 OpusClip；Q2 中只有 Claude、Gemini 点名产品。Scribix 在六份回答中均未出现。上述次数仅描述本轮样本，不是稳定推荐率。原文与对话链接见[采样记录](character-survey.md)。

### 2. 独立功能页确实进入了本轮引用链

观察：Gemini Q1 引用了 OpusClip 的长转短页面；Q2 又用同一页支持上传、AI 分析、人工修改和导出步骤。[P10：OpusClip 功能页](https://www.opus.pro/tools/long-video-to-short-video-ai)

ChatGPT Q1 则引用了 Klap 的 long-video-to-short-video-converter 页面和 Vizard 的 auto-video-editor 页面。[P16：Klap](https://klap.app/tools/long-video-to-short-video-converter)、[P15：Vizard](https://vizard.ai/tools/auto-video-editor)

推断：这个任务适合一个清晰的功能页承接；其中的具体操作、输入输出和限制都能成为独立可引用的信息。不能据此断言关键词 URL、FAQ 或固定段落结构必然提高推荐。

### 3. 页面需要交代 AI 之后的人工工作

观察：三份 Q2 回答都包含人工检查或修改；两份 Q1 回答建议拿同一份素材比较实际可用片段。可借鉴的判断包括：能否独立理解、开始和结束是否完整、字幕需修正多少、取景是否正确。[C-Q2、G-Q2、T-Q2 原文](character-survey.md)

来源端也有具体支持：Restream 写明适用讲话素材及人工调整；Recapo 讨论内容类型差异和候选采用情况。[P20：Restream](https://restream.io/tools/long-video-to-short-video-ai)、[P19：Recapo](https://recapo.cn/blog/best-ai-clip-generators/)

推断：Scribix 应优先展示为什么保留某一片段，以及哪些地方经过修正。可把「完整意思、可修改、可导出」作为页面解释重点；不能宣称已证实优于竞品。

### 4. 被引用不等于有可靠的实测证据

观察：Clippingnet 页面标题声称 Tested and Compared，但测试日期、测试者、各工具采用数量与耗时还保留未填写占位符。它可以支持“页面如此描述 Submagic／Descript”，不能证明已完成对比实验。[P17：Clippingnet](https://clippingnet.com/ai-video-clipping-tools/)

观察：Ssemble 榜单明确把 CapCut 描述成没有 AI 自动选片；Claude Q1 的 CapCut 句子却把它与 CapCut 自家文章一起引用来支持自动识别片段。两来源存在冲突，不能合并成一致证据。[P07：Ssemble](https://www.ssemble.com/blog/best-clipping-software-2026)、[P03：CapCut](https://www.capcut.com/resource/top-8-tools-for-turning-long-videos-to-shorts)

观察：Gemini Q1 将 Adobe Express 和 FlexClip 并列，但只给出 FlexClip 来源；Q2 将多个工具并列时仅引用 OpusClip。出处并不支持该段全部品牌。FlexClip 页面也未给出“多数人静音观看”或字幕显著提升留存的测试数据。[P14：FlexClip](https://www.flexclip.com/tools/ai-long-video-to-short-video/)

推断：优先补真实素材、修改记录与成片，比复制“最快”“爆款”“几十秒生成”之类未经本产品验证的说法更有依据。本轮未测任何工具速度、效果或转化。

## 正文引用页面核查

下表“支持”只表示页面存在对应说明，**不表示功能效果经本轮实测验证**。所有页面于 2026-09-23 核查。功能页没有可见更新日期的，统一记为未标注；不把版权年份当成内容日期。最终 URL 使用实际读取或浏览器跳转后的地址。

| 页面 ID／最终 URL与标题 | 样本与断言 | 类型／作者关系 | 页面证据与内容日期 | 支持程度 | 可借鉴内容与限制 |
|---|---|---|---|---|---|
| P02 [9 Best AI Video Clipping Tools…](https://vizard.ai/blog/9-best-ai-video-clipping-tools-2026) | C-Q1：Vizard 全流程、OpusClip 高产、Premiere 精修 | 厂商榜单；Vizard Team | 2026-05-12；列测试维度、三类素材、各工具适用对象，自家排第一 | 支持其定位描述；优劣排名仅为作者判断 | 借鉴按使用目的比较；不能当独立评测 |
| P03 [Top 8 AI Video Tools…](https://www.capcut.com/resource/top-8-tools-for-turning-long-videos-to-shorts) | C-Q1：CapCut 自动识别／字幕／免费 | 厂商榜单；署名 CapCut | 2026-04-24；功能说明、三步流程，FAQ 声称免费功能丰富 | 页面支持功能与免费宣传；无当前账户额度实测 | 借鉴输入到输出步骤；免费范围需在产品内确认 |
| P04 [11 Best AI Video Editors…](https://www.choppity.com/blog/best-ai-video-editors-content-creators/) | C-Q1：Choppity 指定找片条件、发布、分析；Kapwing 水印 | 厂商榜单；Michael Wong，页尾明确 Founder & CEO | 发布 2026-03-11，更新 2026-06，价格核对日期 06-10；截图说明、测试方法及案例陈述 | 支持页面所写功能；无独立效果验证 | 自家条件指令和编辑过程表达具体；有直接商业关系 |
| P05 [11 Best AI Clip Makers…](https://www.choppity.com/blog/best-ai-clip-maker/) | C-Q1：Choppity 找片到发布流程 | 同一厂商／创始人榜单 | 发布 2026-06-10，更新 2026-06；明确自然语言条件、预览、字幕编辑、发布入口 | 支持描述，排名与案例是厂商自述 | 借鉴候选审阅截图；与 P04 不是两份独立证据 |
| P07 [12 Best Clipping Software…](https://www.ssemble.com/blog/best-clipping-software-2026) | C-Q1：$7.50/月组合功能、Descript 文本编辑、CapCut 自动选片 | 厂商榜单；Ssemble，未见个人署名 | 2026-03-20，页尾更新 2026-03；有套餐表和功能分工 | Ssemble／Descript 描述有支持；CapCut 自动选片与本文明确相反 | 起价未在当前结账核验，计费周期范围不能自行补齐 |
| P08 [OpusClip homepage](https://www.opus.pro/) | C-Q1、T-Q1：ClipAnything、取景、字幕、API／发布 | 官方首页；Opusclip Inc. | 内容日期未标注；列模型、API、功能演示及发布说明 | 支持功能宣传；跨题材可靠性与速度未验证 | 借鉴展示输入与输出、具体能力名称；营销最高级不是事实 |
| P09 [Best AI Clipping Tools in 2026…](https://loopdesk.ai/blog/best-ai-clipping-tools-2026) | C-Q1：五步处理流程、定向选片 | 厂商博客；Mateo Delgado，Short-Form Video Producer，个人雇佣关系未进一步查证 | 发布 2026-07-31，更新 09-04；给出可操作提示词与同素材测试陈述 | 支持页面的流程与定位；不证明通用性能 | 自家排名第一，有商业动机；定向选择可用例子解释 |
| P10 [Long Video to Short Video AI](https://www.opus.pro/tools/long-video-to-short-video-ai) | G-Q1、G-Q2：选片、编辑、上传与导出 | 官方功能页 | 未标注；四步 how-to，字幕／取景，FAQ 可调整时长与加字幕 | 核心流程支持；一小时耗时、30–90 秒范围、所有并列品牌未完整支持 | G2-03 弹窗节选谈转写，与 clipping 步骤不完全匹配；正文另有上传说明。G1-01 弹窗落在证言区 |
| P11 [AI Clip Generator…](https://klap.app/tools/ai-clip-generator) | G-Q1：10+ clips、速度、评分、取景、字幕 | 官方功能页；Klap / ZIGG SAS | 未标注；三步流程、52 语言、自述 30 秒及免费 1 视频 | 页面支持这些宣传；未测速度、质量及免费实际流程 | FAQ 又说 30 秒到数分钟；不能把最短时间当所有素材保证 |
| P12 [Transform Long Video to Short Clips](https://www.capcut.com/tools/ai-long-video-to-short-video) | G-Q1：识别高光、多语言、场景分析 | 官方功能页 | 未标注；功能、素材入口、输出审核 FAQ | 支持核心描述；“swift”无计时证据 | 页面明确生成后需检查字幕、取景与故事；免费可用性要求到编辑器确认 |
| P13 [Free Long Video to Short Video AI Converter](https://www.vmaker.com/tools/long-video-to-short-video-ai) | G-Q1：播客、访谈、webinar 转短片 | 官方功能页；Animaker Inc. | 未标注；三步过程、关键词选片、时长档位、字幕与编辑说明 | 支持用途；“minimal effort”未测 | 借鉴可选择的条件和素材类型，不复制固定产量和速度 |
| P14 [AI Long to Short Video Converter](https://www.flexclip.com/tools/ai-long-video-to-short-video/) | G-Q1：FlexClip & Adobe Express；G-Q2：字幕提高留存 | 官方功能页；PearlMountain | 未标注；说话人取景、字幕、三步流程、2 小时输入上限、常见 5–10 片段的自述 | FlexClip 功能支持；Adobe Express 不支持；静音比例与留存效果未提供证据 | 借鉴格式、时长、输出解释；不可把宣传当量化研究 |
| P15 [Auto Video Editor…](https://vizard.ai/tools/auto-video-editor) | T-Q1：Vizard 自动剪辑、更多文本控制 | 官方功能页 | 未标注；当前页面强调 Agent 指令、独立片段、修改与导出 | 自动剪辑和控制部分支持；未找到 text-based 原措辞 | 功能名称／版本已变；P01 有文本编辑，但仅作补充对照，不能替换原引用链 |
| P16 [Long Video to Short Video Converter](https://klap.app/tools/long-video-to-short-video-converter) | T-Q1：上传长片、自动找片、导出 | 官方功能页 | 未标注；支持格式／4 小时上限的自述，三步流程，提示词选片 | 工作流支持；全部限制、质量、速度未实测 | 适合借鉴输入条件、可修改项和明确输出；不采用流量增长倍数 |
| P17 [Best AI Video Clipping Tools: Tested and Compared](https://clippingnet.com/ai-video-clipping-tools/) | T-Q1：Submagic 精修、Descript 文本编辑 | 商业产品方的比较文章；Clippingnet team，页面披露自家做手动 clipper | 更新／价格读取日 2026-09-19；正文有两工具定位；测试者、日期、分数与耗时未填写 | 支持定位陈述；“已实测排名”无法核实 | 可以借鉴评价问题，不能把标题当作实验已完成；+1 来源仍未知 |
| P18 [Best AI to Turn Long Videos Into Shorts](https://marvienta.com/tasks/turn-long-videos-into-shorts) | T-Q1：quso.ai 剪辑加排期 | 工具目录／编辑团队；自称独立，利益关系未进一步验证 | 更新 2026-08-30；标为 Research-Based Guide；明确 quso.ai 排期组合 | 支持该描述；非产品实测 | 按用户瓶颈选工具；价格及低视频量不值得付费的结论不能直接泛化 |
| P19 [Best AI Clip Generators…](https://recapo.cn/blog/best-ai-clip-generators/) | T-Q1：讲话内容、转写到候选流程 | 产品方 Recapo 的内容页；未见个人署名 | 发布 2026-07-06，更新 08-18；讲内容密度、采用情况、字幕纠错、人工审查 | 支持其流程说明；不是所有模型统一机制的证明 | 可借鉴保留率和修正成本的测量思路；不能从标题推出已测完成 |
| P20 [AI Long Video to Short Video Converter](https://restream.io/tools/long-video-to-short-video-ai) | G-Q2：长视频自动高光、取景、字幕 | 官方功能页；Restream | 未标注；上传区注明讲话音频／2GB；FAQ 区分讲话与无讲话素材；编辑／下载 | 核心功能描述支持；“几分钟”无计时实验 | 适用和不适用输入边界写得清晰，适合借鉴 |

## 来源列表对照与补充核查

| 来源 | 类别 | 选择原因 | 观察 | 不能据此推断 |
|---|---|---|---|---|
| P01 [The Anti–AI-Slop Playbook…](https://vizard.ai/blog/best-ai-video-clipping-tools-2026) | 仅来源列表对照；C1-01／T1-20 | 两平台列表重复出现，正文均未明确引用 | 2026-02-04，Yao Wang，作者介绍明确属于 Vizard；按场景分工、介绍文本编辑，自家排第一 | 不能补造正文映射，也不能把重复出现解释成稳定权威 |
| [Scribix 产品计划](../../roadmap/video-product-plan.md) | 本地补充产品记录 | 避免照抄竞品能力 | 2026-09-23 状态核对：本地上传、AI 候选、编辑与单片导出已有；YouTube 原视频 URL 导入未接入；批量导出、内部删句、双人分屏未形成用户流程 | 代码／记录存在不证明生产全流程已验收 |
| [Homepage media](../../homepage-media.md) | 本地补充素材记录 | 确认案例能证明什么 | Hero 用现有 Vision-Future-compressed 素材与成片，发布状态是视觉示意；静态图为生成示意 | 不当作真实社交发布验收、速度实测或客户证言 |

## 推荐与引用的区别

- Recapo 是 ChatGPT Q1 的正文来源，但未列入其工具推荐；来源出现与推荐是两件事。
- Vizard P01 出现在两个来源列表中，属于列表观察；不能把它登记成两次正文引用。
- Gemini 推荐 Adobe Express，但所附 FlexClip 链接无法确认该品牌能力；这是实际映射缺口。
- ChatGPT Q1 的 Clippingnet `+1` 打开后只显示总体 Activity 列表，未取得第二来源与该句的确切关系。Highstyle 虽在面板中，仍保留为“仅来源列表可见”。
- Q2 没有引用的回答仍是有效观察样本；其中 5–15 可用片段、20–90 秒等经验数字没有在回答中提供证据，不能写成 Scribix 保证。

## 优先内容行动

| 优先级 | 用户需求 | 建议页面／内容 | 证据 | 自家需核实的事实 | 真实示例 |
|---|---|---|---|---|---|
| P0 | 我已有长视频，哪个工具能帮我做短片？ | 独立功能页 `/long-video-to-short-video-ai`，清晰展示上传、候选、可修改项、MP4 输出 | G-Q1/G-Q2 的 P10；T-Q1 的 P16；G-Q2 的 P20 | 生产输入限制、套餐／水印／编辑权限、字幕和构图可靠性 | 同一原素材时间段与最终导出并排；标注修正过的起止／字幕／裁切 |
| P0 | AI 选出来的片段是否能独立看懂？ | 功能页内的候选审阅案例及 FAQ | 三份 Q2；P19；P12 的复核建议 | 候选完整性、允许零候选、用户能修改哪些部分 | 一个保留片段和一个被放弃片段；说明缺上下文或重复等理由 |
| P1 | 我如何实际完成一次长转短？ | 操作教程：`How to Turn a Long Video into Short Clips for Social Media` | Q2 工作流；P10/P20 | 按当前 UI 验证完整流程、素材权利、导出结果 | 一次从上传到实际 MP4 的可复现录制；列真实耗时及人工改动 |
| P2 | 我怎样比较几个候选工具？ | 先在教程附小型检查表；有实测再决定独立对比内容 | T-Q1 的同素材建议、P17 的测试缺口、P19 | 相同源文件、同等目标、工具版本／套餐和测试日期 | 候选数、采用数、字幕修正数、人工修改分钟数及真实输出 |

### 功能页具体建议

建议 H1：**Turn Long Videos into Short Clips with AI**。核心输入是用户已有的长视频。页面可按以下顺序展开；这是内容提案，尚未编写或实现页面：

1. **用途与 CTA**：明确面向播客、访谈、课程和 webinar 等讲话素材；入口使用已支持的本地文件上传。
2. **真实结果**：一段源视频与最终带字幕竖屏成片，写清来自哪一期、哪个时间段；示意动画与真实导出分开标注。
3. **四步流程**：Upload → Review AI-selected clips → Refine captions and framing → Export。用实际界面解释每步需要用户做什么。
4. **如何判断片段可用**：有开场、有完整意思、有结束；展示实际审阅和修正，不保证固定数量或“必火”。
5. **输入输出与限制**：格式、大小、时长、可选短片长度、语言、导出分辨率、免费额度／水印及编辑权限。数字从现行配置和真实流程核对后再写。
6. **FAQ**：能否处理一小时素材？适合哪些内容？可以修改哪些部分？会生成多少片段？怎样导出？免费方案包含什么？对当前不支持的输入方式给明确回答。

首页继续承接产品类别和整体价值；这个功能页提供本任务的具体证据和操作答案。教程则展开一次完整操作。三者通过自然内链连接，而不是复制同一套段落。

### 先补什么证据

优先完成一条真实源素材的全流程示例，记录源视频实际时长、选中片段的原始时间范围、AI 初始候选与修改后版本、人工修正原因、最终 MP4。若教程标题要使用 “one-hour video”，应先有接近一小时的真实案例；不能将短素材截图包装成一小时测试。

当前本地记录明确 YouTube 原视频 URL 导入未接入；页面不要展示可用的粘贴 YouTube 链接输入框。发布和排期仍有验收边界，应按已验证能力描述，不能用视觉示意证明已完成跨平台发布。

## 发布渠道判断

本轮正文来源以厂商官网功能页和厂商博客为主；Marvienta 为目录型编辑页，Clippingnet 与 Recapo 也有自家产品。**目前足够支持优先建设站内功能页和真实案例，尚不足以确定某个站外渠道值得付费投入。**

Marvienta 可列为以后观察的目录样本，但本轮没有验证其收录规则、受众或转化；没有据此提出购买、投稿或联系作者。Medium、Substack 未出现在本轮采集的来源中，也不形成平台投放建议。若将来有真实对比内容，须披露 Scribix 的作者身份与测试条件；竞品自排第一不能作为照做理由。

## 局限与完成情况

- 六次正式采样均完成；每平台每题只有一次，不能推算稳定推荐率、排名或流量。
- **ChatGPT Q1 显式调用候选生成对话的记忆**，因此它不是完全隔离的无上下文样本。开新对话并未消除账户个性化；按约定未修改设置或重跑。其它样本未显示记忆不等于没有使用。
- 未施加国家限制，但账户位置和个性化未知，因此不称“全球代表性 AI 样本”。与前轮全球关键词量是不同证据口径。
- 18 个明确正文来源已读，1 个列表对照已读；其余 39 个去重网页未读。ChatGPT 另有一处未知折叠映射。
- 9 个网页通过读取工具获得正文，另外 9 个正文来源使用 Chrome ai-publisher 回退读取；列表对照用网页读取工具。各页公开内容可能变化，日期表示本轮读取时间。
- 网页中关于价格、速度、准确率、增长倍数和排名的数字均为来源说法，本轮没有产品效果、费用或转化实测。未全面审计 Scribix 的生产功能。
- 已完成本轮采样、来源核查和内容建议；未实施网页、发布内容或外联。

原始英文回答、候选与确认记录：[character-survey.md](character-survey.md)。逐条引用、原始片段 URL 与品牌结果：[sources.md](sources.md)。
