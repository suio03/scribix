# 按需求选片与发布准备

2026-09-15 的本地真实项目已走通上传至成片生成；实际下载及无指导新手任务仍待验收。此处保留单片发布准备的实现和当时验证，不用早期“未确认生产部署”判断当前环境。产品状态见[产品 plan](../roadmap/video-product-plan.md)，历史首期范围见[归档方案](../archive/plans/publish-preparation-design.md)，远程依赖与发布记录见[部署与运维](operations.md)。

## 选片

2026-09-17 新增后台批量链路，2026-09-18 的发布与开关记录见 [第一阶段方案](../roadmap/ai-clips-generation-workflow.md)和[验证记录](ai-analysis-validation.md)。批量链路 POST 返回 202，等待转写、发现、复审和恢复均由后台负责；支持明确的最多 180 分钟分析范围。下文请求内执行及十分钟失效规则仅适用于关闭开关后的历史链路。

长视频进入工作台不再自动分析。默认“帮我挑选”，选择特定内容才展开主题和类型；主题最多 300 个 Unicode 字符。类型与限制定义在 `lib/video-workspace/selection.ts`。免费和付费用户均可首次分析；付费短视频直接编辑路径保持不变。

`POST /api/video-projects/:id/candidates` 接受 `requirements: { mode: "auto" | "specific", topic, kind }`、`requestId` 和可选 `adjust: true`，旧请求默认自动推荐。原有顶层 `mode: "manual"` 保留。GET 返回实际使用的 `selection`、转写就绪状态和结果。业务状态为 idle、waiting、running、matched、empty、failed：

- 转写未完成时持久化明确提交的需求，浏览器在就绪后继续；刷新只恢复已提交的任务。
- D1 原子领取并以执行标识限制结果提交；并发和过期任务不能覆盖新结果。
- 正常零匹配允许一次主动调整，修改需求与切回自动推荐共用该机会。旧零结果项目同样最多一次。
- 技术失败重试存储的原条件；不消耗调整机会。运行超过现有 10 分钟期限可重试。成功产生过 AI 片段后不再允许换方向。
- 非空特定主题先做能力检查；视觉搜索、外部检索、加音乐等要求在正文分析前拒绝，并恢复调整机会。主题作为数据，不能覆盖系统规则。
- 每个分析批次及完整性复审接收同一条件，同时要求原文支持、主题和类型匹配、独立完整及 15–90 秒。允许不足数量或零结果，不回退到无条件推荐。理由保留在候选数据和卡片的辅助说明中，紧凑卡片不展开长篇理由；评分不展示。

## 发布草稿

单片 editor GET/PUT 增加 `publishDraft`，与现有 `expectedRevision` 一起保存；旧请求缺省保留现有文案。开头标题和封面文字分别保存在可选 `RenderSpec.openingTitle`、`coverTitle`。旧草稿缺省关闭，候选 V1 合同不变。

`POST /api/video-projects/:id/publish` 接受 `candidateId`、`expectedRevision` 和 `mode: "all" | "titles" | "copy"`。仅付费编辑权限可用；项目、候选、媒体归属及有效期在服务端检查。输入仅为最终保留片段的已修正讲话文字。复用现有结构化模型与用量记录，首次生成三个开头标题、一份标题、1–3 句正文和最多五个标签。首个有效开头标题默认显示三秒，封面首次采用该标题，之后独立编辑。

`edited` 标记保护人工文字和叠层；重复打开或重复首次请求复用保存结果。生成期间的本地编辑会在服务器结果返回后合并保存；跨标签页 revision 冲突仍走原有冲突机制。内容关联值只包含保留的源区间及修正讲话文字；内容变化保留文案并提示核对，用户可确认已检查。

每用户同时最多一个生成任务，滚动一分钟最多五次；D1 操作记录保存有界的请求时间列表与 180 秒执行租约。过期执行不能提交结果。技术失败不清空编辑，错误向用户显示普通重试说明。

## 画面与材料依赖

浏览器与 FFmpeg 共用 `containers/video-preview/title-layout.mjs`、字体字宽表和 Noto Sans JP Bold 字体；来源及许可证在 `containers/video-preview/fonts/`。布局按词和 CJK 字符换行，长标题缩小，避开字幕位置；字体、颜色、位置、大小与显示时间可调整。

