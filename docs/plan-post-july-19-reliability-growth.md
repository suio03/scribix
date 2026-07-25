# Scribix 可靠性、转化与增长修复计划

> 状态：release `0.18.0` 已通过 commit `99bf119` 推送到 `main`；后续修复 release `0.18.1`（commit `30f4b0a`）已统一 Starter 10 小时上限、替换 AAI 废弃模型并拆分 Discord channel。release `0.19.0`（commit `653757c`）新增本地化 AI Note Taker 入口与归因。release `0.20.0`（commit `4b79377`）将新购套餐精简为 Pro 月付 $20 或年付 $120，并为两种周期都提供每月重置的 2,400 分钟额度。release `0.20.1`（commit `36f6c86`）将路由、图标、顺序、价格和配额等结构移出翻译文件，并在 build、preview、deploy 前强制校验六种语言。以上版本都没有改变上传 pipeline version。生产 D1 migration 已完成；等待确认 Cloudflare 部署结果并开始发布后七天观测
>
> 2026-07-22 已获授权并完成全部本地修复，生产 D1 migrations `0016–0019` 已应用。Plausible/Bing 后台配置仍需单独执行；2026-07-23 的 `0.19.0` push 已触发部署，但不能代替生产环境验收。

### 1.0 实施进度（2026-07-22）

- 已完成本地代码：T1、U1–U5、C1–C4、B1–B2、S1–S5、M1。
- 已完成本地数据准备：支付归属 migration 已在本地 D1 成功应用；tracking repo 已支持 Plausible 完整事件、Bing query/page 拉取和发布后健康报告。
- 尚需外部执行：确认 Cloudflare 生产部署成功、Plausible goals 配置、Bing Webmaster 验证/API key/sitemap。
- 生产部署确认后才能完成：U3 的真实大视频端到端验证，以及 M1 的连续七天目标判定。
- M2 自动验证已通过：生产构建、TypeScript、121 个静态页面生成和补丁空白检查均成功；公开页面已完成英文、西班牙语浏览器烟测。需真实账号、套餐、网络故障、大视频和支付沙箱的场景按 `docs/runbooks/post-release-monitoring.md` 在部署前后验证。

## 1. 数据背景

### 1.1 分析范围

- 数据拉取日期：2026-07-22
- 上线后区间：2026-07-19 至 2026-07-21
- 对照区间：2026-07-16 至 2026-07-18
- 时区：Australia/Melbourne
- Plausible：已重新拉取原始事件数据
- GSC：已重新拉取相同日期范围
- GA4：property 权限不足，返回 403，本次不参与分析

2026-07-19 03:08（Melbourne 时间）提交了混合大视频上传功能。因此，本次分析主要用于检查该版本上线后的产品健康状况，不应将三天样本直接解释为长期趋势。

Plausible 线上尚未创建 `direct_video_attempt` 等 goals，标准分析脚本会返回 400。本次分析改用原始 `event:name` 查询，避免将“goal 未配置”误判为“事件数为 0”。

### 1.2 核心数据

| 指标 | 07-16 至 07-18 | 07-19 至 07-21 | 变化 |
| --- | ---: | ---: | ---: |
| Visitors | 186 | 242 | +30.1% |
| Visits | 205 | 276 | +34.6% |
| Pageviews | 508 | 757 | +49.0% |
| Bounce rate | 36% | 41% | +5pp |
| 平均访问时长 | 173 秒 | 154 秒 | -11.0% |
| Views per visit | 2.48 | 2.74 | +10.5% |
| 转录成功事件 | 52 | 100 | +92.3% |
| 转录失败事件 | 56 | 69 | +23.2% |
| 转录成功率 | 48.1% | 59.2% | +11.1pp |
| 技术失败事件 | 18 | 18 | 持平 |
| Checkout completed | 2 | 0 | -2 |

上线后的每日转录成功率：

| 日期 | 成功 | 失败 | 成功率 |
| --- | ---: | ---: | ---: |
| 07-19 | 20 | 25 | 44.4% |
| 07-20 | 41 | 21 | 66.1% |
| 07-21 | 39 | 23 | 62.9% |

07-20 和 07-21 的结果好于 07-19，但目前只有三天数据，仍需用后续完整七天观察确认。

### 1.3 设备与页面路径

