# AI 短视频工作台 M1 数据与生命周期

> 状态：基础设施、source 与 final export retention 已实现
> Migrations：`0025_video_workspace.sql`、`0034_latest_final_render.sql`、`0035_final_export_retention.sql`

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

所有新视频上传都会解析为 `video_clips` workflow：preflight 强制选择 `direct_video`，init 同时
建立 transcript、dormant project 和 uploading source asset。multipart 完成后 source asset 标记为
ready。已有 completed 视频 transcript 也可通过 `POST /api/video-projects` 幂等创建项目。

每个未删除 transcript 当前只允许一个 video project；一个项目内部通过多个 candidates 和
versions 产生多条短视频方案。

## 删除顺序

项目、transcript 和账号删除都遵循：

1. 按 owner 查询全部确定性 R2 keys。
2. 删除 R2 对象；失败则保留 D1 记录供重试。
3. 解除 project 对 source/version 的循环引用。
4. 删除 jobs、candidates、versions、asset rows 和 project rows。

用户有两个不同范围的删除动作：

- “Remove original video” 只删除 source 与 preview proxies，并清空 transcript 的媒体 key；项目、
  transcript 文本、候选、草稿元数据和未到期的最新成片仍保留。项目进入归档只读状态，不能继续
  编辑或重新导出。
- “Delete video project” 删除该项目的 source、preview、brand assets、final outputs 与项目数据，
  但保留 transcript 文本记录。删除 transcript 或账号仍执行完整的关联清理。

所有删除都先确认 R2 对象已删除，再清理 D1 引用；活跃渲染期间拒绝移除 source。

## Source retention 与容量

| 套餐 | 原视频保留 | 原视频总容量 |
|---|---:|---:|
| Free | 7 天 | 5 GiB |
| Basic | 30 天 | 25 GiB |
| Creator（`pro`） | 30 天 | 100 GiB |

这些值定义在 `lib/plans.ts`，是套餐事实的单一来源。Preflight 会在上传前返回当前
`usedBytes`、`limitBytes`、`requiredBytes` 和 `retentionDays`；创建 source asset 时再用带
容量条件的单条 INSERT 原子校验，避免并发上传同时越过上限。容量不足时整次视频上传被阻止，
Free/Basic 用户会看到升级入口；不会静默退回只上传音频。音频文件不读取或占用这组容量。

Source 到期时，cleanup worker 会等待活跃 preview/final job 结束，再删除 R2 原视频与 preview
proxies，并清空 transcript 的旧 `audio_r2_key` 和 project 的 `source_asset_id`。Transcript 文本、
候选和未到期的最新 final export 继续保留；当前产品不提供为归档项目重新绑定 source 的流程。

每个 candidate 只保留最新完成的 final export。新导出成功后，旧 job 标记为 superseded，并立即
尝试删除旧视频和封面；删除失败由 cleanup worker 重试。最新视频和封面从完成时间起保留 30 天，
也允许用户提前删除。到期清理不会删除 transcript 文本或候选元数据，但没有 source 时无法重新生成成片。

## 验证

- 全部 migration 必须能从空 D1 数据库应用至当前最新版本。
- TypeScript 检查通过。
- Video workspace 合同与 R2 key 测试通过。
- Production build 必须在每次生命周期改动后通过。
