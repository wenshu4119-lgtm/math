# 第四阶段：独立作业收交与人工批改交接

日期：2026-11-14，Windows/Node24，全部本地。当前阶段完成的是可运行的最小独立作业流程；不是全课程、完整RAG或生产系统交付。

## 已完成的真实流程

老师在「作业中心」从本机构已审核practice题建立草稿，设置每题满分、指引和可选截止提示；逐项核对后发布。也可从已批准通关包创建草稿，保留来源包版本。学生本人填写选择和可选过程并实际提交，负责人逐题人工录分（含部分分和零分）、写反馈并确认。家长只能看状态、实际总分及老师明确公开的familySummary。

原三步闭环、线上自主学习/线下教师辅导主线和旧通关练习作业单全部保留。独立作业提交不是通关练习或复测，不自动完成学习包，也不显示没有复测依据的进步。已确认人工阅卷可作为作业批改参考，但不自动取分、转换观察档位或复制一份卷面报告。

## 文件与数据模型

| 文件 | 本轮作用 |
|---|---|
| migrations/0004_homeworks.sql | homeworks生命周期/负责人/版本/幂等请求；homework_items题目与满分快照；homework_answers原始作答；homework_marks人工得分及反馈 |
| src/homeworks.mjs | 资源权限、批准内容选题、发布/提交/批改状态机、事务及角色DTO |
| src/papers.mjs | 导出既有分值校验函数供复用；卷面算法未换成AI评分 |
| src/api.mjs、src/learning.mjs | 新路由与独立homeworkEvidence成长字段 |
| public/homework-workspace.js | 老师/学生/家长界面，JSON/CSV，异步视图保护 |
| public/app.js、styles/integration.css、sw.js | 工作台导航、来源包入口、移动布局与公共外壳版本 |
| public/export-registry.js、print-data.js、print.js、print.css | 新5类导出、角色字段边界、长作答分页 |
| scripts/generate-contract.mjs、docs/openapi.json、tests/contracts.test.mjs | API1.3.0/44路径，真实响应验证；作业单schema禁止答案字段 |
| tests/homeworks.test.mjs | 13项作业领域及安全回归，含英语闭环与跨科目拒绝 |
| scripts/homework-ui-test.mjs、homework-view-race-test.mjs | 两种布局实际交互、丢响应重试及迟到响应保护 |
| scripts/homework-pdf-test.mjs、verify-homework-pdfs.py | 实际授权PDF、空/错/撤权、中文/长文本/基础公式/A4验证 |
| scripts/workerd-homework-smoke.mjs、seed-pages-local.mjs | 独立stage4本地D1验收，不写普通演示库 |

详细字段、请求及响应示例见API.md与openapi.json。业务状态draft→published→submitted→graded；发布后题目/分值不可改，学生提交与最终人工批改均不可覆盖。满分/实际分按整数百分位保存；未批改score=null，零分是实际score对象。

## 权限、并发与真实能力边界

- 老师须是创建负责人，并仍与该学生绑定；其他绑定老师也不能读该作业，列表、明细、成长和导出一致。管理员不默认读学习资料。
- 学生看不到草稿；批改完成前不下发参考答案或解析。所有角色的作业单都在服务端剥离答案、学生正文和评分。教师完整记录明确标注可能含答案。
- 家长摘要不含题目、原始过程、feedback或逐题note；只包含明确公开的familySummary。撤权后的打印前检查会清空预览并阻止打印。
- create/submit/grade以同一requestId和语义哈希处理重试，变更重放409；revision及随机write_token门控整组明细/审计，失败请求不覆盖获胜结果。来源包revision在发布SQL中再次校验。
- 已失效的负责老师/授课关系不再收新作答。学生既有历史保留；老师读写拒绝。未保存表单不冒充已保存导出。
- 新模块无OCR/RAG/LLM调用，没有外部费用或真实学生资料发送。默认OCR不可用时明确提示；第三阶段的可选本机Tesseract继续保留。DeepTutor RAG和AI出题仍不可用，上游通用判分的已知反例没有被引入正式分数计算。

## 实际验证结果

| 检查 | 结果 |
|---|---|
| Node业务、安全、API、数学打印边界 | 51/51通过，含13项新作业测试；数学/英语均有实际API闭环 |
| 语法、静态资源/契约/导出入口 | 65个JS/MJS文件通过；25类导出登记及加载器齐备 |
| 作业实际UI | 1440×1000与390×844各12项，共24项通过，真实API/隔离SQLite |
| 迟到响应 | 2/2通过：详情A不覆盖B和未保存输入；旧科目目录不覆盖当前科目 |
| 原学习闭环与人工阅卷UI | 16+16=32项重跑通过，JSON/CSV实际下载 |
| 作业PDF与错误/权限 | 28份实际PDF、28项空/错/权限检查；最终50页A4全部渲染 |
| 原18类导出 | 42份实际PDF、78项浏览器检查；72页全部重新验证/渲染，含中文、基础MathML、SVG图表、图片和长文本 |
| Cloudflare本地D1 | 0004迁移成功，12/12作业验证；含并发CAS、来源包非空条件、权限和撤权 |
| 普通开发启动 | 4/4：首页/health成功、src拒绝静态访问、匿名作业401；默认OCR/AI明确unavailable |

