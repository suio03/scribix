# AI 短视频工作台外部设置清单

本清单只描述生产环境动作。M0–M9 开发期间没有执行 remote migration、Cloudflare deploy、ECR push、AWS 资源创建或真实用户开放。

## 1. Cloudflare D1 与 R2

1. 先备份生产 D1，再确认待执行 migrations 为 `0025`–`0031`，运行 `npm run db:migrate:remote`。
2. migration 后执行 `PRAGMA foreign_key_check`，确认无结果；检查两个 `render_jobs_final_*` triggers 存在。
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

生成至少 32-byte 随机 `VIDEO_WORKER_SIGNING_SECRET`，在主 Scribix Worker 和 video-render dispatcher 上配置相同值。dispatcher 另需：

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- 如使用短期凭证：`AWS_SESSION_TOKEN`
- `VIDEO_RENDER_VCPU_MICROUSD_PER_HOUR`
- `VIDEO_RENDER_MEMORY_GB_MICROUSD_PER_HOUR`
- `VIDEO_RENDER_PER_JOB_MICROUSD`
- `VIDEO_RENDER_COST_MODEL`

价格变量使用 AWS `ap-southeast-2` 当日官方费率，不把价格或凭证提交到仓库。主 Worker 继续需要用于 R2 签名的既有 `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`，其 token 只授予 `scribix-media` object read/write，不授予账户级管理权限。

保持 `VIDEO_WORKSPACE_ROLLOUT_PERCENT=0`，仅在 smoke test 前把内部 user ID 加入 `VIDEO_WORKSPACE_PILOT_USER_IDS`。

## 3. AWS ECR 与镜像

1. 创建 immutable `scribix-video-render` ECR repository，启用 scan-on-push / enhanced scanning。
2. 构建 `linux/amd64` 镜像，运行 `npm run test:video-security`、24-case benchmark 和 Trivy HIGH/CRITICAL gate。
3. 推送后只使用 image digest 创建 job definition revision，不使用可漂移的 `latest`。
4. HIGH/CRITICAL 未修复漏洞、未知 base-image digest 或 benchmark 失败时停止部署。

## 4. AWS IAM、Batch 与网络

1. 用 `docs/video-workspace/aws/dispatcher-iam-policy.json` 创建 dispatcher principal policy，替换 `REGION` / `ACCOUNT_ID`，并把资源名保持为 `scribix-video-render`。如 AWS 对 Describe/Terminate 不支持 resource-level restriction，保留模板中的 `*`，同时用独立 principal、CloudTrail 和无其他 AWS 权限限制 blast radius。
2. 用 `execution-role-policy.json` 创建 ECS task execution role：只能拉指定 ECR repo、写指定 CloudWatch log group。
3. container task role 不附加 policy，也不注入 AWS 或 R2 credentials。
4. 创建 Fargate On-Demand compute environment 和 `scribix-video-render` job queue。security group 无 inbound，只允许所需 HTTPS egress；private subnet 使用受控 NAT/VPC endpoints，或明确评估 public-IP 成本与风险。
5. job definition 使用镜像 digest、50 GiB ephemeral storage、只写临时目录、CloudWatch logs 和 60 分钟上限。preview 由 dispatcher override 为 1 vCPU / 2 GiB，final 为 2 vCPU / 4 GiB。
6. 注册 revision 后把 `wrangler.video-render.jsonc` 的 `AWS_BATCH_JOB_DEFINITION` 更新为实际 revision。

## 5. 部署与观测

按以下顺序：D1 migrations → ECR/Batch → Queue/DLQ → 主 Next/OpenNext app → video-render dispatcher → cleanup worker。不要在 schema 或 Batch 尚未就绪时打开 rollout。

配置并验证：

- Queue/DLQ、Batch failed/timeout、ECR scan 和 CloudWatch error alarms。
- `video_render_metrics` 的 queue depth、p50/p95 start/render/total、success/retry rate。
- `video_render_cost_rates_missing` 必须为零，所有成功任务都有 cost model。
- cleanup retry、orphan assets 和 source/proxy retention。
- 日志不得出现 signed URL、Authorization、R2 key、transcript 或字幕内容。

## 6. Production smoke 与试点

使用 allowlist 内部账号依次验证：横屏有声、竖屏静音、多 segment、三个字幕模板、Logo/字体、取消、重试、重复 idempotency key、源过期、视频/封面下载、账户删除。确认 Final Render 只读取 original source。

随后按 `m9-pilot-rollout.md` 邀请 5–10 位真实 talking-head/podcast 用户。开放前由负责人确认隐私说明、AWS/转录处理披露、7/30/90 天源保留、5/25/100 GiB 存储额度、render 使用量/成本转嫁规则与套餐文案。达到阶段阈值后再从 0% 提升至 5%，不得直接全量开放。
