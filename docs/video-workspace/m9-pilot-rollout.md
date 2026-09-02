# M9 内测与渐进发布

M9 已完成生产试点所需的本地支撑。真实用户开放、生产性能阈值验证、隐私/套餐确认和基于真实数据的参数调整属于外部阶段，仓库不会把合成数据冒充用户结果。

## 24 条技术基准

`render-benchmark-v1` 包含 24 条实际 FFmpeg 成片任务，覆盖：

- landscape、portrait、square 三种源画幅。
- 有声与无声六种 source profiles。
- 单 segment 与两个不连续 segments。
- karaoke、boxed、minimal 三种字幕。
- crop x/y 边界、1×–2.4× zoom、四个 Logo 位置。
- corner/signature 品牌、响度标准化、淡入淡出、封面和静音补轨。

执行方式：

```bash
docker build -t scribix-video-render:local containers/video-preview
npm run benchmark:video-render
```

本次本地结果：24/24 通过，6 个源 profile，累计渲染 10,432ms，单 case p50 423ms、p95 501ms、最大 523ms。合成视频只有 1.2 秒，用于回归正确性，不代表 Cloudflare Containers 的生产延迟或真实内容质量。隔离 POC 的真实 15/30/45 秒结果见 `cloudflare-containers-poc.md`。

## 渐进开放

所有环境默认 `VIDEO_WORKSPACE_ROLLOUT_PERCENT=100`，未配置时也按 100% 开放，不区分本地与生产。`VIDEO_WORKSPACE_PILOT_USER_IDS` 和百分比开关仍然保留，可在故障止损或以后需要小范围放量时使用；非法百分比值会 fail closed。

建议阶段：

1. 在本地和预发布环境以 100% 完成内部 smoke test。
2. 只有在外部依赖、隐私、套餐和成本规则全部准备好后才部署到生产。
3. 生产部署后保持 100%，持续观察真实 render 成功率、延迟、下载率和成本。
4. 出现重大错误时把百分比设为 0 并清空 allowlist。开关只阻止新建项目，已有项目仍可完成、下载和删除，避免用户数据被困住。

## 指标与隐私

`video_workspace_events` 只保存固定事件名、opaque IDs 和受控数字/枚举属性，不保存 transcript、字幕、标题、文件名、URL、R2 key 或任意自由文本。账户/项目删除会先删除这些事件。

自动记录：render requested/completed/failed。浏览器记录 editor opened、每个 revision 的 edit elapsed time，以及每个成片/封面的首次下载。完成结果旁的“仍需外部编辑”按钮记录否定反馈；未点击不被解释为强肯定，只用于估算上限。

管理员可读取：

```text
GET /api/admin/video-workspace-metrics?days=30
```

输出 candidate 接受/拒绝、编辑时长 p50/p95、final 请求/成功/失败/重试、总延迟 p50/p95、唯一下载、外部编辑需求和各比率，不返回用户级明细。

## 建议放量阈值

- 至少 30 个 terminal final jobs 后，首次/总体 render 成功率 ≥ 95%。
- ≤60 秒输出的 p95 total latency ≤ 10 分钟，p95 start latency ≤ 5 分钟。
- 成功 render 的唯一下载率 ≥ 70%。
- 已下载结果中“仍需外部编辑”的上限比例 ≤ 30%，并通过访谈确认未点击用户确实可直接发布。
- candidate 接受率和编辑时长只用于趋势：初始目标接受率 ≥ 40%、编辑 p50 ≤ 5 分钟，不以合成数据决定产品结论。
- DLQ 必须为空，HIGH/CRITICAL 镜像扫描必须通过，成本字段覆盖 100% 成功任务。

## 真实试点检查单

- 选择具有使用授权的 talking-head、访谈和 podcast 长视频；覆盖口音、多人、横竖屏、安静/嘈杂音频和 30 分钟至数小时源文件。
- 获得参与者明确同意，并说明源视频保留期、第三方转录与 Cloudflare Containers 处理边界。
- 每位用户完成候选选择、编辑、至少一次成片、下载，并回答是否仍需 CapCut/Premiere 以及原因。
- 每日查看管理员指标、dispatcher metrics、DLQ、cleanup、Container 容量/镜像告警和成本。
- 只有在隐私文案、套餐配额、保留策略和区域价格获得负责人确认后才提高百分比。
