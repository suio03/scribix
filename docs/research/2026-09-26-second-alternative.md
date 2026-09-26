# 第二篇 Alternative：选题调研与制作 brief

调研日期：2026-09-26。状态：用户已选定 Vizard；页面已于 2026-09-26 发布（`4172cc7`）。实现与验证见 [内容记录](../content/vizard-alternative.md)。内容上线状态仍统一维护在 [内容规划](2026-09-07-blog-seo-acquisition-summary.md)。

## 结论

优先制作 **Vizard Alternative**，Klap 为备选。建议英文标题 **Vizard Alternative for Podcast Clips: Scribix Compared**，路由 `/alternatives/vizard-alternative`。

理由是任务匹配和可准备的证据：两者都服务于长视频中的讲话片段，现有 Scribix 真实素材可以展示选段、修正边界、构图和导出；Vizard 的免费编辑、团队功能、输出和套餐提供明确的决策维度。此优先级不是搜索量排名，也不表示已经验证 Scribix 比 Vizard 更好。

采用围绕 Vizard 的直接比较，不复制第一篇的四工具榜单。回答用户切换后能完成什么、会失去什么，以及哪些需求仍适合继续使用 Vizard。Scribix 是发布方，公开说明文章与产品的关系及比较方法。

## 研究范围与数据限制

- 目标语言：英语；目标受众：英语市场的播客／访谈个人创作者。未取得限定美国或其他单一国家的 SERP 快照。
- 来源：公开搜索结果、竞品官方功能与价格页、Chrome `ai-publisher` 中的 Vizard 动态月付页面、当前仓库产品合同。
- 检索日期不等于搜索量统计周期；本次未接入可用关键词指标 API，也未取得 Keyword Planner、Ahrefs、Semrush 或 Search Console 的可比导出。
- 下表搜索量、KD、CPC 均未知。搜索结果中出现多篇竞争文章只能证明存在这一内容类型，不能推导需求规模、容易排名或流量预测。
- 未实际操作竞品剪辑，未购买套餐，未上传素材，未重新验收 Scribix 生产流程。竞品能力按官方声明记录；本地代码不作为生产可用证据。

## 候选关键词与选择

| 优先级 | 候选词簇 | 搜索结果所呈现的意图 | 取舍 | 月搜索量 / KD |
| --- | --- | --- | --- | --- |
| 首选 | vizard alternative / vizard alternatives / vizard ai alternative | 工具选型、免费限制、付费套餐与工作流比较 | 与当前产品任务接近；可写具体切换说明 | 未取得 / 未取得 |
| 备选 | klap alternative / klap alternatives / klap ai alternative | 长视频切片、免费入口、按成片数计费与其他方案比较 | 任务匹配；但需厘清免费试用和按 clips 计费，不能套用旧分钟制表格 | 未取得 / 未取得 |
| 后续 | quso ai alternative / vidyo ai alternative | 切片与社媒管理组合、旧品牌迁移后的选型 | 需要说明替代整套社媒工具还是仅替代切片；当前不宜承诺全面替代 | 未取得 / 未取得 |
| 暂缓 | descript alternative | 文字剪辑、完整音视频制作、录音和 AI 音频等多种任务 | 用户预期更广；Scribix 尚缺内部删句、重排、音频处理等流程 | 未取得 / 未取得 |

单复数及 `ai` 变体由同一页面承接。`free vizard alternative` 作为 FAQ 子问题；不新增近似页面，也不以“免费编辑器”承诺吸引用户后再要求付费。

### 搜索结果抽样

运行了 `vizard alternative`、`klap alternative`、`quso ai alternative`、`descript alternative podcast clips`，并用 `klap ai alternatives video clipping tools` 消除 Klap 普通词／学术词噪声；另查询 Vizard 的文字剪辑官方说明。检索无精确排名及地域保证。

可追踪的代表页面：

