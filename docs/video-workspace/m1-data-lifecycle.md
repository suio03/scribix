# AI 短视频工作台 M1 数据与生命周期

> 状态：基础设施与 source retention 已实现  
> Migration：`0025_video_workspace.sql`

## 数据模型

M1 新增 `video_projects`、`clip_candidates`、`project_versions`、`media_assets`、
`render_jobs` 和 `brand_templates`。所有用户私有表都直接保存 `user_id`，ownership
查询同时使用对象 ID 和 `user_id`。

`project_versions` 同时保存不可变 EDL 和 Render Spec，因此项目只需要一个
`active_project_version_id`，不保存两个可能互相漂移的 active version。编辑期间的
autosave 分别保存在 nullable draft JSON；点击生成时才创建不可变 version。

Preview job 增加 `preset_id` 和 `scope_key`。唯一索引限制同一个 version、kind、preset
和 scope 只能存在一个活跃 job；不同 candidate/segment proxy 可以使用不同 scope 并行。

## Source object 复用

短视频项目不会复制原视频：

```text
transcripts.audio_r2_key
          │
          └── media_assets(kind = source).r2_key
```

创建 `video_clips` workflow 时，preflight 强制选择 `direct_video`，init 同时建立 transcript、
project 和 uploading source asset。multipart 完成后 source asset 标记为 ready。已有 completed
视频 transcript 也可通过 `POST /api/video-projects` 幂等创建项目。

每个未删除 transcript 当前只允许一个 video project；一个项目内部通过多个 candidates 和
versions 产生多条短视频方案。

## 删除顺序

项目、transcript 和账号删除都遵循：

1. 按 owner 查询全部确定性 R2 keys。
2. 删除 R2 对象；失败则保留 D1 记录供重试。
3. 解除 project 对 source/version 的循环引用。
4. 删除 jobs、candidates、versions、asset rows 和 project rows。

单独删除 project 时保留共享 source object，transcript 仍可播放；删除 transcript 或账号时才
删除 source。cleanup worker 在硬删除过期 transcript 前执行同一流程。

## Source retention 与容量

| 套餐 | 原视频保留 | 原视频总容量 |
|---|---:|---:|
| Free | 7 天 | 5 GiB |
| Basic | 30 天 | 25 GiB |
| Pro | 90 天 | 100 GiB |

这些值定义在 `lib/plans.ts`，是套餐事实的单一来源。Preflight 会在上传前返回当前
`usedBytes`、`limitBytes`、`requiredBytes` 和 `retentionDays`；创建 source asset 时再用带
容量条件的单条 INSERT 原子校验，避免并发上传同时越过上限。Transcript-only 上传不读取
或占用这组 video workspace 容量。

Source 到期时，cleanup worker 会等待活跃 preview/final job 结束，再删除 R2 原视频、清空
transcript 的旧 `audio_r2_key` 和 project 的 `source_asset_id`。Transcript、EDL、Render Spec、
final video 和 cover 继续保留；再次渲染需要重新上传匹配的 source。

## 验证

- 全部 migration 从空 D1 数据库应用至 `0025` 成功。
- TypeScript 检查通过。
- Video workspace 合同与 R2 key 测试通过。
- Production build 必须在每次生命周期改动后通过。
