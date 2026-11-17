# 第六阶段：Antigravity 通关包交互接入

日期：2026-11-14。继续当前学习平台任务，未另开或重复启动项目。实际路由、session/CSRF/X-Actor-Id、API1.4与当前源代码均已读取，不能用旧报告代替本轮现状。

## 保存基线和当前盘点

独立平台全体文件仍为未提交成果；源码快照保留在.local/stage5-before-antigravity-pack。旧math HEAD与tracked diff、保存时platform-ui所有文件哈希在test-results/stage6/preservation-baseline.json。首次读取原型app.js时为116157字节、2026-11-13 20:16:03；后续出现并行更新，不能把这次读取视为最终版本。layout.css与components.css仍保留原版本。本轮只读，不覆盖任何并行成果。

收尾检测到HANDOFF-TO-CODEX.md、index.html、js/app.js、mock/mockData.js、services/dataService.js共5个文件相对保存基线变化。最新只读核对app.js为161793字节，交接文件17203字节（2026-11-14 12:01:27，Asia/Shanghai），已包含同源会话探针和更多模拟状态。其余业务仍是原型演示。旧math tracked diff与HEAD未变化；检查明确非零退出并写入preservation-result.json，不改写基线或回滚对方成果。实际契约差异和后续对接说明见ANTIGRAVITY-HANDOFF-ALIGNMENT。

| 原型设计 / 实际文件 | 当前整合状态 | 本轮处理 |
|---|---|---|
| tokens/layout/components的外壳、导航、双场景、三步条 | 独立平台已使用锁定CSS和真实会话/数据，不能算本轮新建 | 保留，不整包替换为最新原型代码 |
| js/app.js renderMasteryPack、renderPackExplain、renderPackFlashcards | 原型有知识点切换、标签页、翻卡；live仍是平铺讲解/记背文本 | 选择该小型切片，使用现有pack/attempt API独立实现交互 |
| 原型readExplanations/flashcardStatus/calcPackCompletion | 由本地状态算完成百分比，不是服务端学习证据 | 不迁入；翻卡和标签切换只为阅读，不记已掌握/成绩 |
| 原型renderPackPractice/本地判分 | 当前live已有真实问答提交页和服务器评分 | 调用既有作答流程，不重写客户端评分 |
| 原型教师审核/Mock队列、家长基线 | live已有真实内容审核、包调整、人工阅卷、作业和摘要 | 保留真实接口；本轮加强包内审核/复测衔接 |
| 原型模拟OCR、0–3映射、启发式难度、课堂统计/雷达 | 不能当真实识别或验证过的成绩 | 不搬入；旧math题量覆盖另做只读合成实验 |
| 原型全课程筛选、主题切换、课堂/历史演示 | 尚未完整接入，现有真内容仍4点/12题 | 继续明确边界，不用占位数据填充 |

## 选定切片和短计划

真实学生登录 → 当前轮筛查/匹配 → 老师审核调整包 → 学生按讲解/记背/练习入口学习 → 实际提交与复测 → 成长记录。线上自学和线下教师代录入口保留。

计划新增public/pack-workspace.js，复用原型的tabs/chip/flashcard设计和既有安全DOM工具；app.js仅接入入口与本轮下一步。新模块读取最新已授权pack/attempts，教师PATCH沿用revision与审核要求；不信任调用方传入的旧DTO。异步结果须检查当前账号、学生和视图，失败不能回落模拟数据。

讲解/翻卡的浏览状态不持久化，不伪装已掌握。保存内容仍是原有pack/attempt/growth及教师指导，均走现有25类导出清单；完整包导出包括讲解和记背卡，不受当前标签/翻面影响。JSON/CSV原能力须实测保留。无新评分算法、付费服务或生产操作。

验收：隔离真实API持久化、教师审核拒绝、学生/家长/机构与跨账号隔离、无包/错误/断网与结果不确定、桌面/手机、A4分页和导出权限；旧math合成章节/知识点超过题量上限时记录实际覆盖，不把旧核查槽、人工0–3或难度标签当经验证试题。

上述为实施前约定。以下为实际完成结果，不把计划或原型Mock算作实现。

## 已完成的端到端切片

