# AI 短视频工作台 M2 候选生成

> 状态：本地实现与验证完成
> Migrations：`0026_clip_candidate_feedback.sql`、`0032_clip_candidate_origin.sql`、`0033_candidate_drafts.sql`

## 范围

M2 只生成和筛选候选，不生成 preview proxy，也不会自动触发最终渲染。候选的固定 V1
约束如下：

- AI 候选允许为 0 个，禁止为了凑数量返回弱候选。
- 原视频不超过 45 秒时不调用 AI，直接从完整原视频进入编辑器。
- 45 秒以上、3 分钟以内的原视频最多返回 3 个候选；超过 3 分钟最多返回 5 个。
- 每个 AI 候选总时长 15–45 秒；用户手动调整后的最终时间线最多 60 秒。
- 每个 AI 候选只使用一个连续 source segment，不做语义拼接。
- 完整性是硬门槛：只看原始口播时，陌生观众必须能理解必要背景、核心观点和完整收尾；标题、hook 和字幕不能修补缺失上下文。
- 用户进入编辑器后可从 original source 手动调整，EDL 最多 3 个 segments、总时长最多 60 秒；AI 不会自动拼接分散片段或改变原意。
- 45 秒内无法做到独立可理解时直接放弃候选，不延长到 60 秒，也不通过 AI 旁白补充背景。
- 用户选择候选只记录反馈；M3 才开始生成可播放的 preview proxies。

## 受控 AI 输入

服务端从 transcript 生成紧凑的只读参考行：

```text
row|start_ms|end_ms|speaker|word_start-word_end:spoken_word …
```

输入中的 transcript 明确标记为不可信内容。换行、分隔符和异常空白会被规范化；输入预算为
480,000 字符。超过预算时按时间轴均匀抽取行，而不是只保留视频开头。完整 word timestamp
集合仍保留在服务端，专门用于最终对齐和验证。日志只记录字符数、token usage、request ID
和稳定错误码，不记录 transcript 或候选正文。

## OpenAI 两阶段输出边界

候选生成与独立完整性二审都使用 `gpt-5.6-terra`、`reasoning.effort: medium` 和
Responses API strict JSON Schema。聊天等其他 AI 功能的 nano 模型不受影响。所有 object 都声明
`additionalProperties: false`，并在 SDK/HTTP 层之外再次做本地 exact-key、类型、长度、数量和
数值检查。实现遵循 OpenAI 的
[Structured Outputs 文档](https://developers.openai.com/api/docs/guides/structured-outputs)。

Provider 只返回候选内容和 source ranges；稳定 candidate ID 与 `schemaVersion` 由 Scribix
服务端生成，模型不能选择数据库 ID。

第一阶段读取完整受控 transcript，提出 0–5 个候选。第二阶段是独立调用，只能对每个候选执行
`accept`、`adjust` 或 `reject`：

- `accept` 保留第一阶段的原始 ranges。
- `adjust` 只能修改 source ranges，用于补齐背景或收尾；不能改写主题、hook、reason 或 score。
- `reject` 删除 45 秒内无法修复的候选。

二审必须恰好返回每个 candidate index 一次；缺失、重复、未知字段或非法 verdict 会使整个
provider payload 在写入 D1 前失败。两次调用分别记录 token、reasoning token、cache hit 和估算费用。

## 服务端准入流水线

模型输出必须依次通过：

1. 第一阶段 strict JSON Schema 与本地 provider payload 校验。
2. Terra 独立完整性二审；只允许接受、调整 ranges 或拒绝。
3. 二审 strict JSON Schema、candidate index 完整性与本地 exact-key 校验。
4. 原始时间范围越界、反向区间和 segment 数量检查。
5. 起止时间吸附到最近的真实 word start/end；漂移超过 3 秒则拒绝该候选。
6. 单 segment 至少 2 秒；AI 候选总时长必须在 15–45 秒。
7. 同一候选的 source ranges 不得重叠。
8. 按 score 排序，以 source 时间覆盖率 80% 为阈值去除高度重复候选。
9. 再次通过共享 `ClipCandidate` contract 后才能写入 D1。

如果没有候选完整通过，服务端保存空候选集并显示“未发现足够完整的精彩片段”，不会把空结果当作 provider 失败，也不会为了凑数放宽质量门槛。用户仍可从 original source 建立手动剪辑；任何无效 candidate payload 都不会进入后续 preview/render pipeline。

## API 与状态

- `GET /api/video-projects/{projectId}/candidates`：读取当前候选和 project 状态。
- `POST /api/video-projects/{projectId}/candidates`：生成或重新生成候选；JSON body `{ "mode": "manual" }` 从 original source 建立手动剪辑入口。
- `POST /api/video-projects/{projectId}/candidates/{candidateId}/feedback`：记录
  `accepted` 或 `rejected`。

AI 生成时 project 原子切换为 `analyzing`，阻止同一项目重复请求。短源视频和显式 manual 模式不调用 AI。超过 10 分钟的 analyzing
状态可被安全重试。重新生成成功后才以 D1 batch 替换旧候选；失败时旧候选和此前的用户反馈
事件都保留。

反馈当前同时更新候选状态，并写入 `clip_candidate_feedback_events` 事件表。事件不依赖候选
外键，因此候选被重新生成替换后，历史接受率数据仍可保留；删除 project 或账号时事件一起
删除。

## UI

完成转录且仍有原视频的 transcript 会显示“查找视频片段”入口。候选工作台展示 rank、主题、
hook、reason、得分、总时长和每段 source timestamp，支持重新生成、选择和排除。页面重新加载
到活跃任务时会轮询状态；陈旧任务会恢复为可重试状态。

## 验证

- 合同测试覆盖真实 word-boundary 对齐、连续候选、越界过滤、高重复去重、完整性二审的接受/调整/拒绝，以及未知字段、缺失或重复 decision 拒绝。
- Locale key/type/ICU 参数一致性必须通过。
- 全量 TypeScript 检查与 production build 必须通过。
- 全部 migrations 必须能从空 D1 数据库应用到 `0033`，且 foreign key check 为空。
