# thewyj.uk 源码评估与复用清单

核查日期：2026-11-13（Asia/Shanghai）。固定提交：[`4fc025a044e5e39d742166df9510d488413f7043`](https://github.com/WYJ0904/thewyj.uk/tree/4fc025a044e5e39d742166df9510d488413f7043)。

结论：值得优先继承的是其**服务端学习事件与题目快照、原生模块边界、错误与降级表达、D1/R2 生命周期、发布资源白名单和 PWA 版本一致性**。它的会员权限、全站管理员模型、Web 令牌存储、语言题库和图片式 PDF，不能直接充当面向未成年学生的业务与安全模型。

## 1. 授权、来源与核查边界

用户在本对话明确补充：认识 thewyj.uk 与 DeepTutor 的仓库所有者，两位所有者允许其直接使用全部内容。本次按此授权背景读取实际源码并在本地隔离目录运行纯模块实验，**不再把该项目一律限定为仅可借鉴架构**。未取得独立授权条款文本；正式对外发布前应补存复制、修改、分发、再授权及商业使用范围的书面记录，商业使用不能仅凭公开仓库或本次技术评估推定。该事项不阻塞本轮本地实现。

固定提交根目录没有项目级 `LICENSE`/`COPYING`；`THIRD_PARTY_NOTICES.md` 仅说明指定第三方组件。用户提供的权利人授权与第三方许可证是两条分别记录的依据。公开可见本身不等于开放源代码许可，参见 [GitHub 官方许可说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)。

已读取完整 Git tree，共 1,589 条，`truncated=false`；围绕本任务缓存并核对 50 个文件。来源位于忽略目录 `.local/references/thewyj/`，不属于新平台静态资源或运行依赖。Git blob 核验允许 CRLF/LF 与末尾空行差异，其余源码内容必须匹配固定树；首次发现的 `package.json` 差异经 GitHub blob 对照，确认仅末尾多一个空行。没有读取 `.dev.vars`、生产密钥、真实用户记录，没有调用参考站点或远程 D1/R2，更没有运行部署脚本。

此次是重点源码审阅与有限的本地实验，**不是对全仓所有功能、全部依赖或线上部署状态的安全认证**。

## 2. 实际目录与关键文件

| 位置（均为上述固定提交） | 实际内容 | 新平台采用方式 |
| --- | --- | --- |
| [`js/core/`](https://github.com/WYJ0904/thewyj.uk/tree/4fc025a044e5e39d742166df9510d488413f7043/js/core) | API、会话、配置、路由、存储、界面与启动模块 | 借鉴职责拆分；认证实现换为新平台协议 |
| [`js/language/`](https://github.com/WYJ0904/thewyj.uk/tree/4fc025a044e5e39d742166df9510d488413f7043/js/language) | 测验、错题、掌握度、同步、PDF 等 | 词汇练习与导出模块是候选，需替换题库/用户/证据模型 |
| [`app.js`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/app.js) | 浏览器组装层仍含大量账号、管理后台和学习编排 | 保留交互经验，不复制为新平台单体入口 |
| [`functions/api/[[path]].js`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/functions/api/%5B%5Bpath%5D%5D.js) | 同源 API 分发到 task12/14/18/20/26 等领域服务；敏感管理操作统一审计 | 新平台按 `/api/v1` 的清晰领域路由重建 |
| [`functions/_lib/cloudflare-foundation.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/functions/_lib/cloudflare-foundation.mjs) | 请求 ID、安全头、来源检查、D1 限流、功能开关、故障分类 | 提取设计，按学生隐私与拒绝优先原则改写 |
| [`cloudflare/migrations/`](https://github.com/WYJ0904/thewyj.uk/tree/4fc025a044e5e39d742166df9510d488413f7043/cloudflare/migrations) | 0001–0025，账号、会话、会员、临时文件、管理员、设备、发布开关、学习事件 | 独立迁移编号与表，不搬正式库或整套历史迁移 |
| [`wrangler.jsonc`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/wrangler.jsonc) | preview/production 配置；D1 `WYJ_DB`、R2 `WYJ_STORAGE`、AI binding；输出 `.wrangler/pages-output` | 新平台独立 bindings/资源/环境，不复制数据库 ID、域名或开关状态 |
| [`scripts/stage_pages_deploy.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/scripts/stage_pages_deploy.mjs) | 文件白名单、禁止私有目录与软链接、凭据形态扫描，才生成发布目录 | 值得筛选复用的构建安全逻辑；本轮未运行该脚本 |
| [`sw.js`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/sw.js)、[`manifest.webmanifest`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/manifest.webmanifest) | 带 release 的完整应用壳缓存、安装事务、超时、旧客户端兼容 | 借鉴版本一致性；学生数据与文件必须更严格排除 |
| [`local-backend/`](https://github.com/WYJ0904/thewyj.uk/tree/4fc025a044e5e39d742166df9510d488413f7043/local-backend)、[`qa/`](https://github.com/WYJ0904/thewyj.uk/tree/4fc025a044e5e39d742166df9510d488413f7043/qa) | 历史本地实现、模块/D1/浏览器回归与迁移验证 | 借鉴测试组织方式，不误当当前生产后端 |

目录还含 Android、财务、通知归档、会员支付、临时分享及工具箱。它们不是第一阶段初中学习闭环的必要依赖。

## 3. 登录、注册与会话：可保留机制，不能原样搬运

主要证据：[`task12-model.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/functions/_lib/task12-model.mjs)、[`task12-crypto.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/functions/_lib/task12-crypto.mjs)、[`task12-service.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/functions/_lib/task12-service.mjs)、[`task12-api.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/functions/_lib/task12-api.mjs)。

- 实际接口包括 `POST /api/register`、`POST /api/login`、账号改密/注销、管理员重置、封禁、强制登出与注销。注册端严格限制允许字段，用户名规范化并唯一；普通注册只能成为 `user`，不能自报管理员。
- 密码并非明文：随机 salt；`deriveCloudSecret` 使用 100,000、100,000、100,000、10,000 次四段 PBKDF2，再使用环境 pepper 做 HMAC。该自定义串接 **不应描述成标准单次 310,000 次 PBKDF2 等价实现**。本地正确/错误密码行为测试通过，不构成密码学强度证明。新平台继续使用标准 KDF 参数与密码策略，不为兼容而直接继承自定义 KDF。
- `task12-model` 的最短 secret 为 7 字符。新平台应提高要求，支持长密码，管理员生成随机初始密码；不要保留特定用户名和固定所有者密钥规则。
- 会话 token 为 32 随机字节，D1 只存 SHA-256 摘要；关联账号状态、过期时间、`session_version`。改密、封禁、全端登出会撤销或提升版本。登录批处理还防止密码/封禁状态在验证和发会话之间变化。这些并发保护值得保留。
- 当前 Web 的 [`js/core/session.js`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/js/core/session.js) 把 token 放在 `localStorage`，并通过 `X-Session-Token` 发送；不能把它描述为全站 HttpOnly Cookie。`task12` 是最长 7 天、访问间隔达 5 分钟时续期的滚动会话。
- [`task20-model.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/functions/_lib/task20-model.mjs) 才包含 Android 15 分钟 access Cookie（`__Host-`、Secure、HttpOnly、SameSite=Strict）及 180 天 refresh 设计。User-Agent 识别客户端不能当成可信授权。当前阶段只预留移动端接口，不复制原生会话/刷新服务。
- 新平台 Web 采用服务端不透明会话、HttpOnly Cookie、固定会话期限、明确 Origin 与 CSRF 校验。不能只因为 `SameSite` 就省略 CSRF；不将密钥/令牌放在 localStorage。

安全差异：上游基础 `sameOriginResult` 对没有 Origin 且没有跨站 Fetch Metadata 的写请求允许通过；限流数据库不可用时可返回 `allowed:true, degraded:true`。这与它的兼容/分阶段迁移背景有关，不能直接作为新平台安全默认。登录相关上游日志还保存 IP、国家/地区/城市、User-Agent 与尝试用户名，默认保留 90 天且最多 5,000 条；新平台应只保存最小安全事件、随机对象 ID 与哈希限流键。

## 4. 权限与管理后台：必须增加机构和关系维度

证据：[`task18-service.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/functions/_lib/task18-service.mjs)、[`task18-api.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/functions/_lib/task18-api.mjs)、[`0014_admin_roles_messages.sql`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/cloudflare/migrations/0014_admin_roles_messages.sql)、`app.js` 的 `renderAdminUsers`、`loadAdminData`、`showAdminPanel`、`saveAdminSecret`。

实际区分固定站点所有者 `super_admin`、受委派管理员 `admin`、普通 `user`；`task18_admin_roles` 保存委派来源，只有所有者可授予/撤销管理员。触发器保护单一所有者、所有者状态及管理员目标状态。敏感动作有服务端鉴权与审计，管理界面不会展示已有密码，只能重置。

UI 值得继承：用户分页搜索、过期异步结果丢弃、`aria-busy`、请求局部失败时保留已加载内容、错误可重试、操作按钮等待态。`js/core/api.js` 在请求前后检查会话所有者，防止切换账号后旧响应覆盖新页面；优于只检查页面入口的登录态。`js/admin/formatters.js` 只是纯展示函数，不承担授权。

但上游没有初中平台所需的机构、师生、监护人关系模型；会员 `entitlements` 表示购买权益，不能拿来代替学生数据访问权。新平台应把以下三层分别判断：

1. **身份**：是否有效账号/会话；
2. **能力权限**：管理员管理账号、老师审核/辅导、学生提交、家长阅读；
3. **对象范围**：同机构且存在有效师生/亲子绑定，家长只取成长摘要，学生只取本人，老师代录明确记录操作者。

管理员默认不读取学生试卷、作答明细和个人成长内容；撤销关系后逐请求立即失效。不能移植“管理员可看全部”和“拥有会员即可访问”的旧语义。注册先采用机构邀请/管理员建号；公开注册、监护确认与关系建立需另行设计。

## 5. D1/R2：最值得继承的是一致性和清理协议

[`0003_accounts_sessions.sql`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/cloudflare/migrations/0003_accounts_sessions.sql) 与服务层使用参数绑定、唯一约束、CHECK、外键及批处理；schema readiness 失败会明确返回不可用，不把没有数据伪装成正常空列表。

[`task14-service.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/functions/_lib/task14-service.mjs) 的临时文件流程：D1 创建带 owner/期限/配额的 `uploading` 预留 → 验证上传者与预留状态 → 校验声明大小及 MIME → R2 写入 → 检查实际长度/文件签名 → D1 标为 `active`。上传失败尝试删除对象并登记待清理；清理失败进入 `delete_pending` 与退避重试。下载授权摘要有 15 分钟上限，下载流处理完成/取消，并区分到期、次数用完、正在下载等状态；有过期记录及孤儿 R2 对象清理。

适合提取的具体部分：受限流式读取、`safeContentDisposition`、文件签名检查、R2 失败补偿、删除重试及配额原子性。其 `.txt/.csv/.json/.pdf/.png/.jpg/.webp/.gif/.zip/.mp4/...` 广泛格式范围与临时外链分享不适合直接开放给学生。新平台阶段一只收少量 JPEG/PNG，存随机对象键，去除可识别元数据，按学生/老师关系读取；原图不能走公共分享授权 URL。

D1 与 R2 不是同一事务系统，不能用“D1 batch 已成功”推定图片也持久保存或已物理删除。到期停止访问与存储清理应分别可观测；正式运行前必须验证失败重试、无引用对象、账号删除后的数据保留规则。此轮没有连接上游真实 R2 验证。

## 6. 学习事件与掌握度：优先复用候选，但不要直接继承评分结论

证据：[`task26-api.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/functions/_lib/task26-api.mjs)、[`task26-service.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/functions/_lib/task26-service.mjs)、[`task26-mastery.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/functions/_lib/task26-mastery.mjs)、[`task26-catalog.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/functions/_lib/task26-catalog.mjs)、[`0025_adaptive_learning_mastery.sql`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/cloudflare/migrations/0025_adaptive_learning_mastery.sql)。

真实接口包括：`POST /api/learning/adaptive/next`、`POST /api/learning/events`、`GET /api/learning/mastery`、`GET /api/learning/review`、`POST /api/learning/mastery/reconcile`、`POST /api/learning/explanation`。它并非只有前端自报成绩：

- `issueQuestion` 签发不透明题票，D1 保存题目、知识点、课程版本、算法版本、有效期；发给浏览器的题干响应不包含答案。
- `submitLearningEvent` 核查题票属于当前账号，从服务端快照调用 `gradeQuestion`，以 `(user_id,event_id)` 和输入摘要处理幂等，题票只允许一个终结结果；不能反复提交刷分。
- `reconcilePoint` 按服务端事件序列重放，使用投影版本条件更新与回执保存处理并发；学习事件更新被数据库触发器阻止，算法不兼容时拒绝盲目重算。
- `mastery-v1` 会对 20 分钟内相同题目与每日超过 6 次有效证据降权；未达到 6 次有效作答、2 个题族、2 个证据日及跨度至少一天时，分数上限为 79。正确率、作答时长和复习间隔被组合成启发式分数与置信度。
- `task26-api` 的 AI 错因补充只在服务端课程事实基础上生成解释，并校验 rule/example/contrast 与既有内容一致；失败返回明确 fallback，不让 AI 重新判分。这是适合新平台的事实边界。

建议第一批可移植单位：事件幂等/快照/算法版本/重放测试，而非 task26 API 整体。API 同时依赖会员、功能开关、发布渠道、旧 schema 与英语/日语模型，直接复制会引入与当前目标无关的耦合。

新平台当前用逐题事实与样本计数呈现成长，筛查/练习/复测分开。数学规则、初中英语课程标准、教师介入、离线辅导以及“只有一题”的证据强度须重新标定。`mastery-v1` 的数值不是经本次验证的教育测量指标；代码里写“已审核课程事实”也不能替代本机构真实审核记录。上游英语/日语样例不自动获得新平台的已核验状态。

## 7. PWA 与公开资源

上游 `sw.js` 做了较完整的 release 管理：并发数 6、资产超时、先写 staging cache、确认核心 shell 完整与 HTML release 一致后才发布缓存；旧页仍可使用旧版模块，不会随意清空其他应用缓存。导航优先网络，失败回退离线 shell；`/api/` 不缓存。

但除 API 外，同源 GET 会走 `matchingAsset`，不是仅限公开文件的极小白名单。新平台有学生图片、报告和可能的签名路径，必须显式排除这些数据，即使不在 `/api/` 下也不能缓存。第一阶段沿用新平台的公共壳精确白名单，离线只展示壳与提示；不自动补交学生答案。未来离线作答需设计账号隔离、设备丢失、撤销关系、幂等补交和人工确认，不照搬个人词汇软件的本地存储。

上游 `_headers` 包含同源 CSP、nosniff、禁嵌入等；`stage_pages_deploy.mjs` 白名单与私有目录过滤能防止根目录误发布。新平台独立 `public/` 是更简单的边界，仍需检查 public 内意外出现的答案、密钥、报告和第三方文件。

## 8. PDF、打印、公式、图表和字体专项

主要证据：[`js/language/pdf.js`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/js/language/pdf.js)、`app.js` 的 `exportWrongBook`、[`tools.js`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/tools.js) 的 `pdfBytesFromJpegs`/`fileToJpeg`/`images-pdf`/`image-pdf`、[`local-backend/test_task15_pdf_js.mjs`](https://github.com/WYJ0904/thewyj.uk/blob/4fc025a044e5e39d742166df9510d488413f7043/local-backend/test_task15_pdf_js.mjs)。

真实实现不是现成第三方 PDF 库或 `window.print`：错题导出用 1000×1414 Canvas 绘制文字，按 `measureText` 逐字符换行，转 JPEG（质量 0.9），再用自写 PDF 1.4 对象/xref writer 将每页 JPEG 居中放入 A4 的 595×842 点页面。图片 PDF 工具采用类似方式。导出前有空数据检查、按钮等待态，生成后检查 `%PDF` 签名，Blob URL 下载并回收，失败显示错误；无需把错题上传给 PDF 服务。

| 能力 | 真实观察 | 适配决定 |
| --- | --- | --- |
| 隐私与下载 | 浏览器本地生成，带元数据及错误提示 | 借鉴本地处理、禁日志内容、可重试下载；导出仍先检查当前用户可访问的对象 |
| 通用打印 | 主要路径是专用错题 Canvas 导出，未发现这些路径提供全站统一打印注册表 | 新平台统一声明可打印视图，不把当前 DOM 全页无差别截图 |
| 文字与无障碍 | 文字已经栅格化在 JPEG 中 | 不能复制/搜索文本，无结构标签；长讲解/报告优先 HTML 打印或可嵌入字体的成熟 PDF 路线 |
| 中文字体 | `system-ui`、Microsoft YaHei、PingFang 等系统回退栈 | 不需要把系统字体文件从电脑打包发布，但不同设备可能缺字/换行；若嵌入字体，单独选择许可清楚的字体并测试字形 |
| 公式 | 导出函数只有 `fillText`，没有 LaTeX/MathML/KaTeX/MathJax 渲染 | 不能保证分式、根式、上下标和长推导正确；采用单独公式渲染层并等字体准备完成，再进入打印 |
| 图表 | `studyWeekChart` 是页面上的 DOM 图表，未接入专用错题 PDF renderer | 新平台打印模板应显式包含图表与可读数据表；Canvas 图应先转稳定图片或改用 SVG，并测试分页 |
| 上限与截断 | 最大 250 条；safeText 有不同长度上限，drawText 默认再裁到 500 字符 | 不适合任意长课堂材料。超限应明确提示和分页，不能静默丢内容 |
| 分页 | ensureSpace 在换页时创建新 Canvas；当前 drawText 仅在进入循环前设置字体和颜色 | 合成探测已观察跨页后默认字体；若复用，需每次换页恢复样式并进行真实视觉测试 |
| 清晰度 | 1000 像素宽映射 A4，大约 121 dpi | 小字与公式打印可能欠清晰；需真实打印/PDF渲染检查，不能只看文件头 |

因此优先采用新平台的统一 HTML 打印注册表、打印专用 CSS、数据快照和权限判断；将上游的 JPEG PDF writer 仅列为“图片附件合并/离线应急导出”候选。不可把错题本专用输出包装成全站排版能力。若未来复用该 writer，保留授权出处，并增加长文本、分页样式、空图、超大图、字体加载与结构合法性测试。

此专项没有导出用户 PDF 文件或触发打印。上游 PDF 单测使用假的 Canvas 和极小 JPEG 字节，验证的是绘字调用与 PDF 结构，不是有效图像、中文字体、公式或最终页面视觉。

## 9. 第三方代码、素材与字体

| 项目 | 代码证据与已核查结果 | 复用处理 |
| --- | --- | --- |
| qrcode-generator 2.0.4 | `THIRD_PARTY_NOTICES.md`、`vendor/qrcode.js` 的原始 Kazuhiko Arase/MIT 头 | 需要二维码再引入；保留原版权和 MIT 许可声明，不能因为所有者许可就去掉第三方声明 |
| OpenCC 1.4.1 字符词典 | notices 列出两份词典、哈希及 `vendor/opencc-LICENSE.txt`；许可证为 Apache-2.0 | 当前初中闭环不需要；若使用，保留许可证/声明与修改记录，并另查所用具体词典的权利来源 |
| Web 开发依赖 | 固定 `package-lock.json` 有 91 个依赖条目（另有 1 个根项目）；wrangler 4.118.0 标为 MIT OR Apache-2.0，miniflare 为 MIT，workerd 为 Apache-2.0，sharp 为 Apache-2.0 | 这是锁文件声明核查，非逐包法律审计；只保留新平台实际所需开发依赖，不整包复制 node_modules |
| libvips/平台二进制 | 锁文件中 `@img/sharp-libvips-*` 为 LGPL-3.0-or-later，部分 sharp 平台包为 Apache/LGPL/MIT 组合 | 开发机工具依赖与分发到用户的二进制是不同范围；若分发工具链、容器或二进制，需再核对实际包及 LGPL 等要求，不能全标 MIT |
| 字体 | 完整树未发现 `.woff/.woff2/.ttf/.otf/.eot`；已读样式和 PDF 使用系统字体栈 | 不推断操作系统字体可再分发；新平台继续使用系统栈，未来嵌入另选明确许可字体 |
| Aeris 图片/Logo | `assets/brand/asset-manifest.json` 记录来源哈希、裁切和缩放，但没有独立素材授权条款 | “有哈希”不等于“有第三方授权”。新平台使用独立品牌；如要复用原图/标识，核对原始来源与授权范围 |
| 安卓/桌面等非本次模块 | 实际目录存在，但未逐一核查其完整依赖、素材与分发要求 | 不纳入第一阶段复用承诺；准备移动端时另做 SBOM 和许可复核 |

MIT 保留声明要求见 [OSI MIT 正文](https://opensource.org/license/mit)；Apache 分发时保留许可证、相关 notices 并标识修改等要求见 [Apache-2.0 正文](https://www.apache.org/licenses/LICENSE-2.0)。本次没有把上游或第三方代码加入新平台 `public/`、`src/`、`functions/`。

## 10. 实际验证、复用顺序与尚未验证

在新平台目录执行：

```powershell
node --test scripts/experiments/thewyj-audit.mjs
node .local/references/thewyj/local-backend/test_task15_pdf_js.mjs
node scripts/experiments/thewyj-pdf-probe.mjs
```

| 验证 | 实际结果 | 能证明与不能证明 |
| --- | --- | --- |
| 固定源码来源 + 纯函数测试 | 50 文件 Git blob 核验；共 10 项测试通过，0 失败 | 包括随机 token/摘要、正确/错误 secret、缺 pepper 拒绝、单题不宣称掌握、事件幂等、重复题降权、乱序重放、逆时间拒绝、算法版本拒绝；不证明密码学强度或真实学习效果 |
| 上游 PDF 单测 | 输出 `6 pages, 20 objects`，通过 | 验证 xref、页树/对象数、合成绘字内容；fake Canvas/JPEG，不是实际浏览器截图或打印测试 |
| 新增 PDF 限制探测 | 合成 3 页，5 次跨页后的默认 10px 字体绘制；第 12 个长候选答案未被绘出 | 对真实导出源码运行的控制流探测；没有真实字体测量、图像解码、读屏或打印机验收 |
| 生产部署/数据库/R2/AI | 未执行 | 无上线、无真实账号操作、无实际 OCR/AI 质量或成本结论 |

执行环境为 Node 24；实验脚本依赖本机忽略目录的固定参考缓存，不自动下载或运行任意仓库代码。缺失缓存时明确报错。上游 `.js` 没有 package `type` 声明，Node 24 会提示按 ES module 重新解析；未修改上游参考文件以隐藏提示。

建议复用顺序：

1. **当前 MVP**：独立账号/机构/关系权限、版本化 API、审核门禁、真实作答快照、原图核对及公共壳 PWA；继续保留新平台实现，明确引用本报告的设计来源。
2. **小范围代码提取**：优先从 task26 的纯 reducer/事件幂等测试、API 会话所有者保护、R2 删除重试、公开资源白名单中提取最小模块。为每个提取模块记录原文件、固定 SHA、作者授权依据、变更与新增测试，避免带入整套 task 编号和会员依赖。
3. **课堂验证后**：扩展题族与人工审核题库，验证重复练习与间隔复习策略，再决定是否采用经标定的掌握度 reducer；保留算法版本和事实事件以便回放。
4. **发布前**：确认商业/分发授权记录、实际第三方组件清单、真实 D1/R2 故障恢复、多人权限撤销、PWA 升级、PDF/打印视觉与字体验收。原生 App 留到后续独立阶段。
