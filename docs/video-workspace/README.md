# 视频技术导航

先读对应主题，不再按 M1–M9 开发阶段查找。功能现状与下一步见[产品 plan](../roadmap/video-product-plan.md)；本地测试和隔离 POC 不代表生产验收。

| 工作主题 | 当前文档 |
| --- | --- |
| 项目、素材保留、删除、AI 选片与完整性 | [数据与选片](data-and-selection.md) |
| 草稿、编辑权限、字幕、品牌、手动与自动构图 | [编辑与构图](editing-and-framing.md) |
| 预览代理、最终渲染、下载、画面一致性 | [预览与渲染](rendering.md) |
| 迁移、外部配置、调度、安全、成本与真实验收 | [部署与运维](operations.md) |
| 按需求选片状态、标题、封面、文案和发布包 | [发布准备](publish-preparation.md) |
| 社交账号、平台适配、发布与验收证据 | [社交发布](social-publishing.md) |
| 分析平台事件及属性边界 | [追踪合同](tracking.md) |

数量、时长和输出规格以 [contracts.ts](../../lib/video-workspace/contracts.ts) 及运行时校验为准；套餐事实以 [plans.ts](../../lib/plans.ts) 为准。时间字段使用 original source 时间，最终成片读取原视频。

本地运行命令与素材见[脚本 README](../../scripts/video-workspace/README.md)。历史计划与 POC 从[总导航的历史资料](../README.md)查阅，不继续维护旧阶段待办。