| 路径/设备 | 对照期成功率 | 上线后成功率 | 结论 |
| --- | ---: | ---: | --- |
| Desktop | 44.6% | 57.6% | 明显改善，但仍低于 Mobile |
| Mobile | 100% | 81.8% | 样本较小，不适合直接比较 |
| 主页上传路径 | 31.6% | 34.2% | 几乎没有改善，仍是主要掉点 |
| `/dashboard/new` | 59.7% | 66.4% | 明显改善 |

Desktop 占上线后 225/276 visits，是最需要持续关注的设备。主页路径为 13 次成功、25 次失败，成功率只有 34.2%；`/dashboard/new` 为 87 次成功、44 次失败，成功率为 66.4%。

### 1.4 直传视频数据

上线后记录到：

- `direct_video_attempt`：17
- `direct_video_upload_completed`：5
- `direct_video_upload_failed`：10
- 没有明确终态：2
- 标记为 `upload_mode=direct_video` 的转录成功：3

10 个 `direct_video_upload_failed` 的错误为：

| 错误 | 数量 | 类型 |
| --- | ---: | --- |
| `duration_exceeds_tier` | 5 | 业务限制，不应算上传失败 |
| `upload_network_error` | 2 | 技术问题 |
| `upload_stalled` | 1 | 技术问题 |
| `unsupported_media` | 1 | 文件/兼容问题 |
| `not_found` | 1 | 状态或资源问题 |

因此，当前 10 次 upload failed 中只有约 5 次属于真实传输或技术失败。现有事件语义混合了业务拒绝和上传失败，导致直传漏斗无法准确评估。

由 `extraction_timeout` 触发的 fallback 共 5 次，其中 0 次明确记录 upload completed，4 次记录失败。这说明 fallback 已经被触发，但还没有可靠救回该类用户。

### 1.5 失败原因

上线后共有 69 次 `transcribe_fail`：

| 类型 | 数量 | 占比 |
| --- | ---: | ---: |
| Product limit | 42 | 60.9% |
| Technical | 18 | 26.1% |
| Quota | 8 | 11.6% |
| Auth | 1 | 1.4% |

主要错误：

- `duration_exceeds_tier`：24
- `video_file_too_large`：17
- `insufficient_quota`：5
- `no_quota`：3
- `transcript_poll_failed`：5
- `aai_submit_failed`：5
- `upload_network_error`：3
- 其他：7

相比对照期：

- `video_file_too_large` 从 22 降到 17，说明混合上传方向有效。
- 最终 `extraction_timeout` 从 7 降到 1，但其中一部分转移到了尚未稳定的 direct-video fallback。
- 技术失败绝对数仍为 18；按 visits 计算，从 8.8% 降至 6.5%。
- 新出现 5 次 `transcript_poll_failed`，暴露出 polling 恢复机制不足。

### 1.6 收入与 Checkout

07-19 至 07-21 没有 checkout click、opened 或 completed。

对照期的两个 checkout 实际都包含属性：

- Plan：Basic
- Cycle：Monthly

此前报告无法展示 plan 和 cycle，原因不是产品没有发送属性，而是 tracking 配置没有将 checkout 事件及 breakdown 纳入自动分析。后续收入、税费、退款和 chargeback 统一以 Paddle 为准，不再复制金额到 Plausible 或 Scribix 数据库。

上线后存在 24 次 duration 超限和 8 次 quota 错误，但 checkout opened 为 0。虽然这些是事件数而非唯一用户，仍说明当前业务限制错误没有被有效承接到升级流程。

### 1.7 流量与 SEO

主要来源 visits：

| 来源 | 对照期 | 上线后 | 变化 |
| --- | ---: | ---: | ---: |
| Bing | 72 | 77 | +6.9% |
| Direct | 34 | 68 | +100.0% |
| DuckDuckGo | 45 | 55 | +22.2% |
| Yahoo | 22 | 32 | +45.5% |
| Google | 15 | 27 | +80.0% |
| ChatGPT | 9 | 8 | -11.1% |

搜索引擎合计约占 71% visits。Bing 单独贡献 77 visits，是最大单一来源，但目前没有 Bing Webmaster 查询和页面数据。

GSC 在 07-19 至 07-21 仅记录约 27 impressions、0 clicks；对照期约 86 impressions、3 clicks。由于区间很短，且最新日期可能仍存在数据延迟，当前不应据此扩大内容或本地化页面。

