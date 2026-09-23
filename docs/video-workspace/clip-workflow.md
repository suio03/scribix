# AI Clips 生成设置与结果审阅

2026-09-17 完成本地实现；2026-09-18 的批量分析发布记录见[验证记录](ai-analysis-validation.md)。本页保留生成设置与结果审阅的交互合同及当时本地验证，不以早期“尚未部署”描述当前状态。依据用户提供的 Opus 网格／原文视图、Quso 左列表右预览，以及生成前设置流程。

## 用户流程

1. 原视频与转写就绪后，选择分析范围、自动或指定主题／内容类型。
2. 生成前选择 Auto 15–90 秒或 15–30、30–60、60–90 秒；选择字幕样式（Karaoke、Editorial box、Quiet minimal、关闭）、开场标题、自动跟随／保留完整画面。当前输出固定 9:16，不展示未实现比例。
3. 字幕样式提供示例和源视频预览。可把长度及样式保存为当前设备的默认值；不保存上一项目主题和时间范围。文案明确范围缩短不减少现有转写费用，沿用套餐额度。
4. 后台发现与复审，显示真实批次进度。完成后默认左侧紧凑列表、右侧大预览，可切换网格。
5. 候选显示标题、源时间和长度，可收藏或标记不感兴趣；按状态筛选，按推荐／源顺序／长度排序。原文与源范围供核对，推荐理由可展开。
6. 浏览读取实际字幕、标题和构图；编辑需要主动点击，返回后保留当前片段和筛选。浏览不保存草稿。导出沿用原额度与权限。

网格只为可见卡片获取实际预览帧，绘制字幕／标题／构图并释放视频。当前片段使用完整播放器；审阅页不显示编辑辅助虚线。不新增未经验证的爆款分数。

## 数据与兼容

- `selection_json.generation` 保存类型化设置，随后台任务输入冻结；技术重试不能改设置。旧请求未带设置时使用原默认值。
- 模型收到长度条件，复审后服务端再次校验；超出档位的结果记录为拒绝，不能仅在界面隐藏。
- 新 AI 候选的初始 RenderSpec 应用生成设置；已保存草稿优先，手动片段保持自身编辑。已有 clips 直接获得新的浏览与筛选，不自动重新选片或改变原有样式。
- 迁移 `0043_clip_review_mark.sql` 增加独立 keep/discard 标记，允许多条收藏，与当前编辑选择分离。仅操作所属项目。
- `GET editor?view=review` 允许所属用户只读预览；PUT/POST 继续执行编辑套餐权限。明确导出时才按既有机制准备草稿／快照。
- 当时本地验证使用关闭的后台开关；后续迁移、Worker 与应用发布结果见[验证记录](ai-analysis-validation.md)。

## 本地验证

- 生产 Next.js 与 OpenNext Cloudflare 构建通过；六种 locale 检查通过。
- workspace 56 项、选片 12 项、后台分析 12 项、发布工作流 38 项通过；最后增补的只读权限及设置／收藏／修正文字回归 4 项通过。发布工作流完整套件使用 Node 24（Node 22 在已有并发用例挂起）。
- ai-publisher Chrome + 本地 workerd：真实播客项目四条旧候选展示、网格静态成片预览、收藏与筛选、进入编辑后返回、浅深色和手机宽度检查完成。
- 历史 The Good Woman Trap 六条候选（含手动片段）可正常浏览；未重新分析。
- 生成设置用复用既有源素材及转写的临时本地项目检查：长度、构图、字幕、标题和设备默认值刷新保留。未点击生成，不新增付费转写／模型调用；临时记录检查后删除。
- 测试收藏已恢复，设备默认值恢复 Auto、Karaoke、自动构图、不开启标题。
- 遵照用户要求，本轮不做导出验收。新的长度与样式经代码回归及浏览器设置验证，未再付费生成一批新片段。真实三小时素材端到端验收仍缺失。
- 最后复查修正了审阅播放器沿用编辑器封面时间的问题：审阅从片段开头播放，编辑器仍保留封面定位。浏览器确认实际播放进度推进。局部取帧／换页时本地 OpenNext 曾记录流中断与请求取消日志，随后素材 206、编辑数据 200 和播放均成功；未据此宣称远程媒体压力测试通过。

## 2026-09-17 审阅布局修正

根据用户实际截图修正：列表左栏固定紧凑宽度并独立滚动，右侧播放器根据剩余高度伸缩；原文默认折叠。操作栏参与正常布局，不再悬浮覆盖时间轴。网格只显示卡片，点击打开原生 modal dialog；支持前后片段、关闭与 Escape，锁定背景滚动并恢复触发卡片焦点。编辑仍进入单独工作区，返回网格编辑会回到预览弹层。

黑边检查：播客第三条草稿的 `mediapipe-talknet-v5` 自动构图点使用约 0.4–0.6 倍 zoom。黑边是现有构图内容，不是审阅容器比例错误。本次不改写已保存构图，也不对预览做与导出不一致的强制铺满；自动构图质量需要另行修正并评审真实画面。

### Manual selection polish (2026-09-18)

Existing projects still open Clips first; manual selection is the secondary tab. The source workspace now uses compact controls, a shared start/end range track, exact time inputs and selected-duration feedback. Transcript paragraphs scroll continuously with browser content visibility; phrase search supports match counts and previous/next navigation. Selection and current playback word have distinct highlights. A help disclosure explains drag and Shift selection. Changing the range stops selection playback; successful manual creation opens the editor directly.

Local verification: workspace contracts 56/56, six-locale validation, production Next.js and OpenNext builds. On the existing 9m47s podcast, browser checks covered phrase search, match navigation, keyboard Shift selection, invalid >90s ranges, playback stopping at 1s, and creating a 16s manual clip that opened the editor. The temporary clip was deleted through the UI; the four original AI clips were retained. No export was requested in this pass.

## 提交前复核（2026-09-18）

当时全量本地改动包含 Home／Projects、Planner、后台分析、生成设置、审阅和手动选片。最终复核：workspace 56、AI candidates 12、AI analysis 12（实际本地 workerd，供应商 mock）、render scheduling 11、AAI completion 13、publish workflow 39 项通过；发布工作流使用 Node 24。六语言检查及 Next.js／OpenNext 生产构建通过。当时尚未部署；后续发布记录见[验证记录](ai-analysis-validation.md)，Planner 真实定时发布和三小时真实内容验收仍缺失。
