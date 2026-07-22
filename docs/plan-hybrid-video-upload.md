# 混合视频上传架构（客户端提取 + 原视频直传 + 14 天临时存储）

> 状态：v0.17.0 已于 2026-07-19 合入 `main`；仍需生产/预览环境大文件与 AAI 端到端验证，并配置 Cloudflare cleanup 持续失败告警。不需要 D1 migration。

## 背景与目标

15 天 Plausible 数据中，61% 的 `transcribe_fail` 来自视频大小限制或客户端提取失败：

| 错误 | 次数（15d） | 性质 |
|---|---:|---|
| `video_file_too_large` | 103 | 1GB 上限直接阻断大视频 |
| `extraction_timeout` | 41 | 浏览器端 ffmpeg.wasm / codec / 加载问题 |
| `cannot_read_metadata` | 13 | 浏览器无法读取容器或 codec 元数据 |
| `audio_extraction_failed` | 2 | 客户端提取失败 |

目标：

- 大视频不再被统一的 1GB 上限阻断。
- 浏览器无法读取元数据或提取音频时，自动降级为原视频直传。
- 上传和转录关键路径保持 serverless，不增加自有 FFmpeg server 依赖。
- 转录完成后可在媒体保留期内直接使用原视频回放。
- 所有上传媒体统一保留 14 天；到期删除媒体，但保留 transcript 文本。

## 已拍板的产品决策

- Free 视频上限：**2GB**。
- Basic / Pro 视频上限：**4.9GB**；产品文案可统一显示“最高 5GB”。代码使用明确的安全字节值，不正好卡在上游极限。
- 音频文件上限保持 1GB。
- 小于等于 1GB 的视频优先在浏览器提取音频。
- 大于 1GB 的视频直接上传原视频，不运行浏览器提取。
- 浏览器提取或元数据读取失败后，**自动**上传原视频，不再要求用户二次确认。
- 原视频使用 R2 multipart upload；普通音频和客户端提取后的 MP3/WAV 继续使用单次 PUT。
- 原视频不再后台转换为 MP3；在 R2 Standard 中临时保存 14 天并直接用于回放。
- completed media 由现有 cleanup worker 在超过 14 天后删除；cleanup 是媒体到期删除的唯一机制。
- transcript JSON 和文本不随媒体到期删除。
- 不新增 `media_extraction_jobs`，本方案不需要 D1 migration。

## 为什么暂不提取音频

- 方案确认时 R2 Standard 为 `$0.015 / GB-month`，一个 2GB 视频保存 14 天的理论边际存储费约为 `$0.014`；后续成本评估应重新核对当前价格。
- R2 对外出口流量免费；当前阶段节省的存储费不足以覆盖 FFmpeg server、任务状态机、重试和媒体切换的实现复杂度。
- 原视频本来就要供 AssemblyAI 拉取，转录完成后继续复用同一个对象即可回放。
- 等真实数据证明回放兼容性、存储规模或请求成本成为问题后，再单独评估后台音频瘦身。

## 上游与当前基础设施边界

- AssemblyAI `/v2/transcript` 的 URL 提交支持音频或视频，最大 5GB / 10 小时；2.2GB 仅是 `/v2/upload` 的限制，本项目不使用该上传端点。
- R2 单次 PUT 的实际限制约为 4.995 GiB，但大文件按 Cloudflare 推荐使用 multipart upload。
- `scribix-media` 当前 `default_storage_class` 已确认为 **Standard**，不是 Infrequent Access。
- 当前 bucket lifecycle 只有“7 天后中止未完成 multipart”，没有媒体到期删除或 storage class transition。
- 媒体、transcript JSON 和 translations 共用 `users/{userId}/{transcriptId}/` 前缀。R2 lifecycle 只支持前缀匹配，无法只命中 `source.*`；因此不增加媒体 expiration lifecycle，也不为此改造现有 key 布局。
- 14 天产品期限由应用 `created_at` 判定，现有 cleanup worker 是媒体到期删除的唯一机制；删除失败必须保留 DB key / row，供下一次每小时任务重试。

## 目标流程