封面直接从原始素材映射的源帧合成构图、品牌和独立封面文字，不截取烧录字幕后的成片。剪辑后仍保留同一源帧；该帧被移除时改用开头并提示。

- 视频依赖 EDL、字幕、构图、品牌、音频和开头标题，不依赖封面字段或发布文案。
- 封面依赖 EDL、选帧、构图、品牌和封面文字，不依赖字幕、开头标题或音频。旧版无独立封面设置的任务不作为封面复用来源。
- 文案独立保存；修改文案不会重新渲染视频。导出列表分别提示视频、封面和文案是否需要更新。

Container 可复用相同依赖的已完成材料，并独立上传视频与封面。新增受任务作用域认证保护的 `/api/internal/video-jobs/:id/assets` 回调校验对象大小、类型、编码和尺寸。部分成功时保留完成项，失败项可重试。新 lease 带 `supportsPartialAssets: true`；兼容 Container 收到旧应用 lease 时继续使用原有整组完成协议。

## 下载与不可变内容

渲染版本持久化当时的发布文案。下载默认 ZIP 包含 MP4、JPG、UTF-8 `-post.txt`（有文案的付费项目）；旧版无文案 ZIP 和免费 MP4 导出继续可用。`?format=video|cover` 可单独下载已完成且未过期的材料，包括部分失败任务的完成项。

`POST /api/video-projects/:id/renders/:jobId/download` 用 `expectedRevision` 校验当前草稿与渲染材料一致，创建不可变 `publish_packages` 内容，再返回带 `packageId` 的 ZIP URL。导出期间后续编辑不改变该包；自动下载使用任务开始时的版本。文案可分别或整体复制。下载事件只表示发起下载，不代表真实发布。

## 迁移与发布顺序

1. 应用增量 D1 迁移 `0037_publish_preparation.sql`：项目选片状态、单片和版本文案、发布限流操作记录及不可变发布包。没有新增分析追踪表。
2. 部署兼容旧 lease 的 Container，包含字体、共享布局及可选叠层支持。
3. 在完整环境验证旧项目导出和新流程，再部署应用；应用部署启用入口。没有变更绑定、套餐、额度和素材保留期限。

本次仅执行了本地 D1 迁移和本地构建，没有远程迁移、Container 部署或应用部署。

## 验证

- `npm run test:publish-workflow`：实际迁移的 SQLite、路由和保存逻辑，覆盖调整计数、原任务重试、并发及晚返回、权限与有效期、人工编辑、滚动限流、执行租约、不可变包、部分产物恢复。
- `npm run test:ai-candidates`、`test:video-workspace`、`test:video-tracking`、`test:video-export-monitor`、`test:export-archive`、`test:render-scope`、`test:render-scheduling`、`test:video-consistency`、`test:video-security`。
- `npm run test:publish-render` 需要带 libass 的 FFmpeg；也可在本地 Container 镜像执行：挂载仓库到 `/workspace:ro`、临时输出目录到 `/proof`，设置 `PUBLISH_PROOF_DIR=/proof`，执行 `node scripts/video-workspace/test-publish-render.mjs`。使用仓库已许可素材验证实际 MP4、独立 JPG 和文本 ZIP，以及视频复用和部分失败。
- `node scripts/video-workspace/test-selection-live.mjs --live` 是显式调用真实模型的可选检查；`--publish-only` 仅检查文案生成，会产生模型用量。
- `npm run check-locales`、`npm run build`、`npm run build:cloudflare`；本地完整环境使用 `npm run dev:video-workspace`。

本地已检查真实模型的支持主题、原文不支持的结论和超能力请求；生成并打开真实视频、图片与文本包。独立组件在英文和日文 390px 窄屏下无横向溢出，检查了键盘进入类型控件、编辑、复制和状态提示。完整账号流程尚未执行：自动审批拒绝浏览器登录动作，需用户授权或自行登录后继续。尚未安排真实新手执行无指导任务，不将组件检查视为该项验收。

