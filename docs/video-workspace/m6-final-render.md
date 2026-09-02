# M6 Final Cloud Renderer

M6 将已保存的 project version 变成不可变 final render job。浏览器只提交项目 revision；服务端复用内容一致的 snapshot，或先创建新 snapshot，再为同一 version 幂等地创建最终视频与封面资产。

## 产品 API

- `GET /api/video-projects/:id/renders`：列出最终渲染及短期下载 URL。
- `POST /api/video-projects/:id/renders`：创建或复用同一 version 的 final job。
- `DELETE /api/video-projects/:id/renders/:jobId`：取消排队中或执行中的任务。
- `POST /api/video-projects/:id/renders/:jobId`：重试可重试失败或已取消的任务。

创建接口接受 `revision` 与 `idempotencyKey`。revision 负责阻止用过期草稿发起渲染；idempotency key 和 version 唯一性共同避免重复输出。最终视频和封面的下载 URL 只有 15 分钟有效。

## 执行协议

Cloudflare Queue dispatcher 同时处理 preview 与 final 两类任务。final lease 只签发本次任务需要的对象：原视频只读 URL、可选 Logo/字体只读 URL，以及最终 MP4、封面各自的只写 URL。Cloudflare Container 不持有 R2 永久凭证，也无法列举 bucket 或访问其他用户对象。

容器直接从原视频执行以下流水线：

1. 按不可变 EDL 对连续 source segment seek、trim。
2. 默认由 MediaPipe 检测主要人脸并生成平滑 9:16 跟随；置信不足时用完整画面加模糊背景，用户也可选择固定 crop。
3. 标准化视频与音频；无音轨输入自动补静音。
4. 生成带逐字 timing 的 ASS 动态字幕，并应用模板、断行、安全区和自定义字体。
5. 应用品牌署名、Logo、音量、响度标准化与淡入淡出。
6. 一次编码为 1080 × 1920 H.264/AAC MP4，并从指定 timeline 时间生成封面。
7. 用 `ffprobe` 校验尺寸、codec、时长和音轨后上传，再回调结果。

最终渲染不会读取 preview proxy，也不会把 proxy 作为中间转码源。
AI 候选为 15–45 秒且只使用一个连续 source segment，不做语义拼接；手动修剪只读取用户上传的 original source，不生成或补写不存在的视频内容。

## 可靠性

- final job 的 Container 渲染超时为 55 分钟；这是异常任务的停止上限，不是正常预计耗时。几十秒输出通常只处理被选中的 source range。lease 与 callback 使用稳定 job token。
- Queue 重投、API 重复请求和 callback 重试均保持幂等。
- 取消会将本地任务置为 canceled，并由 dispatcher 销毁对应 Container。
- provider 已成功但 callback 暂时缺失时保留两分钟恢复窗口，避免过早标记失败。
- callback 只有在 R2 HEAD 与输出元数据都验证通过后才把资产置为 ready。
- 失败使用稳定错误码，重试沿用同一 job/asset 命名空间，避免孤儿输出。

## 本地验证

- `npm run test:video-final`：用本机 FFmpeg 验证多 segment、编码、音频与封面。
- Docker 镜像内以 `TEST_FINAL_CAPTIONS=1` 运行同一 fixture，覆盖 libass 动态字幕。
- `npm run test:video-workspace`：覆盖 Render Spec、job/result contract 与边界校验。
- `npm run build`：验证 Next.js 路由、UI 和服务端模块集成。

远程 D1 migration、生产 Cloudflare Container/Queue consumer 发布均未执行；代码、Container 镜像构建和 Wrangler dry-run 已在本地通过。
