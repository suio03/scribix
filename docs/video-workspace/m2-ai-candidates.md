# AI 短视频工作台 M2 候选生成

> 状态：已提交（`fac1911`）
> Migration：`0026_clip_candidate_feedback.sql`

## 范围

M2 只生成和筛选候选，不生成 preview proxy，也不会自动触发最终渲染。候选的固定 V1
约束如下：

- 每次最多 5 个候选。
- 每个候选总时长 15–90 秒。
- 每个候选最多 3 个互不重叠的 source segments。
- 一个候选可以按叙事顺序组合多个不连续 segments。
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

## OpenAI 输出边界

候选通过 Responses API 的 strict JSON Schema 生成。所有 object 都声明
`additionalProperties: false`，并在 SDK/HTTP 层之外再次做本地 exact-key、类型、长度、数量和
数值检查。实现遵循 OpenAI 的
[Structured Outputs 文档](https://developers.openai.com/api/docs/guides/structured-outputs)。

Provider 只返回候选内容和 source ranges；稳定 candidate ID 与 `schemaVersion` 由 Scribix
服务端生成，模型不能选择数据库 ID。

## 服务端准入流水线

模型输出必须依次通过：

1. Strict JSON Schema 与本地 provider payload 校验。
2. 原始时间范围越界、反向区间和 segment 数量检查。
3. 起止时间吸附到最近的真实 word start/end；漂移超过 3 秒则拒绝该候选。
4. 单 segment 至少 2 秒；候选总时长必须在 15–90 秒。
5. 同一候选的 source ranges 不得重叠。
6. 按 score 排序，以 source 时间覆盖率 80% 为阈值去除高度重复候选。
7. 再次通过共享 `ClipCandidate` contract 后才能写入 D1。

只要没有候选完整通过，生成即失败，任何无效 payload 都不会进入后续 preview/render
pipeline。

## API 与状态

- `GET /api/video-projects/{projectId}/candidates`：读取当前候选和 project 状态。
- `POST /api/video-projects/{projectId}/candidates`：生成或重新生成候选。
- `POST /api/video-projects/{projectId}/candidates/{candidateId}/feedback`：记录
  `accepted` 或 `rejected`。

生成时 project 原子切换为 `analyzing`，阻止同一项目重复请求。超过 10 分钟的 analyzing
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

- 合同测试覆盖真实 word-boundary 对齐、多段候选、越界过滤、高重复去重和未知字段拒绝。
- Locale key/type/ICU 参数一致性必须通过。
- 全量 TypeScript 检查与 production build 必须通过。
- 全部 migrations 必须能从空 D1 数据库应用到 `0026`，且 foreign key check 为空。
