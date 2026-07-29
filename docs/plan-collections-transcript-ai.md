# Scribix Collections 与 Transcript AI Workspace 实施计划

> 状态：已规划，尚未实施  
> 创建日期：2026-07-27  
> 当前范围：第一阶段、第二阶段  
> 延后范围：第三阶段 Collection AI 及场景化能力

## 1. 已确认的产品方向

本计划沉淀以下已经确认的方向：

- 用户不会只有一个视频或一份 transcript；学生、播客创作者和工作人员都会长期积累相关内容。
- 近期先让用户通过 Collection（资料集）组织和管理多份 transcript。
- “先不要做 AI‘分析当前学科的所有 transcript’”，Collection 级 AI “可以作为第三阶段使用”。
- 在 Collection AI 之前，增加针对“当前的转录文件进行交流”的 Ask AI。
- 当前 transcript 的 AI Notes 与 Ask AI 应形成一个统一的 Transcript AI Workspace。
- 第三阶段需要进入长期计划，但现在不实施。
- 后续按本文件的里程碑一步一步完成，每个里程碑完成并验证后再进入下一步。

## 2. 一句话目标

把 Scribix 从按时间平铺的一次性转录工具，升级为可以长期组织多份 transcript、并能围绕当前 transcript 生成可追溯笔记和持续对话的工作空间。

## 3. 产品原则与已定决策

### 3.1 Collection 是通用容器

- 代码和数据层使用稳定名称 `Collection`。
- 用户界面按 locale 翻译；中文建议使用“资料集”。
- “学科”是学生对 Collection 的一种使用方式，不进入底层数据模型。
- 学生可以创建 Biology，播客用户可以创建 Podcast Research，工作用户可以创建 Project Alpha。

### 3.2 第一版保持单层结构

- 一个 transcript 最多属于一个 Collection。
- transcript 可以不属于任何 Collection；界面统一显示为“未分类 / Unfiled”。
- Unfiled 是虚拟视图，不创建特殊 Collection 数据行。
- 暂不支持嵌套文件夹、标签、多 Collection 归属、颜色、图标和拖拽排序。

### 3.3 删除 Collection 不删除 transcript

- 删除 Collection 时，其中的 transcripts 全部移回 Unfiled。
- 删除 transcript 时继续沿用现有 transcript、音视频、翻译、AI Notes 的清理语义。
- 未来加入 Ask AI 后，删除 transcript 和删除账户也必须清理对应会话与消息。

### 3.4 两种 AI 范围必须分开

- Transcript AI：上下文固定为当前一份 transcript，近期实施。
- Collection AI：从同一个 Collection 的多份 transcripts 中检索和回答，第三阶段实施。
- 当前阶段不得为了未来 Collection AI 提前加入向量库、知识图谱或 Collection chat 表。

### 3.5 AI 必须可追溯

- AI Notes 和 Ask AI 的重要结论必须引用原 transcript 的 segment。
- UI 将引用解析成说话人、开始/结束时间，并支持点击跳回 transcript 和媒体位置。
- 模型返回 segment ID，服务端验证 ID 后再解析时间；不直接信任模型生成的任意时间戳。
- 找不到依据时，Ask AI 必须明确说明当前 transcript 没有相关内容。

## 4. 当前基线

### 4.1 Transcript Library

- Dashboard 当前按 `created_at DESC` 平铺最近 100 条 transcripts。
- `transcripts` 表没有 Collection 关系。
- 上传/录音和应用内 YouTube import 分别创建 transcript。
- 浏览器扩展的即时 YouTube transcript 当前不写入主 transcript library，因此不在第一阶段的 Collection 赋值范围内。

### 4.2 AI Notes

- 当前仅对单份已完成 transcript 工作，并仅开放给付费用户。
- 使用 OpenAI Responses API 与 `gpt-5-nano`。
- 输入包含 segment 时间戳、speaker 和文本，最多保留 1,000,000 个字符。
- 输出是一个固定的纯文本结构：Overview、3–6 个 Key points、可选 Action items。
- 生成状态保存在 D1，结果 JSON 保存在 R2；支持缓存、失败重试和卡住任务恢复。
- UI 以纯文本显示结果，没有结构化 section、可靠引用、点击定位、模板选择或成功后的重新生成。