1. 首页保留三步条与线上/线下双场景，新增当前科目「本轮下一步」：按真实最新筛查状态继续作答、匹配包、等待/进入审核、继续学习或查看已提交复测记录。
2. 今日通关包采用原型的知识点chips、讲解/记背/练习标签和翻卡设计。内容来自最新授权pack，讲解、记背、教师指导均为已保存材料。Enter/空格翻卡，标签可用方向键；这些阅读状态不持久化，不生成掌握度或学习完成率。
3. 老师在同一包页核对范围、填写指导并批准，仍由原revision/机构审核/师生绑定校验。学生看不到审批表单；待审包不能创建练习，真实POST也拒绝。
4. 练习标签衔接既有实际作答页，不复制原型客户端判分。练习提交后才进入复测；实际演示0/2筛查→2/2练习→1/2复测，只展示计数和来源，不宣称全部掌握或提高百分比。
5. 加载失败显示错误和重试，不回落旧DTO/Mock。实际创建成功但响应丢失时提示不确定，刷新活动后找回同一份open练习，避免重复创建。账号/学生切换后的迟到结果不渲染到新视图。

新增两条只读API：/students/{id}/learning-cycle?subject=...、/packs/{id}/activity，契约1.5.0共46路径。它们定位实际当前轮与指定包，不依赖最近100条列表判断是否练过。写入/评分/审批接口和4个迁移均保留，无新持久实体。家长仍用授权成长摘要，管理员不因此得到学习明细权限。

关键文件：public/pack-workspace.js（新交互与视图守卫）、public/app.js（本轮下一步和最小接入）、public/styles/integration.css（限定包页样式）、public/sw.js（公共外壳v10）、src/learning.mjs（两个只读摘要）、scripts/generate-contract.mjs与docs/openapi.json。既有3份锁定原型CSS没有覆盖；没有引入DataService、MockData、localStorage业务状态、模拟角色或新第三方依赖。

## 本轮实际测试

| 范围 | 本轮实际结果 |
|---|---|
| 业务、安全与契约 | **64/64通过**，含新轮次/活动摘要、100条截断边界、角色/机构/撤权、最新交接协议差异；v1.5真实响应校验 |
| 新包页真实UI/API/导出 | **122项通过**，1440×1000和390×844；12张截图；真实登录、筛查、审核、阅读无写入、断网/丢响应恢复、练习、非满分复测、成长 |
| 跨账号/切换学生及来源 | **8/8通过**；两个视口验证迟到真实200响应不覆盖新账号/新学生，学生查看教师代录仍显示教师来源 |
| 原会话切换/打印隐私 | **4/4重跑通过**，包括旧401与混账号打印读取 |
| 原默认学习闭环UI | **16项重跑通过** |
| 独立作业UI | **24项重跑通过**，含真实JSON/CSV下载、从包建稿丢响应重试、人工部分分与零分 |
| 人工阅卷UI | **16项重跑通过**，含真实JSON/CSV下载与部分分/观察分离 |
| 本轮PDF | **16份/20页**：草稿包、翻卡时导出的完整批准包、无答案作业单、练习/复测报告、学生/家长成长、完成后的包；全部A4/中文/范围/实际分数/分页检查和逐页渲染查看 |
| workerd/D1本机 | **6/6通过**；新只读接口与原持久化流程、权限和新轮次独立性，state为.local/workerd-stage6-tests |
| 静态与普通本机启动 | **82个JS/MJS文件**和25类导出检查通过；**7项启动检查**通过，含模块可读、后端源码404、匿名新API401及不含业务数据的公开打印外壳 |

角色回归曾发现学生页共用了“教师记录可能含参考答案”的教师导出提示，造成含混；API实际没有泄露答案。public/homework-workspace.js改为按角色展示提示，实际未批改答案隐藏检查继续保留；修复后24项通过。包页错误用持久错误区展示，避免同一信息在toast和正文重复。

随后补明活动摘要的实际提交来源（不按当前查看者猜测），并把材料序号标为“当前查看知识点”。定向UI/预览复查**124项通过**，结果为pack-ui-recheck.json；这次使用--ui-only，没有重生成PDF，不能把其中0份新PDF与前一轮16份实际文件混淆。打印模板未修改，原始16份证据保留。

PDF不是按钮验收：实际从包页导出入口打开授权预览，读完整服务器材料并生成文件；只翻到第二张卡时仍导出全部讲解、两张记背卡和保存的指导语。练习单不含标准答案，家长成长没有私密包指导或逐题解析。无数据或越权预览禁止打印；未生成假空白PDF充数。原JSON/CSV实际下载保留。没有新业务实体，导出种类仍25。

本轮使用隔离合成账号/答案，教师审核与批改由自动化角色执行，不代表真人审校或真实学生成绩。失败网络和延迟响应仅用于错误路径；正常业务均运行真实API和SQLite。手机是Chrome视口，不是iOS/Android/鸿蒙真机；物理打印未验证。

## 旧math实际题量覆盖与迁移边界

