# AI 短视频工作台外部设置清单

本清单只描述生产环境动作。M0–M9 开发期间没有执行 remote migration 或真实用户开放。2026-09-02 已部署一个与生产隔离的 Cloudflare Containers POC；它不代表生产接入已经完成。此前的 AWS Batch 方案已被 Cloudflare Containers 方向取代，不要再按旧 AWS 步骤创建资源。

## 1. Cloudflare D1 与 R2

1. 先备份生产 D1，再运行 `npx wrangler d1 migrations list scribix-db --remote` 核对待执行列表。本次视频工作台所需 migrations 为 `0025`–`0037`；已应用的迁移无需重复执行，使用 `npm run db:migrate:remote` 应用剩余迁移。
2. migration 后重新查询待执行列表，确认无待应用迁移；执行 `PRAGMA foreign_key_check`，确认无结果。检查两个 `render_jobs_final_*` triggers、`0036` 重建的 preview/final active-scope 唯一索引及 `0037` 新增的 `media_assets.auto_framing_json` 字段存在。
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

## 2. Cloudflare Queue、secrets 与 variables

创建 `scribix-video-render` 和 `scribix-video-render-dlq`，确认 `wrangler.jsonc` 是 producer、`wrangler.video-render.jsonc` 是 consumer，最大 retry 为 5 且 DLQ 绑定正确。

生成至少 32-byte 随机 `VIDEO_WORKER_SIGNING_SECRET`，在主 Scribix Worker、Queue consumer 和 Container job callback 上配置相同值。Container 不得接收 R2 永久凭证；由 Worker 以 job-scoped stream 或短期签名 URL 提供输入和接收输出。

为生产 Worker/consumer 配置 Containers Durable Object binding、R2 binding、Queue binding 和独立的成本费率变量。费率以部署当日 Cloudflare Containers 官方价格为准，不把 secret 或账户级凭证提交到仓库。主 Worker 如继续使用 R2 S3 signed URL，只授予 `scribix-media` object read/write，不授予账户级管理权限。

默认保持 `VIDEO_WORKSPACE_ROLLOUT_PERCENT=100`。仓库未准备完成前不要部署到生产；百分比和 `VIDEO_WORKSPACE_PILOT_USER_IDS` 只作为以后需要灰度或紧急止损时的控制手段。

## 3. Cloudflare Container 镜像

1. 使用固定 digest 的 Debian/Node base image 和固定 FFmpeg 版本构建 `linux/amd64` 镜像，保留 `libx264`、AAC、`subtitles`/libass 和 `ffprobe` 启动检查。
2. 运行 `npm run test:video-security`、render benchmark、真实 1080p 15/30/45 秒矩阵和 HIGH/CRITICAL 镜像漏洞 gate。
3. Container 使用非 root user、只写 job 临时目录，不注入 Cloudflare API token 或 R2 key。当前实现只为 job-scoped internal callback 与短期 signed R2 URL 开启出站网络；不得把 URL、transcript 或字幕写入日志。
4. 镜像 digest、FFmpeg 版本、Render Spec schema、资源 profile 或 benchmark 不可确认时停止生产部署。

## 4. Cloudflare Containers 与调度

1. Queue consumer 只接收 `jobId`，先取得 D1 lease 和 idempotency lock，再通过 `getByName(jobId)` 启动唯一 Container；一个实例只处理一个 FFmpeg job。
2. `max_instances` 是 application 总上限，不是每个实例的并发数，也不是立即可用容量承诺。根据 pilot 数据设置生产上限，同时在 Queue consumer 设置更小或相等的并发阈值。
3. 对临时容量不足、冷启动和可重试 5xx 使用有上限的指数退避；穷尽重试进入 DLQ。不得因某个实例暂不可用而丢弃整个批次。
4. job 成功、失败、取消或超时后强制销毁其 Container。唯一 job ID 不保留 warm instance；定期清理 stuck/orphan instances 和 R2 partial outputs。
5. source 和 output 通过 Worker/R2 受控传输。R2 输出必须使用已知长度的 stream；禁止在 Worker 内缓冲超大成片，禁止把永久凭证传入容器。
6. 当前生产配置（`wrangler.video-render.jsonc`）为 1 vCPU / 3072 MiB / 6000 MB、最多 10 个单任务实例，`VIDEO_RENDER_MAX_CONTAINERS=10`；Queue consumer 的 `max_concurrency=1`、`max_batch_size=10`。本地配置仍限制为 1 个实例。上线后以真实 1080p 的 p50/p95、失败率和单位成本决定是否增配或扩容。
7. POC 的公开 bearer endpoint 只用于隔离验证；生产入口必须经过 Scribix auth、ownership、job-scoped token 和内部 Queue 流程。

## 5. 部署与观测

按以下顺序：D1 migrations → private R2/CORS → Container image/application → Queue/DLQ consumer → 主 Next/OpenNext app → cleanup worker。默认 rollout 为 100%，因此 schema、Container 调度和其他依赖未就绪时不要部署主应用。

配置并验证：

- Queue/DLQ、Container capacity/cold-start/failed/timeout、镜像扫描和 Worker error alarms。
- `video_render_metrics` 的 queue depth、p50/p95 start/render/total、success/retry rate。
- `video_render_cost_rates_missing` 必须为零，所有成功任务都有 cost model。
- cleanup retry、orphan assets、source/proxy retention、30 天 final export expiry 与 superseded export 清理。
- 日志不得出现 signed URL、Authorization、R2 key、transcript 或字幕内容。

## 6. Production smoke 与试点

使用 allowlist 内部账号依次验证：横屏有声、竖屏静音、连续片段修剪、Fill 拖动裁切与 Fit 模式、三个字幕模板、Logo/字体、取消、重试、重复 idempotency key、源过期、ZIP 下载、成片删除、账户删除。确认 Final Render 只读取 original source，同一 candidate 的新导出会替换旧导出。

同时验证公开入口：`/` 继续承接 AI video clipper 首页，`/video-to-text` 及五个 locale 版本承接原视频转文字页面；检查侧边栏链接、上传后登录回跳、自引用 canonical、reciprocal hreflang、Open Graph、JSON-LD 和 sitemap 记录。

随后按 `m9-pilot-rollout.md` 验证真实 talking-head/podcast 用户流程。生产部署前由负责人确认隐私说明、Cloudflare Containers/转录处理披露、7/30/30 天源保留、5/25/100 GiB 存储额度、render 使用量/成本转嫁规则与套餐文案；确认完成后以默认 100% 上线。