`/audio-to-text` 在上线后三天只有 4 GSC impressions；Plausible 记录 6 visits，bounce rate 为 100%。该页面可以做低成本 metadata 和 CTA 实验，但暂时不应成为主要增长项目。

## 2. 为什么需要修复

### 2.1 混合上传已经有效，但还没有完成闭环

整体转录成功率提升 11.1 个百分点，证明 07-19 的方向正确。但是直传链路只有 17 次 attempt、5 次 upload completed 和3次明确的 direct-video transcribe success，且 extraction-timeout fallback 几乎没有成功闭环。

如果现在直接扩大流量，会把更多用户送入尚未稳定的大视频路径，放大网络、状态恢复和错误语义问题。

### 2.2 用户等待过久后才得知业务限制

当前流程在浏览器提取音频之后才调用服务器 init 检查 duration 和 quota。用户可能等待数分钟后，才知道文件时长超过套餐或 quota 不足。

这既增加失败感知，也浪费客户端 CPU、带宽和上传资源。

### 2.3 业务限制没有转化为升级机会

上线后三天共有 32 次 duration/quota 错误，但没有 checkout opened。当前升级入口主要覆盖 quota，没有根据 duration 和文件大小给出适合的套餐或替代方案。

### 2.4 主页体验与 dashboard 不一致

主页成功率只有 34.2%，约为 dashboard 路径的一半。未登录用户选择文件后才进入 OAuth，会丢失浏览器 File；主页 Record 标签目前也只是动画，没有真正录音。

这会损害首次访问者的信任和激活率。

### 2.5 Polling 和 Retry 可能制造重复工作

当前 polling 遇到临时网络错误后会显示失败；用户点击 Retry 时会重新执行整个上传流程。对于已经完成上传或已经提交给 AAI 的 transcript，这可能造成重复上传、重复请求或用户无法找回正在处理的任务。

### 2.6 收入统计应以 Paddle 为唯一来源

客户端 checkout completed 只用于来源归因和转化率。金额、税费、退款和 chargeback 由 Paddle 负责，Scribix 只保留 transaction、用户、套餐、周期、状态和 adjustment 归属，避免复制一套易漂移的财务数据。

### 2.7 当前追踪配置会阻塞自动分析

Plausible goal、产品事件和 tracking repo 配置不一致，已经导致标准分析脚本直接返回 400。如果不先修复事件契约，后续改动即使有效，也无法可靠评估。

### 2.8 SEO 数据不足以支持大规模扩张

当前 Google 数据仍很稀疏，而最大搜索来源 Bing 又缺少查询数据。现阶段应先补齐 Bing 数据和核心页面可信度，再决定内容和语言扩张方向。

## 3. 修复计划

## P0：追踪与测量基线

### T1. 修复 Plausible 和 tracking 配置漂移

计划：

- 在 Plausible 后台创建：
  - `direct_video_attempt`
  - `direct_video_upload_completed`
  - `direct_video_upload_failed`
- 将 YouTube inspect/import 和 checkout 全链路事件加入 `projects.json`。
- 为 checkout 增加 tier、cycle、currency、total 和 payment method breakdown。
- 为转录失败统一补充：
  - `upload_mode`
  - `fallback_reason`
  - `step`
  - `error_type`
  - `retryable`
- 增加 `upload_pipeline_version`，用于隔离不同发布版本。
- 调整分析脚本：某个 goal 未创建时跳过并报告配置错误，不让整份报告失败。

验收标准：

- 标准分析脚本不再返回 400。
- Plausible 能展示完整直传和 checkout 漏斗。
- 新事件部署后 24 小时内可以查询。

工作量：低到中。

外部影响：需要修改 tracking repo 和 Plausible 后台，执行前需单独确认。

## P0：上传可靠性

### U1. 增加上传前 Preflight

计划：

- 新增只读 `/api/transcripts/preflight`。
- 在音频提取和文件上传之前检查：
  - 文件大小
  - MIME/type
  - 媒体时长
  - 用户套餐
  - 剩余 quota
- 返回推荐 pipeline：`extracted_audio` 或 `direct_video`。
- 返回可升级套餐和明确的 CTA 类型。
- Preflight 不创建 transcript、不初始化 multipart、不预占 quota。
- 只有通过后才调用现有 `/api/transcripts/init`。
- 无法读取时长时进入明确 fallback，不静默绕过验证。

