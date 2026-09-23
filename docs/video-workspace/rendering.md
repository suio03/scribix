# 视频预览与最终渲染

2026-09-14 按主题合并现行合同，替代分散的阶段文件。以下本地验证和历史测量不等于生产验收；功能状态与优先级统一见[产品 plan](../roadmap/video-product-plan.md)。

[预览代理与任务](#preview) | [最终渲染与交付](#final) | [预览与成片一致性](#consistency)

<a id="preview"></a>

## 预览代理与任务

> 状态：早期本地验证保留为实现依据；现行部署与验收以[部署运维记录](operations.md)和[后台分析验证记录](ai-analysis-validation.md)为准
> Migration：`0027_preview_proxy_jobs.sql`
> Provider：Cloudflare Queue + Containers

### 范围与边界

M3 为每个候选 segment 单独生成带 5 秒 handles 的轻量 proxy。Proxy 固定使用
`preview-720p-v1`：最长边 1280、H.264、AAC、MP4 `faststart`。它保留源画幅，不烧入字幕、
品牌或最终 9:16 crop，也绝不会成为最终 renderer 的输入。

候选前 5 名在保存成功后自动入队；其余候选由用户首次打开时懒生成。每个 segment
独立拥有 job、asset、幂等键和错误状态，因此一个坏 segment 不会影响 transcript、其他候选
或已成功的 proxy。Proxy 保存 7 天，到期后由 cleanup worker 删除 R2 object 并软删除 asset。

### 数据合同

旧 `render_jobs.project_version_id` 只能表达 M4 之后的 final render。Migration 0027 保留 final
job 的 immutable version 约束，同时允许 preview job 在没有 project version 时保存以下服务端
快照：

- `candidate_id`、`segment_index`、`segment_id`
- 用户选择的 `source_start_ms` / `source_end_ms`
- 加 handles 且按 source duration 截断的 `proxy_source_start_ms` / `proxy_source_end_ms`
- `proxy_version`

Preview active scope 使用 project + kind + preset + scope；final job 继续使用 immutable project
version scope。默认 proxy 使用 version 1；当 M4 的边界调整超出已有 handles 时，API 仅为对应
segment 创建下一 version。仍在 handles 内的调整直接复用原 proxy。

### 请求流

```text
Candidate API
  -> D1 创建 preview render_job + pending media_asset
  -> Cloudflare Queue: { schemaVersion, jobId }
  -> Queue consumer 原子 claim job
  -> getByName(jobId) 启动唯一 Cloudflare Container
  -> Container 使用 job-scoped token 获取 lease
  -> 15 分钟 signed R2 GET / PUT
  -> ffprobe source -> FFmpeg proxy -> ffprobe output -> R2 PUT
  -> authenticated result callback
  -> D1 job completed + asset ready
```

队列 payload 不含用户内容、R2 key、signed URL 或凭证。Dispatcher 用共享 secret 为具体 jobId
生成 HMAC token；容器只拿到该 scoped token。Internal API 重新读取 D1 的受控范围并签发精确
object URL，容器没有永久 R2 凭证，也不能把一个 job 的 token 用于另一个 job。

### API

- `GET /api/video-projects/{projectId}/candidates`：候选及全部 preview 状态。
- `GET /api/video-projects/{projectId}/candidates/{candidateId}/previews`：获取 ready segment 的
  5 分钟播放 URL。
- `POST /api/video-projects/{projectId}/candidates/{candidateId}/previews`：懒生成或重试失败 job。
- 同一 POST 可传 `{ segmentIndex, sourceStartMs, sourceEndMs }`；只有超出已有 handles 才创建
  单 segment 新 proxy version。
- `POST /api/internal/video-jobs/{jobId}/lease|progress|result`：仅接受 job-scoped bearer token。

Result callback 只接受稳定 error code，且 completed output 必须通过 duration、dimension、H.264/
AAC 和 R2 object existence 检查。Worker 日志不输出 token、signed URL 或媒体内容。

### Dispatcher 与 reconciliation

`workers/video-render-dispatcher.ts` 已使用 Cloudflare Queue consumer 和 Container Durable Object，并保留以下合同能力：

- D1 原子 claim 阻止普通重复 delivery 产生两次 SubmitJob。
- provider adapter 隔离 Containers API；应用侧 job contract 不依赖 provider 字段。
- 容量/启动失败使用指数退避，5 次失败后把单 segment 标记为 `provider_unavailable` 并进入 DLQ。
- queued job 未 dispatch 或 preparing claim 中断时重新入队。
- reconciliation 读取 D1 lease 与 Container/job 状态，修复 STARTING/RUNNING/FAILED 漂移。
- Container 成功但 result callback 缺失时标记 `upload_failed`，避免永久卡住。

Container 必须以 `jobId` 作为 Durable Object name，并在启动前取得 D1 lease；deterministic output key、
scoped callback 和 D1 终态共同阻止重复 delivery 覆盖成功结果。job 终态后立即销毁实例。

### Container

代码位于 `containers/video-preview/`。Worker 以非 root `node` 用户运行，不通过 shell 拼接任何
参数；所有 FFmpeg 选项由固定 preset 生成。它对远端 signed GET 进行 input seek，只把最长约
100 秒的 proxy 写到 ephemeral disk 后上传，不下载整段数小时原视频到浏览器。

本地验证：

```bash
npm run test:video-preview
docker build -t scribix-video-preview:m3 containers/video-preview
docker run --rm --entrypoint ffmpeg scribix-video-preview:m3 -version
```

当前本地构建记录：Node `22.15.0-bookworm-slim`、FFmpeg `5.1.9-0+deb12u1`，H.264 encoder
检查通过。正式 Cloudflare Container build 必须记录 image digest，并让 image platform 保持
`linux/amd64`。

### 发布依赖

部署顺序、全部迁移、Queue、签名配置及 Container 验收统一见[部署检查](operations.md#deployment)，不再维护早期仅覆盖 0027 的平行清单。以下验证记录是原预览阶段的本地结果，不是当前生产验收。

### 验证记录

- Migrations 0001–0027 已在 local D1 应用，`PRAGMA foreign_key_check` 为空。
- 共享合同与 HMAC token 测试 16/16 通过。
- 本地 FFmpeg fixture 输出 6 秒、1280 × 720、H.264/AAC proxy。
- Docker image 在本地 arm64 成功构建，镜像内 FFmpeg encoder 检查通过。
- Locale parity 和完整 TypeScript 检查通过。
- Production Next build 与 Wrangler dispatcher dry-run 均已通过。

<a id="final"></a>

## 最终渲染与交付

M6 将当前候选已保存的 project version 变成不可变 final render job。浏览器提交 candidate ID 与该候选的 revision；服务端只复用属于同一候选且内容一致的 snapshot，或先创建新 snapshot，再为同一 version 幂等地创建最终视频与封面资产。

### 产品 API

- `GET /api/video-projects/:id/renders`：列出最终渲染及短期下载 URL。
- `POST /api/video-projects/:id/renders`：创建或复用同一 version 的 final job。
- `DELETE /api/video-projects/:id/renders/:jobId`：取消排队中/执行中的任务，或删除已完成导出的 R2 视频与封面。
- `POST /api/video-projects/:id/renders/:jobId`：重试可重试失败或已取消的任务。
- `GET /api/video-projects/:id/renders/:jobId/download`：下载 ZIP；付费用户包含 MP4、独立 JPEG cover 及已保存的 UTF-8 发布文案，Free 只包含 MP4。

创建接口接受 `candidateId`、`expectedRevision` 与 `idempotencyKey`。revision 负责阻止用过期草稿发起渲染；candidate ownership、idempotency key 和 version 唯一性共同避免不同候选串用草稿或重复输出。Container 使用的对象 URL 有效期为 60 分钟；用户下载通过受认证的打包接口读取当前可用资产。

Free 的创建请求不信任浏览器草稿：服务端从所选 AI candidate 重建默认 EDL 与 Render Spec，并原样导出该候选。Free 不能渲染 manual-origin candidate、不能重试历史 edited render，也不会收到 cover 下载 URL。Creator 和 legacy Basic 继续按当前已保存的 editor draft/version 渲染，并可下载封面。

Migration `0034_latest_final_render.sql` 为 final job 增加 `superseded_at`。同一个 candidate 的新导出
完成后成为唯一可下载版本，服务端立即尝试从 R2 删除旧视频与封面，失败时由 cleanup worker
重试；历史 job row 只保留用于运行诊断。
Migration `0035_final_export_retention.sql` 为已有 final assets 回填完成时间起 30 天的过期时间；
新导出在 callback 验证成功时直接写入相同期限。用户可在期限前主动删除当前导出。

### 执行协议

Cloudflare Queue dispatcher 同时处理 preview 与 final 两类任务。final lease 只签发本次任务需要的对象：原视频只读 URL、可选 Logo/字体只读 URL，以及最终 MP4、封面各自的只写 URL。Cloudflare Container 不持有 R2 永久凭证，也无法列举 bucket 或访问其他用户对象。

容器直接从原视频执行以下流水线：

1. 按不可变 EDL 对连续 source segment seek、trim。
2. Fill 模式使用用户 crop；Fit 模式保留完整画面并按 canvas 背景色填充。Auto 模式使用预览任务缓存的 MediaPipe + TalkNet 取景计划，置信度不足时显示 Fit；手动设置优先。
3. 标准化视频编码；音频保持原始响度和起止，不应用标准化或淡入淡出，无音轨输入自动补静音。
4. 生成带逐字 timing 的 ASS 动态字幕，并应用模板、断行、安全区和自定义字体。
5. 应用品牌署名和 Logo；音频使用固定的原音兼容参数。
6. 编码为 1080 × 1920 H.264/AAC MP4；从指定 timeline 对应的原始源帧独立合成封面，不包含字幕或开头标题。
7. 用 `ffprobe` 校验尺寸、codec、时长和音轨后上传，再回调结果。

最终渲染不会读取 preview proxy，也不会把 proxy 作为中间转码源。
AI 候选为 15–90 秒且只使用一个连续 source segment，不做语义拼接；手动修剪只读取用户上传的 original source，不生成或补写不存在的视频内容。

### 可靠性

- final job 的 Container 渲染超时为 55 分钟；这是异常任务的停止上限，不是正常预计耗时。几十秒输出通常只处理被选中的 source range。lease 与 callback 使用稳定 job token。
- Queue 重投、API 重复请求和 callback 重试均保持幂等。
- 取消会将本地任务置为 canceled，并由 dispatcher 销毁对应 Container。
- provider 已成功但 callback 暂时缺失时保留两分钟恢复窗口，避免过早标记失败。
- callback 只有在 R2 HEAD 与输出元数据都验证通过后才把资产置为 ready。
- 失败使用稳定错误码，重试沿用同一 job/asset 命名空间，避免孤儿输出。

### 本地验证

- `npm run test:video-final`：用本机 FFmpeg 验证多 segment、编码、音频与封面。
- Docker 镜像内以 `TEST_FINAL_CAPTIONS=1` 运行同一 fixture，覆盖 libass 动态字幕。
- `npm run test:video-workspace`：覆盖 Render Spec、job/result contract 与边界校验。
- `npm run build`：验证 Next.js 路由、UI 和服务端模块集成。

上述本地验证发生时，远程 D1 migration 与生产 Cloudflare Container/Queue consumer 尚未发布；后续远程记录见[部署与运维](operations.md)及[后台分析验证](ai-analysis-validation.md)。


### Timed framing and cover selection

The editor supports optional `renderSpec.segments[id].framingRanges`: ordered source-time boundaries, each with its own fill/fit mode and crop. The base crop applies before the first boundary; subsequent settings continue until the next boundary or the content segment end. Source timestamps keep framing attached to the same footage when clip trims change. Boundaries outside the current trim are retained and ignored unless they establish the framing at the trimmed start.

The editor exposes section splitting, shared boundary adjustment and merging with the selected neighbour. Cover selection uses the current playback time and has a separate preview with saved framing and cover overlays; interaction details live in the editing contract.

Final rendering expands content segments into temporary render inputs at framing boundaries, then concatenates them. Original EDL IDs and caption timing remain intact. Existing specs without ranges retain their original rendering behavior. No database migration is needed. Deploy/rebuild the video container before enabling the new editor: older container images ignore the optional framing ranges.

Download ZIP and contained media names use the source title, current visible clip number, and clip title. Internal project version numbers remain in export history rather than filenames.

Validation: workspace contract suite; `test:video-final` exercises multiple framing ranges in one content segment with 1080×1920 output and a 150 ms duration tolerance; `test:video-consistency` checks browser/render crop geometry. Local browser verification covered independent ranges, boundary editing, merge, cover preview, and persistence after reload.

### Automatic speaker framing

Auto framing adds migration `0037_auto_framing.sql` and an updated CPU video image. Apply the migration before deploying the app and worker together. Only local migration/build validation has been performed. See [editing-and-framing.md](editing-and-framing.md#framing) for policy, model provenance, verification, and remaining release evaluation.

### Editor contract

The current manual-section workflow, caption controls and their validation are maintained in [editing and framing](editing-and-framing.md#editing). This renderer reads that saved source-time specification; temporary framing previews do not authorize exporting unsaved edits.

### Publish assets (2026-09-08)

Opening titles use shared browser/ASS layout and bundled fonts. Video and cover can independently reuse valid outputs and retain successful uploads after partial failure. Scoped asset callbacks are enabled only by `supportsPartialAssets`, preserving old-app lease compatibility. Publishing copy is frozen in the render version or a revision-checked download package; editing later cannot change the requested package. See [publish preparation](publish-preparation.md) for exact dependencies and migration → Container → application release order. Historical validation notes above apply to their original revisions.

<a id="consistency"></a>

## 预览与成片一致性

M7 把 Browser Preview 与 Final Renderer 的呈现规则变成可执行契约，并修复了本阶段发现的实际偏差：浏览器原先围绕中心缩放、字幕字号偏小、依赖 CSS 自动断行；renderer 的 karaoke 语义也不是“仅当前单词高亮”。

### 共享契约

`lib/video-workspace/presentation.ts` 定义以下稳定规则：

- 根据源画面宽高、crop x/y 和 zoom 计算覆盖 1080 × 1920 canvas 的像素矩形。
- 三个字幕模板的字号、字重、box、outline、shadow 和 uppercase 行为。
- 按 Unicode 字符数与最大行数进行逐词断行。
- 当前高亮单词的半开时间区间 `[sourceStartMs, sourceEndMs)`。
- Logo 宽度、四角安全偏移和 signature 品牌线高度。

Browser Preview 使用该模块计算实际 CSS 尺寸和位置。Final Renderer 使用同一组数值规则生成 FFmpeg crop、ASS 字幕与 overlay；契约测试逐项比较两个 adapter。

renderer 的逐字高亮现在按每个 word interval 生成稳定 ASS event：非活动单词保持正文颜色，只有当前单词使用 highlight color。这样避免 karaoke fill 在单词播放结束后留下不同颜色。

### 固定 fixture 与视觉回归

`scripts/video-workspace/fixtures/presentation-v1.json` 固定源尺寸、crop、品牌、安全偏移、字幕参数和三个模板。验证命令：

- `npm run test:video-consistency`：比较 crop、Logo、模板、断行、颜色和逐字 timing 的 Browser/Renderer 契约。
- `npm run test:video-visual-parity`：生成同一 1600ms 源帧，分别由无头 Chrome 和 Final Renderer 截图，再以 FFmpeg SSIM 比较 1080 × 1920 输出。
- `npm run test:video-final`：验证两段 EDL concat、音视频总时长、codec、尺寸和封面。
- Docker 内以 `TEST_FINAL_CAPTIONS=1` 运行 final fixture，验证 libass 真实字幕渲染。

当前视觉 fixture 的 SSIM 为 `0.984769`，golden 下限为 `0.97`。fixture 会在 crop、Logo 或品牌线出现明显漂移时失败。

### 明确允许的差异

- 编辑器 safe-area 虚线是操作辅助，不进入最终视频。
- 播放按钮和 timeline 控件属于编辑器 chrome，不进入最终视频。
- 浏览器字体栅格器和 libass 会有亚像素抗锯齿差异；字号、行、位置、颜色与当前高亮单词必须一致。
- Render Spec 仍保留音频兼容字段，但当前产品固定为 0 dB gain、不做响度标准化或淡入淡出；Browser Preview 与 Final Renderer 都保留原始音轨的响度和起止。

这些差异在 UI 或本文档中明确，不视为 silent mismatch。
