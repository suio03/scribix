# Scribix AI 短视频工作台 V1 实施计划

> 状态：M0–M9 本地实施已完成；真实用户试点与外部配置待执行
> 创建日期：2026-08-31  
> 当前范围：长视频对话内容 → 候选 clips → 浏览器编辑预览 → Cloud 最终成片  
> 明确不做：社交账号连接、内容日历、定时发布和多平台分发

## 1. 已确认的产品方向

本计划沉淀以下已经确认的方向：

- Scribix 不再只停留在“音视频转文字”，而是把长视频中的对话内容变成可以直接发布的短视频成片。
- AI 主要分析 transcript，不对整段长视频逐帧做内容理解。
- AI 根据对话与逐字时间戳生成多个候选 clips；一个候选 clip 可以由多个不连续的 source segments 组成。
- 用户必须可以调整内容、时间点、片段顺序、9:16 裁切、动态字幕、品牌样式、音量和音频效果。
- 浏览器负责编辑 UI 和实时预览，不负责 V1 的最终视频编码。
- 几小时的原视频不作为编辑器的主要预览素材；Cloud 只为候选时间段生成小体积 preview proxies。
- 用户确认后，Cloud 必须从原始视频和最终 Render Spec 一次性生成最终成片；最终渲染不得从 preview proxy 转码。
- 最终结果应当是无需再进入 CapCut/Premiere 即可上传的 MP4，而不是未经包装的原始裁剪片段。
- 发布包和分发不属于 Scribix V1；已有独立平台负责连接客户社交账号和分发。

## 2. 一句话目标

用户上传一段几小时的长视频后，Scribix 自动提出多个值得发布的短视频候选；用户在浏览器中完成少量调整，然后由 Cloud 生成一条带动态字幕、品牌样式、正确画幅和处理后音频的最终 9:16 MP4。

## 3. V1 产品边界

### 3.1 必须完成

- 原始视频可靠上传、保留和删除。
- transcript 必须提供可用于精确裁切的 word-level timestamps；有 speaker 数据时保留 speaker。
- AI 生成多个候选 clips，并给出候选理由、标题或主题和 segments。
- 用户可以播放候选 clip，而不是从头播放几小时原视频。
- 用户可以修改 segment 起止时间、删除 segment、调整顺序。
- 用户可以校正字幕文本并选择动态字幕模板。
- 用户可以设置每个 segment 的 9:16 裁切位置和缩放。
- 用户可以应用 Logo、字体和颜色等品牌模板。
- 用户可以调整音量，并应用 V1 最终确认的音频处理项。
- 用户可以选择封面时间点。
- Cloud 从原始视频生成最终 1080 × 1920 MP4 和封面图片。
- 用户可以下载最终视频和封面。
- 任务失败可重试；重复请求不得产生冲突输出或重复扣费。

### 3.2 明确不做

- Scribix 内连接 TikTok、YouTube、Instagram 等客户账号。
- 直接发布、定时发布、内容日历、发布历史和平台失败重试。
- 为分发平台生成完整发布包。
- 完整专业多轨时间线编辑器。
- 任意数量的视频轨、画中画和复杂转场。
- AI B-roll、生成式视频、虚拟人物和复杂视觉特效。
- 对几小时原视频逐帧做多模态“精彩度”分析。
- 浏览器端最终视频编码作为 V1 的必需路径。
- 4K、HDR、环绕声和专业母版输出。

### 3.3 实施前仍需锁定的细节

以下不改变总体架构，但必须在对应里程碑开始前确认：

- 已确认：“音效”在 V1 仅指音量、响度标准化、降噪、淡入淡出等音频处理，不包括背景音乐和可放置在时间线上的音效素材。
- 已确认：原视频 Free 保存 7 天/5 GiB、Basic 30 天/25 GiB、Pro 90 天/100 GiB；到期后保留 transcript、EDL、Render Spec 和成片，重新渲染要求重新上传匹配的原视频。
- 第一版是否只接受桌面浏览器编辑。建议优先桌面 Chrome/Edge，移动端先支持查看结果和下载。
- 是否保留 AI 标题、描述和 Hashtags。当前建议交给已有分发平台，Scribix 只保留 clip 的内部名称/主题。
- 已确认：Cloud 执行供应商采用 AWS Batch + Fargate On-Demand；Render Job 协议保持供应商无关。

