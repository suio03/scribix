# Cloudflare Containers 视频渲染 POC

> 日期：2026-09-02
> 结论：功能与单任务成本达标；可以作为生产执行层方向继续推进，但生产接入前必须加入 Queue、容量重试和完整观测。

## 目标与边界

本 POC 只验证隔离的 Cloudflare Worker、R2 和 Containers 链路，不连接 Scribix 正式用户、生产 D1 或生产媒体桶。执行模型是一份 FFmpeg render job 对应一个容器实例，POC `max_instances` 为 3。

测试源为 153.667 秒、31,611,776 bytes、1280 × 720、30 fps 的 H.264/AAC 视频。源文件名、内容、字幕、URL 和用户信息不写入 POC report。由于输入本身是 720p，本次只能验证输出规格和 720p → 1080 × 1920 的处理链路，不能代表原生 1080p 输入的最终性能。

三个用例均包含 9:16 裁切、字幕烧录、音频响度标准化、H.264/AAC 编码和封面提取：

| 用例 | source segments | 输出时长 |
|---|---:|---:|
| continuous-15s | 1 | 15 秒 |
| continuous-30s | 1 | 30 秒 |
| splice-45s | 3 | 45 秒 |

`splice-45s` 只用于验证 FFmpeg concat 与资源上限，不代表当前 AI 产品策略。V1 的 AI 候选始终为一个连续 segment；只有用户手动编辑的 EDL 可以包含最多 3 段。

## Cloudflare 实测结果

资源配置：1 vCPU、3 GiB memory、6 GB disk、最多 3 个实例。所有输出均由 `ffprobe` 验证为精确时长、1080 × 1920、H.264 video + AAC audio。

| 用例 | source 传输 | FFmpeg render | 写回 R2 | 单 job 总耗时 | 实时系数 | 输出大小 | 估算容器费用 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 15 秒连续片段 | 3.063s | 49.493s | 1.184s | 54.293s | 3.300× | 9.06 MB | $0.001516 |
| 30 秒连续片段 | 2.535s | 70.263s | 1.222s | 74.567s | 2.342× | 12.24 MB | $0.002082 |
| 45 秒三段拼接 | 2.509s | 118.367s | 1.910s | 123.288s | 2.630× | 19.83 MB | $0.003442 |

三份成片的容器费用合计估算为 `$0.007040`。该数值是按 POC 资源运行时间计算的 container compute estimate，不是最终账单；不包含 R2 存储/操作、Worker/Queue 请求、转录、AI 分析、网络和产品层成本。三个单任务均低于 `$0.01` 目标。

性能判断：15 秒和 30 秒成片落在 30–90 秒常规目标内；45 秒三段拼接为 123.288 秒，略超 2 分钟，但仍低于 3 分钟极端上限。V1 的 AI 候选上限保持 45 秒是合理的；不能据此承诺所有 45 秒任务都在 90 秒内完成。

## Smart Reframe 第二阶段实测

第二阶段在同一个 POC image 中加入 MediaPipe Tasks `1.0.1`、BlazeFace full-range model 和 FFmpeg。依赖与模型在 image build 时安装并校验，实例启动时不会重新安装。MediaPipe 仅输出匿名人脸位置与置信度，实际截取、动态裁切、拼接和编码仍由 FFmpeg 完成。

判断策略是保守的单主讲人模式：按 5 fps 分析候选片段；人脸覆盖、多人歧义、横向跳动和安全裁切宽度全部达标才使用 `smart_crop`，否则整段回退为 `fit_blur`。测试不持久化分析帧或人脸坐标。

真实测试源为 1,569.888 秒、622,186,879 bytes、3840 × 2160 AV1 + Opus 的 MKV。另生成一份不修改原文件的 1080p H.264/AAC 临时代理，用于快速迭代。测试发现 30–45 秒区间含多位讲者与片尾卡，因此正确回退；60–75 秒是连续单人讲述，作为正向智能裁切用例。

本地容器在 1 vCPU / 3 GiB 限制下的完整矩阵：

