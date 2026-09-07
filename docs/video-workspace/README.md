# 视频工作台文档

本目录保存当前实现合同、验证方法和外部发布检查。M1–M9 文件名保留以稳定引用，它们已包含后续实现更新；编号不表示仍要重新实施一遍。文档中的本地测试或隔离 POC 结果不代表生产验证。

## 按工作内容查阅

| 主题 | 文档 |
| --- | --- |
| 数据生命周期与保留 | [M1](m1-data-lifecycle.md) |
| AI 选片与完整性复审 | [M2](m2-ai-candidates.md) |
| 预览任务与代理素材 | [M3](m3-preview-proxy.md) |
| 编辑、草稿与付费边界 | [M4](m4-timeline-editor.md) |
| 字幕、品牌与浏览器预览 | [M5](m5-browser-preview.md) |
| 最终渲染、下载与替换 | [M6](m6-final-render.md) |
| 预览与渲染一致性 | [M7](m7-preview-render-consistency.md) |
| 安全、容量与运维 | [M8](m8-operations.md) |
| 试点、基准与放量验证 | [M9](m9-pilot-rollout.md) |
| 自动构图与说话人跟随 | [实现与限制](speaker-follow-plan.md) |
| 产品事件 | [tracking](tracking.md) |
| 生产配置和发布待办 | [外部清单](external-setup-checklist.md) |
| 隔离 POC 与历史测量 | [POC 证据](cloudflare-containers-poc.md) |
| 本地命令与样本 | [脚本 README](../../scripts/video-workspace/README.md) |

## 合同来源与历史边界

- 数量、时长和输出规格以 [contracts.ts](../../lib/video-workspace/contracts.ts) 及运行时校验为准；套餐事实以 [plans.ts](../../lib/plans.ts) 为准。初始 M0 的 20 段 / 180 秒上限已不是当前合同。
- 时间字段保留 original source 时间；最终成片读取原视频，不从 preview proxy 转码。编辑和渲染分别遵守上述 M4、M6、M7 合同。
- 旧总计划中的桌面/移动端验收、真实素材矩阵、用户试点、隐私与成本确认仍需实际验证；使用外部清单与 M9 维护结果。发布文案、分发等新增能力见研究路线图，提案不自动改变现行实现范围。
- [总实施计划](../archive/plans/plan-ai-short-video-workspace.md)及 [M0](../archive/plans/m0-foundation.md)仅保留历史。旧原型的音频处理、供应商迁移状态、保留策略和费用估算不能代替现行合同。
