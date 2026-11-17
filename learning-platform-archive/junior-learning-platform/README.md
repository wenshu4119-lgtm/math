# 智学方舟 · 初中学习平台 MVP

第七阶段已接通 **老师「方案与课后反馈」**：选择真实筛查/学习包、保存方案草稿或批准、从方案布置作业，学生实际提交后逐题人工批改，预览明确公开给家长的摘要。版本冲突保留输入并要求比较；丢失批改响应可读取已保存结果；撤权关闭敏感编辑。API1.5.1仍46路径、25类导出。详情、实测证据与未完成项见 [教师阶段交接](docs/STAGE7-TEACHER-WORKSPACE.md)。

Antigravity原型现已有LiveService和实际业务调用，最新交接及候选模块已只读核对；与本项目参数/辅助函数的差异见 [最新交接对齐](docs/ANTIGRAVITY-HANDOFF-ALIGNMENT.md)。保留原型的并行更新，不把它的测试声明直接计入本平台验收。

第六阶段已接入 Antigravity 的**通关包分步交互**：讲解、知识点切换、记背卡翻面、真实练习/复测入口，以及教师审核和首页“本轮下一步”。翻卡不计掌握度，不写假进度；完整包PDF不受当前标签影响。接口1.5.0，25类导出保留。详见 [本轮整合与旧math边界](docs/STAGE6-ANTIGRAVITY-PACK.md)。

第六阶段时原型仅有会话探针的核查结论已被本阶段的新源码更新；旧测试证据作为历史保留，以顶部最新对齐为准。

第五阶段新增**已审核知识点专项筛查**：只审核一个示例点即可做小范围筛查并走完学习包、练习、复测；未审核点禁选，原本科目全部示例入口保留。报告、清单、成长档案及PDF显示保存的范围和版本，历史数据不倒填。实际内容仍是4点/12题、普通库待真人审核；完整RAG/模型出题未接通。详见 [覆盖盘点与本阶段交接](docs/STAGE5-SCOPED-ASSESSMENTS.md)。

第四阶段已加入**真实独立作业闭环**：老师从已审核练习或通关包建草稿、发布；学生本人提交；负责人逐题人工批改；家长只看授权摘要。发布内容与提交记录冻结，未批改不显示成绩，作业不冒充复测或进步。新增5类PDF/打印（全站25类），JSON/CSV保留。接口为v1.3，详见 [作业阶段交接](docs/STAGE4-HOMEWORK.md)、[API](docs/API.md) 和 [实际验收](docs/VERIFICATION.md)。

已补 [三步闭环与双场景专项验收](docs/PRODUCT-THEME-VERIFICATION.md)：18个桌面/手机状态组合通过，成长页在无配对复测时明确提示尚无进步对比依据。现有导出证据和业务入口保留。

[缺失与真实零分专项](docs/MISSING-EVIDENCE-VERIFICATION.md)未复现补零计算缺陷；API、界面与PDF明确未覆盖不等于0分，新增防回归和12份实际PDF验证。完整业务测试现为54项。

第三阶段新增**真实本机OCR**与教师文字核对、OCR来源追踪和2类导出（全站20类）。完整DeepTutor RAG仍未接通，已做真实有限检索评估，详见 [OCR/RAG阶段交接](docs/STAGE3-OCR-RAG.md) 和 [检索评估](docs/RAG-LOCAL-EVALUATION.md)。本机启用OCR用`node scripts/dev.mjs --ocr`；默认启动仍保留明确不可用和人工录入。

第二阶段已完成：整合 Antigravity 原型设计与真实API；新增人工阅卷、小题部分分、独立能力观察和18类PDF/打印。详见 [本轮交接](docs/STAGE2-HANDOFF.md) 与 [最新验收](docs/VERIFICATION.md)。一期源码备份在 `.local/stage1-before-integration/`。本任务未改写旧math或原型；检测到的原型3文件并行更新已记录并保留。

独立于旧 `math` 的本地项目。原生 HTML/CSS/ES Modules、Cloudflare Pages Functions、D1/R2 适配、PWA。第一阶段数学/英语各 2 个原创示例知识点，共 12 题；不宣称完整课程或经校准的能力测量。没有部署脚本、Git remote 或生产资源 ID。

## 立即启动（Node 24+）

```powershell
cd C:\Users\Administrator\Desktop\junior-learning-platform
node scripts/setup.mjs
node scripts/dev.mjs
```

打开 **http://127.0.0.1:8788**，不要换成 localhost（同源配置必须一致）。这条路径无需安装 npm 依赖，真实本地数据持久化在 `.local/learning.sqlite`，私有图片在 `.local/papers/`。数据库 adapter 使用 SQLite 模拟 D1 调用形式、文件 adapter 模拟 R2；业务代码与 Pages Functions 共用，**不是返回固定结果的 Mock API**。

本机没有 `npm` 命令时也可直接运行以上 Node 命令。若终端找不到 Node，本次运行环境的可执行文件是 `C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`。

