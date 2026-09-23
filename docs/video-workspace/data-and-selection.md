# 视频数据与选片合同

2026-09-14 按主题合并现行合同，替代分散的阶段文件。以下本地验证和历史测量不等于生产验收；功能状态与优先级统一见[产品 plan](../roadmap/video-product-plan.md)。

[数据与生命周期](#lifecycle) | [AI 候选与完整性](#selection)

<a id="lifecycle"></a>

## 数据与生命周期

> 状态：基础设施、source 与 final export retention 已实现
> Migrations：`0025_video_workspace.sql`、`0034_latest_final_render.sql`、`0035_final_export_retention.sql`

### 数据模型

M1 新增 `video_projects`、`clip_candidates`、`project_versions`、`media_assets`、
`render_jobs` 和 `brand_templates`。所有用户私有表都直接保存 `user_id`，ownership
查询同时使用对象 ID 和 `user_id`。

`project_versions` 同时保存不可变 EDL 和 Render Spec，因此项目只需要一个
`active_project_version_id`，不保存两个可能互相漂移的 active version。编辑期间的
autosave 分别保存在 nullable draft JSON；点击生成时才创建不可变 version。

Preview job 增加 `preset_id` 和 `scope_key`。唯一索引限制同一个 version、kind、preset
和 scope 只能存在一个活跃 job；不同 candidate/segment proxy 可以使用不同 scope 并行。

### Source object 复用

短视频项目不会复制原视频：

```text
transcripts.audio_r2_key
          │
          └── media_assets(kind = source).r2_key
```

所有新视频上传都会解析为 `video_clips` workflow：preflight 强制选择 `direct_video`，init 同时
建立 transcript、dormant project 和 uploading source asset。multipart 完成后 source asset 标记为
ready。已有 completed 视频 transcript 也可通过 `POST /api/video-projects` 幂等创建项目。

每个未删除 transcript 当前只允许一个 video project；一个项目内部通过多个 candidates 和
versions 产生多条短视频方案。

### 删除顺序

项目、transcript 和账号删除都遵循：

1. 按 owner 查询全部确定性 R2 keys。
2. 删除 R2 对象；失败则保留 D1 记录供重试。
3. 解除 project 对 source/version 的循环引用。
4. 删除 jobs、candidates、versions、asset rows 和 project rows。

用户有两个不同范围的删除动作：

- “Remove original video” 只删除 source 与 preview proxies，并清空 transcript 的媒体 key；项目、
  transcript 文本、候选、草稿元数据和未到期的最新成片仍保留。项目进入归档只读状态，不能继续
  编辑或重新导出。
- “Delete video project” 删除该项目的 source、preview、brand assets、final outputs 与项目数据，
  但保留 transcript 文本记录。删除 transcript 或账号仍执行完整的关联清理。

所有删除都先确认 R2 对象已删除，再清理 D1 引用；活跃渲染期间拒绝移除 source。

### Source retention 与容量

| 套餐 | 原视频保留 | 原视频总容量 |
|---|---:|---:|
| Free | 7 天 | 5 GiB |
| Basic | 30 天 | 25 GiB |
| Creator（`pro`） | 30 天 | 100 GiB |

这些值定义在 `lib/plans.ts`，是套餐事实的单一来源。Preflight 会在上传前返回当前
`usedBytes`、`limitBytes`、`requiredBytes` 和 `retentionDays`；创建 source asset 时再用带
容量条件的单条 INSERT 原子校验，避免并发上传同时越过上限。容量不足时整次视频上传被阻止，
Free/Basic 用户会看到升级入口；不会静默退回只上传音频。音频文件不读取或占用这组容量。

Source 到期时，cleanup worker 会等待活跃 preview/final job 结束，再删除 R2 原视频与 preview
proxies，并清空 transcript 的旧 `audio_r2_key` 和 project 的 `source_asset_id`。Transcript 文本、
候选和未到期的最新 final export 继续保留；当前产品不提供为归档项目重新绑定 source 的流程。

每个 candidate 只保留最新完成的 final export。新导出成功后，旧 job 标记为 superseded，并立即
尝试删除旧视频和封面；删除失败由 cleanup worker 重试。最新视频和封面从完成时间起保留 30 天，
也允许用户提前删除。到期清理不会删除 transcript 文本或候选元数据，但没有 source 时无法重新生成成片。

### 验证

- 全部 migration 必须能从空 D1 数据库应用至当前最新版本。
- TypeScript 检查通过。
- Video workspace 合同与 R2 key 测试通过。
- Production build 必须在每次生命周期改动后通过。

<a id="selection"></a>

## AI 候选与完整性

> 状态：以下早期 M2 验证保留为实现依据；动态批量分析的现行范围与发布记录见 [AI Clips 方案](../roadmap/ai-clips-generation-workflow.md)及[验证记录](ai-analysis-validation.md)
> Migrations：`0026_clip_candidate_feedback.sql`、`0032_clip_candidate_origin.sql`、`0033_candidate_drafts.sql`

### 范围

M2 的早期同步路径只生成和筛选候选，不自动触发最终渲染。现行批量路径的范围和数量由 [AI Clips 方案](../roadmap/ai-clips-generation-workflow.md)定义；共同边界如下：

- AI 候选允许为 0 个，禁止为了凑数量返回弱候选。
- Creator 和 grandfathered Basic 可对不超过 45 秒的原视频直接编辑；Free 仍走 AI 候选流程。
- AI 候选时长为 15–90 秒；批量路径最多展示 120 条，但不按视频时长保证产出数量。旧同步路径关闭批量开关时仍使用 1／3／5 条上限。
- 用户手动调整后的最终时间线最多 90 秒。
- 每个 AI 候选只使用一个连续 source segment，不做语义拼接。
- 完整性是硬门槛：只看原始口播时，陌生观众必须能理解必要背景、核心观点和完整收尾；标题、hook 和字幕不能修补缺失上下文。
- 用户进入编辑器后可从 original source 手动调整，EDL 最多 3 个 segments、总时长最多 90 秒；AI 不会自动拼接分散片段或改变原意。
- 在选定时长范围内无法做到独立可理解时放弃候选，不通过 AI 旁白补充背景。
- 候选保存后只自动预热前 5 名的 preview proxies，其余首次打开时懒生成；选择候选与反馈不触发最终渲染。

### 早期同步路径的受控 AI 输入

以下记录保留旧同步路径的输入与二审边界；生产批量路径采用持久化分批发现、统一复审与按需预览，见 [AI Clips 方案](../roadmap/ai-clips-generation-workflow.md)。

服务端读取现有 R2 transcript 的完整 words，在内存生成句子编号和 word 索引映射：

```text
s12|84.2-91.7|A|This is the original spoken sentence.
```

每行只有句子编号、近似秒数、speaker 和原文，不包含逐词时间戳。优先使用与真实 word
边界一致的 AAI sentences；缺少有效句子标注的部分按标点、停顿和 speaker 切分。每个有效
word 恰好归属一个句子。句子编号及首尾 word 索引仅保存在本次请求的内存中，不新增 R2
副本或 D1 转写字段，也不需要 migration。

输入中的 transcript 明确标记为不可信内容。换行、分隔符和异常空白会被规范化。单批输入
上限为 100,000 字符；长文本按连续句子分批，相邻批次保留约 60 秒重叠，覆盖全部原文，
不会均匀抽样或丢弃中间段落。单句本身超限时明确失败。批次候选统一排序、去重后进入二审。
日志只记录字符数、token usage、request ID 和稳定错误码，不记录 transcript 或候选正文。

### OpenAI 两阶段输出边界

候选生成与独立完整性二审都使用 `gpt-5.6-terra`、`reasoning.effort: medium` 和
Responses API strict JSON Schema。聊天等其他 AI 功能的 nano 模型不受影响。所有 object 都声明
`additionalProperties: false`，并在 SDK/HTTP 层之外再次做本地 exact-key、类型、长度、数量和
数值检查。实现遵循 OpenAI 的
[Structured Outputs 文档](https://developers.openai.com/api/docs/guides/structured-outputs)。

Provider 只返回候选内容和 `startSentenceId` / `endSentenceId`；稳定 candidate ID 与 `schemaVersion` 由 Scribix
服务端生成，模型不能选择数据库 ID。

第一阶段读取完整受控 transcript，提出 0–5 个候选。第二阶段只读取候选及前后各 45 秒
范围内的完整句子；重叠上下文去重，每个候选仍只能在自己的上下文内调整。二审不接收
第一轮的主题、hook 和推荐理由，避免依赖文案补足口播。第二阶段是独立调用，只能对每个候选执行
`accept`、`adjust` 或 `reject`：

- `accept` 返回原始句子编号，保留第一阶段的原始范围。
- `adjust` 只能修改首尾句子编号，且必须与原候选重叠，用于补齐背景或收尾；不能改写主题、hook、reason 或 score。
- `reject` 将两个句子编号设为 null，删除在允许时长内无法修复的候选。

二审必须恰好返回每个 candidate index 一次；缺失、重复、未知字段或非法 verdict 会使整个
provider payload 在写入 D1 前失败。两阶段分别记录 token、reasoning token、cache hit 和估算费用；长文本第一阶段汇总各批次 usage。

### 服务端准入流水线

模型输出必须依次通过：

1. 第一阶段 strict JSON Schema 与本地 provider payload 校验。
2. Terra 独立完整性二审；只允许接受、调整 ranges 或拒绝。
3. 二审 strict JSON Schema、candidate index 完整性与本地 exact-key 校验。
4. 原始时间范围越界、反向区间和 segment 数量检查。
5. 将有效句子编号直接映射到保留的真实 word 起止时间；拒绝未知、反向、不连续或超出该候选上下文的编号。显示的近似时间不参与反推，AI 新流程不依赖最近时间猜测。
6. 单 segment 至少 2 秒；AI 候选总时长必须在 15–90 秒。
7. 同一候选的 source ranges 不得重叠。
8. 按 score 排序，以 source 时间覆盖率 80% 为阈值去除高度重复候选。
9. 再次通过共享 `ClipCandidate` contract 后才能写入 D1。

如果没有候选完整通过，服务端保存空候选集并显示无匹配结果及剩余调整机会，不会把空结果当作 provider 失败，也不会为了凑数放宽质量门槛。用户仍可从 original source 建立手动剪辑；任何无效 candidate payload 都不会进入后续 preview/render pipeline。

### API 与状态

- `GET /api/video-projects/{projectId}/candidates`：读取当前候选和 project 状态。
- `POST /api/video-projects/{projectId}/candidates`：首次生成 AI 候选；JSON body `{ "mode": "manual" }` 从 original source 建立额外的手动剪辑入口。
- `DELETE /api/video-projects/{projectId}/candidates/{candidateId}`：只删除付费用户创建的 manual candidate 及其相关草稿、任务和输出；AI 推荐不可通过该接口删除。
- `POST /api/video-projects/{projectId}/candidates/{candidateId}/feedback`：记录
  `accepted` 或 `rejected`。

AI 生成时 project 原子切换为 `analyzing`，阻止同一项目重复请求。付费短源直接编辑和显式 manual 模式不调用 AI；Free 短源仍调用 AI。超过 10 分钟的 analyzing
状态可按原条件安全重试；零匹配允许一次显式调整，成功产生过 AI candidates 后服务端返回
`candidates_already_generated`，避免无上限重复消耗 AI。首次生成失败不会写入部分候选。

反馈当前同时更新候选状态，并写入 `clip_candidate_feedback_events` 事件表。事件不依赖候选
外键，因此删除 candidate 后历史接受率数据仍可保留；删除 project 或账号时事件一起删除。

### UI

完成转录且仍有原视频的 transcript 会显示“查找视频片段”入口。候选工作台展示 AI 推荐与
manual candidates，支持选择候选；付费用户可创建和删除 manual candidate。AI 推荐生成完成后
不显示 Regenerate。页面重新加载到活跃任务时会轮询状态；陈旧任务会恢复为可重试状态。

### 验证

- `npm run test:video-workspace` 覆盖精确句子/word 映射、缺失/部分句子标注、长文本完整覆盖、局部上下文隔离、连续候选、越界过滤、去重，以及接受/调整/拒绝和非法 decision。
- `npm run test:ai-candidates` 用模拟 Responses API 验证请求 schema、两阶段实际载荷、分批 usage 与错误处理，不产生模型费用。
- Locale key/type/ICU 参数一致性必须通过。
- 全量 TypeScript 检查与 production build 必须通过。
- 全部 migrations 必须能从空 D1 数据库应用到当前最新版本，且 foreign key check 为空。

### 首期按需求选片（2026-09-08）

长视频工作台改为用户明确点击开始，支持自动推荐或主题与类型条件；转写期间可提交并保存待执行需求。条件进入所有分析批次和完整性复审，零匹配最多一次调整，技术失败按原条件重试。成功结果保持原批次。执行状态、API 字段、兼容与验证见[发布准备约定](publish-preparation.md)。