## 4. 用户流程

```text
上传原始视频
  ↓
生成 transcript（word timestamps + speaker）
  ↓
AI 生成多个候选 clips
  ↓
自动准备排名靠前候选的 preview proxies
  ↓
用户进入短视频编辑器
  ├── 调整内容和时间点
  ├── 调整 segment 顺序
  ├── 选择 9:16 裁切
  ├── 校正并设计动态字幕
  ├── 应用品牌模板
  ├── 调整音量/音频处理
  └── 选择封面
  ↓
保存 EDL + Render Spec
  ↓
用户点击“生成视频”
  ↓
Cloud 从原始视频一次渲染最终 MP4
  ↓
校验成片 → 保存 R2 → 用户下载
```

## 5. 总体架构

```text
┌───────────────────────────────────────────────┐
│ Next.js / OpenNext on Cloudflare             │
│                                               │
│ UI、Auth、Project API、EDL、Render Spec、状态 │
└───────────────┬───────────────────────┬───────┘
                │                       │
                ▼                       ▼
        ┌──────────────┐        ┌──────────────┐
        │ Cloudflare D1│        │ Cloudflare R2│
        │ 项目与任务状态│        │ 视频与图片资产│
        └───────┬──────┘        └───────▲──────┘
                │                       │ signed GET/PUT
                ▼                       │
        ┌──────────────────────────────────────┐
        │ Queue / Job Dispatcher               │
        │ 只传 jobId，不传永久凭证或用户内容   │
        └──────────────────┬───────────────────┘
                           ▼
        ┌──────────────────────────────────────┐
        │ Container Render Worker              │
        │ FFmpeg / FFprobe / caption renderer  │
        │ Preview Job + Final Render Job       │
        └──────────────────────────────────────┘
```

职责边界：

- 浏览器：编辑状态、虚拟时间线、交互预览。
- Cloudflare 应用：鉴权、所有权校验、数据状态、签名 URL、任务编排。
- R2：原始视频、preview proxies、最终视频、封面和品牌资产。
- 外部容器执行层：处理不适合 Cloudflare Worker 的 FFmpeg 任务。
- D1：项目事实来源；外部 Job Provider 不是业务状态的唯一来源。

## 6. 三类核心视频资产

| 资产 | 用途 | 是否用于最终渲染 | 建议规格 |
|---|---|---:|---|
| Original Source | 转录、精确裁切、最终渲染 | 是 | 用户原始文件 |
| Preview Proxy | 浏览器编辑和预览 | 否 | 720p H.264/AAC、1–2 Mbps |
| Final Render | 下载和交给外部分发平台 | 最终结果 | 1080 × 1920、H.264/AAC MP4 |

### 6.1 Original Source

- 浏览器直接 multipart 上传到 R2，不经过 Next.js/Worker 请求体。
- 所有新视频上传都必须上传并保留原始视频；不能继续只上传浏览器提取的音频。音频文件继续使用 transcript-only 流程。
- 现有 `audio_r2_key` 已经可能指向直接上传的视频，字段语义不够清晰；实施数据模型时必须决定是迁移为通用 source media 命名，还是由 video project 显式引用现有对象。
- 原视频过期后 transcript、EDL 和 Render Spec 可以保留，但再次渲染必须要求用户重新上传匹配的源文件。

### 6.2 Preview Proxy

- 不生成几小时的完整代理视频。
- 每个候选的每个 source segment 单独生成 proxy，并在最终 segment 前后保留默认 5 秒 handles。
- 示例：最终选择 `02:00–02:25`，proxy 可生成 `01:55–02:30`。
- 用户在 handles 范围内调整时间点不需要重新生成 proxy；超出范围时异步扩展或重建该 segment proxy。
- 不提前把 segments 合并成一个 MP4，避免用户调整顺序或删除片段时反复重渲染。
- AI 完成后预生成排名前三的候选；其他候选在用户打开时懒生成。
- Proxy 只短期保存，并可安全重建。

### 6.3 Final Render