```text
小视频 happy path：
浏览器读取时长 → 客户端提取 MP3/WAV → 单次 PUT 到 R2 → AAI → 完成
  → 14 天内回放音频 → cleanup 删除媒体

大视频或 fallback：
文件 >1GB / metadata 失败 / 提取失败
  → multipart 上传原视频到 R2
  → R2 HEAD 验证真实对象
  → AAI 直接转录视频 URL
  → 14 天内直接回放原视频
  → cleanup 删除原视频并清空 audio_r2_key
```

页面始终访问稳定的应用媒体端点。媒体到期前，底层对象保持不变；到期后端点返回 410，transcript 文本仍可正常访问。

## 未知时长的处理

`cannot_read_metadata` 通常表示浏览器不支持该容器/codec、文件元数据异常或文件损坏，不代表 AssemblyAI 一定无法读取。

当浏览器无法得到 duration 时：

1. 仍允许进入原视频直传。
2. 服务端使用 `min(套餐单文件时长上限, 用户当前剩余分钟数)` 作为保守预留时长。
3. 将该预留值按现有协议转换为毫秒：`audio_end_at = reservedMinutes * 60 * 1000`，交给 AAI 硬性限制实际处理范围和成本。
4. AAI 完成后按返回的真实 `audio_duration` 对预留分钟进行 reconciliation。
5. 若用户没有剩余额度，在开始 multipart 上传前直接拒绝。

这意味着未知时长的视频可能只转录允许额度内的前半段，但不会绕过套餐上限或耗尽未授权的 AAI 时长。

## Phase 1 — 应用侧直传与回放

### 1. 套餐限制

`lib/plans.ts`：

- Free `maxVideoUploadBytes` → 2GB。
- Basic / Pro `maxVideoUploadBytes` → 4.9GB 的明确安全字节值。
- `maxFileBytes` 保持 1GB。

前端展示值与服务端限制来自同一配置或共享常量，避免 UI 与 API 漂移。产品可以显示“最高 5GB”，不需要展示 4.9GB 的工程安全边界。

### 2. 初始化与媒体状态

`app/api/transcripts/init/route.ts`：

- 使用 `directVideo: boolean` 区分原视频直传和已提取音频。
- `directVideo` 时保留经过白名单校验的原扩展名和 MIME，R2 key 使用 `source.mp4` 等真实后缀。
- 现有 `audio_r2_key` 继续表示可回放的 active media；直传视频也写入该字段，不另建 source-video 字段。
- `mime_type` 保存真实媒体类型，供播放器选择 `<video>` 或 `<audio>`。
- 现有 `bytes` 保存 init 声明的总字节数，供 multipart complete 和 `/start` 验证。
- 已知时长继续执行现有套餐时长和 quota preflight；未知时长使用上文的保守预留规则。

不持久化 multipart upload id。客户端携带 R2 返回的 opaque `uploadId` 调用受认证端点，服务端始终从当前用户拥有的 transcript 记录取得 object key 和预期 bytes。客户端中断后无法主动 abort 的残片，由 bucket 现有的 7 天 multipart abort lifecycle 清理。

`pending` / `uploading` transcript 从 `created_at` 起保留 **24 小时**，与现有单次 PUT URL 的 24 小时有效期对齐。part URL 可以保持短时效，只要 transcript 尚未过期，客户端即可重新请求未完成 part 的 URL；超过 24 小时后不再签发新 URL，也不允许 complete 或 `/start`。仍存在的过期行返回 `upload_expired`；已经被 cleanup 清除的行由客户端结合本地上传开始时间把 `not_found` 映射为上传已过期提示。

### 3. Multipart 上传

原视频不再使用单次 PUT。应用侧提供受认证的 multipart 流程：