### 4.3 Ask AI

- 当前没有 Ask AI API、会话数据模型、对话历史、引用协议或聊天 UI。
- 当前隐私政策只覆盖 OpenAI 处理付费 AI summary；加入 Ask AI 前必须更新相关说明。

## 5. 当前明确不做的内容

- Collection 内所有 transcripts 的 AI 分析或问答。
- 自动生成 Collection 总结、共同主题、矛盾观点或跨 transcript 时间线。
- 学生复习模式、播客内容模式、工作会议模式。
- Mind Map。
- 自动分类、AI 推荐 Collection。
- 团队协作、Collection 分享和复杂权限。
- 嵌套 Collection、标签和一个 transcript 属于多个 Collection。
- transcript 全文搜索；第二阶段搜索先覆盖标题与已有数据库元数据。
- 浏览器扩展内容自动保存到 Collection。

## 6. 目标信息架构

```text
Dashboard
├── Collections
│   ├── Biology
│   │   ├── Lecture 01
│   │   ├── Lecture 02
│   │   └── Cell Division Explained
│   ├── Podcast Research
│   └── Project Alpha
├── Unfiled
└── Recent transcripts

Transcript detail
├── Transcript / Subtitles / Translation
└── AI Workspace
    ├── AI Notes
    └── Ask AI
```

桌面端 Transcript detail 的长期目标是左右对照：左侧保留 transcript 与媒体同步，右侧显示 AI Notes 或 Ask AI。移动端使用 tabs 或纵向切换，避免强行压缩成双栏。

## 7. 数据模型计划

### 7.1 第一阶段 migration

新增下一号 D1 migration，预期包含：

```sql
CREATE TABLE collections (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at  DATETIME
);

CREATE INDEX idx_collections_user_updated
  ON collections(user_id, updated_at)
  WHERE deleted_at IS NULL;

ALTER TABLE transcripts ADD COLUMN collection_id TEXT REFERENCES collections(id);

CREATE INDEX idx_transcripts_collection_created
  ON transcripts(collection_id, created_at)
  WHERE deleted_at IS NULL;
```

实施约束：

- Collection name 去除首尾空白、合并异常空格、最大 80 个字符、不能为空。
- 第一版在应用层拒绝同一用户完全相同的活跃 Collection name；不为了复杂 Unicode case-folding 增加额外结构。
- 所有带 `collection_id` 的写入必须验证 Collection 属于当前用户且未删除。
- Migration 只做 additive change，不重写现有 transcripts；旧数据自然进入 Unfiled。

### 7.2 Ask AI 数据模型

第二阶段 B 实施前再创建独立 migration，预期包含：

```text
transcript_chat_sessions
- id
- transcript_id
- user_id
- title
- created_at
- updated_at
- deleted_at

transcript_chat_messages
- id
- session_id
- role
- content
- citations_json
- model
- input_tokens
- output_tokens
- created_at
```

约束：

- D1 中的数据是 Scribix 的会话事实来源。
- 默认由 Scribix 自己重建有限对话历史并调用 Responses API，不把 OpenAI conversation object 作为唯一状态来源。
- OpenAI 请求优先使用 `store: false`，便于保持与 Scribix 删除语义一致；实施时再次按当时官方文档核对。
- 日志不得记录 transcript 内容、用户问题或完整 AI 回答。

## 8. API 计划

### 8.1 Collection API

- `GET /api/collections`
  - 返回当前用户的活跃 Collections 及基础统计。
- `POST /api/collections`
  - 创建 Collection。
- `PATCH /api/collections/[id]`
  - 重命名 Collection。
- `DELETE /api/collections/[id]`
  - 先将其 transcripts 更新为 `collection_id = NULL`，再软删除 Collection。
- `PATCH /api/transcripts/[id]`
  - 扩展现有 route，支持 `{ collectionId: string | null }`。
- `PATCH /api/transcripts/bulk`
  - 第二阶段 A 增加，支持批量移动；必须保证所有 transcript IDs 都属于当前用户。

