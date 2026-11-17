# 第八阶段：DeepTutor 接口与隔离候选题（后端已验收，网站待接入）

日期：2026-11-14。最新分工：本线程只负责后端、AI/DeepTutor及隔离题库；网站/发布/Android由新线程在独立release-workspace处理。收到短暂网站/Android安排后仅只读检查，未改动页面/发布配置、未构建APK、未部署；随后已撤回该范围。

## 文件所有权与小型计划

1. 只读核验既有VPS：使用HostodoProxy现有DPAPI与固定SSH主机指纹；只读服务、安装版本、空模型配置及OpenAPI/health，不执行部署脚本或模型请求。历史探测和判分反例保留。
2. 独立后端模块：src/draft-content.mjs、draft-provider.mjs、draft-api.mjs、deeptutor-readonly.mjs；migrations/0005_isolated_drafts.sql。教师本人/本机构私有的合成资料、候选批次及不可变版本；人工复核后仍隔离，绝不写knowledge/questions或学生成绩。
3. 适配器使用固定环境地址、Bearer、超时、限长、显式费用/发送开关、禁止重定向和工具调用；未知/未配置/失败不伪造结果。实际VPS没有模型时不能宣称完整RAG或出题完成。平台内部桥接契约不是假定的DeepTutor官方生成接口。
4. 真实SQLite/D1兼容业务与权限测试、合成HTTP传输替身测试、54题草稿只读转存实验；回放上游判分反例。新增内容的授权JSON/CSV与PDF/打印数据契约及加载器在integrations/drafts交接，不修改public/或他线程页面。

暂定接口：/draft-provider、/draft-sources、/draft-sources/{id}、/question-drafts、/question-drafts/{id}、/question-drafts/generate、/question-drafts/{id}/review、/draft-exports。管理员/学生/家长不能读取教师私有草稿；同机构其他老师也不能读取。所有写入沿用会话、Origin、CSRF、限流与身份头。

主API入口/机器契约将以验证后的后端补丁交接。public、发布配置、Android和platform-ui保持不写；docs/API/VERIFICATION等共有说明的变更集中记录于本文件。跨线程消息工具两次返回AbsolutePathBuf路径错误，未声称消息已送达；网站线程可从本文件和integrations/drafts读取所有权及最终契约。

## 当前核验

已找到并实际用现有严格SSH通道只读连接。VPS后端/前端均running，以deeptutor普通用户运行；仅127.0.0.1:8001/3782监听；ready 200，登录页200，匿名settings 401。安装包1.7.2；OpenAPI info.version为1.0.0，不等于安装发行版本。资料与settings路径真实存在，未修改。

以下为实际结果。任何合成测试通过都不代表模型准确率、真人审题或生产上线。

## 真实 DeepTutor 核验与当前阻碍

- 使用已有DPAPI加密凭据、严格固定的SSH主机指纹，未改凭据存储、VPS网络/安全设置、服务或生产数据。临时回环隧道结束后关闭；不占用网站线程的/opt/junior-learning-trial目录。
- 六个已安装DeepTutor模块均1.7.2；版本出处与既有固定提交60fb3bdf一致。OpenAPI自身版本1.0.0不能当发行包版本。
- 本轮现场读取的services.llm/task/embedding/search及语音/图像/视频profiles全为0。目录其他字段计数不是模型数。已核查的DeepTutor配置未提供可验证的模型/embedding profile；没有测试推理凭据有效性，网页登录凭据不等于模型凭据。
- `src/deeptutor-readonly.mjs`确实通过SSH隧道对已部署服务发出GET /health/ready与GET /openapi.json，得到ready及knowledge路由。mastery HTTP路径未出现；WS是否挂载不能从OpenAPI推定。没有调用preflight、模型测试、上传、索引、问答或出题。
- 真实模型调用0、embedding调用0、真实RAG运行0、上传资料0、付费调用0。此结论只描述本线程；不把其他线程的工作计入本轮。

证据：test-results/stage8/deeptutor-vps-readonly.json与deeptutor-http-adapter.json。前者是现场服务/安装/配置形状，后者是本项目Node只读适配器的实际HTTP结果。原始配置值、认证头、会话及密码不进入结果文件。

重跑既有上游4模块探测：**18/18行为断言通过**，仍复现12345678被误判等于12345679、0.5与1/2被拒、not correct被关键词判对等反例。输出保留于.local/deeptutor-probe-result.json。行为复现不是准确率，未将该判分代码接入正式成绩。

## 已实现的数据和状态

0005只新增draft_sources、question_drafts、draft_versions。资料带不可变文本、版本1、SHA256、来源与许可声明。候选批次保存来源快照、生成来历、当前revision；每次题目修改/复核新增不可变题目版本和账号动作记录。原knowledge/questions及学生作答表不受影响。

手工候选从pending_human开始，逐题复核后为accepted_isolated或rejected；修改后回到pending_human。accepted_isolated的published始终false，没有发布接口，不能拿候选ID创建正式测评。自动结构校验的humanReview始终false；实际账号确认单独记录在review中。自动化测试确认不是真人审题。