1. 创建 transcript 和 R2 multipart upload，返回 `transcriptId`、`uploadId` 和固定 part size。
2. 为客户端签发各 part 的短时效 presigned upload URL。
3. 客户端使用 `File.slice(start, end)` 按 **100MiB** 固定大小切出 Blob 并上传；除最后一片外，每个 part 必须严格等大。单片失败只重试该片。
4. 客户端只通知服务端所有预期 part 已上传，不提交 ETag 列表。
5. 服务端使用现有 R2 S3 credentials，通过 S3-compatible `ListParts` 读取真实 part number、size 和 ETag；不依赖 Workers binding（`R2MultipartUpload` 没有 `listParts()`）。
6. 服务端校验 part 连续、数量符合预期、除最后一片外均为 100MiB，最后一片与 transcript 中保存的总字节数一致，然后用 `ListParts` 返回的 `{ partNumber, etag }` 完成 multipart。
7. 客户端对网络错误、408、429 和 5xx 最多重试 complete 3 次；服务端在 ListParts 或 Complete 响应不确定时 HEAD 最终对象，若大小与 transcript `bytes` 完全一致则幂等返回成功。
8. 三次重试后仍无法确认时保留 transcript 和 multipart，不立即 abort/删除；完成后进入 `/start`，未完成的 multipart 不允许提交 AAI。

100MiB 是协议常量，不根据网速或重试次数动态变化。4.9GB 文件约 47–50 片，远低于 R2 的 part 数量限制，同时满足除最后一片外每片至少 5MiB 的要求。重新上传相同 part number 会替换旧 part；若替换请求失败，客户端继续把该 part 视为未完成并重传。

R2 CORS 必须允许 multipart 所需方法和 `Content-Type` 等 header。完成流程不依赖浏览器读取 ETag，因此 `ExposeHeaders: ["ETag"]` 不是关键路径要求；可保留用于调试。

#### 浏览器分片与内存

浏览器必须决定每个 part 的字节范围，但不需要把整个视频读进 JavaScript 内存。`File` 通常由本地文件或操作系统文件句柄支撑，`File.slice()` 返回对应范围的 Blob；只有上传中的 part 会被浏览器读取和缓冲。

实现约束：

- 禁止对整个视频调用 `FileReader.readAsArrayBuffer()`、`file.arrayBuffer()` 或复制到一个完整 Uint8Array。
- 直接把 `file.slice(offset, end)` 得到的 Blob 交给 XHR / fetch 上传。
- 默认并发 2 个 part，避免 100MiB part 在手机或低内存设备上造成过高峰值。
- 一个 part 完成后释放对应请求引用，再调度下一片。
- 内存峰值主要取决于“part size × 并发数 + 浏览器网络缓冲”，约为 200MiB 加浏览器缓冲，而不是整个 2–4.9GB 文件大小。

普通音频和客户端提取后的音频继续使用现有单次 PUT。单次 PUT 可签入 Content-Type；Content-Length 签名只作为附加保护，最终以 R2 HEAD 校验为准。

### 4. `/start` 必须验证真实对象

`app/api/transcripts/[id]/start/route.ts` 不是零改动。提交 AAI 前必须通过 R2 binding HEAD 验证：

- 对象存在。
- multipart 已完成。
- 实际字节数等于 transcript `bytes` 中保存的预期字节数。
- 实际大小没有超过当前套餐上限。
- Content-Type / 后缀位于允许的音视频范围。

验证完成后才生成 AAI presigned GET 并提交转录。`webhook` 的转录完成逻辑不需要感知媒体是音频还是视频。

### 5. 自动 fallback

`app/components/Uploader.tsx`：

- 视频 >1GB：跳过客户端提取，直接进入 multipart。
- `cannot_read_metadata`：按未知时长规则自动进入 multipart。
- `extraction_timeout`、`audio_extraction_failed`、WebAudio / ffmpeg.wasm 失败：自动使用原文件进入 multipart。
- fallback 前清理客户端提取状态，保留原始 `File`，避免要求用户重新选择文件。
- multipart 显示总进度；单片重试不把总进度错误归零。
- fallback 上传和最终失败继续复用现有错误 UI。

### 6. 原视频回放与稳定 URL

`/api/transcripts/[id]/audio` 继续作为兼容现有客户端的稳定媒体入口：