### 8.2 Transcript 创建入口

以下入口增加可选 `collectionId`，并在创建 transcript 前验证所有权：

- `POST /api/transcripts/init`：dashboard 上传和录音链路。
- `POST /api/transcripts/youtube/import`：应用内 YouTube import。

不在当前范围：

- 匿名或扩展本地缓存的 transcript。
- 尚未保存到 Scribix transcript library 的浏览器扩展结果。

### 8.3 AI Notes v2 API

- 保留现有 `GET/POST /api/transcripts/[id]/summary` 权限、缓存和状态机。
- 新 payload 增加明确 `schemaVersion`，使用结构化输出而不是依赖 Markdown 字符串。
- 旧 summary payload 继续可读，并在 UI 标记为 legacy；用户主动重新生成时升级为 v2。
- 重新生成必须有显式操作、并发保护和成本事件，不在页面打开时自动触发。
- 结构化响应至少包含：
  - title
  - overview
  - keyPoints
  - keyMoments
  - actionItems（允许为空）
  - 每一项的 segment citations

### 8.4 Ask AI API

建议 route 形状：

- `GET /api/transcripts/[id]/chat/sessions`
- `POST /api/transcripts/[id]/chat/sessions`
- `GET /api/transcripts/[id]/chat/sessions/[sessionId]`
- `POST /api/transcripts/[id]/chat/sessions/[sessionId]/messages`
- `DELETE /api/transcripts/[id]/chat/sessions/[sessionId]`

每次消息请求必须：

1. 验证用户、套餐、transcript 与 session 所有权。
2. 确认 transcript 已完成且 R2 对象存在。
3. 读取并标准化 transcript segments，为每段分配稳定 segment ID。
4. 估算输入预算；短中 transcript 先走完整上下文，超过安全预算时拒绝或进入受控检索路径，不静默截掉问题相关内容。
5. 只发送有限、相关的会话历史，避免对话无限增长。
6. 要求结构化回答与 segment citations。
7. 服务端校验 citations，只保存合法引用。
8. 记录 token usage、延迟、状态和错误码，但不记录用户内容。

## 9. 分阶段实施

## 第一阶段：Collection 基础闭环

### M1.1 数据与领域层

- [ ] 新增 `collections` migration 和 transcript nullable `collection_id`。
- [ ] 新增 Collection 类型、name normalization 和 ownership helpers。
- [ ] 为 Collection 和 collection transcript queries 建立集中式查询函数，避免 route 中重复所有权逻辑。
- [ ] 本地应用 migration，并确认现有 transcripts 全部表现为 Unfiled。

完成标准：

- 现有数据无损。
- 未分类 transcript 的现有上传、查看、导出、翻译和 AI Notes 行为不变。
- 不可能把 transcript 移入其他用户的 Collection。

### M1.2 Collection CRUD API

- [ ] 实现 list/create/rename/delete routes。
- [ ] 扩展 transcript PATCH 以支持移动或移回 Unfiled。
- [ ] 明确定义 400、401、403、404、409 错误语义。
- [ ] 删除 Collection 时先移动 transcripts，再软删除 Collection。

完成标准：

- Collection CRUD 与移动操作均通过服务端所有权校验。
- 删除 Collection 不删除 transcript 或 R2 对象。
- 重复提交和并发删除不会产生跨用户或悬空数据。

### M1.3 Dashboard 与 Collection 页面

- [ ] Dashboard 增加 Collections 区域、Unfiled 和 Recent transcripts。
- [ ] 增加 `/dashboard/collections/[id]` 页面。
- [ ] 增加创建、重命名、删除 Collection 的 dialog/menu。
- [ ] transcript 行菜单增加 Move to Collection。
- [ ] transcript detail 显示所属 Collection，并提供正确返回路径。
- [ ] 完成 empty、loading、error、deleted Collection 和移动后的界面状态。
- [ ] 完成桌面和移动端基本布局。

完成标准：

- 用户可以从 Dashboard 完成创建 Collection、加入 transcript、打开 Collection、移出 transcript 和删除 Collection 的完整闭环。
- 所有 destructive action 都有明确确认与后果说明。

