# 旧 math 与 Antigravity 前端：源码核查和迁移方案

2026-11-14补充：本轮只读执行当前旧app.js四个纯范围函数，合成12点单章实际覆盖9点、16章实际覆盖15章；合成cap8多科测试丢失后续科目。生成物无题干/答案，score=3和难度是人工核查/位置启发式，不能作为客观试题成绩迁入；实际覆盖必须以返回条目为准。新平台显式21点整体拒绝、20点无遗漏，测试占位不算课程。详见STAGE6-ANTIGRAVITY-PACK与test-results/stage6/legacy-cap-audit.json。旧网站、原型及真实历史均未修改。

> 本文是迁移前只读评估。第二阶段已完成其中界面对接及结构化人工阅卷的限定实现，见STAGE2-HANDOFF、API1.1和VERIFICATION；本文原计划/未实现描述作为研究沿革保留，不代表当前代码状态。

核查日期：2026-11-13（Asia/Shanghai）。这份评估基于本地实际代码和离线执行结果；没有访问旧网站、调用真实识图模型、查询生产数据或执行部署。

## 1. 保留边界与证据版本

- 旧仓库：`C:/Users/Administrator/Desktop/cloudflare-deploy`，分支 `main`，HEAD `e56614db680fa83ac68210bec69f8d164e7c8fd0`。
- 旧源码的固定版本入口：[app.js](https://github.com/wenshu4119-lgtm/math/blob/e56614db680fa83ac68210bec69f8d164e7c8fd0/app.js)、[index.html](https://github.com/wenshu4119-lgtm/math/blob/e56614db680fa83ac68210bec69f8d164e7c8fd0/index.html)、[paper-worker.mjs](https://github.com/wenshu4119-lgtm/math/blob/e56614db680fa83ac68210bec69f8d164e7c8fd0/paper-worker.mjs)。以下旧源码行号按此版本。
- 主任务开始时工作区干净；研究期间出现未跟踪的 `platform-ui/`。复核时 `git status --short --branch` 为 `## main`、`?? platform-ui/`，已跟踪文件没有修改。该前端属于并行产生的成果，不能删掉、覆盖或视作垃圾。
- `.githooks/pre-push` 会执行 `npx --yes wrangler@4 deploy`，当前 `core.hooksPath=.githooks`。旧 Wrangler 的静态资源目录是仓库根目录；`platform-ui/` 也在这个范围内。今后任何旧站发布前都需检查发布资产列表。本次没有推送或触发钩子，也没有修改忽略文件。
- 未读取旧 `.dev.vars`，未取生产凭据、R2 对象或 Cloudflare 日志。新平台放在独立同级目录，不能把独立平台目录嵌入旧站的根目录发布范围。
- 本次只新增此文档，并补充新平台的 `scripts/experiments/math-inventory.mjs`。没有复制旧应用到新平台运行目录。

## 2. 已有成果是什么

### 2.1 目录和实际知识目录

旧应用为静态 HTML/CSS/JS 加一个 Cloudflare Worker。`index.html:414` 的内联 `window.SYS_CONFIG` 是知识目录与考试场景的数据源，配置版本为 4。

| 科目 | 学期模块 | 章节 | 知识点 | 单科预设 |
| --- | ---: | ---: | ---: | ---: |
| 数学 | 6 | 25 | 71 | 7 |
| 物理 | 3 | 21 | 59 | 4 |
| 化学 | 2 | 12 | 29 | 2 |

还有 2 个跨科目预设，合计 15 个预设。**旧配置没有英语。** 物理、化学目录可以归档保留，第一阶段不要冒充已支持课程。

`modules[subject][module].children[chapter].kps[point]` 存放名称与层级，没有每个知识点对应的讲义、记背卡、真实题干、标准答案、解析、人工审核记录或教材版次证据。71 个数学知识点是有价值的目录种子，但不是 71 个已验收教学单元。

### 2.2 关键文件和函数

| 证据位置 | 真实功能 | 可继承方式与边界 |
| --- | --- | --- |
| `app.js:93–152`，`modSemesterOf`、`availableGrades`、`needSemester`、`candidateMods`、`chapterEntries` | 科目、年级、学期筛选；九年级物理全一册时跳过学期选择 | 提取为纯范围选择模块；新目录使用明确的学期字段，不长期依赖 `8shang` 这类字符串推断 |
| `app.js:245–352`，预设渲染和 `applyPreset` | 考试场景预设；确认范围后生成核查行 | 继承场景选择交互和预设清单，教材适配与覆盖率需老师审核 |
| `app.js:449–580`，`renderTree`、`fillKps`、`commitRange` | 章节/知识点两级勾选 | 适合作为筛查范围选择 UI；后端仍需校验选中范围及权限 |
| `app.js:174–228`，`buildQuestionsForEntry`、`buildAllQuestions` | 生成带知识点标签、难度和 3 分上限的人工核查槽 | **不是出真实题。** 新平台用审核题库组卷；旧算法只能作人工观察量表的参考，不能伪装成客观测验 |
| `app.js:585–679`，`readStudent`、`renderForm`、`updateProgress` | 可选姓名/年级/学校；逐项点选 0、1、2、3 后生成报告 | 保留完成度检查；新平台改用账号随机 ID/别名，不迁入姓名、学校等非必要字段 |
| `app.js:704–754`，`paperCatalog`、`paperFindScope` | 知识目录扁平化及范围匹配 | 可提取候选匹配逻辑；章节级标签不可强行落为某个知识点，见实测问题 |
| `app.js:800–909`，`paperNewRow`、`paperChanged`、`paperPoints`、`paperReady` | 手工建表、部分分、进度、改动后撤销复核确认 | 是线下辅导的重要成果；需搬到服务端状态机和审核记录，保留逐行人工核对 |
| `app.js:916–1009`，提示词复制、`paperImport` | 外部 JSON 导入，最多 120 小题；不接受 AI 判分；错误时保留原表 | 值得复用的产品能力；新平台需要严格 schema、来源、行 ID、版本及幂等校验 |
| `app.js:1012–1092`，`paperPhoto`、`paperServiceStatus`、`paperAnalyze` | 本地照片预览、用户确认、缩图、同源接口、取消/超时、revision 防止覆盖新编辑 | 继承交互原则。旧最大选图 15 MiB、发送前最长边 2000 像素；新上传限制需统一，不照搬整段全局 DOM 代码 |
| `paper-worker.mjs:45–86`，`decodeImage`、`normalizeResult` | JPEG/PNG 签名和体积检查；结构化结果白名单；丢弃模型答案与分数 | 可提取为有版本的 OCR 适配器；旧检查不等于完整图片解码/元信息清理；新平台的上传策略应继续更严格 |
| `paper-worker.mjs:88–109`，`promptFromAssets` | 从静态 HTML 读取知识目录组成提示词 | 提示词约束可保留；从 D1 的审核目录读取，不再解析运行时 HTML |
| `paper-worker.mjs:112–183`，Worker `fetch` | 状态查询、访问码、Origin、限流、模型调用、明确失败 | 替换共享访问码为新平台会话、对象归属鉴权和按机构/用户配额；模型调用单独封装 |
| `app.js:1094–1130`，`paperToReport` | 手工复核后把试卷逐题分值映射到报告引擎 | 分清卷面实得分与等权指标，不能把等权指标记为考试成绩 |
| `app.js:1134–1419`，`calcReport`、图表、薄弱模块/失分/提升计划 | 按章节、题型、难度聚合；规则建议与雷达/条形图 | 计算逻辑可抽离成纯模块；建议改为教师可审核的学习包素材，去除未经验证的能力分层结论 |
| `app.js:1422–1444`，`renderStudio` | 工作室展示；系统分享标题和简短文字，不传完整报告 | 新平台不要自动复制工作室联系方式；原功能不是 PDF 或完整报告导出 |

### 2.3 真实识卷功能的边界

旧 Worker 的模型字符串为 `@cf/mistralai/mistral-small-3.1-24b-instruct`。是否可用要求环境中的启用开关、访问码、AI 和限流绑定同时满足；这次没有读取实际绑定，也没有调用模型，所以**不能把源码中的调用路径表述为已验证识图可用、已授权该模型或已知准确率**。

其输入是 `{image: dataURL, consent:true}`；输出核心是：

```json
{
  "exam": "示例卷名",
  "questions": [{
    "no": "21(1)",
    "subject": "math",
    "scope": "知识点名称或待确认文本",
    "qtype": "证明",
    "diff": "待确认",
    "maxScore": null,
    "evidence": "短题干摘录"
  }],
  "needsReview": true,
  "source": "ai-structure-only"
}
```

这个接口抽取的是**试卷结构**，没有完整题干和全部选项的正式题库契约；不读取或自动判定学生手写答案。`normalizeResult` 明确丢弃模型提交的 `score`、`correct`、`answer`。结构表必须人工确认科目/范围、难度、满分、对错或部分分后才进入报告。新平台仍应保持“识别、内容审核、教师判分、学生真实作答”四种不同事实。

旧端点主体上限 3 MiB，单图上限 2 MiB，模型调用超时 150 秒；前端等待 75 秒后取消。前端取消不保证云端推理任务已终止，已有提示用量可能计入。上线对接需加入任务状态、终止语义和预算，不把请求 Abort 当成计费撤销。

## 3. 本地实际执行结果

在新平台目录运行：

```powershell
node scripts/experiments/math-inventory.mjs 'C:/Users/Administrator/Desktop/cloudflare-deploy'
```

脚本用 `git show HEAD:app.js`、`git show HEAD:index.html` 读取固定源码，在隔离 VM 内执行纯函数；Worker 只测试未启用、异源、未授权等提前返回路径。测试绑定含拒绝调用 AI 的假对象；没有网络请求、真人数据和数据库写入。原 Worker 当前工作文件无已跟踪修改，故与上述 HEAD 一致。

| 核验 | 观察结果 | 含义 |
| --- | --- | --- |
| 目录计数 | 数学 6/25/71；物理 3/21/59；化学 2/12/29；预设 15 | 目录可作为课程映射起点，不代表题库完成度 |
| 数学全范围核查行 | 45 行，仅 15/25 章节、39/71 知识点；无题干、无答案字段 | `acc.slice(0,target)` 会截掉后部章节，不能宣称“全知识点覆盖”；新组卷要返回实际覆盖率和未覆盖清单 |
| 范围“全等三角形” | 落到 `math|8shang|quandeng|xingzhi`，名称为“全等的性质与判定(SSS/SAS)” | 章级信息被错误精确化为第一个知识点；应输出 chapter match、候选项或 unresolved |
| 报告合成样本 | 两项满分 4、6，人工给分 3、3 → 6/10=60%；基础 75%、中档 50% | 实际执行了原计算函数；仅为合成测试，不是学生成绩 |
| OCR 归一化 | 模型 `score/answer/correct` 被剥离；重复题号、空题数组被拒绝 | 可以继承这条“不信任模型判分”的契约 |
| Worker 未启用 / 异源 / 未授权 | 分别返回 503 / 403 / 401 | 本地提前拒绝路径通过；未测真实 Cloudflare 模型或生产绑定 |
| 旧应用持久化 | `app.js` 无 localStorage/sessionStorage；无学习记录服务端写入 | 原 `STATE` 是内存状态。不能从仓库推导历史学生档案；已有截图/外部文件需人工提供并单独审核 |
| 预览前端纯计算 | 人工档位 2、满分 3：旧 `paperPoints` 为 2，新预览为 2.16 | Antigravity `judgeRatio(2)=0.72` 与旧线性 `2/3` 不同；必须统一含义，不能悄悄换算考试分数 |
| 预览来源保真 | 给预览 helper 传 `_isMock:true, reviewed:false` 的合成行，输出报告 `_isMock:false` | UI 外层有复核门禁，但计算函数不保留来源/审核事实；不能将前端标志作为后端可信证据 |

脚本目前对已检查的源码形状使用定向提取，不是通用 JS AST 工具；原函数或配置格式变化后需更新提取与断言。它不启动旧 UI，未覆盖浏览器可访问性、图表排版或线上行为。

## 4. 应迁入什么数据，怎样保留来源

| 旧数据 | 迁移目标（建议） | 规则 |
| --- | --- | --- |
| 学期模块/章节/知识点 | `curriculum_nodes` 与稳定新 ID；`legacy_key_map` 保留 `subject|module|chapter|point` | 数学优先。保存来源仓库、提交 SHA、配置版本和原名。待教研核查教材版次与年级顺序；不是直接标为已审核题目 |
| 科目/考试预设 | `assessment_blueprints` | 记录可选范围、抽样策略、覆盖率；数学满分 120 等地区配置仅作有出处的场景参数，不能泛化所有学校 |
| 0–3 核查槽和人工评分 | 单独 `teacher_observations` 或导入候选档案 | 标为人工量表，不转成学生答对/答错；必须有操作者、时间和来源，旧内存记录若无证据不补造历史 |
| OCR 结构 JSON | `paper_assessments` / `paper_items` 的 draft | 题号唯一、分值有界；`scope` 保留原文；匹配层级和置信来源独立保存；全部从未审核状态进入 |
| 原卷照片 | 新平台私有上传引用 | 先遮挡个人信息，限制文件类型/大小/尺寸，去除非必要元信息；24 小时访问期及清理任务由新平台控制；不复制旧站密钥 |
| 人工实得分 | `paper_item_reviews` 或版本化评分事件 | 仅有效绑定老师确认。真实满分已知时保存原始分值；未知时保存观察量表，禁止伪装为卷面成绩 |
| 报告汇总/建议 | 服务端重新计算的 report snapshot / 教师草稿包 | 以可追溯明细重新算，不信任浏览器提交的总分、薄弱点或能力等级 |
| 工作室名片 | 新平台机构设置的可选配置 | 不自动迁入旧姓名、电话、微信、地址或头像等资料 |

当前新平台的 SQL 和 API 还没有上述完整目录层级、旧卷逐行记录或量表导入表；这些是**迁移设计，不是已经执行的数据迁移**。当前样题保留为隔离的小范围闭环，避免把 71 个目录名称展示为已覆盖 71 个知识点。

## 5. Antigravity `platform-ui/` 保留与对接

该目录在本次核查时有 12 个文件，合计 386,422 字节；它仍可能被另一工具继续编辑，数字只代表核查快照。没有 package.json、后端、真实鉴权或 fetch 调用（已检查 `services/dataService.js` 与 `js/app.js`）。

已有前端成果包括四角色导航、范围筛查、公式呈现、拍照预览/缩放、人工逐题复核、讲解/记背/练习页、复测、图表、家长与教师视图、Loading/Empty/Error/Retry 状态。`utils/samplePaperGen.js` 在浏览器生成演示卷图，`utils/mathRenderer.js` 为本地有限公式渲染器；它们可保留作 UI 和验收工具，不需要重写成另一套设计。

`services/dataService.js` 的 localStorage 键是 `edu_platform_ui_preview_v1`，保存角色切换、照片 data URL、答案、卡片状态、本地记录等。`mock/mockData.js` 包含演示题、学习包、假 OCR、班级/家长历史与管理概览。页面已提供 Mock 标签，这一点应保留。**“实际点过按钮并保存本地”不等于“已认证、已审核、已写入服务端的真实学情”。** 不应将整个 localStorage 直接上传或将示例历史自动导入成长档案。

| 现有前端切入点 | 新平台对接契约 | 必须调整 |
| --- | --- | --- |
| `setRole`、`state.role`、角色切换器 | `POST /api/v1/auth/login`、`GET /auth/session`、`POST /auth/logout` | 实际角色由 session 返回；演示角色切换只可在显式预览模式使用，不授予权限 |
| 学生/老师/家长“名单” | `GET /api/v1/students` | 仅显示服务端允许访问的学生；家长不可拉逐题作答或原图 |
| `MockData` 知识点/题库 | `GET /api/v1/knowledge?subject=math`、`POST /attempts` | 前端得到服务端下发题目；提交前不能从静态 assets 取得标准答案；未审核内容阻止出题 |
| `computeQuizReport` | `POST /api/v1/attempts/{id}/submit`，提交 `questionId, selectedOption` | 不提交总分、correct、role 等派生字段；读取提交响应的服务端结果 |
| 今日学习包和 `calcPackCompletion` | `POST /api/v1/packs`、`GET /packs/{id}`、教师 `PATCH /packs/{id}` | 先匹配已审核素材，再审核/调整范围。卡片“已掌握”只是自我标记，不替代复测证据 |
| `simulateMockPaperOcr`、预览表格 | 现有 `/api/v1/uploads`、`/{id}/recognize`、`/{id}/review`；完整逐题结构用后续 paper 契约 | 当前 recognize 返回 503 OCR_UNAVAILABLE；不得悄悄回落 Mock 并标真实。当前 review 只存核对文本，逐题结构与分值尚未实现 |
| `localArchiveRecords + MOCK_ARCHIVE_HISTORY` | `GET /api/v1/students/{id}/growth` | 只展示返回的真实作答；演示曲线放独立区，不能和成长曲线拼接计算增幅 |
| 教师审核队列/派发/管理员概览 | 内容 review、pack revision、admin users/relationships API | 使用操作者 ID、版本冲突和服务端授权；原 Fake 名单/状态不能当真实账号或审批记录 |

上表略写路径均沿用 `/api/v1` 前缀；精确请求字段以主项目 `docs/API.md` 和 `docs/openapi.json` 为准。此评估没有修改 `platform-ui` 来替另一开发者提交更改。

建议新增一个可替换的远程 service adapter，保持页面组件和样式；Mock adapter 显式保留用于演示，live 模式只使用真实 API。API 失败必须显示 error/retry，不能调用 `simulateMockPaperOcr`、填默认 74% 或混入演示基线补齐画面。

需要单独修正的前端契约：

1. 把 `sourceType` / `_isMock` 拆成内容来源、OCR 服务状态、人工审核状态、判分来源、记录可信度；这是服务端记录的事实，不由前端任意声明。
2. 对真正的实得分使用原始分数。0–3 人工量表保存原档位，不能用 0.35/0.72 等无校准系数冒充卷面部分分。
3. 按 `revision` 提交审核，409 后重新拉取；编辑任一题干/知识点/分值后撤销该行与整卷确认。
4. 不将登录 token、学生照片或成绩持久存入 localStorage；PWA 只缓存公共 shell。
5. 公式渲染器是有限语法工具，需测试转义、恶意 HTML、根式/分式嵌套、键盘与屏幕阅读，不宣称等同完整 LaTeX。

## 6. 分阶段迁移顺序与验收

### 阶段 A：保留与对接底座（本轮）

- 保留旧仓库、线上地址、Antigravity 未提交成果；新仓库无部署链接。
- 新平台先提供真实账号/关系、微型审核题库、筛查→匹配→审核→练习→复测→成长的接口和验收页面。
- 旧代码只读盘点脚本已实际运行；不自动迁移真人历史。OCR 未接通时明确不可用，支持私有上传和人工文本核对。
- 验收：旧已跟踪文件 diff 为空，新的 platform-ui 保持；API 契约和模拟边界文档齐全；核心权限/闭环测试由主项目执行。

### 阶段 B：继承目录与 Antigravity UI

- 导出 71 个数学知识点为待教研审校目录；保存 `legacy_key`、配置版本与来源 SHA，设计英语独立目录。
- 修复全范围抽样的顺序截断：先保证章节或知识点覆盖，再分配题数；超过题数预算必须告知未覆盖内容。
- 接通可替换 data service；移除 live 模式角色切换、客户端答案、默认学情与 Mock 回落。
- 验收：稳定 ID 映射无冲突；缺失题库不出伪题；两套界面针对相同 API 事件得到相同真实结果；跨学生/跨组织/撤销关系测试通过。

### 阶段 C：结构化人工阅卷与旧报告

- 先把 `paperImport`、`paperReady`、`paperPoints` 的规则转成后端纯校验，再开放逐行人工核对；不先依赖 AI。
- 添加 paper draft/item/review 的迁移及 API（建议 `/api/v1/papers`、`/{id}/items`、`/{id}/confirm`、`/{id}/report`，**尚未实现，不供前端现阶段调用**）。
- `scope` 允许 chapter/unresolved；只有人工确认后进入指定知识点统计。保留原始 OCR 文本和后续修订者，但按最小化原则设置保存期限。
- 按真实分值与等权观察两种口径分别出报表；报告显示样本量、来源、时间、口径、算法版本和局限。不要以极少样题冠以“顶尖层/补漏层”等定论。
- 验收：旧黄金样本聚合一致；混合未知满分不可冒充原始分；空/重复/超范围分/错误层级被拒绝；并发审核和重复确认只产生一次有效事件。

### 阶段 D：按机构小范围接入真实识卷

- 从旧 Worker 提取 provider adapter、结果 schema 和 fail-closed 原则；新会话鉴权、绑定关系、私有对象、任务状态、机构额度接管旧共享访问码。
- 明确支持数学/英语，旧 `SUBJECTS` 和提示词没有英语，必须扩充并用英语卷专门验证；图中文字不作为系统指令。
- 用授权且去标识的小样本比较：题号/分值识别、知识点候选覆盖、不可识别率、人工修正时间、误接收率、延迟与实际费用。没有模型密钥或有效绑定时暂停该实验，不公布准确率。
- 验收：provider 超时/限额/许可错误返回真实失败；取消不覆盖人工编辑；AI 输出从不自动写入学生正确率或已审核题库。

### 阶段 E：历史导入与课程扩展

- 只导入能验证来源的人工记录/试卷，不从代码或模拟历史生成学生成长。
- 备份/脱敏/预览差异/教师确认/幂等提交/可撤销批次分开实施；维护原始观测与新测验的类型，不拼接成虚假的长期能力趋势。
- 数学和英语验证成熟后，再考虑原目录中的物理、化学；不以有目录名等同已提供课程。

## 7. 许可证、真实能力和待确认事项

- 本地 math 根目录未见独立 LICENSE/NOTICE 文件。它是用户现有成果，按本次任务授权做迁移评估；公开再分发前仍应确认题目、品牌、联系资料等内容权属，不把“仓库在手”当成第三方内容自动授权。
- `chart.min.js` 和 `platform-ui/vendor/chart.min.js` 的实际文件头声明 **Chart.js v4.4.1 / MIT**，署名为 Chart.js Contributors。未来复用时保留完整许可和声明，最好通过锁定版本包补齐许可证，不只留下压缩文件头。
- 所查 CSS 引用系统字体，未发现 `@font-face`、字体远程导入或打包字体；不是对整个电脑字体、未来素材或参考项目资产的一揽子许可结论。
- 旧识图模型的供应商许可、可用额度和真实效果没有验证；任务未读取凭据，也没有调用生产服务。
- 本轮已验证的是目录盘点、真实纯函数输出、OCR 结果过滤/错误提前返回，以及预览来源/评分差异。真正的三方后端集成、真人题目审核、旧站历史数据迁移、Cloudflare 上线和完整浏览器体验不在此实验已完成范围。

可以直接保留的价值是：原范围选择经验、数学目录、人工复核工作流、部分分与多口径报告、图表布局和 Antigravity UI。需要新增或重构的是：真实题库与审核、英语课程、服务端身份/授权、不可篡改作答、课程/题目版本、对象存储、证据来源、教学包状态机和长期成长档案。