- 最终成片必须从 Original Source 读取，不得从 720p proxy 生成。
- 每个 render 使用不可变的 EDL + Render Spec version。
- 成功后写入唯一、确定性的 R2 key，并用 `ffprobe` 校验再标记 completed。
- 失败或超时不得覆盖上一次成功输出。

## 7. 时间模型：Source、Proxy 与 Timeline

编辑器必须明确区分三套时间：

```json
{
  "segmentId": "seg_01",
  "sourceStartMs": 120000,
  "sourceEndMs": 145000,
  "proxySourceStartMs": 115000,
  "proxySourceEndMs": 150000,
  "timelineStartMs": 0,
  "timelineEndMs": 25000
}
```

- Source time：原视频中的绝对时间，是 transcript、EDL 和最终渲染的事实来源。
- Proxy time：代理文件内的局部时间，仅用于浏览器播放。
- Timeline time：组合后短视频的连续时间，用于字幕、封面和 UI。

所有时间在 API 和数据库中统一使用整数毫秒，避免浮点累计误差。最终生成 FFmpeg 参数时再转换为秒。

## 8. EDL 与 Render Spec

### 8.1 EDL

EDL 只描述“使用原视频中的哪些内容以及顺序”：

```json
{
  "schemaVersion": 1,
  "segments": [
    {
      "id": "seg_01",
      "sourceStartMs": 120000,
      "sourceEndMs": 145000,
      "order": 0
    },
    {
      "id": "seg_02",
      "sourceStartMs": 380000,
      "sourceEndMs": 405000,
      "order": 1
    }
  ]
}
```

约束：

- 时间必须位于 source duration 内。
- `sourceEndMs > sourceStartMs`。
- segment 数量、单段时长和总输出时长必须有套餐或系统上限。
- AI 返回的时间必须服务端校验，不能直接信任模型。
- 用户编辑后创建新 version，不原地修改正在渲染的 version。

### 8.2 Render Spec

Render Spec 描述“如何把 EDL 渲染成成片”：

```json
{
  "schemaVersion": 1,
  "canvas": {
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "backgroundColor": "#000000"
  },
  "segments": {
    "seg_01": {
      "crop": { "x": 0.5, "y": 0.5, "zoom": 1.15 }
    },
    "seg_02": {
      "crop": { "x": 0.42, "y": 0.5, "zoom": 1.1 }
    }
  },
  "captions": {
    "templateId": "karaoke-v1",
    "fontAssetId": "font_01",
    "textColor": "#FFFFFF",
    "highlightColor": "#FFD600",
    "positionY": 0.78
  },
  "brand": {
    "templateId": "brand_01",
    "logoAssetId": "logo_01"
  },
  "audio": {
    "gainDb": 0,
    "normalize": true,
    "fadeInMs": 0,
    "fadeOutMs": 250
  },
  "coverTimelineMs": 4800
}
```

规则：

- 坐标和尺寸优先使用 0–1 的归一化值，保证浏览器预览和 Cloud 输出一致。
- 所有模板、字体和品牌资产必须通过稳定 ID 引用，不能让用户输入任意服务器文件路径。
- 每个 schema 都必须有 `schemaVersion`；旧项目必须可以继续渲染或明确提示升级。
- 浏览器和 Cloud renderer 共享同一份类型定义与验证 schema。

## 9. 浏览器编辑器

### 9.1 编辑器不是完整 NLE

V1 使用 transcript-first、template-first 的编辑器：

- 左侧/上方：视频预览。
- 中间：连续的虚拟 timeline 和 segments。
- 右侧/下方：字幕、画面、品牌、音频和封面设置。
- Transcript 面板允许按句子或词调整边界，不要求用户拖动传统多轨时间线完成所有操作。

### 9.2 Preview 播放

- 主编辑器只加载 preview proxies。
- 使用双 video element 或等价的预加载策略：一个播放当前 segment，另一个提前准备下一个 segment。
- 播放控制器负责把 timeline time 映射成 proxy time，并在 segment 边界切换。
- 字幕、Logo、标题区和安全区域使用 DOM/CSS 或 Canvas 覆盖，不为每次修改生成视频。
- 同一次上传会话中可临时用本地 `File`/object URL 作为 proxy 未完成前的快速路径，但不能依赖它支持跨设备或稍后返回编辑。

### 9.3 预览与最终结果一致性