### M1.4 新建 Transcript 时选择 Collection

- [ ] Dashboard `/new` 增加可选 Collection selector。
- [ ] 上传和录音创建请求传递 `collectionId`。
- [ ] 应用内 YouTube import 支持相同 selector。
- [ ] Collection 页面提供“Add transcript”入口，并预选当前 Collection。
- [ ] selector 加载或校验失败时不得阻塞用户创建未分类 transcript。

完成标准：

- 用户可以从 Collection 中开始上传，并在完成后回到正确的 Collection。
- 旧调用方未传 `collectionId` 时行为保持兼容。

### M1.5 i18n、analytics 与验证

- [ ] 所有用户文案进入 `messages/*.json`。
- [ ] Collection route、IDs、limits、排序值等稳定结构保留在 TypeScript。
- [ ] 增加 locale parity 验证。
- [ ] 增加不含 Collection name 或 transcript 内容的产品事件：
  - `collection_created`
  - `collection_opened`
  - `collection_renamed`
  - `collection_deleted`
  - `transcript_collection_assigned`
  - `transcript_collection_unfiled`
- [ ] 运行 `npm run check-locales`。
- [ ] 运行 `npm run build`。
- [ ] 手动验证上传、录音、YouTube import、移动、删除和现有 transcript 功能。

第一阶段发布门：

- [ ] 本地 migration 验证完成。
- [ ] 生产 remote migration 与部署需单独明确授权。
- [ ] 上线后确认 Collection 操作错误率与 transcript 创建成功率无回归。

## 第二阶段 A：大量 Transcript 的管理体验

### M2A.1 搜索、排序和筛选

- [ ] Collection 内按 transcript title 搜索。
- [ ] 支持 newest、oldest、title、duration 排序。
- [ ] 支持 status、source、language 等现有元数据筛选；只添加实际有用的筛选项。
- [ ] 增加分页或 cursor，移除依赖单页最多 100 条的隐含限制。
- [ ] 保留 URL query，使刷新和返回操作可恢复当前列表状态。

明确边界：

- 本阶段不搜索 R2 中的 transcript 正文。
- 不为了全文搜索提前建设 embeddings 或外部索引。

### M2A.2 批量管理

- [ ] 支持多选 transcript。
- [ ] 支持批量移动到 Collection 或 Unfiled。
- [ ] 批量操作返回明确的成功数量与失败原因。
- [ ] 不在本阶段增加批量删除，避免扩大 destructive scope。

### M2A.3 Collection 统计与快速入口

- [ ] 显示 transcript count、总时长、最近更新时间。
- [ ] Dashboard 显示最近 Collections 和最近 transcripts。
- [ ] 记住用户上一次明确选择的 Collection，并允许一键改回 Unfiled。
- [ ] 上传完成后明确显示 transcript 保存位置。

第二阶段 A 完成标准：

- 拥有几十或上百份 transcripts 的用户仍能快速找到和移动内容。
- 列表状态可分享/刷新恢复，移动后统计正确。
- `npm run check-locales` 与 `npm run build` 通过，主要管理流程完成手动验证。

## 第二阶段 B：当前 Transcript AI Workspace

### 决策门 DG-AI-1：实施前必须确认

Ask AI 会产生持续、不可缓存为单份固定结果的成本。开始 M2B 前必须确认：

- [ ] Ask AI 是否只开放给 Pro；当前建议：Pro-only。
- [ ] 每用户每日消息上限、并发上限与最大输入/输出预算。
- [ ] 超限后的产品文案和是否提供升级入口。
- [ ] AI 对话保存期限，以及用户是否可以删除单个会话。
- [ ] 用真实 transcript eval 比较模型质量、延迟和成本后再确定 Ask AI model；不因为文档推荐新模型就顺便替换当前 summary model。

### M2B.1 AI Notes v2