scripts/experiments/legacy-cap-audit.mjs只读当前app.js，单独执行entryKey/diffAt/buildQuestionsForEntry/buildAllQuestions四个纯函数；没有启动旧站或调用模型。结果与源码SHA保存在test-results/stage6/legacy-cap-audit.json。

| 合成选择 | 实际旧输出 | 边界 |
|---|---|---|
| 单章12个知识点，默认cap60 | 9槽、覆盖9点，遗漏3点 | 单章固定配额不能代表全部所选范围 |
| 16章各1点，默认cap60 | 45槽、覆盖15章，遗漏1章 | 单科target45后slice导致尾部章节丢失 |
| 两科各1点，合成cap8 | 8槽只覆盖数学，物理整科遗漏 | cap8为压力测试参数，不是声称旧站当前配置8题；科目最低配额再全局截断可偏向前一科 |
| 同一知识点重复9槽 | 同一点获得基础/中档/压轴3类标签 | diffAt按位置分配，非经题目实测的难度 |

旧生成结果只有知识点标签、score=3等人工核查槽，没有真实题干、选项或答案键。人工0–3与此启发式难度不得作为已验证客观试题/成绩迁入；选择范围也不能冒充实际已覆盖范围。真正有明确满分、实际得分、原卷依据与人工复核的卷面记录属于另一证据类型，不能一概等同旧观察槽。本平台已将0–3观察与卷面成绩分开，未导入旧真人历史或旧预警算法。

新平台另外建立21个**仅在内存中的容量占位点**，不是课程扩充：显式请求21点返回400 INVALID_SCOPE，创建0条测评；请求20点返回20道占位快照，范围集合完全一致、遗漏0。没有提交答案或生成分数。教师角色审批仅用于测试接口边界，不算这些占位点经真人审核。当前真实内容仍数学/英语各2点，共12道原创示例题。

## 证据与运行

本轮证据在test-results/stage6：node-tests.txt、pack-browser-results.json、view-boundaries.json、pdf-validation.json、16份PDF与rendered、legacy-cap-audit.json、workerd.json及保存基线。JSON/CSV回归证据在test-results/homework和test-results/integration；这些本轮已重跑，其他旧阶段PDF/OCR/RAG结果仅保留历史，不冒充本轮全量重跑。

最后普通库只读核对：content_reviews、attempts、answers、packs、paper_assessments、ocr_runs、homeworks均0，测试没有代替真人审核或写入日常档案。验收用本地服务已关闭，按下面命令重新启动即可访问。

正常本地启动：

```powershell
cd C:\Users\Administrator\Desktop\junior-learning-platform
node scripts/setup.mjs
node scripts/dev.mjs
```

访问http://127.0.0.1:8788；不换localhost，账号初始密码在已忽略的.local/accounts.txt。普通库审核状态未由测试改变；老师必须实际核验示例内容后使用。启用已安装的本机OCR仍用原--ocr参数，未启用时明确不可用。

定向复现：

```powershell
node --test tests/*.test.mjs
node scripts/pack-workspace-browser-test.mjs
node scripts/pack-view-boundary-test.mjs
node scripts/experiments/legacy-cap-audit.mjs
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' scripts/verify-pack-workspace-pdfs.py
```

workerd只用隔离本地状态：应用既有迁移并运行seed-pages-local.mjs --isolated-pack-tests，再以--persist-to .local/workerd-stage6-tests启动pages dev，执行workerd-pack-activity-smoke.mjs --isolated-pack-tests。不要加--remote，不在旧math目录运行。

## 尚未整合与下一步

- 原型t_overview的班级薄弱点汇总、t_dispatch独立课后方案/课堂反馈、p_records完整线上线下记录单、全目录年级/学期树、主题切换和部分图表设计尚未完整接入。现有真实包指导、作业反馈和家长摘要可用，不能把它们说成原型全部页面已完成。
- 未搬入原型“标记学完/已掌握”和本地总进度计算；若以后要保存阅读或自评，需独立定义低可信证据、权限、接口和导出，不充当真实掌握度。
- 题目仍为微型示例、普通库待真人审核；没有完整课程。完整DeepTutor RAG/模型出题未接入，判分反例及人工OCR复核边界保留，AI未参与正式评分。
- 通用历史列表仍有100/500等读取上限；本轮只解决当前轮及指定包的状态定位，未实现全量游标分页。打印与应用品牌文案仍有历史差异，统一品牌可另做小范围视觉变更。
- 下一步优先教研核验与内容扩充，或为教师真实课后反馈选择另一小切片；原生App、物理真机/打印、生产清理与监护核验不在本轮完成范围。

只在独立平台改动，旧math和原型只读；未部署、推送、触发旧pre-push、修改生产数据或系统安全设置，没有收费API或真实学生资料上传。