- DB `mime_type` 为 `video/*` 时，TranscriptViewer 使用 `<video>` 媒体元素驱动现有播放控制和时间同步；默认不展示视频画面。
- `mime_type` 为音频时继续使用 `<audio>`。
- 两者均通过相同的 `HTMLMediaElement` 播放、暂停、seek 和 `currentTime` 接口接入 transcript 高亮逻辑。
- 视频可能依赖较晚的 Range 请求；保留 5 分钟 signed URL，在媒体元素触发 `error` 时重新请求稳定应用 URL、恢复 `currentTime` 和播放状态。
- 每次媒体加载最多自动刷新一次；第二次仍失败则显示格式不兼容，避免 codec 错误造成无限刷新。
- AAI 能转录但浏览器不能播放的 codec 允许转录成功；UI 明确提示“该媒体格式无法在当前浏览器回放”，不再通过后台 MP3 转换兜底。

### 7. 14 天媒体保留与删除

产品语义统一为：**上传媒体从 transcript `created_at` 起可回放 14 天，文本长期保留。**

- 稳定媒体端点继续在 `created_at + 14 天` 后返回 410，即使 R2 对象尚未物理删除。
- 现有 cleanup worker 继续按小时运行，删除超过 14 天的 completed media。
- cleanup 删除必须幂等；R2 删除成功（包括对象已经不存在）后，才能将 `audio_r2_key` 设为 `NULL`。
- R2 删除抛错时必须保留 `audio_r2_key`，让下一次每小时 cleanup 自动重试；禁止吞掉异常后仍清空 key。
- 对需要 hard-delete 的 pending、uploading、failed 或其他过期行同样适用：只有该行引用的 R2 对象全部删除成功后才能删除 DB row，否则保留整行重试，避免制造无法定位的孤儿对象。
- 每次删除失败写 structured log，至少包含 transcript id、R2 key、状态和错误类别；每轮同时记录扫描、删除成功、删除失败和待重试数量，并为持续失败配置日志告警。
- transcript/account 主动删除继续立即删除其 `audio_r2_key` 指向的音频或视频。
- pending/uploading transcript 的 cleanup TTL 从 1 小时统一提高到 **24 小时**；init 只做 quota preflight，真正 reserve 在 `/start`，所以延长 TTL 不会锁住用户分钟额度。
- 尚未完成的 multipart 由现有 7 天 abort lifecycle 最终清理；该规则只处理中止 multipart，不承担 completed media 删除。
- 不配置媒体 expiration lifecycle。现有 key 布局无法用前缀规则区分 `source.*` 与需要永久保留的 JSON，cleanup worker 的可重试删除语义就是可靠性保障。

## Analytics 与可观察性

由浏览器通过现有 `lib/analytics.ts` 上报：

```text
direct_video_attempt
direct_video_upload_completed
direct_video_upload_failed
transcribe_success
```

Plausible 公共属性：

```text
upload_mode: extracted_audio | direct_video
fallback_reason: over_1gb | cannot_read_metadata | extraction_timeout | extraction_failed
file_size_mb
duration_sec（未知时可缺失）
upload_elapsed_sec
```

同步更新 `lib/analytics.ts` 和 tracking repo `projects.json` 的 custom breakdown，确保后续分析能看到用户侧使用量、成功率和 fallback 原因。

核心漏斗：

```text
direct_video_attempt
→ direct_video_upload_completed
→ transcribe_success
```

cleanup worker 使用 structured log 记录扫描、成功删除、删除失败和待重试数量。应用已输出 `cleanup_r2_delete_failed`；Cloudflare 侧持续失败告警属于独立生产配置，发布代码不会自动创建。媒体漏删监控不伪装成 Plausible 访客事件。

## 实现状态

### 已实现 — 上传基础

1. 套餐限制和未知时长 quota 规则。
2. multipart init / part sign / complete / abort。
3. `/start` R2 HEAD 校验。
4. 自动 fallback 和 analytics。

### 已实现 — 直传转录与回放

1. AAI 直传视频 URL。
2. 稳定媒体端点支持 video/audio。
3. signed URL 过期后的单次恢复。
4. 使用 `NEXT_PUBLIC_DIRECT_VIDEO_UPLOAD_ENABLED` 作为 build-time kill switch；首发即全量开启，紧急关闭需要重新 build + deploy，不支持运行时百分比放量。

### 已实现 — Cleanup 可靠性

