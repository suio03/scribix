# Scribix GSC / Bing 检查记录

检查时间：2026-09-19（Australia/Melbourne）。只读审计，未修改应用、Cloudflare 或站长工具设置，未提交收录或验证修复。

**结论：生产公开页面未发现普遍的抓取或 canonical 阻断。优先处理开发域暴露、HTTP 未跳 HTTPS、dashboard 索引清理；其次处理价格页定位和正式落地页的收录。**

证据范围：Chrome ai-publisher 中 GSC 页面索引全部 8 类、视频索引、sitemap、robots、抓取统计、HTTPS、Core Web Vitals、人工处置、安全问题；Bing 全部 4 类 Recommendations、Site Explorer 问题分类、sitemap、Site Scan、IndexNow。另读取线上 sitemap 的全部 70 个 URL（6 种语言），检查 HTTP、HTML 元数据、hreflang、HTML 链接和 JSON-LD 语法。原始抓取结果在 `/tmp/scribix-seo-audit/results.json`，对应 HTML 与响应头也保存在该目录。

## 优先处理

| 优先级 | 状态 | 发现与证据 | 最小处理方向 |
| --- | --- | --- | --- |
| P1 | observed | `local.scribix.io/` 和 `/terms` 被 Google 抓取并列入 canonical 替代页。开发域 90 天有 88 次抓取；GSC robots 于 9/15 报 5xx。当前首页、terms、robots 均返回 Cloudflare 530 / error 1033。Bing 也发现该域 robots。 | 给开发域设置访问控制，避免在线时开放开发站、离线时返回隧道故障。公开预览若确有需要，单独设计 noindex；不要仅依赖指向生产的 canonical。 |
| P1 | observed | `http://scribix.io/` 当前直接 200，未转 HTTPS；Bing 已索引 HTTP 首页，Google canonical 排除中有 4 个 HTTP URL。 | 在边缘设置保留路径、查询参数的 HTTP→HTTPS 永久重定向。 |
| P1 | observed | `/dashboard` 已收录但 robots 阻止抓取；未登录请求实际 307 到首页。`/dashboard/account` 被 robots 阻止。 | 保持鉴权，设计能让搜索引擎观察到重定向或 noindex 的退出索引流程。不要把解除 robots 屏蔽误当作解除登录保护；需要快速隐藏时可在修复方案中考虑临时移除。 |
| P2 | observed | 价格页标题仅 `Pricing · Scribix`、`料金 · Scribix` 等，缺少产品上下文。非英语价格页描述仍强调转录分钟，英语已强调视频剪辑。 | 统一六语言产品定位、标题和摘要；事实继续从 `PRICING_FACTS` 插值。相关文件：`app/[locale]/pricing/page.tsx`、`messages/*.json`。 |
| P2 | observed / inferred | 14 个正式 HTTPS 页面已抓取未收录，日语音频页已发现未抓取。线上这些页面均 200、自引用 canonical、无 noindex。日语 MP3 的 GSC 检查明确显示成功抓取、允许收录、Google canonical 为检查 URL。 | 先改善重点页面的独有用途、实例、内容与站内入口，再复查抓取。内容相似或索引优先级是待验证解释，不是已证实原因；不能用批量提交保证收录。 |
| P3 | observed | 生产 HTTP/HTTPS robots 均提示第 11 行 `Host: https://scribix.io` 被 Google 忽略。 | 可移除 `app/robots.ts` 中冗余 Host；不是阻断收录的错误。 |

## GSC 全部告警

页面索引报告更新于 **2026-09-14**：31 已收录、51 未收录（页面明细的个别抓取日期比报告日期新，按界面原样记录）。

