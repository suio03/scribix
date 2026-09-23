# Scribix 文档

日常从下面六个入口开始；产品状态只在 plan 更新，实现约束在主题文档更新，部署结果以实际记录为准。

| 要做什么 | 入口 |
| --- | --- |
| 看功能现状和接下来做什么 | [产品 plan](roadmap/video-product-plan.md) |
| 修改视频选片、编辑、渲染或发布 | [视频技术导航](video-workspace/README.md) |
| 配置环境和外部服务 | [环境配置](manual-setup.md) |
| 上线与运行维护 | [发布检查](runbooks/launch-checklist.md) · [监控](runbooks/post-release-monitoring.md) · [AAI 删除](runbooks/aai-bulk-delete.md) |
| 开发规范与设计 | [AGENTS](../AGENTS.md) · [Claude 补充](../CLAUDE.md) · [设计系统](../design-exploration/design-system.md) |
| 修改转写 AI 或浏览器扩展 | [Ask AI](transcript-ask-ai.md) · [扩展开发](../chrome-extension-youtube-transcript/README.md) · [扩展发布](browser-extension-publishing.md) |

## 专项资料：需要时查

- [首页素材与授权](homepage-media.md)、[Logo 使用](../logo-exploration-round-6/production/USAGE.md)、[设计 tokens](../design-exploration/tokens.json)。
- [付款通知](payment-notifications.md)。
- [Collections 与 Transcript AI v2 提案](roadmap/collections-transcript-ai.md)：尚未实施，不是现行合同。
- [内容规划（唯一维护入口）](research/2026-09-07-blog-seo-acquisition-summary.md)、[Google Ads 试验方案](research/2026-09-07-google-ads-launch-research.md)：历史关键词估计与投放建议须在执行前重新核查；广告方案不表示已开始投放。
- [教程素材与重制记录](content/how-to-clip-podcasts-for-tiktok.md)：真实截图、导出证据与演示重制方式；上线状态统一见内容规划。
- 内容获客的渠道取舍与后续任务统一见内容规划；竞品当日页面观察不作为当前流量或转化证据。

<details>
<summary>历史资料与构建附件（不作为日常待办）</summary>

- [首期发布准备设计](archive/plans/publish-preparation-design.md)：保留当时的交互决策和验收设计；当前待验收状态以产品 plan 及技术记录为准。
- 历史设计：[方向](archive/design/directions.md)、[研究](archive/design/research.md)，作为设计探索页面的配套说明；现行规则见[设计系统](../design-exploration/design-system.md)。
- [隔离 Container POC](archive/research/cloudflare-containers-poc.md)：保留原始测量，旧待办不是当前开发清单。
- [CHANGELOG](../CHANGELOG.md) 保留版本记录；[Firefox reviewer README](firefox-extension-source-readme.md) 是构建脚本输入。
- 源码旁 README、字体说明、第三方 LICENSE 保留原位置，避免影响构建、授权和维护。

</details>

## 维护规则

现行视频说明按主题合并，旧 M1–M9 文件已移除，仓库引用已更新；不要恢复按开发阶段分散记录的结构。新增功能优先补充现有主题，避免另开计划、进度和状态表。只保留仍被使用的设计依据、独有测量和未完成验收证据；已被现行文档承接的旧计划与评审直接删除，需要追溯时查 Git 历史。历史资料中的额度、价格、待办和部署记录不作为当前事实。