- [ ] 定义服务端与前端共享的 AI Notes schema。
- [ ] 使用 OpenAI Structured Outputs，处理 refusal、incomplete 和 schema validation。
- [ ] 输入 segment 使用稳定 ID；输出只允许引用已提供 ID。
- [ ] 生成 overview、key points、key moments 和可选 action items。
- [ ] UI 使用语义化 React 组件渲染，不直接渲染模型 HTML。
- [ ] 引用可点击并跳转到 transcript 和媒体时间。
- [ ] 支持 legacy summary 读取与显式 regenerate。
- [ ] 对失败、处理中、旧版本、重新生成和部分 transcript 提供明确状态。

### M2B.2 Transcript 双栏工作区

- [ ] 桌面端左侧固定 transcript，右侧切换 AI Notes / Ask AI。
- [ ] 移动端使用可访问的 tabs 或纵向切换。
- [ ] 将现有 ExportPanel 重新安置到顶部操作或独立面板，保留所有下载、copy 和 audio 行为。
- [ ] AI 引用跳转时自动滚动、高亮 segment，并同步播放位置。
- [ ] 完成键盘导航、焦点管理、loading 和 screen-reader labels。

### M2B.3 Ask AI 后端

- [ ] 新增 chat session/message migration。
- [ ] 新增会话 CRUD 和 message routes。
- [ ] 应用层管理对话历史，明确 OpenAI `store` 与删除策略。
- [ ] 增加 server-side rate limit、并发保护和消息长度限制。
- [ ] 抵抗 transcript 中的 prompt injection：将 transcript 明确视为不可信来源内容，而不是系统指令。
- [ ] 回答只基于当前 transcript；外部知识如果未来允许，必须在 UI 中明确区分。
- [ ] 对超长 transcript 做 token budget guard；先验证完整上下文方案，再决定是否需要 retrieval。
- [ ] 保存合法 citations、usage、model 和状态。

### M2B.4 Ask AI 前端

- [ ] 当前 transcript 页面增加 Ask AI tab。
- [ ] 支持首次提问、连续追问、新建对话、打开历史和删除会话。
- [ ] 提供少量基于当前 transcript 的 starter questions，不做学生/播客/工作三套模式。
- [ ] 回答显示可点击引用。
- [ ] 明确显示“只基于当前 transcript”；找不到时不伪造答案。
- [ ] 处理发送中、重试、限流、额度用尽、内容缺失和服务不可用状态。

### M2B.5 隐私、analytics 与质量验证

- [ ] 更新 Privacy 页面，说明 Ask AI 会发送哪些 transcript 片段、问题和对话上下文给 OpenAI。
- [ ] transcript/account deletion 清理所有 chat session/message 数据。
- [ ] analytics 只记录事件和技术元数据，不记录问题、回答、Collection name 或 transcript 内容。
- [ ] 建立最小 eval 集：事实问题、找不到答案、跨段归纳、时间点引用、speaker 引用、prompt injection、长 transcript。
- [ ] 验证每个引用对应真实 segment，且点击定位正确。
- [ ] 记录并检查 token usage、延迟、失败率和缓存命中（如启用）。
- [ ] 运行 `npm run check-locales` 与 `npm run build`。
- [ ] 手动验证桌面、移动端、Free/Pro、partial transcript、YouTube 和音视频 playback。

第二阶段 B 完成标准：

- AI Notes 输出结构稳定、可追溯且可以跳回原文。
- 用户可以围绕当前 transcript 连续提问并管理会话。
- Ask AI 不会引用不存在的 segment；无依据时明确告知。
- 成本、限流、隐私、删除和套餐边界全部可解释、可验证。

## 第三阶段：Collection AI 与场景化能力（记录，不实施）

### M3.1 Collection Ask AI

- 从一份 transcript 扩展为一个 Collection 内的多份 transcripts。
- 支持选择、排除或临时添加 sources。
- 回答引用 transcript title、speaker、segment 和时间点。
- 需要跨 transcript retrieval、权限过滤、索引更新与删除一致性。
- 复用第二阶段 B 的 chat UI、session、structured citations 和 eval 方法。

### M3.2 Collection 自动分析

- Collection 总体摘要。
- 反复出现的主题和概念。
- 不同 transcripts 之间的一致、冲突和变化。
- 跨 transcript 时间线和未解决问题。

### M3.3 场景化能力