验收标准：

- duration/quota 超限不会启动音频提取或上传。
- 合法的大视频直接进入 multipart。
- 非法文件在数秒内收到明确反馈。
- 不产生孤立 transcript 或 quota reservation。

工作量：中。

### U2. 修正直传漏斗与错误语义

计划：

- 将直传状态拆分为：
  - `direct_video_selected`
  - `direct_video_preflight_rejected`
  - `direct_video_upload_started`
  - `direct_video_upload_completed`
  - `direct_video_upload_failed`
  - `direct_video_transcribe_completed`
- duration/quota 错误不再记录成 upload failed。
- `direct_video_upload_failed` 只在真正开始传输后触发。
- 为失败记录具体 stage：
  - multipart init
  - part upload
  - multipart complete
  - AAI submit
  - polling
- 为所有终态补充 `upload_mode` 和 `fallback_reason`。
- 补齐 abandoned 或 processing 状态，保证每个 attempt 都有终态。

验收标准：

- 每个 direct attempt 最终进入 completed、failed、rejected 或 abandoned。
- duration 超限不再污染上传失败率。
- 直传漏斗事件数量可以闭合。

工作量：中。

### U3. 修复 extraction-timeout fallback

计划：

- 复现小于 1GB、浏览器 extraction timeout 的视频。
- 检查 fallback 后的 multipart 初始化、MIME、R2 上传、complete 和 AAI 读取。
- 保留 part upload 重试，并增加：
  - 网络恢复检测
  - stalled part 重新上传
  - 页面离开提示
  - 明确的整体超时
- 不自动重试确定性错误，例如 unsupported media。
- 持续失败时展示本地提取音频指南。

验收标准：

- extraction-timeout fallback 至少完成一个端到端真实视频测试。
- 网络中断后不从零重传已经成功的 part。
- 失败时用户能看到明确的下一步。

工作量：中到高。

### U4. 恢复 Polling，不重新上传

计划：

- 保存当前 transcript ID 和 processing 状态。
- polling 使用指数退避，容忍短暂 5xx、网络中断和离线。
- 页面刷新后从 transcript ID 恢复状态。
- Retry 按失败阶段分流：
  - upload 失败：重试上传
  - submit 失败：重试 submit
  - polling 失败：只恢复 polling
- 已完成上传的文件不得重新上传。
- 长时间 processing 时允许用户离开并从 dashboard 查看。

验收标准：

- 模拟一次 polling 网络错误，恢复网络后自动继续。
- 刷新页面不会创建第二个 transcript。
- `transcript_poll_failed` 不再直接成为用户终态。

工作量：中。

### U5. 提高 AAI Submit 可靠性

计划：

- 对明确的 429 和可重试 5xx 添加有限次数退避重试。
- 对“不确定是否已经提交”的网络超时不盲目重交。
- uncertain 状态保存为 pending processing 并继续轮询。
- AssemblyAI webhook 可通过唯一 webhook token 找回并绑定缺失的 AAI transcript ID。
- 记录上游 HTTP 状态、attempt count 和响应类别。
- cleanup 删除超时非终态任务前原子归还未结算 quota。
- 聚合同类 Discord 告警，避免重复通知。
- 如果无法保证请求幂等，先改善状态恢复，不启用自动 retry。

验收标准：

- 明确的临时 5xx 可以恢复。
- 不产生重复 AAI job。
- 失败后 quota 不会被永久占用。

工作量：中。

## P1：转化率

### C1. 为 Duration、Quota 和文件大小错误增加升级 CTA

计划：

- quota 错误继续展示升级入口。
- duration 超限根据文件时长推荐合适套餐：
  - 不超过 60 分钟：推荐支持该时长的入门付费套餐
  - 不超过 10 小时：推荐 Pro
  - 超过 10 小时：建议拆分或提取音频
- 文件过大时区分：
  - 升级可以解决：展示套餐 CTA
  - 所有套餐均不支持：只展示压缩或提取指南
- 增加事件：
  - `upgrade_cta_shown`
  - `upgrade_cta_click`
  - `upgrade_modal_opened`
  - `upgrade_checkout_completed`
- CTA 保留原始失败上下文和上传意图。

验收标准：

- 所有业务限制错误都有正确且诚实的下一步。
- 不向无法通过付费解决的问题强行推销。
- 可以计算 error → CTA → checkout 转化率。

