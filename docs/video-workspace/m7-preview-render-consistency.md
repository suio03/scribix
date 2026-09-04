# M7 Preview/Render 一致性

M7 把 Browser Preview 与 Final Renderer 的呈现规则变成可执行契约，并修复了本阶段发现的实际偏差：浏览器原先围绕中心缩放、字幕字号偏小、依赖 CSS 自动断行；renderer 的 karaoke 语义也不是“仅当前单词高亮”。

## 共享契约

`lib/video-workspace/presentation.ts` 定义以下稳定规则：

- 根据源画面宽高、crop x/y 和 zoom 计算覆盖 1080 × 1920 canvas 的像素矩形。
- 三个字幕模板的字号、字重、box、outline、shadow 和 uppercase 行为。
- 按 Unicode 字符数与最大行数进行逐词断行。
- 当前高亮单词的半开时间区间 `[sourceStartMs, sourceEndMs)`。
- Logo 宽度、四角安全偏移和 signature 品牌线高度。

Browser Preview 使用该模块计算实际 CSS 尺寸和位置。Final Renderer 使用同一组数值规则生成 FFmpeg crop、ASS 字幕与 overlay；契约测试逐项比较两个 adapter。

renderer 的逐字高亮现在按每个 word interval 生成稳定 ASS event：非活动单词保持正文颜色，只有当前单词使用 highlight color。这样避免 karaoke fill 在单词播放结束后留下不同颜色。

## 固定 fixture 与视觉回归

`scripts/video-workspace/fixtures/presentation-v1.json` 固定源尺寸、crop、品牌、安全偏移、字幕参数和三个模板。验证命令：

- `npm run test:video-consistency`：比较 crop、Logo、模板、断行、颜色和逐字 timing 的 Browser/Renderer 契约。
- `npm run test:video-visual-parity`：生成同一 1600ms 源帧，分别由无头 Chrome 和 Final Renderer 截图，再以 FFmpeg SSIM 比较 1080 × 1920 输出。
- `npm run test:video-final`：验证两段 EDL concat、音视频总时长、codec、尺寸和封面。
- Docker 内以 `TEST_FINAL_CAPTIONS=1` 运行 final fixture，验证 libass 真实字幕渲染。

当前视觉 fixture 的 SSIM 为 `0.984769`，golden 下限为 `0.97`。fixture 会在 crop、Logo 或品牌线出现明显漂移时失败。

## 明确允许的差异

- 编辑器 safe-area 虚线是操作辅助，不进入最终视频。
- 播放按钮和 timeline 控件属于编辑器 chrome，不进入最终视频。
- 浏览器字体栅格器和 libass 会有亚像素抗锯齿差异；字号、行、位置、颜色与当前高亮单词必须一致。
- Render Spec 仍保留音频兼容字段，但当前产品固定为 0 dB gain、不做响度标准化或淡入淡出；Browser Preview 与 Final Renderer 都保留原始音轨的响度和起止。

这些差异在 UI 或本文档中明确，不视为 silent mismatch。
