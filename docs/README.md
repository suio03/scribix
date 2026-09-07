# Scribix 文档导航

现行合同和操作说明保留在对应主题目录；历史方案放在 `archive/`，尚未实施的提案放在 `roadmap/`，调研结论放在 `research/`。归档中的额度、价格、部署状态和未勾选项不是当前事实。生产状态必须用实际部署及验证记录确认。

## 现行规范与操作

| 内容 | 入口 |
| --- | --- |
| 项目开发约定 | [AGENTS.md](../AGENTS.md)、[CLAUDE.md](../CLAUDE.md) |
| 设计系统与标准值 | [设计规范](../design-exploration/design-system.md)、[tokens](../design-exploration/tokens.json) |
| 当前 Logo 母版 | [使用规范](../logo-exploration-round-6/production/USAGE.md) |
| 配置与外部依赖 | [manual-setup](manual-setup.md) |
| 发布、监控及删除 | [发布检查](runbooks/launch-checklist.md)、[发布后监控](runbooks/post-release-monitoring.md)、[AAI 删除](runbooks/aai-bulk-delete.md) |
| 视频实现与发布检查 | [视频工作台导航](video-workspace/README.md) |
| Transcript Ask AI | [现行说明与待验证项](transcript-ask-ai.md) |
| 首页素材与授权 | [homepage-media](homepage-media.md) |
| 扩展开发与发布 | [源码 README](../chrome-extension-youtube-transcript/README.md)、[发布说明](browser-extension-publishing.md)、[Firefox 打包 README](firefox-extension-source-readme.md) |

`firefox-extension-source-readme.md` 是构建脚本输入；第三方源码中的 README 与 LICENSE 仍与源码一起保留。根目录 [CHANGELOG](../CHANGELOG.md) 保留发布历史。

## 未来规划与研究

- [Collections 与 Transcript AI v2 提案](roadmap/collections-transcript-ai.md)：未实施，不应当作现行合同。
- [长视频剪辑功能优先级](research/2026-09-08-clipping-product-roadmap.md)及[竞品功能证据](research/2026-09-08-clipping-competitor-product-research.md)：产品建议，包含竞品功能、Scribix 改进项与延伸设想，不是全部逐项验证的竞品功能。
- [博客、SEO 与非广告获客](research/2026-09-07-blog-seo-acquisition-summary.md)及[关键词原始数据](research/2026-09-07-video-seo-keywords.json)。
- [Google Ads 调研](research/2026-09-07-google-ads-launch-research.md)：建议与研究记录，不代表已开始投放。

## 历史归档

| 历史内容 | 保存位置 | 当前应读 |
| --- | --- | --- |
| 早期转录产品 v1 计划 | [progress](archive/plans/progress.md) | 配置、运维与代码 |
| 视频工作台总实施计划 | [原计划](archive/plans/plan-ai-short-video-workspace.md) | 视频工作台主题文档 |
| M0 初始合同与原型记录 | [原记录](archive/plans/m0-foundation.md) | 当前代码合同及视频导航 |
| Ask AI v1 实施过程 | [原计划](archive/plans/plan-transcript-ask-ai.md) | Ask AI 现行说明 |
| 四个设计方向 | [directions](archive/design/directions.md) | 已批准的设计系统 |
| 视觉参考研究 | [research](archive/design/research.md) | 已批准的设计系统 |
| Prism Pulse 原型评审 | [refinement](archive/design/prism-pulse-refinement.md) | 已批准的设计系统 |

设计 HTML 原型保留原位置，相关文档链接已指向归档。今后只更新现行合同；归档用于查决策背景，不继续累积开发待办。