工作量：低到中。

### C2. 修复主页上传路径

计划：

- 未登录用户先完成登录，再打开文件选择器。
- 登录后返回原语言和原工具页面。
- 首页与 dashboard 共用同一套上传错误和进度组件。
- 上传区明确展示免费分钟、文件限制、支持格式和无需信用卡。

验收标准：

- 未登录用户登录后只需选择一次文件。
- 首页和 dashboard 对同一文件返回一致结果。
- 主页成功率目标达到 50% 以上。

工作量：中。

### C3. 修复首页 Record 功能

推荐分两步执行：

1. 短期隐藏当前不工作的 Record 标签。
2. 后续接入现有 Recorder 和上传流程。

完整版本包括：

- 麦克风权限处理
- 开始、暂停、结束和取消
- 录音时长
- 试听
- 上传并创建 transcript
- 移动端和 Safari 兼容提示

验收标准：

- Record 真正生成音频并完成转录。
- 权限拒绝和不支持浏览器有明确提示。
- 不再显示虚假的固定录音时间。

工作量：中。

### C4. 登录后恢复 YouTube URL

计划：

- OAuth 前将 URL 和工具上下文保存到 sessionStorage。
- 登录返回后恢复 URL。
- 可以自动 inspect，但不自动触发收费或 quota 操作。
- 完成或取消后清理临时状态。

验收标准：

- 用户无需重新粘贴 URL。
- 不会重复触发 import。
- URL 不跨用户或长期保存。

工作量：低。

## P1：支付转化与归属

### B1. 修复 Checkout 分析契约

计划：

- 保留 tier、cycle 和 transaction ID。
- 创建 checkout 时保存 `transactionId → tier/cycle`，作为 custom data 缺失时的 fallback。
- checkout closed/fail 记录 stage 和错误码。
- Plausible 只记录转化归因，不发送金额或 revenue payload。
- Paddle 是金额、税费、退款和 chargeback 的唯一财务真相。

验收标准：

- 每个 completed checkout 都有套餐、周期和 transaction ID。
- Plausible 可以按来源和落地页分析付款转化。
- 同一个 transaction 不会重复计数。

工作量：低到中。

### B2. 建立服务端支付归属记录

计划：

- Paddle webhook 成功时记录：
  - transaction ID
  - user ID
  - subscription ID
  - tier/cycle
  - status
  - occurred_at
- 使用 transaction ID 作为唯一约束。
- 记录 adjustment ID、action 和 status，但不复制金额。
- 历史 adjustment 到达时从 Paddle API 解析交易归属；新事件乱序时等待 transaction webhook 后重试。
- 收入报表只从 Paddle 获取。

验收标准：

- 客户端 checkout 可以逐单对应到 Paddle webhook。
- webhook 重放不会重复记录或重复发放套餐。
- Scribix adjustment 不会因历史交易或 webhook 乱序被静默丢弃。

工作量：中到高。

风险：涉及 billing 和数据库 migration，执行前必须单独确认数据模型及迁移方案。

## P2：流量与 SEO

### S1. 接入 Bing Webmaster 数据

计划：

- 验证 Bing Webmaster Tools。
- 提交 sitemap。
- 评估是否接入 IndexNow。
- 每周获取 query、page、country、device、CTR 和 position。
- 合并进 tracking 自动分析报告。

验收标准：

- 能解释 Bing 流量来自哪些非品牌词和页面。
- 后续内容计划不再只依赖稀疏的 GSC 数据。

工作量：低到中。

### S2. `/audio-to-text` CTR 和落地页实验

计划：

- 测试标题：`Audio to Text Converter — 45 Free Minutes | Scribix`。
- Description 强调：
  - MP3、WAV、M4A
  - speaker labels
  - timestamps
  - TXT、DOCX、SRT、VTT、CSV
  - 45 free minutes
  - no card required
- CTA 不再以 Sign in 作为第一卖点。
- 增加 landing-page CTA impression/click 事件。
- 至少等待 4 周或累计 200 impressions 后再判断实验。

验收标准：

- metadata 与页面实际能力一致。
- 可以测量 SERP CTR 和页面 CTA。
- 不根据极小样本提前下结论。

工作量：低。

### S3. 修复国际化 Metadata

计划：

