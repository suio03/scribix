# Transcript Ask AI：现行实现与验证

2026-09-08 对照本地代码整理。本文描述实现合同，不确认生产部署健康；v1 旧计划已移除，未完成验证项集中在下文，历史实施记录可查 Git 历史。

## 产品与 API

每份已完成且仍有 R2 transcript 的记录提供一串持久化对话。读取和修改都检查登录、所有权及 transcript 状态。

- `GET /api/transcripts/[id]/chat`：返回最近的消息、较早消息标志及额度。
- `POST`：接受 `question`，原子预扣额度，调用模型，成功后在同一 D1 batch 保存 user / assistant 消息。
- `DELETE`：清空当前对话，不返还额度。
- 消息按自增 `id` 排序，不依赖只有秒级精度的 `created_at`。
- 当前不提供可点击 citations、多 Chat session、流式回答或 Collection 检索。模型回答中的时间戳只是普通文本。

API、校验和错误处理以 [chat route](../app/api/transcripts/[id]/chat/route.ts) 为准；消息页大小、问题长度与套餐额度以 [plans.ts](../lib/plans.ts) 为准。

## 额度、删除与成本

- Free / grandfathered Basic 使用终身体验额度，Creator（后端 `pro`）使用 allowance period 额度；体验计数不会随周期重置。
- 条件 UPDATE 防止超过 cap；调用或保存失败时尝试回退。周期额度回退带 `period_started_at` 守卫，避免跨周期修改新额度。
- 清空对话或删除 transcript 不返还已使用额度。删除 transcript 和账号时清除相关聊天内容。
- `ai_usage_events` 保存模型、token 和预估费用，不保存问题、回答或原文；删除 transcript / 账号时解除相关 ID，保留匿名成本记录。成本记账失败不应使已生成的回答失败。
- 当前没有 request reservation 表或请求幂等状态机；不能把前端禁用发送按钮描述成完整服务端并发控制。

相关实现：[额度周期](../lib/quota-period.ts)、[用量记录](../lib/ai-usage.ts)、[删除 transcript](../app/api/transcripts/[id]/route.ts)、[删除账号](../app/api/account/route.ts)。

## 模型输入与用户体验

[openai-chat.ts](../lib/openai-chat.ts) 是模型配置和输入预算的来源。只使用当前 transcript 作为事实依据，将其中指令视为不可信内容；缺乏依据时明确说明。

Transcript 在前，有限的历史消息和当前问题在后；使用稳定的隐私保护缓存键，缓存命中不是成本保证。Transcript 和历史分别估算预算并截断，响应返回截断标志，UI 应显示对应提示。

Transcript 工作区提供 Ask AI / AI Notes 切换、额度、发送状态、清空与错误反馈；Export 位于独立弹层。未来 citations 需统一服务端和播放器的 segment 派生，并按时间定位，不能直接把 R2 数组索引视作 UI 分段索引。

## 仍需实际验证

以下从旧计划保留；本次整理未执行这些生产测试，也不将旧勾选项升级为当前证据。

- [ ] 确认生产部署健康及相关 migration 状态。
- [ ] 登录态验证 Free / Basic 终身额度、Creator 周期额度、成功扣减和失败回退。
- [ ] 覆盖音频、视频、YouTube 来源。
- [ ] 清空对话、删除 transcript、删除账号后核查聊天清理。
- [ ] 验证原文事实问题、无依据问题、原文内嵌指令、长 transcript 截断和超出历史窗口的追问。
- [ ] 检查匿名产品事件不包含用户内容，观察实际成本与缓存命中，不沿用旧计划的价格估算。

改代码时按仓库验证约定执行相关检查；历史版本号、推送记录与价格核对日期可查 Git 历史。