这是 V1 的核心质量门：

- 字幕模板必须同时实现 Browser Preview adapter 与 FFmpeg/ASS Render adapter。
- 字体文件、字号计算、行宽、行数、safe area 和 word highlight timing 必须共享规范。
- Crop 使用相同的归一化坐标和 zoom 算法。
- 音量预览可使用 Web Audio，但最终以 Cloud FFmpeg 的实现为准；UI 必须标记无法完全实时模拟的处理。
- 每个模板需要 golden fixtures，用固定视频、字幕和 Render Spec 对比 preview screenshot 与最终输出关键帧。

## 10. AI 候选 clips

### 10.1 输入

- transcript 文本。
- word timestamps。
- speaker/utterance 边界（如果存在）。
- 用户可选的目标时长、主题、语气或平台用途；V1 可以先使用固定默认值。

### 10.2 输出

AI 必须返回结构化数据，而不是自然语言时间戳：

```json
{
  "candidates": [
    {
      "id": "candidate_01",
      "theme": "为什么这个方法失败",
      "hook": "Most people get this part wrong.",
      "reason": "结论完整，开头有冲突，单独观看仍可理解。",
      "score": 0.86,
      "segments": [
        { "startMs": 120000, "endMs": 145000 },
        { "startMs": 380000, "endMs": 405000 }
      ]
    }
  ]
}
```

### 10.3 服务端校验与后处理

- 把模型时间对齐到真实 word boundaries。
- 校验 segment 是否越界、重叠、过短、过长或总时长超限。
- 检查候选是否依赖前文、是否在句子中间开始/结束。
- 去除高度重复的候选。
- 候选只作为建议；用户确认前不得自动触发最终渲染或计费。
- Prompt 与 transcript 都视为不可信输入；日志不得记录完整 transcript 或生成内容。

## 11. Preview Job

每个 proxy job 输入：

- `jobId`
- source asset ID
- candidate/segment IDs
- 经过校验的 source ranges 和 handles
- proxy preset ID

Worker 行为：

1. 通过受保护的 Scribix internal API 用 `jobId` 换取短期、精确对象级 R2 GET/PUT URLs。
2. 使用 `ffprobe` 验证输入容器、duration 和 streams。
3. 对每个 segment 快速 seek 到目标时间附近。
4. 输出 720p、H.264/AAC、低码率、`faststart` proxy。
5. 上传到确定性 R2 key。
6. 回调成功状态和实际 metadata。
7. Scribix 校验回调并更新 D1。

Proxy job 不烧录字幕、不加品牌、不生成最终比例；这些由浏览器实时覆盖预览。

## 12. Final Render Job

### 12.1 输入

- 不可变的 EDL version。
- 不可变的 Render Spec version。
- 原始 source asset。
- 经过校验的字幕数据。
- 经过所有权校验的 Logo/font/brand assets。
- output preset。

### 12.2 FFmpeg 处理顺序

1. 为每个 source segment 建立独立输入 seek，避免从视频开头解码到目标时间。
2. 精确 trim 视频和音频并重置时间戳。
3. 按 EDL 顺序 concat。
4. 应用每段 crop/scale/pad。
5. 应用字幕、Logo 和品牌 overlay。
6. 应用 gain、normalization、fade 等已确认音频处理。
7. 编码 H.264/AAC MP4，写入 web-compatible metadata 和 `faststart`。
8. 从最终 timeline 的 `coverTimelineMs` 生成 JPEG/PNG 封面。
9. 用 `ffprobe` 校验输出后再上传，并回传 completed 状态。

必须避免：

- 把用户输入直接拼接成 shell command。
- 使用 proxy 作为最终输入。
- 对整个原视频使用一个 `trim` filter 并从头解码。
- 在任务成功前覆盖已有成片。

### 12.3 V1 输出契约

- 画面：1080 × 1920，9:16，SDR。
- 视频：H.264、`yuv420p`。
- 音频：AAC stereo。
- 容器：MP4，支持网络快速播放。
- 字幕：烧录字幕；V1 不依赖平台 sidecar subtitles。
- 额外文件：一张封面图片。
- 输出必须通过 duration、dimension、stream 和可解码性检查。

## 13. Job 状态机与可靠性

建议统一状态：