生成先保存幂等请求，状态generating，之后pending_human、unavailable或failed。同一requestId/同一意图重放返回原记录；生成中返回202，不发起第二次外部调用；同键不同输入409。201仅表示请求记录创建，不能用HTTP成功码宣称模型已出题。无配置明确NOT_CONFIGURED且questions为空。

只接受老师本人/本机构的原创合成资料，每批1–3题、1–2份资料、4个选项、7–9年级。API不接受studentId、组织覆盖、上游URL/令牌、正式分数或审核状态注入。其他老师（即便绑定同一学生）、管理员、学生、家长不能读取这些草稿。写入沿用真实会话、Origin、CSRF、限流和身份响应头，事务再次检查有效老师账号；并发版本只能一个获胜。

引用校验复用retrieveScoped：来源必须在授权集合中，digest、版本、行号和原文逐字匹配。仅证明原文定位，不证明原文或候选解答正确。导入原型草稿时，来源是其草稿本身，不能称为教材RAG引用或知识验证。

## API与桥接契约

主后端src/api.mjs已接draftRoutes，机器契约更新至**1.6.0、54路径**。独立新增部分为docs/draft-api-contract.json；老API不改变写入结构。docs/API.md和VERIFICATION.md保留原阶段说明，网站线程合并时需增加本文件链接和新版本说明。

| 方法/路径 | 当前行为 |
|---|---|
| GET /draft-provider | 配置可用性，无实际模型探测，不返回地址/密钥 |
| GET/POST /draft-sources | 本人最近100份资料 / 幂等保存原创合成资料 |
| GET /draft-sources/{id} | 不可变文本、来源声明、版本及digest |
| GET/POST /question-drafts | 本人最近100批 / 手工保存1–3道待审候选 |
| GET/PATCH /question-drafts/{id} | 本人详情及题目历史 / revision更新后重新待审 |
| POST /question-drafts/generate | 受控桥接；默认保存明确不可用状态 |
| POST /question-drafts/{id}/review | 每题答案/解析/来源/年级适配核对、说明及明确确认；仍隔离 |
| GET /draft-exports | 四种kind的授权文档、JSON、CSV |

复核请求片段：`{"revision":1,"decision":"accept","note":"已逐题核对候选答案与解析，需要保留来源版本。","confirmed":true,"checks":[{"questionId":"q1","answer":true,"rationale":true,"source":true,"ageAppropriate":true}]}`。响应状态为accepted_isolated、published=false；不是human_reviewed正式题目。

`junior-candidates-v1`是本平台拟定的内部候选桥接协议，**不是DeepTutor官方HTTP出题路由**。现VPS没有部署该桥接，不能把环境地址直接填为官方/ws或虚构POST /generate。真实模型连接仍未集成。

桥接环境示例在integrations/drafts/provider.env.example，未写入.dev.vars或VPS。默认关闭；必须同时明确允许调用、确认无费用条件、配置固定HTTPS/回环端点、Bearer、契约、模型及供应方版本才可请求。请求固定tools=[]、syntheticOnly=true、gradingAllowed=false、maxOutputTokens=2048；12秒总超时（含响应流）、64KiB输出限制、拒绝重定向、无自动重试。响应只允许候选和用量，所有题目仍需结构/来源校验。

桥接自身是否执行模型与禁用工具仍需后续真实服务验证；目前成功传输只用明确contract_fixture本机HTTP替身，记录modelExecution=not_executed_test_fixture。真实桥接将标provider_reported_unverified，不能凭供应方返回值承诺准确率。失败不保存原始异常、认证数据或模型响应正文；未知用量保持null而不是0。

## 题库实际范围

初读原型54题，实施时Antigravity并行更新为**108题/36知识点，1.2.0-draft**。首轮完整导入因超过本轮60题上限明确拒绝，没有写部分内容。随后显式指定`--batches 1,2`，仅转存原两批54题/18点，其余54个ID逐一保存在excludedIds中；未改原型或执行其automatedCheck.expr。

54题经真实平台API写入独立合成账号SQLite，18份资料、18个批次，全部pending_human；教师复核记录0、可证实真人审核0、正式发布0。每题结构与引用定位检查通过，不是答案正确率检查；CC0/原创声明是原型作者声明，未伪造独立版权核验。实际文件位置与原始SHA256见test-results/stage8/draft-bank-audit.json。

普通演示库只读核对仍4点/12题、content_reviews及学习/作业记录0；0005尚未在普通库应用，因此普通库没有这些候选表。启动本地开发服务会按既有迁移器新增空表，不自动导入54题，也不迁移测试账号/审核记录。

## 导出交接和实际测试

四种新增导出kind：draft-sources、draft-source、question-drafts、question-draft。服务端/draft-exports统一校验老师所有权，提供打印blocks、JSON（题目历史）和CSV（当前版本明细及公式注入防护）。未审题答案标“候选答案”，不称“正确答案”。

主public/的25类导出保持原样。本线程提供integrations/drafts/export-registry.js与print-loader.js，合入后才是29类正式入口。网站入口尚未接入，**不能称已有可见按钮或本轮已发布**。