- [G2 Vizard alternatives](https://www.g2.com/products/vizard-corp-vizard/competitors/alternatives)：软件目录型选项集合。
- [EzClip Vizard comparison](https://www.ezclip.tv/alternatives/vizard)：搜索摘要突出免费限制与定价；正文抓取失败，仅作为结果类型证据，不采信其数字。
- [Overlap Vizard alternatives](https://overlap.ai/blogs/vizard-alternatives)：已阅读，按使用场景、计费单位和发布工作流比较。说明“工作流比较”本身已经有竞争，不能当作空白市场。
- [Klap 的 Vizard alternative](https://klap.app/alternatives/vizard-ai)：厂商直接对比页，支持采用单品牌直接比较的形式；不采信其对第三方的优劣评价。
- [OpenClip Klap alternatives](https://openclip.app/alternatives/klap-alternatives) 与 [EzClip Klap comparison](https://www.ezclip.tv/alternatives/klap)：搜索摘要中的免费试用描述不一致，应回到官方确认，不能用其负面结论。
- [quso.ai alternatives 目录](https://quso.ai/alternatives)：覆盖切片、视频编辑、内容复用及社媒排程，反映其产品范围较广。
- [Descript 官方套餐与功能](https://www.descript.com/pricing)：官方范围包括录音、多轨编辑、音频增强等；不是与 Scribix 完全同类的替代承诺。

以上仅用于意图与内容形式分析，未用评论数量、结果数量或文章标题估算需求。

## 已核对的产品事实

| 项目 | Vizard 官方信息 | Scribix 当前仓库依据及写作边界 |
| --- | --- | --- |
| 免费体验 | 60 credits/月，720p，编辑器可用，3 天存储 | 60 分钟一次性额度；免费可导出原始候选，编辑与品牌控制需付费 |
| 入门月付 | Creator $29/月，所选档位 600 credits/月；1 credit = 1 分钟上传视频 | Starter $29/月、600 处理分钟/月，来自 v2 定价配置；上线写稿前核实实际新购入口 |
| 年付 | Creator $174/年，页面折合 $14.50/月，7,200 credits/年 | Starter $174/年；额度按月重置，不把月均值写成全年可任意使用 |
| 文字操作 | 官方明确支持删除转写文本来剪掉视频内容 | 支持文本定位与起止范围调整；尚无用户可用的内部删句／重排流程，不能写成同等文本编辑器 |
| 输出与团队 | Creator 明示 4K、排程、6 个社交账号；Business 提供共享工作区与品牌工具 | 当前主切片输出为 9:16；不要承诺 4K、多比例、共享团队工作区或全面替代其发布功能 |

Vizard 价格的网页文本抓取把动态金额显示成 `$0`，因此通过 Chrome 官方页核实并切换 Monthly：Creator 显示 $29 和 600 credits/month。Business 当前页面选择的是 1,000 credits/month、$68/月；这是所选档位，不据此宣称最低价。读取后将计费切换恢复为原来的 Yearly。

来源：

- [Vizard pricing](https://vizard.ai/pricing)，2026-09-26 网页及动态页面核对。
- [Vizard text-based editing](https://vizard.ai/tools/text-based-video-editing)，2026-09-26 检索到的官方说明。
- [Scribix 定价配置](../../lib/pricing-v2.ts)、[额度配置](../../lib/plans.ts)、[编辑合同](../video-workspace/editing-and-framing.md)、[产品状态](../roadmap/video-product-plan.md)。

这些事实不支持“更便宜”“只有我们支持文字剪辑”“更多免费额度”“剪得更准”等卖点。Scribix 可以展示自身审阅流程，方便用户判断适配程度；是否更省时间必须另行实测。

## 推荐页面结构

Title：`Vizard Alternative for Podcast Clips | Scribix`

H1：`Vizard Alternative for Podcast Clips: Scribix Compared`

建议开头直接说明：适合想审阅讲话内容、调整一个完整片段并导出竖屏视频的用户；若需要免费文本编辑、团队协作或其他已核实的 Vizard 能力，继续使用 Vizard 可能更合适。不能把这一定位写成独占功能。

1. **Should you switch from Vizard?** 三种需求分流：免费编辑、个人单片审阅、团队／复杂编辑。给明确选择理由，不强行推荐 Scribix。
2. **Vizard vs Scribix: what changes** 围绕输入、编辑权限、文本操作方式、输出、存储、计费周期的紧凑表格。每个数字附核查日期。
3. **Review one podcast clip in Scribix** 具体例子展示一句缺少上下文的开头如何补齐、为何保留这段、如何检查画面和字幕。演示的是 Scribix 操作，不暗示 Vizard 无法完成。
4. **Compare the plan you would actually use** 免费编辑权限与一次性／周期额度优先于价格字号；分清月付、年付及额度重置方式。
5. **What you give up by switching** 列出已核实的能力差异，特别是内部文本删句、多比例／4K 与团队需求；未经生产验收的平台能力暂不承诺。
6. **Try it with your own recording** 上传原视频 → 审阅候选 → 免费原始候选导出；编辑按钮附近说明付费要求。CTA 可用 `Try Scribix with your recording`。
7. **FAQ** 免费替代是否可编辑？是否支持删除句子？能否输入 YouTube URL？是否适合团队？比 Vizard 更好吗？最后一项明确本页不是效果排名。

与第一篇的区分：首篇继续承接 OpusClip 用户的多工具选型；第二篇提供 Vizard 用户的直接切换判断、权限差异和具体工作示例。不再重复同一四工具榜单或机械更换品牌名。复用真实媒体可行，但解释内容需要服务本页决策。

## 素材和验证准备

最小可发布版本无需购买竞品套餐或补完整竞品跑分：官方功能比较 + 可核查的 Scribix 工作示例足够。准备内容如下：

- 优先沿用已获用户授权的 Guide 素材、真实导出与截图；标注为已有示例，不包装成新一轮对照测试。
- 选一个明确的审阅决策，记录原片时间码、为何调整开头／结尾、最终选段及画面结果；没有真实前后文件就只做操作说明。
- 录入 Scribix 当前生产中新账号的免费导出及付费编辑边界，确认页面承诺与实际可用能力一致。
- 如希望写速度／准确性优劣，再以同一获授权输入、同一目标任务、各自套餐及设置做测试，保存输出和人工修正时间。单样本只写本次案例，不外推整体质量。
- 比较页维持英文、单一 canonical、无翻译 hreflang，locale 跳转遵循现有规则；接入 Alternatives registry、索引、页脚与 sitemap。
- 内链到第一篇 Alternative、TikTok Guide、Podcast Clip Checklist、播客功能页及定价页；不链接尚未上线的横屏转竖屏页。
- 公开页面保留来源名称及核查日期，按已确认约定不放竞品外链；完整 URL 留在内部资料。发布前跑 build，检查桌面／移动端、演示播放、CTA 和索引信号。

## 本轮发现的旧内容维护项

第一篇 `lib/alternatives/opus-clip.ts` 写 quso.ai Lite 包含六平台发布与排程。本次 [quso.ai 官方价格页](https://quso.ai/pricing) 把 Lite 标为 TikTok 发布，七平台排程放在 Essential。新文章不得沿用旧描述；建议下一次内容更新同步核实并修正首篇。后续页面实施已修正首篇这两处描述，并更新修改日期；随 `4172cc7` 发布，线上已验证。

Klap 的 [当前价格页](https://klap.app/pricing) 使用 clips/mo：Basic 100、Pro 300、Pro+ 1,000；默认年付折算价分别 $14／$39／$94 每月。本轮未验证月付开关和试用条件，不把这些年付数字标成月付，也不沿用旧的“处理分钟数”比较。

## 后续决策

可以按本 brief 开始撰写 Vizard 页面。若下一步要按流量回报重新排序，再取得同一国家、英语、同一统计期间的 Vizard／Klap／quso／Descript 词簇指标；不把缺少搜索量解释成没有需求。发布后沿用现有搜索和产品分析，看该页查询、点击、到上传和首次导出的实际结果，不单靠排名或少量访问决定效果。