本轮实际生成70份原始PDF/122页；OCR2类不在本轮重跑集，第三阶段10份/14页真实引擎验证记录保留，没有把旧证据说成当前新跑。当前25类清单均有真实实现；没有仅按钮的已完成项。未涉及的模型评估没有重复消耗。

所有账号、题目场景与成绩均为隔离合成测试；teacher操作由自动化执行，不等于真人审题。选择/作答/批改/角色访问来自真实API，网络延迟/丢响应/失败只用于明确的故障测试。最终供查看的3份PDF另加「合成样本、自动化教师操作」页脚，原始浏览器证据不改写。

证据：test-results/stage4-node-tests.txt、homework/ui-results.json、homework/view-races.json、homework/pdf/summary.json及pdf-validation.json、pdf/summary.json及pdf-validation.json、integration两套UI结果、workerd-homework-smoke.json、stage4-local-startup.json。PDF原始证据在test-results，带标签的副本在output/pdf。

## 发现的失败与修复

1. 合法来源学习包修改可插入发布前检查和事务之间；已加发布SQL版本条件，真实PATCH交错回归通过。详情见HOMEWORK-IMPLEMENTATION-REVIEW。
2. 同一主区迟到A详情会覆盖后来B，旧数学目录也可能覆盖英语；已加视图和目录代次，回归通过。
3. 原包按钮在创建成功但响应丢失后重试会生成新requestId；已固定按钮意图ID，两种布局都验证只有一份草稿。
4. 首轮PDF样本截短了末段却仍检查第35段；修正为完整且不超过2000字符的35段原文，再生成验证。没有删去完整性断言。
5. 视觉检查发现打印media规则覆盖allow-split，长作答整体移至下一页；修复覆盖顺序，并加首页已有作答的检查。PDF从58页降至50页，内容完整。
6. workerd脚本重复运行时再次审核已审核版本收到正常409；脚本改为只审pending_human，并恢复测试撤销的老师关系。最终12项通过，没有修改业务状态码来配合测试。

## 启动与复现

普通开发（保留现有数据）：

```powershell
cd C:\Users\Administrator\Desktop\junior-learning-platform
node scripts/setup.mjs
node scripts/dev.mjs
```

访问http://127.0.0.1:8788；密码在本机忽略的.local/accounts.txt，不打印到报告。setup仅应用迁移并保留数据。本轮普通库content_reviews/attempts/answers/paper_assessments/ocr_runs/homeworks均为0；测试未审核普通样题或伪造日常档案。老师须先实际审核内容，再试作业闭环。可选本机OCR使用`node scripts/dev.mjs --ocr`，条件见STAGE3-OCR-RAG。

定向测试：`node --test tests/*.test.mjs`、`node scripts/homework-ui-test.mjs`、`node scripts/homework-view-race-test.mjs`、`node scripts/homework-pdf-test.mjs`；Python/Poppler检查见README。无新增运行依赖。

Cloudflare隔离本地验证（先停止Node服务，严禁加--remote）：

```powershell
node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --persist-to .local/workerd-stage4-tests
node scripts/seed-pages-local.mjs --isolated-homework-tests
node node_modules/wrangler/bin/wrangler.js pages dev public --ip 127.0.0.1 --port 8788 --persist-to .local/workerd-stage4-tests
# 另一个终端，仅对上述隔离服务执行
node scripts/workerd-homework-smoke.mjs --isolated-homework-tests
```

测试会在隔离库保留合成作业记录与审计，恢复它主动撤销的负责老师关系；不是生产清理工具。普通开发库与该目录互相独立。收尾停止本任务拥有的服务，无后台部署或自动推送。

## 保留成果和下一步

阶段开始前源码快照保留在.local/stage3-before-homeworks-20261114；一期快照也仍在。旧math tracked diff为空，未触发pre-push。新项目仍无remote、无提交，所有未提交成果保留。原型12文件中9个与初始一致、3个并行修改仍保留，最新layout哈希见CONCURRENT-PROTOTYPE-UPDATE；preserve-check退出2表示登记的版本差异，不是全通过或要求覆盖。

Antigravity应继续在独立平台public/对接API，不将原型MockData/localStorage角色切换搬入业务层。原型最新视觉改动仍待选择性评审；当前使用已验证的锁定CSS与独立业务模块。thewyj实际目录/会话/D1/R2/PWA/打印参考及用户授权背景继续见THEWYJ-AUDIT与ARCHITECTURE；本阶段没有新复制上游代码或扩大第三方许可结论。

下一步优先：已确认阅卷与作业批改的更正/作废审计，教研审核与目录扩充，再做教师辅助的证据检索和试卷到学习包匹配。每项新增保存内容须同步加入导出清单。

当前明确未完成：批量发给班级、协同批改/负责人转交、撤回/再提交/重新批改、持久化批改草稿、作业图片附件、非选择题自动判分、全量分页导出、旧真人数据及71点正式迁移、完整DeepTutor解析/Embedding/HTTP/WS/生成、真实手机相机和物理打印、复杂LaTeX/几何图、原生App及生产合规/可靠清理。作业截止时间只是提示；超长记录允许跨页并要求预检。Chrome移动视口不等于iOS/Android/鸿蒙真机验证。