最终验证记录：上述 Node 测试共 110 项通过，渲染一致性、安全检查和六语言检查通过；Next.js、OpenNext Worker 与最终本地 Container 镜像构建通过。真实素材检查输出 MP4 468,587 字节、JPG 88,974 字节、ZIP 557,987 字节；确认 3.5 秒画面已移除三秒开头标题，独立封面不含字幕。临时组件验收页面已移除，未进入构建。完整本地环境已启动，等待登录验收。


### 2026-09-10 登录后继续验收

用户已完成本地登录。将普通 Next.js 服务切换为完整 Wrangler/Queue/Container 环境；本地 `.dev.vars` 沿用 `.env.local` 的既有会话签名配置，登录保持有效（未改变生产配置）。旧项目候选和独立草稿恢复正常，新增发布入口可见；过期预览按原流程恢复并实际播放到 24 秒，未手动修改旧草稿。历史视频单项下载接口返回 200。

新建项目上传尚未开始：Chrome 扩展 `fileChooser.setFiles` 返回 Not allowed，需要允许扩展访问文件 URL 或由用户手动选择 `/tmp/scribix-e2e-nasa-introduction.mp4`。测试文件为现有许可 NASA/Ellen Gertsen Introduction 素材的前 95 秒，仅用于独立验收项目。浏览器内部下载页面受工具 URL 策略限制，未读取；不将接口 200 等同于本次文件已落盘验证。完整新项目流程仍待完成。


### 2026-09-15 真实长视频验收（localhost）

用户提供 `The Good Woman Trap.mp4`（760,986,960 bytes，主视频 1920×1080 H.264 / AAC，3561.059 秒），授权用于测试。使用 Chrome `ai-publisher`、现有 Basic 账号及完整本地 D1 / Queue / Container 环境；原文件未修改。测试项目为 `982ebb5f-95ca-46e2-a151-967e0294c215`，转写为 `1c507456-680a-43d6-ab49-ae89e19e92a8`。

- `local.scribix.io` 上传初始化成功，但 R2 OPTIONS 返回 403（`PreflightMissingAllowOriginHeader`）；现有 CORS 只允许 localhost:3000 和正式站。两次失败上传由产品自动中止并清理，没有开始转写。远程 CORS 修改被自动审批拒绝，未执行。
- 按用户要求改用 `http://localhost:3000`，本地 `.env.local` / `.dev.vars` 的 `AUTH_URL` 与 `NEXTAUTH_URL` 同步改为该地址。既有测试隧道已停止，生产配置未改。重新正常登录原账号后，完整分片上传成功，转写完成且无后台错误。
- 默认 Pick for me 的需求在转写期间保存；刷新后恢复等待状态，转写完成后自动执行选片，得到 5 条候选（约 44、44、38、21、40 秒），预览均完成。
- 第一条实际播放检查通过。生成三个片头标题备选、独立封面文字及发布标题／正文／标签；将片头与发布标题改为 `Connection Beyond Devices`，封面保持独立原文；复制标题内容正确，刷新恢复修改。
- 用词边界按钮调整并恢复原始起点，确认提示核对发布文案；核对操作可保存。最终保留原区间 10:04.459–10:48.750。
- 成片任务 `13fd0837-f212-427f-b850-1bbc40ca1e22` 完成，界面视频、封面、文案均 Ready。已发起自动及手动 ZIP 下载，但服务日志出现 `Network connection lost` / `Unable to enqueue`，没有确认文件落盘；用户明确接手下载测试。浏览器内部下载管理页面被工具策略阻止，未读取。不将 HTTP 200、Ready 或本地 fixture ZIP 成功当作这份实际下载验收。
- 质量观察：第一条部分画面回退全景，多人访谈在竖屏中人物偏小；尚未对五条进行完整内容／构图质量评审。无真实平台发布，也未执行完整免费账号、新手或移动端验收。

修正首次预览准备时误报“剪辑超出预览范围”的等待提示，六语言统一改为准备已保存片段的预览；未改变处理规则。发布工作流 29 项、视频工作台 56 项及真实渲染 fixture（MP4 468,323 bytes、JPG 88,973 bytes、ZIP 557,722 bytes）通过；六语言校验通过。修正后的 Next.js 与 OpenNext 构建均通过；文档差异检查通过。