| 告警 | 数量 | 核查结论 |
| --- | ---: | --- |
| Alternative page with proper canonical tag | 26 | 20 个生产域带推广参数的 URL、4 个 HTTP URL、2 个 local 开发域 URL。推广参数去重正常；HTTP 和开发域按上表处理。抽查 `/?via=topaitools` canonical 为 HTTPS 首页。 |
| Page with redirect | 3 | `/ja/privacy`、`/de/privacy`、`/it/dashboard/new`。法律页统一英语、后台登录跳转符合代码设计；日语 privacy 线上最终 200 到 `/privacy`。无需让来源 URL 独立收录。 |
| Server error (5xx) | 2 | `/it/opengraph-image?083ca35692cfd944` 和 `/en/opengraph-image?9a3520b58fc6d228`。当前均跳到 `/brand/social.png` 返回 200；前者 308，后者先 307 去英文前缀再 308。线上已不复现，报告仍为历史状态。兼容路由：`app/[locale]/opengraph-image/route.ts`。 |
| Not found (404) | 1 | 旧字体 `/_next/static/media/797e433ab948586e-s.p.0.q-h669a_dqa.woff2`。当前仍 404，但 70 页均不再引用该精确路径；现用同字体新版本返回 200。无需恢复过期构建资源用于收录。 |
| Blocked by robots.txt | 1 | `/dashboard/account`。私人账户页排除合理。 |
| Crawled - currently not indexed | 17 | 14 个正式 HTTPS 页面 + 1 个 HTTP 音频页 + 2 个字体 URL。不要把资源文件计入需要争取收录的落地页。 |
| Discovered – currently not indexed | 1 | `/ja/audio-to-text`。GSC 检查显示已通过 sitemap 和其他页面发现，但没有抓取记录。线上 200，canonical/hreflang 正常。 |
| Indexed, though blocked by robots.txt | 1 | `/dashboard`，应清理而非优化搜索展示。 |

14 个正式 HTTPS 已抓取未收录页面：

- 首页：`/de`、`/ja`、`/fr`。
- MP3：`/ja/mp3-to-text`、`/it/mp3-to-text`、`/de/mp3-to-text`、`/es/mp3-to-text`、`/fr/mp3-to-text`。
- Audio：`/it/audio-to-text`、`/de/audio-to-text`。
- YouTube：`/ja/youtube-to-transcript`、`/fr/youtube-to-transcript`、`/de/youtube-to-transcript`、`/it/youtube-to-transcript`。

其余 3 个：`http://scribix.io/ja/audio-to-text`、HTTPS 字体 `54fc36028e2bb174-s.p.0nkps02--w45i.woff2`、HTTP 旧字体 `797e433ab948586e-s.p.0.q-h669a_dqa.woff2`（都在 `/_next/static/media/`）。

附加报告：

- 视频（更新 9/17）：首页 `/`、`/it`、`/es` 的 `scribix-hero.mp4` 都是 “Video isn't on a watch page”。营销页演示视频不是以观看为目的的专用页面，不影响网页作为文字结果收录；无需为消除告警而改造首页。[Google 视频要求](https://developers.google.com/search/docs/appearance/video)
- sitemap：Success，Google 9/11 读取到 45 URL；Bing 9/14 读取到 45。当前线上是 70 URL，说明报告尚未反映当前清单，不能把数量差直接称为提交失败。
- HTTPS：0 个 Non-HTTPS URL 问题、9 个 HTTPS 示例，过去 90 天无问题。这并不否定实测 HTTP 仍可返回 200。
- Core Web Vitals：手机、桌面均没有足够 90 天使用数据，不能判定通过或失败。
- 人工处置、安全问题：均 No issues detected。
- 抓取统计：90 天 2,727 请求，平均 399ms；生产域 2,639 请求，平均 382ms；整体 96% 200、2% 404、2% 临时重定向，5xx <1%。生产主机以前有连接问题、近期正常；DNS 和 robots 获取失败率可接受。不能据此推断当前存在生产服务器持续故障。

## Bing 全部 Recommendations

界面显示 13 errors / 12 pages：1 个站点级 IndexNow 建议 + 6 个描述实例 + 4 个标题实例 + 2 个 ALT 实例；这些计数不等同于 13 个抓取故障。

