# AI 短视频工作台 M0 基础合同

> 状态：进行中  
> 分支：`feat/ai-short-video-workspace`  
> 范围：共享数据合同、输入/输出基线、最小 FFmpeg 可行性验证

## 已锁定的技术合同

- EDL、Render Spec、Candidate、Media Asset、Render Job 和 dispatcher message
  使用 `schemaVersion: 1`。
- API 和数据库边界统一使用整数毫秒；FFmpeg adapter 才转换为秒。
- EDL segment ID 和 order 必须唯一，order 从 0 连续；source ranges 不得越界或重叠。
- 当前安全上限为 20 个 segments、单段和最终 timeline 最长 180 秒、source
  最长 12 小时。套餐可以在 API 层施加更低上限，不能绕过这些 renderer 上限。
- Render Spec 只接受固定 output/caption preset、稳定 asset ID、十六进制颜色和有界
  数值。未知字段会失败；合同中没有 shell command、FFmpeg filter 或服务器文件路径。
- Queue/Provider dispatch payload 只包含 `schemaVersion` 和 `jobId`。
- 最终输出 preset 为 1080 × 1920、30 fps、H.264、`yuv420p`、AAC stereo、MP4
  `faststart`；proxy preset 为 720p 级别 H.264/AAC MP4，默认 handles 为 5 秒。

实现位于 `lib/video-workspace/`。运行时校验没有引入新的第三方依赖。

## V1 source 输入基线

短视频工作流和现有 transcript-only 上传是两个兼容性层级。现有转录上传仍可接受更广的
媒体扩展名；进入短视频 preview/render pipeline 前，必须通过 `ffprobe` 和以下策略：

| 项目 | M0 支持基线 |
|---|---|
| Container | MP4、MOV、WebM、Matroska/MKV |
| Video codec | H.264、HEVC、VP8、VP9 |
| Audio codec | AAC、MP3、Opus、Vorbis、ALAC、常见 PCM |
| 必需 streams | 至少一个可解码 video 和一个可解码 audio |
| Source duration | 大于 0 且不超过 12 小时 |
| VFR | 允许输入；最终输出标准化为 30 fps |

损坏、无音视频 stream、非法 duration/dimension 返回 `invalid_source`；container 或 codec
不在支持基线时返回 `unsupported_codec`。实际 worker 仍须执行短解码验证，因为仅看
metadata 不能证明媒体可解码。

## 可执行基准

`scripts/video-workspace/fixtures/render-v1.json` 是共享 golden fixture。合同测试先验证
其中的 EDL 和 Render Spec，FFmpeg 原型再使用同一 fixture：

```bash
npm run test:video-workspace
npm run prototype:video-workspace
```

原型会生成 8 秒的 1280 × 720 H.264/AAC 合成 source，然后：

1. 对两个不连续 source ranges 分别执行 input seek。
2. 使用每段归一化 crop/zoom 生成 9:16 画面。
3. 拼接视频和音频并重置时间戳。
4. 加字幕和品牌色 overlay。
5. 应用 gain、响度标准化和淡入淡出。
6. 输出最终 MP4，并从 timeline 时间点提取 JPEG cover。
7. 用 `ffprobe` 验证 duration、dimension、codec、pixel format、audio channels 和 cover。

本机 FFmpeg 8.0.1 构建缺少 `subtitles`/libass filter，因此本地验证使用明确标记的
`pango-overlay-fallback` 生成固定 caption PNG。生产 renderer 镜像必须固定一个包含
libass 的 FFmpeg build；在该镜像通过 ASS 路径前，字幕 parity 仍属于未完成项。

## M0 完成度

- [x] 建立共享 TypeScript 合同和运行时校验。
- [x] 定义固定最终输出 preset 和自动验收。
- [x] 最小 FFmpeg prototype 跑通多 segment、crop、字幕 fallback、品牌 overlay、音频和封面。
- [x] Browser/renderer 合同排除任意 shell/filter/path 输入。
- [ ] 固定并验证包含 libass 的生产 FFmpeg 镜像。
- [ ] 准备并跑完 20–30 条真实输入基准，包括损坏文件和 VFR。
- [ ] 确认剩余产品项：首发设备范围和 AI 元数据边界；首选 provider 已确认为 Cloudflare Containers，但生产调度迁移仍未完成。

## 尚待产品确认

当前计划中的建议保持为建议，尚未写入不可逆的数据或计费逻辑：

- 编辑器首发桌面 Chrome/Edge；移动端只查看和下载。
- AI 只保存 clip 内部名称/主题，不生成面向社交平台的描述和 hashtags。
- Job contract 保持 provider-neutral；首个生产实现目标已改为 Cloudflare Queue + Containers，隔离 POC 结果见 `cloudflare-containers-poc.md`。

已确认：

- V1 音频只做 gain、响度标准化、降噪和淡入淡出，不做背景音乐或时间线音效素材。
- Source retention：Free 7 天/5 GiB，Basic 30 天/25 GiB，Pro 90 天/100 GiB；
  到期后保留项目和成片，重新渲染需重新上传匹配的 source。