```text
draft
→ queued
→ preparing
→ running
→ uploading
→ completed

失败路径：queued/running/uploading → failed
取消路径：queued/running → canceled
```

要求：

- 客户端创建 job 时提供 idempotency key。
- 同一个 project version + job type + preset 只能有一个活跃 job。
- Provider payload 只包含 `jobId`，不包含永久 R2 credentials、完整 transcript 或用户 PII。
- Retry 只针对基础设施、下载、上传和可恢复 provider errors；坏文件、无效 EDL 和不支持 codec 不自动无限重试。
- Callback 必须签名验证，并有后台 reconciliation 修复漏掉的回调。
- 所有输出使用 deterministic key；重试写同一个 job namespace。
- 用户删除项目/账号时，取消可取消任务并清理所有资产。

建议错误分类：

```text
invalid_source
unsupported_codec
invalid_edl
invalid_render_spec
asset_missing
download_failed
render_failed
upload_failed
provider_unavailable
job_timed_out
```

## 14. Cloud 执行层建议

### 14.1 V1 推荐基线

- AWS Batch 负责队列、调度、重试和优先级。
- AWS Fargate On-Demand 运行隔离的 FFmpeg container。
- 单 job 单 task；不在同一 task 并行处理不同用户的不可信视频。
- 初始规格从 2–4 vCPU、4–8 GiB memory 开始，按真实 benchmark 调整。
- Fargate 默认 20 GiB ephemeral storage 可作为远程 Range 读取失败时的整文件 fallback。
- 正式成片只用 On-Demand；有可靠幂等和中断恢复后，preview jobs 才考虑 Spot。

### 14.2 为什么当前不以 Google Cloud Batch 为第一选择

- 当前任务主要处理最终几十秒内容，启动延迟会占总耗时较大比例。
- Google Cloud Batch 每个任务创建临时 VM，更适合更长、更重或大规模吞吐型任务。
- AWS 官方给出的 Fargate 资源供应基线约 30 秒，更符合交互式产品的异步导出体验。
- Render Job contract 保持供应商无关，后续仍可用同一镜像在 Google Batch 做成本 benchmark。

### 14.3 容器要求

- 固定 FFmpeg build/version，并记录在每次 render metadata。
- 镜像使用 digest pinning。
- 非 root 用户、无 privileged mode、只开放必要 writable scratch。
- 无入站端口；只允许必要 outbound HTTPS。
- CPU、memory、disk、duration 和 output size 全部有限制。
- 对输入文件按不可信媒体处理；解析失败必须安全退出。

## 15. 数据模型计划

具体 migration 编号以实施时下一号为准。建议领域模型如下：

### 15.1 `video_projects`

```text
id
user_id
transcript_id
source_asset_id
status
active_edl_version
active_render_spec_version
created_at
updated_at
deleted_at
```

### 15.2 `clip_candidates`

```text
id
project_id
rank
theme
hook
reason
score
segments_json
status
created_at
```

### 15.3 `project_versions`

```text
id
project_id
version
edl_json
render_spec_json
created_by
created_at
```

最终 render 引用不可变 version；编辑器 autosave 可以更新 draft，点击生成时创建快照。

### 15.4 `media_assets`

```text
id
user_id
project_id
kind              -- source | preview_proxy | final_video | cover | logo | font
r2_key
mime_type
bytes
duration_ms
width
height
status
expires_at
created_at
deleted_at
```

### 15.5 `render_jobs`

```text
id
user_id
project_id
project_version_id
kind              -- preview | final
provider
provider_job_id
status
attempt
idempotency_key
output_asset_id
error_code
queued_at
started_at
completed_at
created_at
```

### 15.6 `brand_templates`

```text
id
user_id
name
config_json
created_at
updated_at
deleted_at
```

所有查询和写入必须同时验证 `user_id`；不能只凭 project/asset/job ID 读取对象。

## 16. R2 对象布局

沿用私有 bucket，建议新增稳定前缀：

```text
users/{userId}/{transcriptId}/source.{ext}

users/{userId}/video-projects/{projectId}/
├── proxies/{candidateId}/{segmentId}-{proxyVersion}.mp4
├── renders/{renderId}/final-9x16.mp4
└── renders/{renderId}/cover.jpg

users/{userId}/brand-assets/{assetId}/{filename}
```