| 类型 | 受影响范围 | 判断与处理 |
| --- | --- | --- |
| IndexNow / High | 全站 | 尚未配置的主动通知建议，优先级低于实际 URL 问题。现有 sitemap 成功。可以后续接入内容变更通知，但不保证收录，也不能当作 Google 收录修复。[IndexNow FAQ](https://www.indexnow.org/faq) |
| 描述过短 / 6 | `/ja`、`/ja/audio-to-text`、`/ja/mp3-to-text`、`/ja/pricing`、`/ja/ai-note-taker`、`/ja/youtube-to-transcript` | 全是日语。当前首页 79 字符、audio 86 字符、pricing 58 字符；多数已有清晰用途和输出格式。不要机械补到英文 150–160 字符。价格页应修正产品定位，其余按语义改进。[Google 摘要说明](https://developers.google.com/search/docs/appearance/snippet) |
| 标题过短 / 4 | `/pricing`、`/ja/pricing`、`/it/pricing`、`/es/pricing` | 增加产品用途和计划比较的上下文即可。另两个语言版本也采用同类短标题，适合统一处理。 |
| IMG 无 ALT / 2 | `/`、`/fr` | 当前服务器 HTML 和浏览器 DOM 均没有缺失 alt 属性的图片；各有 8 张 `alt=""` 图片。历史告警未复现，不能断言全部已解决。需按图片用途判断：装饰图保留空 alt，承载独有信息的截图补本地化说明。源码在 `app/components/VideoHomeMarketing.tsx` 等。 |

Site Explorer 额外发现：

- 唯一 server error 是同一个旧英文 OG 图片，Bing 最后抓取 8/2 为 500，线上已正常重定向。
- `/de/opengraph-image?083ca35692cfd944` 为正常 308，线上最终图片 200。
- 404 URL 是 `/privacy）查看更详细的信息。?refer=similarlabs_ai-productivity_scribix-ai-video-transcription`，像是外部链接把中文标点和正文带入路径（来源推断，未核实外部页面）。应纠正来源；不必把所有错误路径重定向首页。
- 其他问题中 `/audio-to-te` 被排除，线上确为 404；项目搜索未发现该错误内链。无需争取收录。
- Canonical Source 包含推广参数 URL，以及部分协议变体；不能简单当成页面损坏。
- “guidelines issues” 分类显示的是 `local.scribix.io/robots.txt`（9/11 200、Excluded），没有证据表明生产站受到整站处罚。
- NOINDEX、selected not yet crawled 分类显示 No data available。Site Scan 尚未发起过扫描，不代表扫描通过。

## 线上已验证与边界

- 70/70 sitemap URL 返回 200，均有标题、描述、自引用 canonical（首页尾斜线视为等价），没有 HTML 或响应头 noindex。
- 66 个多语言页面各有 6 个语言 alternate + x-default，互相一致且目标均在 sitemap 中；4 个英语专用页面无 hreflang，符合当前设计。
- 70 页均能从本次下载页面集合中的 HTML 链接发现；没有发现完全只靠 sitemap 的孤立 URL。这不等同于每页都有高质量上下文内链。
- 读取到的 JSON-LD 可解析；没有进行完整富结果资格验证。
- 未做全站交互、移动端视觉或 Lighthouse 性能测试；报告关注站长工具告警。没有逐 URL 运行 Google Live Test，也没有拿到历史服务器日志，因此未收录决策、过去连接故障和旧 ALT 报告的确切原因仍未知。
- `robots.txt` 控制抓取而非保证退索引；屏蔽会妨碍搜索引擎读取 noindex 或跳转。清理 dashboard 时必须一起设计。[Google canonical / robots 说明](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

建议执行顺序：开发域访问控制 → HTTP 规范化 → dashboard 退出索引 → 六语言价格页信息同步 → 重点未收录落地页内容与发现路径 → 清理 Host 警告及按需接入 IndexNow。

## 后续决定与代码处理（2026-09-19）

用户确认已在 Cloudflare 开启 HTTP→HTTPS，并选择开发域继续公开可访问，只隔离搜索收录，因此不采用上文建议的 Access 登录保护。以下为本地实现，尚未部署：

- `next.config.ts`：仅匹配 `local.scribix.io`，添加 `X-Robots-Tag: noindex, nofollow`；同时给默认语言及所有支持语言的 dashboard 路径添加相同响应头。普通生产页面不添加该头。
- `middleware.ts`：补上开发域 middleware 重定向的响应头，因为 OpenNext 会在应用 next.config headers 之前返回这类响应。
- `public/_headers`：给 Cloudflare 直接提供的开发域静态资源添加同样的主机限定响应头。这些资源不经过 Next.js。
- `app/robots.ts`：移除 dashboard 的抓取屏蔽，让爬虫能观察已有匿名鉴权跳转及 noindex；移除 Google 忽略的 Host 指令。保留 admin、API、extension-login 屏蔽。后台原有鉴权及 metadata noindex 保留。

验证：生产 Next.js 构建、6 语言结构检查、OpenNext 构建通过。在独立本地 workerd 中使用测试 AUTH_SECRET、无生产数据库绑定，检查正式域/开发域首页、日语工具页、法律页、法律页重定向、robots、sitemap、匿名 session API、图片，以及 5 个默认/本地化后台路径；正式域公开页面保持可索引，开发域有 noindex，匿名后台带 noindex 并跳回相应语言首页。

生效方式：开发服务需载入新的配置（必要时重启）；生产 robots/dashboard 变更需部署后生效。开发域暂不设置 `Disallow: /`，让搜索引擎能读取 noindex。应用离线时 Cloudflare Tunnel 自身的 530/1033 响应不经过代码，仍可能显示历史抓取错误；若希望连这种响应也带 noindex，需要另加主机限定的 Cloudflare 响应头规则。noindex 是退出索引信号，不是鉴权或禁止爬虫请求。