- 首页 metadata 根据 locale 输出对应语言。
- 保证 canonical 和 hreflang 一致。
- 检查本地化页面是否只是英文 metadata 复制。
- 暂停新增语言，先修复现有英语、西班牙语、法语、德语和日语页面。
- 不删除现有语言页面，除非后续索引审计证明需要清理。

验收标准：

- 每种语言的 title 和 description 正确。
- canonical 指向自身标准 URL。
- 不再出现所有语言共用一套英文 metadata。

工作量：中。

### S4. 清理 Sitemap 和 Robots

计划：

- sitemap 不再在每次构建时给所有 URL 写当前时间。
- 使用真实内容更新时间；静态页未改变时保持稳定。
- 检查 robots 是否覆盖带 locale 的 dashboard、admin 和 API 路径。
- 验证 sitemap 只包含 canonical、可索引、返回 200 的页面。

验收标准：

- sitemap 无重定向、404 或私有页面。
- 本地化 dashboard 不被搜索引擎索引。
- `lastModified` 不再无意义变化。

工作量：低。

### S5. 修复营销可信度

计划：

- 核对或删除无法证明的：
  - 200+ languages
  - 99.9% accuracy
  - 10M+ minutes
  - 100K+ creators
  - Stanford、TED、Y Combinator 等品牌 logo
  - 200-hour benchmark
- 统一文件大小描述，避免 1GB、2GB 和 5GB 相互冲突。
- 核对 trial、Pro Unlimited 等计费承诺。
- 改用可验证的产品事实：
  - 免费分钟
  - 支持格式
  - speaker labels
  - timestamps
  - export formats
  - retention policy

验收标准：

- 页面承诺与代码、套餐和供应商能力一致。
- 无未经授权或无法证明的客户 logo。
- Pricing、首页和上传器的限制描述一致。

工作量：低到中。

## P2：监控与最终验收

### M1. 建立发布后七天监控

每日检查：

- transcribe success/fail
- success rate by tool/device/upload mode
- direct-video funnel
- failure reason
- duration/quota → upgrade CTA
- checkout funnel
- AAI/polling failure
- 大文件上传耗时 P50/P90

七天目标：

- 整体转录成功率不低于 65%
- Desktop 成功率不低于 60%
- 主页成功率不低于 50%
- 技术失败占转录事件低于 5%
- eligible direct-video upload completion 不低于 70%
- `transcript_poll_failed` 不再成为用户终态
- duration/quota CTA 点击率不低于 8%

工作量：低。

### M2. 验证清单

自动验证：

- `npm run build`
- TypeScript 校验
- 确认没有无关 migration、binding 或格式化修改

手动验证：

- Free、Basic、Pro
- 未登录和已登录
- Desktop 和 Mobile
- audio 和 video
- 小于 1GB 和大于 1GB
- duration 超限
- quota 不足
- extraction-timeout fallback
- multipart 网络中断
- polling 网络中断
- AAI submit 失败
- OAuth 返回
- YouTube URL 恢复
- 录音权限拒绝
- checkout completed、closed 和 fail
- 英文及至少一个本地化页面

## 4. 推荐执行顺序

### 第一批：测量与关键可靠性

- T1：Analytics 配置
- U1：上传前 Preflight
- U2：直传事件语义
- U4：Polling 恢复
- C1：升级 CTA

目标：先减少无意义失败，并确保后续结果可以被正确测量。

### 第二批：直传与主页体验

- U3：extraction-timeout fallback
- U5：AAI submit 可靠性
- C2：主页上传路径
- C3：Record 功能
- C4：YouTube URL 恢复

目标：稳定直传链路，并改善首次访问用户的激活率。

### 第三批：支付转化与归属

- B1：Checkout 分析契约
- B2：服务端支付归属记录

目标：获得可靠的渠道归因和支付归属，财务数据统一留在 Paddle。


### 最终验收

- M1：连续七天监控
- M2：完整自动和手动验证

## 5. 执行确认方式

本计划最初不默认授权执行全部项目；2026-07-22 用户已明确授权完成所有本地批次。后续新增范围仍应明确指定批次或编号，例如：

```text
开始第一批
```

或：

```text
执行 T1、U1、U2、U4、C1，其他暂缓
```

涉及 Plausible、tracking repo、Paddle、数据库 migration、部署和其他外部状态的操作，应在对应阶段再次确认。