要求：

- 所有浏览器和外部 worker 访问使用短期签名 URL。
- 签名 URL 精确到单个对象和方法，GET 与 PUT 分离。
- 数据库先记录 pending asset，再上传；只有校验成功后标记 ready。
- 清理流程以 D1 记录和 R2 delete 成功共同确认，不能先清数据库 key。
- 现有 cleanup worker 只认识 transcript 的 `audio_r2_key` 和 `transcript_r2_key`；实施时必须扩展 project/assets/jobs 的删除语义。

## 17. 安全、隐私与删除

- 原始视频、字幕、候选内容和品牌资产都属于用户私有数据。
- Signed URL、完整 transcript、字幕和用户文本不得写入日志。
- Render worker 只使用短期 job-scoped credentials。
- FFmpeg 参数来自经过 schema validation 的枚举和数值，不接受任意 filter 字符串。
- Logo/font 等资产必须验证所有权、MIME、大小和实际文件内容。
- 用户删除 transcript 时，必须定义关联 video project 是级联删除还是阻止删除；建议明确提示并级联删除项目资产。
- 删除账号必须覆盖 source、proxies、final renders、covers、brand assets、jobs 和项目数据。
- Privacy/Terms 必须增加原视频 Cloud 处理、外部计算供应商、保留时间和删除说明。

## 18. 成本与额度事件

V1 至少记录：

- source bytes 与保留天数。
- preview 输出秒数、bytes、vCPU/memory preset、任务时长。
- final 输出秒数、任务时长、尝试次数和 provider estimated cost。
- 每个 project 的候选数、proxy 数和 render 数。
- 每次失败的稳定 error code。

计费产品不应直接向用户展示 GB 和 vCPU；建议以后用两类可理解额度：

- Processed source minutes：AI 分析/生成候选的原视频分钟。
- Export minutes：最终输出视频分钟，多个版本分别计入。

Storage retention 作为套餐能力或上限，不按每次 R2 请求向用户计费。

## 19. 分阶段实施

### M0. 锁定合同与基准样本

- [ ] 确认第 3.3 节的剩余产品细节。
- [ ] 建立 EDL、Render Spec、Candidate、Media Asset 和 Job 的 TypeScript schema。
- [ ] 准备 20–30 条真实测试视频，覆盖 MP4/MOV/WebM、H.264/HEVC、横屏/竖屏、多 speaker、VFR 和损坏文件。
- [ ] 定义最终 9:16 输出 preset 和验收命令。
- [ ] 用最小 FFmpeg prototype 验证多 segment 精确截取、concat、字幕、crop、Logo 和音频处理。

完成标准：

- 同一 Render Spec 能稳定产生可播放、音画同步的 MP4。
- 已明确不支持的输入格式有确定错误码和用户提示。
- Browser/renderer 参数契约不包含任意 shell/filter 输入。

### M1. 数据、原视频与生命周期

- [x] 新增 video project、version、asset、job 和 brand template migrations。
- [x] 扩展 R2 key helpers。
- [x] 所有新视频强制直接上传原始视频并建立 dormant video project；音频文件保留 transcript-only 流程。
- [x] 明确 source object 与现有 `audio_r2_key` 的迁移/引用关系。
- [x] 扩展 transcript 删除、账号删除和 cleanup worker。
- [x] 增加 signed GET/PUT 与 ownership helpers。

完成标准：

- 原视频可供转录、preview 和 final render 共用，不重复存储。
- 所有资产都有 owner、状态和到期语义。
- 删除项目/账号后没有遗留 R2 对象或可访问 URL。

### M2. AI Candidate 生成

- [x] 从 transcript 构建受控 AI 输入。
- [x] 定义结构化 candidate 输出 schema。
- [x] 实现 timestamp 对齐、越界校验、去重和总时长限制。
- [x] 保存候选、rank、reason 和 segments。
- [x] 实现候选列表 UI、重新生成和用户反馈事件。

完成标准：

- 每个候选都能映射到真实 word boundaries。
- 一个候选可以包含多个不连续 segments。
- 无效模型输出不会进入 preview/render pipeline。

### M3. Preview Proxy Pipeline