1. 将 pending/uploading TTL 从 1 小时提高到 24 小时。
2. 确认 cleanup worker 对视频 key 与音频 key 一视同仁，并继续按 14 天清理。
3. 重构 cleanup 删除结果：R2 成功后才清空 key 或删除 row；失败时保留引用并在下一轮重试。
4. 增加 structured log 汇总；持续删除失败告警由 Cloudflare 运维配置完成。
5. 保留现有“7 天后 abort 未完成 multipart”规则，不新增媒体 expiration lifecycle。
6. 验证媒体到期后返回 410，transcript 文本仍可访问。

### Phase 2 — 观察后优化（不在本次范围）

- 数据确认 direct video 稳定后，评估移除 ffmpeg.wasm 串行 fallback，只保留 WebAudio + 直传。
- 只有在大视频规模、回放兼容性或成本数据证明有必要时，才重新评估后台 MP3 瘦身。
- 定价页、升级 CTA 和支付成功分析属于另一个 backlog。

## 验收清单

### 上传与安全

- Free 超过 2GB 被拒绝；Basic/Pro 超过安全 4.9GB 上限被拒绝。
- >1GB 视频不运行客户端提取，直接 multipart。
- metadata / extraction 失败后自动进入 multipart，不要求重新选择文件。
- 浏览器通过 `File.slice()` 上传固定 100MiB Blob，不把完整视频读入 JS 内存；默认最多并发 2 个 part。
- 单个 part 失败时只重传该 part。
- 服务端 `ListParts` 取得 ETag 并校验所有非末尾 part 等大，客户端不提交 ETag。
- 伪造 bytes、未完成 multipart、超套餐对象在 `/start` 被 HEAD 校验阻止。
- 未完成 multipart 最迟在 7 天后由现有 R2 lifecycle abort。
- 4.9GB 文件在低速网络上传超过 1 小时不会被 cleanup 删除；pending/uploading 最多保留 24 小时。
- 超过 24 小时后不再签发 part URL、complete 或 `/start`，客户端显示上传已过期而不是通用失败。

### 时长与 quota

- 已知时长沿用当前时长上限和 quota 行为。
- 未知时长按套餐上限与剩余额度的较小值 reserve。
- AAI `audio_end_at` 与 reserved minutes 一致。
- `audio_end_at` 继续使用毫秒单位 `reservedMinutes * 60 * 1000`。
- 完成和失败都能正确 reconciliation。

### 转录与回放

- MP4、MOV 及至少一种浏览器不支持元数据的格式能通过 direct video 提交 AAI。
- 原视频在兼容 codec 下能在 Chrome、Safari 和手机端回放。
- 不兼容 codec 不影响转录成功，并显示明确的回放提示。
- 长媒体 seek 时 signed URL 过期后最多自动刷新一次，并恢复播放位置。
- 时间戳和 transcript 高亮在 `<video>` 与 `<audio>` 下都保持同步。

### 保留期与清理

- 媒体端点在 transcript 创建满 14 天后返回 410。
- cleanup worker 删除超过 14 天的原视频或音频；只有 R2 删除成功后才清空 `audio_r2_key`。
- R2 删除失败时 key / row 被保留，下一轮 cleanup 能再次定位并重试。
- pending、uploading、failed 等 hard-delete 路径不会在 R2 删除失败后先删除 DB row。
- structured log 能区分成功、失败和待重试；配置 Cloudflare 告警后，持续失败能触发通知。
- transcript 文本和 JSON 不随媒体删除。
- 主动删除 transcript/account 时立即清理原视频。
- bucket 不配置媒体 expiration lifecycle，避免误删同前缀下的 transcript JSON 和 translations。
- bucket 保持 Standard，没有 transition 到 Infrequent Access。

### 验证命令与观察

1. `npm run build`。
2. 本地/预览环境完成上述手动矩阵。
3. 使用真实大文件基准测试 2GB 与接近 4.9GB 的上传恢复和 AAI 接受情况。
4. 在测试环境缩短阈值，验证 24 小时上传 TTL、14 天媒体边界以及 R2 删除失败后的保留引用与下一轮重试，不直接等待真实时长。
5. 上线后观察一周 Plausible：旧的 `video_file_too_large` / `extraction_timeout` 应由成功 fallback 取代，并检查 direct upload 到转录成功的完整漏斗。