| 用例 | MediaPipe 分析 | FFmpeg render | 总耗时 | 模式 | 估算费用 |
|---|---:|---:|---:|---|---:|
| 15 秒连续片段 | 2.689s | 55.682s | 58.371s | smart crop | $0.001867 |
| 30 秒连续片段 | 4.355s | 91.847s | 96.202s | fit + blur | $0.002924 |
| 45 秒三段拼接 | 6.468s | 161.516s | 167.983s | 3 段 smart crop | $0.004928 |

Cloudflare 远程 15 秒端到端结果：

| 输入 | R2 → Container | MediaPipe 分析 | FFmpeg render | 写回 R2 | 总耗时 | 估算费用 |
|---|---:|---:|---:|---:|---:|---:|
| 121 MiB、1080p H.264 代理 | 4.662s | 25.534s | 40.322s | 0.316s | 71.432s | $0.001994 |
| 593 MiB、4K AV1 原始 MKV | 14.682s | 33.637s | 51.669s | 0.471s | 100.987s | $0.002820 |

两次远程输出均经 `ffprobe` 和抽帧检查：精确 15 秒、1080 × 1920、H.264/AAC；75/75 分析帧检测到稳定主讲人，使用动态智能裁切。测试完成后源、output、cover、report 均删除，输出 URL 返回 `404`，对应容器被销毁。

上传验证同时确认了两个不同限制：Worker 单请求体无法承载 121 MiB 代理，Wrangler CLI 单文件上传上限为 300 MiB。POC 因此实现 R2 multipart upload，每个 part 64 MiB；593 MiB MKV 由 10 个 part 成功合并。生产上传不能经过单个 Worker request body，必须使用浏览器到 R2 的签名 multipart 流程。

## 并发与容量发现

`max_instances = 3` 表示整个 Container application 最多运行 3 个实例，不是一个实例并发处理 3 个 FFmpeg jobs。每个实例在本 POC 中只执行一个 job。

测试还发现：即使配置上限为 3，三个冷实例同时启动时，Cloudflare 仍可能暂时返回 `Maximum number of running container instances exceeded`。最终批次中 15 秒和 30 秒任务先并行执行；45 秒任务经过一次容量重试，在约 23 秒后获得实例并成功完成。因此：

- `max_instances` 是硬上限，不是立即可用容量的 SLA。
- 生产请求不能直接同步硬打 Container；必须先进入 Cloudflare Queue。
- Consumer 必须限制并发，对容量错误使用有上限的退避重试，并把穷尽重试的任务送入 DLQ。
- 一个 job 完成或取消后立即销毁其唯一容器；不要保留 30 秒 warm window，因为该 job ID 不会复用。
- 必须记录匿名技术指标：queue wait、cold start/source transfer、render、persist、total、capacity retry、失败类别和单 job 成本。

## POC 交付与安全状态

- POC Worker、Container application 和专用 private R2 bucket 与生产资源隔离。
- API 使用独立 bearer secret；容器禁止公网访问，容器内不持有 Cloudflare/R2 永久凭证。
- R2 输出流使用固定长度流写回，避免 Worker 缓冲整份成片。
- 测试下载完成后删除临时 source、output、cover 和 report；测试容器已停止或 inactive。
- POC 基础设施暂时保留以便复测；没有运行实例时不产生 container compute runtime，是否删除由后续收尾决定。

## 进入生产前的下一步

1. 把现有 AWS-shaped dispatcher 替换为 Cloudflare Queue consumer + Container Durable Object；Render Job contract 保持供应商无关。
2. 实现 D1 lease/idempotency、Queue retry/DLQ、取消、超时、任务后强制销毁和孤儿清理。
3. 用真实 1080p talking-head/podcast 样本跑 15/30/45 秒矩阵，并比较 1 vCPU 与 2 vCPU 的 p50/p95 和单位成本。
4. 压测至少 `3 active + queued jobs`，确认不会丢任务、重复扣费或覆盖成功输出。
5. 满足性能、成本、安全和删除策略后，才把 POC binding 合并进生产 `wrangler` 配置并进行 allowlist smoke test。
