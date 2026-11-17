# 第二阶段交接：原型整合与结构化人工阅卷

日期：2026-11-13。仅本地开发验证，无部署、推送、生产改动、付费模型或真实学生数据上传。

## 保留与实际复用

- 开始时独立MVP仍全部未提交，无remote；旧math HEAD为e56614db680fa83ac68210bec69f8d164e7c8fd0，已跟踪文件无diff，仅存在Antigravity未跟踪platform-ui。读取API/VERIFICATION/迁移评估后运行一期15个测试作为基线，全部通过。
- 一期源码副本保存在忽略目录`.local/stage1-before-integration/`；没有删除已有目录、测试或输出PDF。Antigravity原型12个文件保留，SHA256记录在ANTIGRAVITY-INTEGRATION。
- 将原型的tokens/layout/components三个CSS原样复制到public/styles/prototype-*.css，保留来源注释；integration.css只负责live覆盖。实际采用蓝/青/橙变量、顶部栏/左导航/手机抽屉与底栏、loop-stepper、scenario-card等组件。
- 原型的js/app.js、mockData、dataService、samplePaperGen没有加入live入口。没有运行Mock OCR，没有导入edu_platform_ui_preview_v1，没有前端角色切换。原型7个window.print场景由原平台授权print.html覆盖，未发现旧JSON/CSV下载被移除。
- 收尾发现原型js/app.js与两份CSS有并行更新，9/12起始哈希一致；全部保留未覆盖，详见CONCURRENT-PROTOTYPE-UPDATE。独立平台使用已经验收的起始样式版本；“7个打印场景”指初始核查时版本。

## 当前界面流程

- 登录后只显示服务端确认的角色。管理员只管理账号/关系；老师选择关联学生；学生只能本人；家长只读孩子摘要。
- 主线为能力筛查→讲解/记背/练习→复测与成长。learning-state.js按同一diagnostic/pack/practice/retest关联判断阶段，不能用上轮复测显示新一轮进步，更没有默认15%进度。
- 线上：学生实际作答，source=student_self；线下：老师可实际代录现有选择题，source=teacher_recorded，并审核/调整学习包。人工阅卷另有明确入口和独立数据模型。
- OCR、DeepTutor RAG、AI出题明确不可用。只有实际提交/人工确认的数据进入档案；未复测不推断进步。
- 已复测报告和人工卷面记录在成长页分开，家长摘要不包含原图或逐题核对说明。

## 结构化人工阅卷

新增migration 0002_manual_papers.sql、src/papers.mjs、public/paper-workspace.js。支持数学/英语；老师建立scored_paper或ability_observation记录，可关联同一学生有效图片。

1. 题号支持1、21(1)、21(2)，保存parentNo分组，只录叶子条目，拒绝父题总分和小题分双计。最多60条，64KiB请求上限。
2. 卷面分：明确maxScore、earnedScore，支持最多两位小数的部分分，服务器整数百分位求和；未知满分/实际分、负数、超分、过多小数都不能确认。
3. 能力观察：独立0–3档，保留档位计数，不映为旧原型72%或卷面分；AI推断不接受为正式来源。当前内容来源均为人工录入，不假定输入题干已是已审核题库。
4. 范围可为具体知识点、章节或未映射，不能把“全等三角形”自动归到首个具体点。当前具体知识点仍为MVP的4个示例点；旧71点目录没有被悄悄当作已审核课程导入。
5. 草稿逐题reviewed，保存后整份人工确认；确认冻结报告。修改任何题目会清除该题UI复核勾选；未保存修改不能直接确认旧版本。
6. PATCH使用revision+随机write_token，对后续DELETE/INSERT逐条门控。并发保存失败方不改写题目。确认只产生一次事件；重复确认409。
7. 草稿只有关联老师可见；学生只读本人已确认明细；家长只能paper-summaries；管理员不默认读学习数据。绑定撤销立即影响后续请求。
8. growth.paperEvidence独立于choice evidence。原图过期/删除不抹掉确认分值；报告保存来源、算法版本、人工复核人和时间。

这是人工阅卷的可运行阶段，不是自动OCR、AI诊断、全课程题库或完整历史迁移。不会调用DeepTutor通用相似度判分。

## 导出与测试

保留14类原导出，新增papers、paper、paper-report、paper-summaries，共18类；草稿明细打印明确未确认，正式report对草稿409。家长仅摘要，打印前再次鉴权。新增真实JSON/CSV下载，CSV转义公式前缀；没有用PDF替代数据格式。

本轮：26个Node业务/安全/接口/显示状态测试通过；线上闭环和人工阅卷各在桌面/手机实际点击回归，合计32项场景检查；42份PDF与78项浏览器检查通过；Poppler渲染72页，中文、基础公式、图表、图片与分页验证。详见VERIFICATION。

Cloudflare实际本机隔离验证：

```powershell
node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --persist-to .local/workerd-stage2-tests
node scripts/seed-pages-local.mjs --isolated-tests
node node_modules/wrangler/bin/wrangler.js pages dev public --ip 127.0.0.1 --port 8788 --persist-to .local/workerd-stage2-tests
# 另一个终端（仅在上面的隔离服务运行时）
node scripts/workerd-paper-smoke.mjs --isolated-tests
node scripts/workerd-smoke.mjs
```

结果：新阅卷7/7、原会话/R2等8/8通过。测试阅卷只留在隔离state目录，非普通演示数据库；合成测试图片删除，无真实学生数据。

## 本机预览

停止占用8788的测试服务后：`node scripts/setup.mjs` → `node scripts/dev.mjs`，访问http://127.0.0.1:8788。setup按迁移新增表并保留已有数据；随机账号密码仍在本机忽略文件.local/accounts.txt。无需安装新增运行依赖。

先teacher实际核验样题，再切student完成线上闭环；线下阅卷不需要把录入题目伪装成已审核题库。parent可验证只读摘要，admin管理关系。

## 未完成和待验证

- 真正OCR、DeepTutor RAG/LLM出题、费用与准确率仍未验证，无模型调用；旧来源授权及第三方许可评估继续有效。
- 尚无试卷→学习包自动匹配、71点目录审核导入、旧真人历史迁移、独立作业收交/批改、已确认记录更正/作废工作流。
- 本轮旧报告迁移限明确满分、实际得分、部分分、按范围聚合、独立观察；旧多雷达维度和启发式推荐没有伪装成已迁移。
- 保存JSON/CSV用于导出，未实现再导入；不得把导出的文件再当作任意用户可写成绩接口。
- PDF真机/物理打印机/复杂LaTeX/超长单题仍未验证。手机是Chrome移动视口；系统打印对话框保存结果由用户完成。
- 列表/导出有100等上限；没有全量分页导出、生产R2清理重试、完整未成年人监护核验/数据删除策略。原生App不实现。

下一步优先做确认记录更正/作废与审计、教研目录审校/授权来源，再评估结构化OCR与有证据的学习包匹配；每项新增保存内容继续纳入导出清单。