`setup` 不覆盖已有账号、成绩或审核状态。随机初始密码只保存在本机已忽略的 `.local/accounts.txt`。账号：`admin`、`teacher`、`student`、`parent`，另有未关联的 `student-b`、`teacher-b` 用于边界验证。不要把这个文件发送到仓库、服务商或聊天。

### 首次走完闭环

1. 以 `teacher` 登录，在「内容审核」实际核对讲解、记背卡、三阶段样题及答案推导，然后逐点确认。**默认没有真人审核记录**；自动测试的模拟审核只存在于隔离测试数据库。
2. 以 `student` 登录，选择数学或英语，完成筛查并匹配今日通关包。
   若只核验了部分知识点，在「按知识点做专项筛查」中勾选已审核点；原「开始能力筛查」仍要求本科目全部示例点已审核。专项不代表完整学科覆盖。
3. 以 `teacher` 登录「方案与课后反馈 → 学习方案」，检查/调整范围及指导语，可先存草稿，再确认批准学习包；原「学习与通关」审核入口保留。
4. 学生阅读材料、完成通关练习，再复测；「成长档案」按实际提交显示。老师也可代录，明确标 `teacher_recorded`。
5. `parent` 只能看关联孩子的成长摘要；`admin` 只管理账号/绑定/脱敏审计，不默认读取学习内容。
6. 老师进入「线下人工阅卷」，新建「卷面实际成绩」或「人工能力观察」，录入逐题/小题、满分与实际分（或0–3档），逐题核对、保存草稿，再整份确认。确认后只读；学生仅看本人已确认报告，家长只看摘要。
7. 启用本机OCR后，学生/老师可上传图片并「开始本机OCR识别」；只有关联老师能确认修订文字，再引用到空的阅卷草稿。仍须手动拆题和录入分值，OCR不评分。
8. 老师在「作业中心」选已审核练习、设置满分并保存草稿，核对后发布。也可从已批准通关包建立独立作业草稿。学生实际提交选择与过程后，负责老师录入逐题分值（允许部分分及0分），填写学生反馈和可选家长摘要，再确认。未批改时不向学生下发答案；家长不读取作答正文。
9. 老师也可在「方案与课后反馈 → 作业与课后反馈」选本人负责的作业，逐题核对、人工给分；「家长公开摘要」只预览本人作业的公开字段。没有学生提交就不能填写批改成绩；没有独立课次/签到或重新批改功能。手机底栏有新入口，「内容审核」在菜单内。

当前机器已具备固定语言文件，运行`node scripts/setup-ocr.mjs`核验。换机器缺文件时可显式`node scripts/setup-ocr.mjs --download-models`下载约6.6MB官方固定版本；运行时不下载模型、不外传图片。引擎目录可用进程环境变量`OCR_ENGINE_DIR`指定本机Tesseract.js 7.0.0包，语言目录可用`OCR_MODEL_DIR`指定。

所有可保存业务内容都提供「导出 PDF」「打印」入口。先进入预览并核对，再打开浏览器系统打印，选择 A4 和「另存为 PDF」或打印机。实际读取受当前权限保护；加载/空内容/失败时不能打印业务数据。不是第三方 PDF 服务，也不会谎称取消打印后文件已保存。[全站导出清单](docs/EXPORT-INVENTORY.md)

## Cloudflare 本地验证

本项目已安装并锁定 Wrangler 4.160.1。新电脑可用 `pnpm install --frozen-lockfile`（或安装相同版本 Wrangler）。以下命令全为本地，**不要增加 --remote，也不要在旧 math 目录执行**。Node 本地服务和 Wrangler 使用相同端口，先停止其中一个。

```powershell
node scripts/setup.mjs
node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local
node scripts/seed-pages-local.mjs
node node_modules/wrangler/bin/wrangler.js pages dev public --ip 127.0.0.1 --port 8788
```

`seed-pages-local` 仅把本机初始化的组织/账号/关系和原创样题写入本地 Wrangler，不复制审核、成绩或上传。两个开发模式的数据互相独立，不能把 Node 模式已审核状态误认为 Wrangler 已审核。

在另一个终端运行 `node scripts/workerd-smoke.mjs` 可验证真实 workerd 的 scrypt、D1 会话、私有 R2 上传/读取/删除和不可用 OCR。合成测试图片会删除；仅本机留下对应脱敏审计记录。

## 测试

```powershell
node scripts/check.mjs
node --test tests/*.test.mjs
node scripts/ui-integration-test.mjs
node scripts/paper-ui-test.mjs
node scripts/homework-ui-test.mjs
node scripts/homework-view-race-test.mjs
node scripts/homework-pdf-test.mjs
node scripts/coverage-audit.mjs
node scripts/scoped-learning-browser-test.mjs
node scripts/pack-workspace-browser-test.mjs
node scripts/pack-view-boundary-test.mjs
node scripts/teacher-workspace-browser-test.mjs
node scripts/teacher-view-boundary-test.mjs
node scripts/teacher-export-boundary-test.mjs
node scripts/session-race-test.mjs
node scripts/experiments/ocr-local-evaluation.mjs
node scripts/ocr-runtime-safety-test.mjs
node scripts/ocr-ui-test.mjs
node scripts/experiments/rag-local-evaluation.mjs
node scripts/experiments/math-inventory.mjs
node scripts/experiments/thewyj-audit.mjs
node scripts/experiments/thewyj-pdf-probe.mjs
node scripts/experiments/deeptutor-probe.mjs
```

