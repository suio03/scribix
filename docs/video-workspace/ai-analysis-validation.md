# AI Clips 第一阶段本地验证

后续真实素材测试：[2026-09-17 九分四十七秒播客评审](ai-analysis-podcast-review.md)。已跑通真实后台选片、预览和编辑保存；发现复审漏检前文依赖及潜在漏选观点，尚未通过整体内容质量验收。用户要求停止导出检查，三小时真实验收仍未完成。

日期：2026-09-17。实现依据：[三小时分析与动态批量选片](../roadmap/ai-clips-generation-workflow.md)。本地实现已接通，服务端 `AI_CLIPS_BATCH_ENABLED` 默认 `false`，未执行生产迁移、部署或付费模型压力测试。

## 工程证据

| 验证 | 结果 |
| --- | --- |
| `npm run test:ai-analysis` | 12/12；真实 workerd、隔离的本地 D1/R2，模型网络用本地 mock 替代 |
| `npm run test:ai-candidates` | 11/11 |
| `npm run test:video-workspace` | 56/56，包含 90 秒编辑／AI 边界和句子校验 |
| `npm run test:render-scheduling` | 11/11，包含主动任务优先、不抢占和用户公平性 |
| `npm run test:aai-completion` | 13/13 |
| `npm run test:video-tracking` | 5/5 |
| `npm run test:render-scope` | 2/2 |
| `npm run test:publish-workflow` | Node 24.17.0 下原有 35/35；另增批量 API 用例 1/1，验证 202、同请求标识、关闭开关后恢复及超长范围。Node 22 整组曾停滞；发现并修正一个旧 60 秒边界断言 |
| `npm run test:video-preview` | 实际 H.264/AAC 六秒预览通过 |
| `test-final-render.mjs`，`TEST_FINAL_CAPTIONS=1` | 本地媒体镜像中四秒成片、字幕和 105 帧构图切换回归通过 |
| `test-publish-render.mjs` | 本地媒体镜像中标题、独立封面、复用视频和现有单片下载包通过 |
| `npm run check-locales` | 六种语言结构、ICU 参数一致 |
| `npm run build` | 生产构建通过 |
| `wrangler deploy -c wrangler.ai-clips.jsonc --dry-run` | 独立 worker 打包及绑定检查通过；没有部署 |
| `npm run db:migrate:local` | 0042 已应用到本地 D1；没有执行远程迁移 |

后台用例验证：180 分钟边界、越界／密集输入预拒绝、重复提交、实际 Queue 回调、过期租约与全站 4／每用户 2 的原子并发上限、等待转写后启动、临时失败保留成功批次、原输入重试、R2 成功结果复用、60 次实际发现尝试上限、失败／受限范围、原始批次先于一次二分补查、能力拒绝恢复零匹配调整机会、租约隔离提交、已有保存结果不被重复提交覆盖、手动片段保留、超过五条候选仍只预热五条、Cron 清理到期项目的任务对象。

模型 mock 的措辞和筛选结果只用于软件状态测试，不是 AI 内容质量证据，也不是供应商费用证据。任务尝试表保留实际尝试、状态、响应标识与可取得的 usage；R2 保存原始返回及最终报告。用量同时投影到既有 `ai_usage_events`，投影失败时尝试记录仍可用于核对。超时及未知状态不代表没有收费。

## 浏览器

使用 Chrome 的 `ai-publisher` profile 和 `npm run dev` 的独立 3001 端口，临时测试页渲染实际 `VideoCandidateWorkspace`，只替换本地 API 返回，不调用模型。验证了：

- 0–10800 秒范围及 Auto 15–90 秒说明，明确不降低转写费用。
- 结束时间 10801 秒时拒绝提交并显示范围错误。
- 改回 10800 后进入后台阶段，显示 3/22 实际发现批次、选定范围及可离开页面提示，没有百分比或 ETA。

另以真实生成的 100 秒代理视频加载现有 VideoClipEditor：播放推进正常、时间轴显示 1:30；将结束点从 1:35 改到 1:30（85 秒）并自动保存，再恢复 90 秒并保存；修改构图、字幕位置和封面选帧后显示 All changes saved，累计四次通过 EDL 校验的保存。画面和字幕已截图检查。

临时页面及公开目录中的测试媒体已删除，独立 dev server 已停止。编辑器保存接口使用本地 fixture 并调用实际 EDL 校验；D1 保存和 Queue／媒体输出在对应集成测试中分别验证，这不等于认证真实项目从上传到下载的整链路内容验收。

## 九十秒媒体基线

命令对应 `npm run test:video-90s`。宿主机 FFmpeg 不含 libass，因此使用已存在的本地 `scribix-tiktok-release:20260917` 镜像，挂载当前仓库代码为只读，`--network none --cpus 1 --memory 3g`。AMD64 镜像在 ARM64 主机上运行，有架构模拟开销；这些数字不能外推到生产实例。

[原始测量](analysis-media-baseline.json)：

| 项目 | 实测 |
| --- | --- |
| 工程源视频 | 新生成的 100 秒测试图案及音频；非重复拼接真实节目 |
| 预览 | 100 秒，包含 90 秒选段前后各 5 秒 handles |
| 预览渲染耗时 | 58.60 秒 |
| 最终范围 | 原视频 5–95 秒，连续 90 秒 |
| 成片 | 1080×1920，H.264/AAC，90,000 ms，25,052,721 字节 |
| 成片与封面生成耗时 | 152.15 秒 |
| 封面 | 独立 JPG，68,964 字节，选中第 89 秒时间轴画面 |
| 图像检查 | 第 88 秒仍有字幕；中段 fill → fit；封面保留独立标题且无烧录字幕 |

本地可复查产物在 `/tmp/scribix-90s-proof/`，包括 `final-9x16.mp4`、`preview.mp4`、`cover.jpg`、`frame-88s.png`、`report.json`。这是工程媒体验证，不代表真实节目剪辑质量或人物跟随准确率。

## 规划基线与内容缺口

[离线规划数据](analysis-planning-baseline.json)由 `npm run benchmark:ai-analysis` 生成，没有付费调用。短素材、30 分钟、60 分钟和 180 分钟各有稀疏／密集合成文字稿；原始批次数分别为 1/1、4/5、7/11、22/32，最长批次没有超过 20,000 字符。极端密集数据另由集成测试验证在调用模型前拒绝。

工具也可读取合法已有转写，不会自动调用模型：

```sh
npm run benchmark:ai-analysis -- --transcript /path/transcript.json --duration-ms 10800000 --output /tmp/analysis-plan.json
```

2026-09-17 用户确认暂无可用于此评审的半小时、一小时、三小时真实素材。真实内容的发现／拒绝／去重／最终数量、人工保留条数、主题覆盖、候选就绪、首条预览、人物分析耗时及实际供应商费用仍未取得；基准中的这些字段保留为 null。没有用重复拼接素材替代。

三小时真实端到端验证未完成，不能标记三小时能力已验收。开启生产开关前仍需按方案做真实内容评审，并确认队列 worker 密钥、媒体镜像及远程迁移顺序。

## 2026-09-17 生成与审阅流程更新

生成前长度、字幕、标题、构图设置以及列表／网格审阅已本地接通，具体行为与验证见 [竞品流程落地](clip-workflow.md)。已有 clips 不重分析即可使用新浏览界面；此项不代表三小时内容质量已验收。
