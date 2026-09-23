# 视频部署、运维与验收

2026-09-14 按主题合并现行合同，替代分散的阶段文件。以下本地验证和历史测量不等于生产验收；功能状态与优先级统一见[产品 plan](../roadmap/video-product-plan.md)。

[运行、安全与成本](#runtime) | [生产部署检查](#deployment) | [基准与真实用户验收](#acceptance)

<a id="runtime"></a>

## 运行、安全与成本

M8 的本地实现覆盖输入边界、任务资源边界、恢复路径和可观测数据。生产 Cloudflare Containers 容量、镜像扫描、Queue/DLQ 告警和实际价格仍需在外部平台确认；仓库内已提供校验脚本和配置清单。

### 安全边界

- preview 与 final 当前共用 1 vCPU / 3 GiB / 6 GB 的 Container profile，application `max_instances=10`，Queue consumer `max_concurrency=1`。final 的单次 FFmpeg 执行有 55 分钟异常停止上限。
- 同一用户最多两个已排队或执行中的 final jobs（提交额度）；执行时 preview 和 final 跨项目合计最多一个。滚动 24 小时最多创建 20 个 final jobs。API 先返回可读的 `429`，D1 trigger 再关闭并发请求的竞态窗口。
- Render Spec 最长输出 90 秒、最多 3 segments；AI 候选本身只使用一个连续 segment。源视频和品牌资产沿用套餐、字节数和时长限制。
- Logo/字体完成上传时同时检查对象大小与 magic bytes；伪装为图片或字体的内容会从 R2 删除并标记失败。
- 原视频、Logo、字体、输出和封面全部使用 job-scoped 短期 URL。Container 不持有 R2 凭证，不能列举 bucket。
- internal lease/progress/result 使用 job-scoped HMAC bearer token；浏览器会话不能调用这些内部流程。
- renderer base image 以 digest 固定，FFmpeg、MediaPipe 和模型 checksum 固定，进程使用非 root `node` 用户，SSH 关闭。
- Queue 只传 `jobId`，消息作为调度唤醒信号；consumer 为实际领取的任务通过 Durable Object `getByName(jobId)` 启动唯一实例。调度器以单条 D1 UPDATE 原子领取任务，全站最多 10 个、每用户最多 1 个；按用户最近领取时间轮流安排，用户内按任务创建时间排序。容量等待留在 D1，不消耗消息失败重试次数。Container 只接收 job token 与 internal URL。

执行 `npm run test:video-security` 会校验镜像固定、非 root、MediaPipe 固定、Containers binding/规格、Queue 并发和容器无对象存储凭证。设置 `TRIVY_IMAGE=<image reference>` 后，该命令还会阻断含未修复 HIGH/CRITICAL 漏洞的镜像；生产发布前必须检查固定镜像版本的扫描结果。

### 调度验证

- `npm run test:render-scheduling` 使用真实 SQLite 并发连接，验证 25 个竞争请求只领取 10 个不同用户任务、跨项目/任务类型共享用户额度、轮流调度、重复唤醒和丢失消息恢复。
- 领取时即记录 `provider_submitted_at`，覆盖启动请求和冷启动准备时间；它同时是用户公平排序的最近服务时间。无需新增数据库字段或 migration。
- 生产容量必须同时更新 `max_instances` 和 `VIDEO_RENDER_MAX_CONTAINERS`；本地保持 1，测试通过不代表已完成云端 10 用户压力测试。

### 恢复与清理

- dispatcher 每分钟检查并重新入队遗失的 queued/preparing jobs，并通过 Container state 恢复 running/failed/succeeded 状态。
- 结果回调成功写入后立即唤醒下一批任务；唤醒失败不撤销已保存的结果，由定时恢复补投。
- 已鉴权的工作台轮询每项目最多每 15 秒补投一个未派发的 queued job，本地切换服务后无需手动点击每个片段；不重新执行运行中任务。
- provider 成功后留两分钟等待签名 callback；callback 丢失则稳定失败为 `upload_failed`。provider 状态连续缺失 15 分钟则失败为 `provider_unavailable`。
- stale job 失败时只修改 job 与其 output/cover assets，不泄露用户对象路径。
- cleanup worker 删除超过 24 小时且没有 render job 的 pending/uploading 品牌或输出资产，以及超过 7 天的同类 failed orphan assets。
- source 到期或用户主动移除时同时删除 source 与 preview proxies，保留 transcript 文本和未到期最新成片，并将项目降为不可编辑的归档视图。
- cleanup worker 删除完成超过 30 天的 final video/cover，以及被同一 candidate 较新导出 supersede 的旧资产。
- 账户删除、项目删除和用户主动删除成片继续由 lifecycle 路径执行；R2 删除确认后才清除 D1 引用。

### 监控事件

dispatcher 每分钟输出一条不含用户 ID、源 URL、R2 key 或字幕内容的 `video_render_metrics` JSON：

- D1 任务状态近似 queue depth。
- 最近 24 小时 sample、completed、failed、success rate 和 retry rate。
- start latency 与 total latency 的 p50/p95。
- 按 `input`、`storage`、`provider`、`renderer` 聚合的稳定错误类别。
- 已完成任务的 estimated cost 总额。

建议外部告警：DLQ 非空立即告警；queued 连续 10 分钟超过 20；至少 10 个样本时成功率低于 95%；p95 start latency 超过 10 分钟；cleanup retry 非零；出现 `video_render_cost_rates_missing`；Container 容量重试、超时或 provider error category 在 15 分钟内连续出现。

### 成本记录

Migration `0030_render_operations.sql` 保存 provider submit、upload start、complete 时间，以及 billable duration、estimated cost 和 cost model。dispatcher 使用当前配置费率为每个成功任务写入一次估算，重复 cron 不会重复计费。

部署 dispatcher 时必须配置以下非秘密变量，单位都是 micro-USD：

- `VIDEO_RENDER_VCPU_MICROUSD_PER_HOUR`
- `VIDEO_RENDER_MEMORY_GB_MICROUSD_PER_HOUR`
- `VIDEO_RENDER_PER_JOB_MICROUSD`（可为 `0`，用于覆盖公网/NAT、日志等固定摊销）
- `VIDEO_RENDER_COST_MODEL`（例如 `cloudflare-containers-1vcpu-3gib-2026-09`）

preview 与 final 都按当前 1 vCPU / 3 GiB profile 估算。费率缺失或非法时不会写入误导性的零成本，而是输出 `video_render_cost_rates_missing`。价格或 Container profile 更新时必须同时变更代码、变量与 model 名；历史记录保留原 model。

#### Export scope repair (0036)

Apply `0036_render_scope_repair.sql` before deploying the shared export monitor.
Older databases may retain `idx_render_jobs_active_scope` on `project_id`, even
though the current 0027 source defines separate preview and final indexes. This
causes a second clip export in the same project to fail with a unique constraint
error. Migration 0036 repairs both indexes without changing the two-active-final-
jobs-per-user limit. Run `npm run test:render-scope` to cover both schema variants.
Apply locally with `npm run db:migrate:local`; production requires
`npm run db:migrate:remote` before deployment. The repair has only been applied
locally during this change.

Automatic downloads are watched by `VideoExportProvider` for the lifetime of the
project workspace, including when the selected clip changes. Leaving or reloading
the workspace clears automatic-download intent; ready exports remain manually
available. Failed status refreshes retry and are shown separately from failed
export requests.

<a id="deployment"></a>

## 生产部署检查

本清单只描述生产环境动作。M0–M9 开发期间没有执行 remote migration 或真实用户开放。2026-09-02 已部署一个与生产隔离的 Cloudflare Containers POC；它不代表生产接入已经完成。此前的 AWS Batch 方案已被 Cloudflare Containers 方向取代，不要再按旧 AWS 步骤创建资源。

### 1. Cloudflare D1 与 R2

1. 先备份生产 D1，再运行 `npx wrangler d1 migrations list scribix-db --remote` 核对待执行列表。当前视频与发布流程所需 migrations 为 `0025`–`0040`，其中两个 `0037` 文件（`0037_auto_framing.sql`、`0037_publish_preparation.sql`）均需核对，不能只按编号判断；已应用的迁移无需重复执行，使用 `npm run db:migrate:remote` 应用剩余迁移。
2. migration 后重新查询待执行列表，确认无待应用迁移；执行 `PRAGMA foreign_key_check`，确认无结果。检查两个 `render_jobs_final_*` triggers、`0036` 重建的 preview/final active-scope 唯一索引及 `0037_auto_framing.sql` 新增的 `media_assets.auto_framing_json` 字段存在；确认发布准备表、`social_submissions`、`media_assets.social_hold_until` 和 `0040` 允许无项目连接的 `social_connection_returns.project_id` 可空合同。
3. `scribix-media` 保持 private。为浏览器直传配置 CORS，只允许实际产品 origin：

```json
[
  {
    "AllowedOrigins": ["https://scribix.io"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Content-Type", "Range"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

如有 preview/staging domain，显式加入对应 origin；不要使用 `*`。实测 multipart source upload、Logo/字体 PUT、Range GET 和 signed download。

### 2. Cloudflare Queue、secrets 与 variables

创建 `scribix-video-render` 和 `scribix-video-render-dlq`，确认 `wrangler.jsonc` 是 producer、`wrangler.video-render.jsonc` 是 consumer，最大 retry 为 5 且 DLQ 绑定正确。

生成至少 32-byte 随机 `VIDEO_WORKER_SIGNING_SECRET`，在主 Scribix Worker、Queue consumer 和 Container job callback 上配置相同值。Container 不得接收 R2 永久凭证；由 Worker 以 job-scoped stream 或短期签名 URL 提供输入和接收输出。

为生产 Worker/consumer 配置 Containers Durable Object binding、R2 binding、Queue binding 和独立的成本费率变量。费率以部署当日 Cloudflare Containers 官方价格为准，不把 secret 或账户级凭证提交到仓库。主 Worker 如继续使用 R2 S3 signed URL，只授予 `scribix-media` object read/write，不授予账户级管理权限。

默认保持 `VIDEO_WORKSPACE_ROLLOUT_PERCENT=100`。仓库未准备完成前不要部署到生产；百分比和 `VIDEO_WORKSPACE_PILOT_USER_IDS` 只作为以后需要灰度或紧急止损时的控制手段。

### 3. Cloudflare Container 镜像

1. 使用固定 digest 的 Debian/Node base image 和固定 FFmpeg 版本构建 `linux/amd64` 镜像，保留 `libx264`、AAC、`subtitles`/libass 和 `ffprobe` 启动检查。
2. 运行 `npm run test:video-security`、render benchmark、真实 1080p 15/30/45 秒矩阵和 HIGH/CRITICAL 镜像漏洞 gate。
3. Container 使用非 root user、只写 job 临时目录，不注入 Cloudflare API token 或 R2 key。当前实现只为 job-scoped internal callback 与短期 signed R2 URL 开启出站网络；不得把 URL、transcript 或字幕写入日志。
4. 镜像 digest、FFmpeg 版本、Render Spec schema、资源 profile 或 benchmark 不可确认时停止生产部署。

### 4. Cloudflare Containers 与调度

1. Queue consumer 只接收 `jobId`，先取得 D1 lease 和 idempotency lock，再通过 `getByName(jobId)` 启动唯一 Container；一个实例只处理一个 FFmpeg job。
2. `max_instances` 是 application 总上限，不是每个实例的并发数，也不是立即可用容量承诺。根据 pilot 数据设置生产上限，同时在 Queue consumer 设置更小或相等的并发阈值。
3. 对临时容量不足、冷启动和可重试 5xx 使用有上限的指数退避；穷尽重试进入 DLQ。不得因某个实例暂不可用而丢弃整个批次。
4. job 成功、失败、取消或超时后强制销毁其 Container。唯一 job ID 不保留 warm instance；定期清理 stuck/orphan instances 和 R2 partial outputs。
5. source 和 output 通过 Worker/R2 受控传输。R2 输出必须使用已知长度的 stream；禁止在 Worker 内缓冲超大成片，禁止把永久凭证传入容器。
6. 当前生产配置（`wrangler.video-render.jsonc`）为 1 vCPU / 3072 MiB / 6000 MB、最多 10 个单任务实例，`VIDEO_RENDER_MAX_CONTAINERS=10`；Queue consumer 的 `max_concurrency=1`、`max_batch_size=10`。本地配置仍限制为 1 个实例。上线后以真实 1080p 的 p50/p95、失败率和单位成本决定是否增配或扩容。
7. POC 的公开 bearer endpoint 只用于隔离验证；生产入口必须经过 Scribix auth、ownership、job-scoped token 和内部 Queue 流程。

### 5. 部署与观测

按以下顺序：D1 migrations → private R2/CORS → Container image/application → Queue/DLQ consumer → 主 Next/OpenNext app → cleanup worker。默认 rollout 为 100%，因此 schema、Container 调度和其他依赖未就绪时不要部署主应用。

配置并验证：

- Queue/DLQ、Container capacity/cold-start/failed/timeout、镜像扫描和 Worker error alarms。
- `video_render_metrics` 的 queue depth、p50/p95 start/render/total、success/retry rate。
- `video_render_cost_rates_missing` 必须为零，所有成功任务都有 cost model。
- cleanup retry、orphan assets、source/proxy retention、30 天 final export expiry 与 superseded export 清理。
- 日志不得出现 signed URL、Authorization、R2 key、transcript 或字幕内容。

### 社交发布的附加依赖

账号与发布接入、专用应用凭证、精确 OAuth 回调、外部迁移及平台验收统一见 [social-publishing](social-publishing.md)。当前没有用户 ID 发布白名单，仍须验证登录、套餐和资源归属。生产回调不能直接沿用本地 `local.scribix.io`；外部服务部署不代表 Scribix 全流程验收。TikTok Direct Post 已有批准和部署记录，真实账号授权及发布仍待用户验收，见[生产发布记录](tiktok-production-release-2026-09-17.md)。账号刷新也需核对外部部署与真实续期；部署时重查平台状态。

### 6. Production smoke 与试点

使用授权测试账号依次验证：横屏有声、竖屏静音、连续片段修剪、Fill 拖动裁切与 Fit 模式、三个字幕模板、Logo/字体、取消、重试、重复 idempotency key、源过期、ZIP 下载、成片删除、账户删除。确认 Final Render 只读取 original source，同一 candidate 的新导出会替换旧导出。

同时验证公开入口：`/` 继续承接 AI video clipper 首页，`/video-to-text` 及五个 locale 版本承接原视频转文字页面；检查侧边栏链接、上传后登录回跳、自引用 canonical、reciprocal hreflang、Open Graph、JSON-LD 和 sitemap 记录。

随后按 [operations](operations.md#acceptance) 验证真实 talking-head/podcast 用户流程。生产部署前由负责人确认隐私说明、Cloudflare Containers/转录处理披露、7/30/30 天源保留、5/25/100 GiB 存储额度、render 使用量/成本转嫁规则与套餐文案；确认完成后以默认 100% 上线。

<a id="acceptance"></a>

## 基准与真实用户验收

M9 已完成生产试点所需的本地支撑。真实用户开放、生产性能阈值验证、隐私/套餐确认和基于真实数据的参数调整属于外部阶段，仓库不会把合成数据冒充用户结果。

### 24 条技术基准

`render-benchmark-v1` 包含 24 条实际 FFmpeg 成片任务，覆盖：

- landscape、portrait、square 三种源画幅。
- 有声与无声六种 source profiles。
- 单 segment 与两个不连续 segments。
- karaoke、boxed、minimal 三种字幕。
- crop x/y 边界、1×–2.4× zoom、四个 Logo 位置。
- corner/signature 品牌、封面和静音补轨；旧基准中的响度标准化、淡入淡出仅为历史底层测试范围，当前产品音轨合同以编辑与渲染文档为准。

执行方式：

```bash
docker build -t scribix-video-render:local containers/video-preview
npm run benchmark:video-render
```

本次本地结果：24/24 通过，6 个源 profile，累计渲染 10,432ms，单 case p50 423ms、p95 501ms、最大 523ms。合成视频只有 1.2 秒，用于回归正确性，不代表 Cloudflare Containers 的生产延迟或真实内容质量。隔离 POC 的真实 15/30/45 秒结果见 [cloudflare-containers-poc](../archive/research/cloudflare-containers-poc.md)。

### 渐进开放

所有环境默认 `VIDEO_WORKSPACE_ROLLOUT_PERCENT=100`，未配置时也按 100% 开放，不区分本地与生产。`VIDEO_WORKSPACE_PILOT_USER_IDS` 和百分比开关仍然保留，可在故障止损或以后需要小范围放量时使用；非法百分比值会 fail closed。

建议阶段：

1. 在本地和预发布环境以 100% 完成内部 smoke test。
2. 只有在外部依赖、隐私、套餐和成本规则全部准备好后才部署到生产。
3. 生产部署后保持 100%，持续观察真实 render 成功率、延迟、下载率和成本。
4. 出现重大错误时把百分比设为 0 并清空 allowlist。开关只阻止新建项目，已有项目仍可完成、下载和删除，避免用户数据被困住。

### 指标与隐私

`video_workspace_events` 只保存固定事件名、opaque IDs 和受控数字/枚举属性，不保存 transcript、字幕、标题、文件名、URL、R2 key 或任意自由文本。账户/项目删除会先删除这些事件。

内部业务事件与管理员聚合读取现有记录；浏览器行为事件使用现有分析平台，实际触发、漏报与允许属性以 [tracking](tracking.md) 为准。`external_edit_required` 保留合同但没有新增反馈 UI；不能承诺所有用户都会提交该反馈，也不能把未点击当作可直接发布的证据。

管理员可读取：

```text
GET /api/admin/video-workspace-metrics?days=30
```

输出 candidate 接受/拒绝、编辑时长 p50/p95、final 请求/成功/失败/重试、总延迟 p50/p95、唯一下载、外部编辑需求和各比率，不返回用户级明细。

### 建议放量阈值

- 至少 30 个 terminal final jobs 后，首次/总体 render 成功率 ≥ 95%。
- 原有 ≤60 秒输出的放量观察线：p95 total latency ≤ 10 分钟，p95 start latency ≤ 5 分钟；90 秒输出需单独积累真实任务样本，不套用该阈值。
- 成功 render 的唯一下载率 ≥ 70%。
- 通过自愿访谈记录实际外部修改需求；现有事件比率受入口和反馈覆盖限制，不设为无偏质量指标。
- candidate 接受率和编辑时长只用于趋势：初始目标接受率 ≥ 40%、编辑 p50 ≤ 5 分钟，不以合成数据决定产品结论。
- DLQ 必须为空，HIGH/CRITICAL 镜像扫描必须通过，成本字段覆盖 100% 成功任务。

### 真实试点检查单

- 选择具有使用授权的 talking-head、访谈和 podcast 长视频；覆盖口音、多人、横竖屏、安静/嘈杂音频和 30 分钟至数小时源文件。
- 获得参与者明确同意，并说明源视频保留期、第三方转录与 Cloudflare Containers 处理边界。
- 每位用户完成候选选择、编辑、至少一次成片、下载，并回答是否仍需 CapCut/Premiere 以及原因。
- 每日查看管理员指标、dispatcher metrics、DLQ、cleanup、Container 容量/镜像告警和成本。
- 只有在隐私文案、套餐配额、保留策略和区域价格获得负责人确认后才提高百分比。