- [ ] 构建并发布受控 FFmpeg container。
- [x] 实现 preview job API、dispatcher、provider adapter、callback 和 reconciliation。
- [x] 生成带 handles 的单 segment 720p proxies。
- [x] 自动生成前三候选，其余懒生成。
- [x] 超出 handles 时支持单 segment 重建。
- [x] 扩展 cleanup worker 清理到期 proxies。

本地状态：container 已成功构建并通过 FFmpeg fixture；“发布”保持未完成，需先创建
Cloudflare Queue、ECR、AWS Batch compute environment/job queue/job definition 和最小权限
secrets，详见 `docs/video-workspace/m3-preview-proxy.md`。未执行 remote migration 或 deployment。

完成标准：

- 用户不下载整段几小时视频即可开始候选预览。
- Proxy 失败可以单独重试，不影响 transcript 和其他候选。
- Proxy 不被最终 renderer 使用。

### M4. 虚拟时间线与内容编辑

- [x] 实现 source/proxy/timeline 三套时间映射。
- [x] 实现多 segment 连续播放和下一段预加载。
- [x] 实现调整起止时间、删除、排序和总时长提示。
- [x] 实现 transcript/word boundary 对齐操作。
- [x] 实现 project draft autosave 和 version snapshot。

本地实现详见 `docs/video-workspace/m4-timeline-editor.md`。远程 migration 与 deployment
在全部里程碑完成后统一执行。

完成标准：

- 用户看到的是连续短视频时间线，不需要操作原始几小时时间线。
- 在 proxy handles 内修改边界立即生效。
- 刷新页面后编辑状态可恢复。

### M5. 画面、字幕、品牌和音频 UI

- [x] 实现每个 segment 的 9:16 crop/zoom 设置。
- [x] 实现字幕文本校正、断行、位置和动态模板选择。
- [x] 实现 Logo、字体、颜色和品牌模板。
- [x] 实现音量和已确认的 V1 音频处理控制。
- [x] 实现封面 timeline scrubber 与时间点选择。
- [x] 为每个模板实现 Browser Preview adapter。

浏览器适配器、受控 Render Spec 字段和品牌资产上传约束详见
`docs/video-workspace/m5-browser-preview.md`。

完成标准：

- 用户可以在不生成视频的情况下预览所有可编辑项。
- UI 不能生成 renderer 不理解的参数。
- 字幕和 Logo 不越过定义的 safe area。

### M6. Final Cloud Renderer

- [x] 实现 final render job 和不可变 version snapshot。
- [x] 从原视频进行多 segment seek、trim 和 concat。
- [x] 实现 crop/scale、动态字幕、品牌 overlay 和音频链。
- [x] 输出最终 1080 × 1920 H.264/AAC MP4。
- [x] 生成封面图片。
- [x] 实现 `ffprobe` 输出校验、R2 上传和结果回调。
- [x] 实现取消、重试、超时和幂等行为。

本地实现、任务协议、API 与部署边界详见
`docs/video-workspace/m6-final-render.md`。远程 migration、镜像发布和 AWS Batch
job definition 更新在全部里程碑完成后统一执行。

完成标准：

- 最终视频不依赖 proxy，且不发生额外中间转码。
- 用户下载后无需进入第三方编辑器即可上传。
- 相同 version 的重复请求不产生冲突结果。

### M7. Preview/Render 一致性验证

- [x] 建立固定 Render Spec fixtures。
- [x] 截取 Browser Preview 与 Final Render 的相同时间点截图。
- [x] 对比 crop、Logo、字幕位置、颜色、断行和 word highlight。
- [x] 验证音画时长、segment 边界和字幕 timing。
- [x] 为模板变更加 screenshot/golden regression。

共享呈现契约、同帧截图对比和允许差异详见
`docs/video-workspace/m7-preview-render-consistency.md`。

完成标准：

- 用户最终拿到的视频与浏览器确认结果没有材料差异。
- 允许存在的差异有明确说明，不属于 silent mismatch。

### M8. 安全、监控与成本控制

