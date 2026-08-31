# AI 短视频工作台 M3 Preview Proxy Pipeline

> 状态：本地实现与验证完成；云端资源尚未创建或发布
> Migration：`0027_preview_proxy_jobs.sql`
> Provider：AWS Batch + Fargate On-Demand

## 范围与边界

M3 为每个候选 segment 单独生成带 5 秒 handles 的轻量 proxy。Proxy 固定使用
`preview-720p-v1`：最长边 1280、H.264、AAC、MP4 `faststart`。它保留源画幅，不烧入字幕、
品牌或最终 9:16 crop，也绝不会成为最终 renderer 的输入。

候选前 3 名在 M2 保存成功后自动入队；其余候选由用户首次打开时懒生成。每个 segment
独立拥有 job、asset、幂等键和错误状态，因此一个坏 segment 不会影响 transcript、其他候选
或已成功的 proxy。Proxy 保存 7 天，到期后由 cleanup worker 删除 R2 object 并软删除 asset。

## 数据合同

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

## 请求流

```text
Candidate API
  -> D1 创建 preview render_job + pending media_asset
  -> Cloudflare Queue: { schemaVersion, jobId }
  -> Dispatcher 原子 claim job
  -> AWS Batch SubmitJob
  -> Fargate container 使用 job-scoped token 获取 lease
  -> 15 分钟 signed R2 GET / PUT
  -> ffprobe source -> FFmpeg proxy -> ffprobe output -> R2 PUT
  -> authenticated result callback
  -> D1 job completed + asset ready
```

队列 payload 不含用户内容、R2 key、signed URL 或凭证。Dispatcher 用共享 secret 为具体 jobId
生成 HMAC token；容器只拿到该 scoped token。Internal API 重新读取 D1 的受控范围并签发精确
object URL，容器没有永久 R2 凭证，也不能把一个 job 的 token 用于另一个 job。

## API

- `GET /api/video-projects/{projectId}/candidates`：候选及全部 preview 状态。
- `GET /api/video-projects/{projectId}/candidates/{candidateId}/previews`：获取 ready segment 的
  5 分钟播放 URL。
- `POST /api/video-projects/{projectId}/candidates/{candidateId}/previews`：懒生成或重试失败 job。
- 同一 POST 可传 `{ segmentIndex, sourceStartMs, sourceEndMs }`；只有超出已有 handles 才创建
  单 segment 新 proxy version。
- `POST /api/internal/video-jobs/{jobId}/lease|progress|result`：仅接受 job-scoped bearer token。

Result callback 只接受稳定 error code，且 completed output 必须通过 duration、dimension、H.264/
AAC 和 R2 object existence 检查。Worker 日志不输出 token、signed URL 或媒体内容。

## Dispatcher 与 reconciliation

`workers/video-render-dispatcher.ts` 同时处理 Queue 和每 5 分钟一次的 cron：

- D1 原子 claim 阻止普通重复 delivery 产生两次 SubmitJob。
- provider adapter 隔离 AWS Batch API；应用侧 job contract 不依赖 AWS 字段。
- SubmitJob 失败使用指数退避，5 次失败后把单 segment 标记为 `provider_unavailable`。
- queued job 未 dispatch 或 preparing claim 中断时重新入队。
- `DescribeJobs` 把 AWS STARTING/RUNNING/FAILED 状态同步回 D1。
- AWS 成功但 result callback 缺失时标记 `upload_failed`，避免永久卡住。

AWS Batch SubmitJob 本身没有调用方幂等键；dispatcher 在“AWS 已接受、D1 尚未保存 provider job
ID”之间仍存在极小 crash window。恢复时可能产生重复 provider job，但 deterministic output key、
scoped callback 和 D1 终态保证用户只看到一个结果。后续可用 provider event ledger 进一步消除
这部分计算重复。

## Container

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
检查通过。正式 ECR build 必须记录 image digest，并让 AWS Batch job definition 的 CPU
architecture 与 image platform 一致。

## 云端发布清单（尚未执行）

1. 创建 `scribix-video-render` 与 `scribix-video-render-dlq` Cloudflare Queues。
2. 创建 ECR repository，构建、扫描并 push container，记录 immutable digest。
3. 创建 AWS Batch Fargate On-Demand compute environment、job queue 和 job definition。
   Preview 基线建议 1 vCPU、2 GiB memory、30 分钟 timeout、单次 attempt。
4. Job execution role 只允许拉 ECR image 和写 CloudWatch Logs；container 不需要 R2 或 D1 IAM。
5. Dispatcher IAM 只允许对指定 job queue/definition `batch:SubmitJob`，以及 reconciliation 所需
   `batch:DescribeJobs`。
6. 为 app 和 dispatcher 设置同一 `VIDEO_WORKER_SIGNING_SECRET`；只为 dispatcher 设置
   `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`，如使用短期凭证再设置 `AWS_SESSION_TOKEN`。
7. 确认 `AWS_REGION`、`AWS_BATCH_JOB_QUEUE`、`AWS_BATCH_JOB_DEFINITION` 和
   `SCRIBIX_INTERNAL_URL` 后部署 `wrangler.video-render.jsonc`。
8. 应用 remote migration `0027`，再部署包含 Queue producer binding 的 Next app 与更新后的
   cleanup worker。

上述顺序避免应用先向不存在的 queue 投递。任何 remote migration、queue 创建、AWS 资源创建、
镜像 push 或 deployment 都需要单独批准。

## 验证记录

- Migrations 0001–0027 已在 local D1 应用，`PRAGMA foreign_key_check` 为空。
- 共享合同与 HMAC token 测试 16/16 通过。
- 本地 FFmpeg fixture 输出 6 秒、1280 × 720、H.264/AAC proxy。
- Docker image 在本地 arm64 成功构建，镜像内 FFmpeg encoder 检查通过。
- Locale parity 和完整 TypeScript 检查通过。
- Production Next build 与 Wrangler dispatcher dry-run 均已通过。