- 学生：复习提纲、概念解释、测验和考点。
- 播客：引用、选题、重复主题、clip 候选和 show notes。
- 工作：决策、行动项、负责人、跨会议变化和风险。

第三阶段开始条件：

- 第一、二阶段已稳定上线。
- Collection 中确实存在持续积累的 transcripts。
- Transcript Ask AI 的引用、成本、隐私和删除模型已经稳定。
- 再单独确认 retrieval/indexing 架构，不沿用未经验证的提前设计。

## 10. 跨阶段工程要求

### 10.1 安全与隐私

- 所有 Collection、transcript、summary、chat 读写都必须验证当前用户所有权。
- 不在客户端信任 `collectionId`、`transcriptId` 或 `sessionId` 的组合关系。
- 不在日志、analytics 或错误响应中暴露 transcript 或 chat 内容。
- Collection/Transcript/Account 删除行为必须覆盖后续 AI 数据。
- 任何影响隐私政策、套餐、远程 migration 或生产部署的动作都在执行前单独确认。

### 10.2 i18n

- 用户可见文案进入 `messages/*.json`。
- routes、IDs、limits、sort keys、feature flags、schema 和稳定结构保留在 TypeScript。
- 每个里程碑运行 `npm run check-locales`。

### 10.3 Analytics

- 只采集完成产品判断所需的最小事件。
- 不发送 Collection name、transcript title、问题、回答或引用文本。
- AI 事件至少区分 generate/start/success/fail/rate-limit，并记录不含内容的 model、latency、token bucket 和 error code。

### 10.4 验证

每个可发布里程碑至少执行：

1. `npm run check-locales`
2. `npm run build`
3. 本地 D1 migration（存在 migration 时）
4. 受影响流程的手动验证
5. 检查 diff，确认没有无关重构或格式化噪音

远程 D1 migration、部署、提交和 push 不包含在普通实施步骤中，必须由用户单独要求或确认。

## 11. OpenAI 实施参考

- Structured Outputs 适合让 AI Notes 与 Ask AI 返回可验证 schema，而不是解析任意 Markdown：  
  https://developers.openai.com/api/docs/guides/structured-outputs
- Responses API 支持由应用手动管理多轮消息，也支持 API conversation state；本计划优先采用应用自管状态，以保持 Scribix 删除与隐私语义：  
  https://developers.openai.com/api/docs/guides/conversation-state
- 重复使用长 transcript 时可以评估 prompt caching，但必须先测量实际 cache read/write、延迟与成本，不能假设缓存一定节省费用：  
  https://developers.openai.com/api/docs/guides/prompt-caching

这些文档是实施时的当前参考；开始 AI 里程碑前需要重新核对最新 API shape、模型支持和数据保留说明。

## 12. 逐步执行顺序

严格按以下顺序推进：

1. [ ] M1.1 数据与领域层
2. [ ] M1.2 Collection CRUD API
3. [ ] M1.3 Dashboard 与 Collection 页面
4. [ ] M1.4 新建 Transcript 时选择 Collection
5. [ ] M1.5 i18n、analytics 与第一阶段验证
6. [ ] M2A.1 搜索、排序和筛选
7. [ ] M2A.2 批量管理
8. [ ] M2A.3 Collection 统计与快速入口
9. [ ] DG-AI-1 套餐、成本、保留与模型决策
10. [ ] M2B.1 AI Notes v2
11. [ ] M2B.2 Transcript 双栏工作区
12. [ ] M2B.3 Ask AI 后端
13. [ ] M2B.4 Ask AI 前端
14. [ ] M2B.5 隐私、analytics 与质量验证
15. [ ] 第一、二阶段完整回归与发布决策
16. [ ] 第三阶段重新评审；未明确开始前保持 deferred

## 13. 协作方式

每次只推进一个编号里程碑：

1. 开始前读取相关现有代码并确认该里程碑边界。
2. 只修改该里程碑需要的文件。
3. 完成最强可行验证。
4. 更新本计划中的 checkbox 和必要状态说明。
5. 汇报改动、验证结果、残余风险和下一里程碑。
6. 等用户确认后再进入下一步。