参考项目实验需要 `.local/references/` 中的固定版本研究缓存。DeepTutor 脚本可加 `--fetch` 获取固定提交的限定源码和许可证；它不是完整 DeepTutor 安装程序。thewyj 实验要求保留已核验缓存，无缓存会明确失败。

浏览器/PDF 验证：`node scripts/browser-pdf-test.mjs`。默认使用本机 Chrome 与 Codex 打包的 Playwright；其他机器通过 `PLAYWRIGHT_MODULE` 和 `CHROME_EXECUTABLE` 指定绝对路径。脚本在随机回环端口建立隔离 SQLite 实例，不写入你的演示账号数据。生成文件在 `test-results/pdf/`。

主题专项：`node scripts/product-theme-test.mjs`。需要保留第四阶段两组PDF验收文件，脚本只核对其数量/页数/哈希，不重新生成；截图与结果在`test-results/product-theme/`。

PDF 文本/版式检查：用带 `pdfplumber`、`pypdf`、`Pillow` 的 Python 执行 `scripts/verify-pdfs.py`，PATH 需包含 Poppler `pdftoppm`。本机使用：

```powershell
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' scripts/verify-pdfs.py
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' scripts/verify-homework-pdfs.py
```

依赖检查与浏览器测试均有真实运行记录，见 [验证报告](docs/VERIFICATION.md)。物理手机、打印机及全套 DeepTutor RAG/模型生成尚未验证。

## 项目结构与协作

```text
public/          原生前端、PWA、统一PDF/打印预览（唯一静态发布目录）
functions/api/   Pages Functions 入口
src/             身份/权限、学习状态机、样题、私有上传
migrations/      D1/SQLite 数据库迁移
scripts/         本地启动/初始化/清理、契约生成、源码研究、浏览器/PDF验证
tests/           实际业务、安全与样题测试
docs/            架构、OpenAPI、迁移、授权评估、导出清单及验收
.local/          忽略的账号、密钥相关初始化、数据库、私有图片、研究缓存
test-results/    忽略的自动化证据；不是真实学生档案
```

本任务没有改写`cloudflare-deploy/platform-ui/`；并行更新详见 [差异记录](docs/CONCURRENT-PROTOTYPE-UPDATE.md)。它仍是带Mock的前端预览，独立平台已按 [真实契约](docs/API.md) 接入；不能把原型答案、分数或`_isMock:false`当服务器证据。

账号、作答、上传和接口独立实现；具体设计参考thewyj.uk。第二阶段直接沿用用户原型的3份CSS，业务逻辑接入真实服务端，没有加载Mock或localStorage数据层。DeepTutor只完成真实纯模块最小对接。详见 [架构](docs/ARCHITECTURE.md)、[thewyj审计](docs/THEWYJ-AUDIT.md)、[DeepTutor审计](docs/DEEPTUTOR-AUDIT.md)、[math迁移评估](docs/MATH-MIGRATION.md)。

## 当前限制

- Node本机OCR已实现，需`--ocr`启用；Cloudflare未绑定OCR时仍503。识别限印刷文字，公式/题号等须教师核对，没有自动拆题/评分。完整DeepTutor RAG/AI出题、历史迁移、71点目录和试卷自动匹配学习包未实现。
- 已确认阅卷只读，更正/作废审批未实现。每份最多60个叶子条目，最多两位小数；0–3观察不换算成卷面分数。
- 样题虽有推导与自动核验，仍需真人教师审核。没有全学科题库、公开注册/短信找回、支付或原生 App。独立作业已实现单学生/单负责人流程，批量布置、转交、重新批改和附件提交尚未实现。
- 图片访问24小时到期，但物理文件清理需手动 `node scripts/cleanup-local.mjs`；只清理 Node 模式本地数据。正式 R2 需另设生命周期/可靠重试清理，尚未部署。
- PDF 适用于当前示例（中文、基础分数/等式、SVG图表、JPEG/PNG）；没有通用 LaTeX 解析器。复杂根式/矩阵/几何公式、超长单题、真机打印和浏览器差异需要新增样本验证。
- 当前分页读取有上限（清单100、图片30、后台200/审计100）；导出明确标明范围，不是假装全量。机构规模扩大前需游标分页和批量导出。
- 所有服务只做本机验证，没有部署、推送、生产迁移。旧 math 的 pre-push 会部署正式站点，不要借用其 Git/脚本操作新平台。