- [x] 最小权限 IAM、短期签名 URL、callback 签名和镜像扫描。
- [x] 日志脱敏和稳定 error categories。
- [x] Job queue depth、p50/p95 start/render/total latency、成功率和重试率监控。
- [x] 单用户并发、文件大小、总输出时长和资源上限。
- [x] 孤儿 asset/job reconciliation。
- [x] 记录每次成功 render 的成本估算。

安全控制、监控事件、告警建议、成本模型和待启用的外部控制详见
`docs/video-workspace/m8-operations.md`。

完成标准：

- Worker 没有永久 R2 凭证，renderer 没有跨用户对象访问能力。
- Provider callback 丢失后系统能自动恢复最终状态。
- 单个坏文件或恶意 Render Spec 不能无限占用资源。

### M9. 内测与渐进发布

- [x] 内部 20–30 条基准视频全部通过（24 条可重复技术基准；真实内容质量仍由试点验证）。
- [ ] 小范围开放给真实 talking-head/podcast 用户。
- [x] 实现 candidate 接受率、编辑时间、render 成功率、下载率和外部编辑需求的去重采集与管理员汇总。
- [ ] 根据真实数据调整 proxy handles、候选数量、输出时长和计算 preset。
- [ ] 确认隐私、保留、套餐和成本后再扩大开放。

24 条本地基准、rollout 开关、指标口径、阶段阈值和真实试点步骤详见
`docs/video-workspace/m9-pilot-rollout.md`。剩余未勾选项需要真实用户、生产数据或
法律/商业确认，不能由本地代码验证替代。

完成标准：

- p95 最终任务可在产品承诺时间内完成。
- 首次 render 成功率达到上线阈值。
- 用户多数情况下无需外部编辑器即可接受结果。

## 20. 产品与工程指标

### 20.1 产品指标

- 有 transcript 的视频中，进入 AI Clips 的比例。
- AI 候选被打开、保留和删除的比例。
- 候选 segments 被用户修改的比例和平均修改幅度。
- 从候选完成到首次 render 的转化率。
- 成功 render 后的下载率。
- 同一 project 的再次 render 率。
- 用户是否仍然需要导入第三方编辑器（定性访谈）。

### 20.2 工程指标

- Candidate generation latency / failure rate。
- Proxy queue-to-ready p50/p95。
- Final render queue、startup、processing、upload、total p50/p95。
- First-pass render success rate。
- 每个成功输出的总 provider cost。
- R2 source/proxy/final storage bytes 与删除成功率。
- Preview/Final mismatch 缺陷数。

## 21. V1 验收场景

至少覆盖：

1. 一小时横屏 talking-head，AI 生成五个候选，其中一个由两段组成；用户调整时间后输出 9:16 成片。
2. 两位 speaker 的 podcast，用户分别调整两个 segment 的 crop，字幕 speaker/timing 正确。
3. 用户修改 transcript 中的错误词，最终烧录字幕使用修改后的文本。
4. 用户应用自定义 Logo、字体和颜色，preview 与最终帧一致。
5. 用户调低音量并启用 normalization，最终无削波、音画同步。
6. 用户把边界拖出 proxy handles，系统只重建受影响 segment proxy。
7. 用户刷新或跨设备返回，能用 R2 proxy 恢复编辑。
8. Provider callback 丢失，reconciliation 最终把 job 修复为 completed/failed。
9. 同一 render 被重复提交，只产生一个有效输出。
10. 原视频过期后，现有成片仍可下载；重新渲染明确要求重新上传源文件。
11. 删除 project 和删除账号后，关联 source/proxy/final/cover/brand assets 按定义清理。
12. 不支持或损坏的视频返回明确错误，不进入无限重试。

## 22. 推荐实施顺序摘要

```text
先锁定 EDL/Render Spec/资产生命周期
  ↓
先证明 FFmpeg 能从原视频生成最终成片
  ↓
接入 AI candidates
  ↓
建设 proxy pipeline 和虚拟时间线
  ↓
建设字幕/裁切/品牌/音频编辑 UI
  ↓
接入正式 final render jobs
  ↓
做 preview/render 一致性、安全、成本和内测
```

不要先建设完整编辑器再验证 renderer，也不要先接入社交分发。最早的技术里程碑应当是：用一份手写 EDL + Render Spec，从一条真实原视频稳定生成最终 9:16 成片；确认底层合同成立后，再让 AI 和 UI 生产这份合同。