为验证交接加载器，在临时本机服务器以内存覆盖加载器，使用真实API/SQLite及现有print.html/print.js/print.css：桌面1440×1000、手机390×844，共**102项通过，12份实际PDF/16页**。覆盖资料/列表、待审/确认后仍隔离、未配置生成记录；中文、基础分数、长文本分页；所有者、空/失败、停用后打印、旧账号200响应迟到后切账号保护。全部PDF渲染查看。这个试验没有改public，没有用Mock业务成绩，也不等于正式前端导航验收或真机/物理打印。

| 检查 | 结果 |
|---|---|
| 全套Node业务/安全/契约 | **83/83通过**；其中18项新增候选/适配测试 |
| 导出措辞调整后定向业务/契约 | **12/12再通过**，其他业务源码无进一步变化 |
| 本机真实workerd/D1 | **6/6通过**，5个本地迁移成功；不代表线上CPU额度验证 |
| 打印加载器 | **102项、12份PDF/16页**，无真实模型或学生数据 |
| DeepTutor部署HTTP | 实际ready/schema读取成功，模型与embedding请求0 |
| 固定上游模块 | **18/18行为断言**，含已知错误判分反例 |
| 原型草稿转存 | 18批54题保存到隔离库；显式排除54题；无真人审核/发布 |
| 代码/保存检查 | **105个JS/MJS文件通过**；两个交接加载器另通过语法检查；public/27文件哈希不变，旧math tracked diff为空 |

费用：本轮模型、embedding和付费服务调用均0，仅使用既有本机资源与VPS只读连接；没有费用估算或准确率承诺。无新增第三方依赖；DeepTutor原模块探测继续使用已有Apache-2.0参考副本及声明，没有把完整上游/第三方解析器带入平台运行代码。VPS安装依赖许可问题需按其实际锁文件继续单独审查，不能沿用原型“PyMuPDF未安装”的旧说法来证明VPS许可已核验。

本机内存比对现有DPAPI内3个受保护值，对176份源码/文档/本轮文本结果检查，无匹配泄露；没有输出或保存这些值。检查范围与结果见test-results/stage8/secret-audit.json。

## 复跑与合入清单

在独立项目目录（Node24+）：

```powershell
node scripts/check.mjs
node --test tests/*.test.mjs
node scripts/draft-pdf-test.mjs
node scripts/draft-bank-audit.mjs --input C:/Users/Administrator/Desktop/cloudflare-deploy/platform-ui/question-bank/draft-question-bank.json --batches 1,2
```

PDF检查使用打包Python运行scripts/verify-draft-pdfs.py。草稿转存只写新建的.local/draft-bank-labs合成库，不改普通库；脚本拒绝未明确范围的大文件，不自动截断。VPS只读脚本需要已有strict SSH/DPAPI工具目录，不接受明文密码参数；无需再给出或复制密码。

本地workerd单独使用`.local/workerd-stage8-tests`：先对该persist-to执行d1 migrations apply DB --local，再执行seed-pages-local.mjs --isolated-draft-tests，启动pages dev同persist-to，执行workerd-draft-smoke.mjs --isolated-draft-tests。不要指向普通数据或远端。

最终候选合入文件与SHA256在test-results/stage8/closeout.json；网页线程应以该文件核对实际源码再合入，不复制.local、test-results、测试账号或环境凭据。public的27文件相对阶段前快照未变，旧math tracked diff为空，所有未提交成果保留。跨线程联系已通过新的本机网站线程ID成功发送，早期云线程路径错误没有造成源码变更。

## 未完成项和下一步

1. 网站线程接入教师草稿页面、四类可见PDF/打印入口及JSON/CSV，再进行最终页面端到端验收。当前仅后端与加载器可交付，不把新功能强塞入已部署试用站。
2. 模型/embedding配置仍空；没有推理准确率、引用质量、完整RAG或真实生成成功记录。需明确允许的无费用模型条件，再实现并验证VPS私有桥接；不凭登录信息自动购买或调用服务。
3. 原生DeepTutor生成WebSocket/学习模块与当前安装模块的契约需另核验；不能用本轮自有HTTP桥接协议假称官方接口已联调。
4. 生成过程崩溃可能留下generating，当前没有任务队列、恢复/取消或自动重试。调用记录能够保留状态，但不保证供应方推理已停止；未接真实计费供应方。
5. 只有单老师私有草稿与题目版本，没有共享题库、可发布课程、自动难度校准、正式入库或AI评分。后续发布须设计机构课程/版本/撤回和真人逐题审题流程。
6. 网站线程报告其Cloudflare生产密码校验遇CPU额度错误并已回滚维护版本；该问题由发布线程处理，本轮本地workerd通过不能否认它或作为上线批准。
7. 当前候选模块仅有文本资料、选择题和基础分数排版，未新增图形题/附件、复杂LaTeX或图表；不据此取消全站原有图片/图表导出。真机和物理打印未测，按用户最新选择不作为本轮前置条件。
