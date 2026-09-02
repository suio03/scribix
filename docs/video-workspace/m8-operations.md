# M8 安全、监控与成本控制

M8 的本地实现覆盖输入边界、任务资源边界、恢复路径和可观测数据。生产 Cloudflare Containers 容量、镜像扫描、Queue/DLQ 告警和实际价格仍需在外部平台确认；仓库内已提供校验脚本和配置清单。

## 安全边界

- preview 与 final 当前共用 1 vCPU / 3 GiB / 6 GB 的 Container profile，application `max_instances=3`，Queue consumer `max_concurrency=1`。final 的单次 FFmpeg 执行有 55 分钟异常停止上限。
- 同一用户最多两个 active final jobs，滚动 24 小时最多创建 20 个 final jobs。API 先返回可读的 `429`，D1 trigger 再关闭并发请求的竞态窗口。
- Render Spec 最长输出 60 秒、最多 3 segments；AI 候选本身只使用一个连续 segment。源视频和品牌资产沿用套餐、字节数和时长限制。
- Logo/字体完成上传时同时检查对象大小与 magic bytes；伪装为图片或字体的内容会从 R2 删除并标记失败。
- 原视频、Logo、字体、输出和封面全部使用 job-scoped 短期 URL。Container 不持有 R2 凭证，不能列举 bucket。
- internal lease/progress/result 使用 job-scoped HMAC bearer token；浏览器会话不能调用这些内部流程。
- renderer base image 以 digest 固定，FFmpeg、MediaPipe 和模型 checksum 固定，进程使用非 root `node` 用户，SSH 关闭。
- Queue 只传 `jobId`；consumer 通过 Durable Object `getByName(jobId)` 启动唯一实例，并在容量不足时退避重试。Container 只接收 job token 与 internal URL。

执行 `npm run test:video-security` 会校验镜像固定、非 root、MediaPipe 固定、Containers binding/规格、Queue 并发和容器无对象存储凭证。设置 `TRIVY_IMAGE=<image reference>` 后，该命令还会阻断含未修复 HIGH/CRITICAL 漏洞的镜像；生产发布前必须检查固定镜像版本的扫描结果。

## 恢复与清理

- dispatcher 每五分钟重新入队遗失的 queued/preparing jobs，并通过 Container state 恢复 running/failed/succeeded 状态。
- provider 成功后留两分钟等待签名 callback；callback 丢失则稳定失败为 `upload_failed`。provider 状态连续缺失 15 分钟则失败为 `provider_unavailable`。
- stale job 失败时只修改 job 与其 output/cover assets，不泄露用户对象路径。
- cleanup worker 删除超过 24 小时且没有 render job 的 pending/uploading 品牌或输出资产，以及超过 7 天的同类 failed orphan assets。
- source/proxy retention、账户删除和项目删除继续由原有 lifecycle sweep 执行；R2 删除确认后才清除 D1 引用。

## 监控事件

dispatcher 每五分钟输出一条不含用户 ID、源 URL、R2 key 或字幕内容的 `video_render_metrics` JSON：

- D1 任务状态近似 queue depth。
- 最近 24 小时 sample、completed、failed、success rate 和 retry rate。
- start latency 与 total latency 的 p50/p95。
- 按 `input`、`storage`、`provider`、`renderer` 聚合的稳定错误类别。
- 已完成任务的 estimated cost 总额。

建议外部告警：DLQ 非空立即告警；queued 连续 10 分钟超过 20；至少 10 个样本时成功率低于 95%；p95 start latency 超过 10 分钟；cleanup retry 非零；出现 `video_render_cost_rates_missing`；Container 容量重试、超时或 provider error category 在 15 分钟内连续出现。

## 成本记录

Migration `0030_render_operations.sql` 保存 provider submit、upload start、complete 时间，以及 billable duration、estimated cost 和 cost model。dispatcher 使用当前配置费率为每个成功任务写入一次估算，重复 cron 不会重复计费。

部署 dispatcher 时必须配置以下非秘密变量，单位都是 micro-USD：

- `VIDEO_RENDER_VCPU_MICROUSD_PER_HOUR`
- `VIDEO_RENDER_MEMORY_GB_MICROUSD_PER_HOUR`
- `VIDEO_RENDER_PER_JOB_MICROUSD`（可为 `0`，用于覆盖公网/NAT、日志等固定摊销）
- `VIDEO_RENDER_COST_MODEL`（例如 `cloudflare-containers-1vcpu-3gib-2026-09`）

preview 与 final 都按当前 1 vCPU / 3 GiB profile 估算。费率缺失或非法时不会写入误导性的零成本，而是输出 `video_render_cost_rates_missing`。价格或 Container profile 更新时必须同时变更代码、变量与 model 名；历史记录保留原 model。
