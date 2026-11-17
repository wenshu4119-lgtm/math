# 第七阶段：教师方案调整与课后反馈

日期：2026-11-14。先读当前AGENTS、API1.5和实际代码；工作区全部未提交成果保留。阶段前源码快照为.local/stage6-before-teacher-workspace。

## 最新输入与选择

原型HANDOFF-TO-CODEX.md仍为12:01:27版本，但app.js已在12:50:27更新为152793字节，dataService.js在12:39:47更新为24384字节。实际index只加载LiveService与app.js；源码已新增真实API包装和renderTeacherDispatch三组异步页面，不能套用上一轮“仅会话探针”的旧结论。仍需在独立平台实际验证，不能只凭Live API标签宣称所有页面联调通过。

本轮采用其“学习包审阅／作业布置批改／纸卷观察”的工作分组、资源选择与失败保留输入设计，继续使用独立平台现有会话/CSRF/X-Actor-Id守卫，不整包替换前端或覆盖原型。

## 计划与边界

- 新增老师专用「方案与课后反馈」入口，绑定学生选择沿用/students。
- 方案保存复用GET/PATCH packs与内容审核，提取共享编辑组件供旧包页和新工作页使用；失败保留输入，409后读取最新值供比较，明确确认后才更新基准版本。
- 反馈复用实际homeworks提交/人工批改和familySummary；没有学生提交就不批改、不自动给分，不伪造课堂发生记录。批改表单与原作业页共用。
- 家长公开摘要用既有homework-summaries；老师预览仅覆盖本人负责作业，不冒充家长的全部授权记录。
- 保存实体不变，复用pack、homework、homework-feedback、homework-summaries等25类PDF/打印，JSON/CSV保留。未保存草稿仅在当前页面，不放localStorage或跨账号缓存。
- 核对方案更新中的授课关系变更竞争，补充必要的服务端原子授权检查。没有新数据库表或Mock API。

验收以真实隔离API与桌面/手机操作、权限/串档/冲突/断网、PDF文件与分页为准。普通库不写测试审核、成绩或反馈；旧math/原型只读，不部署、不推送。

## 已完成的真实切片

老师登录后进入「方案与课后反馈」，仍由真实会话与`/students`返回的授权学生决定上下文。三组页面为学习方案、作业与课后反馈、家长公开摘要；原三步闭环首页、线上/线下入口、学习/作业/纸卷/内容审核页面保留。手机底栏新增本入口，内容审核可从菜单进入。

1. 读取已提交筛查并匹配真实学习包；审核过的知识点才能勾选。保存草稿不会批准；批准前需明确确认。学习开始后不能覆盖范围和指导语。
2. 新旧学习包页面共用编辑器。版本冲突或网络错误保留当前输入；「读取最新保存版本」展示服务端值、不覆盖输入，更新前必须比较确认。切换包时存在未保存输入须明确放弃；同页标签切换保留输入。
3. 从批准方案进入既有作业创建/发布流程。作业列表仅当前老师负责且仍绑定学生的记录；学生实际提交前不出现评分表单。未绑定、家长、管理员及非负责人不能通过前端选角色获得明细权限。
4. 逐题人工输入实际得分与反馈，支持部分分；空白不变成0或满分。批改总反馈与明确公开给家长的familySummary分开。采用固定请求幂等键；已保存但丢响应时，可读取真实已批改记录、比较并打开保存结果，不能再次覆盖已完成批改。
5. 家长摘要预览只读取老师本人负责作业的公开数据，并标明这是子集。家长使用自己的绑定关系读取摘要，无作答正文、逐题反馈、私密反馈或方案指导语。公开摘要不冒充完整家校档案。

「课后反馈」在本阶段特指实际提交作业的人工批改反馈。没有新建独立课次、课堂观察评语、排课、签到、班级统计、已确认批改修改/撤销或离线草稿持久化。老师反馈不会创建复测、完成学习包或推断进步。

## 关键文件与契约

| 文件 | 本轮内容 |
|---|---|
| public/teacher-workspace.js | 三个真实业务面板、资源选择、未保存输入保护、授权失败关闭、PDF/打印和JSON/CSV |
| public/teacher-editors.js | 共用方案审核及人工批改表单；冲突比较、明确确认、丢响应找回 |
| public/app.js | 老师导航、当前账号/学生/视图守卫，API错误暴露status/code/requestId用于正确处理 |
| public/pack-workspace.js、homework-workspace.js | 原页面复用新表单，不删除原业务和导出能力 |
| public/styles/integration.css、sw.js | 桌面/手机布局；v11公共外壳包含新模块，不缓存API/私有文件/打印预览 |
| src/learning.mjs | 学习包PATCH的版本更新与有效授课关系校验处于同一UPDATE；撤权竞争不写记录或成功审计 |
| tests/teacher-plan-permissions.test.mjs | 请求验证后、实际写入前撤权的确定性交错测试 |
| scripts/teacher-workspace-browser-test.mjs | 真实端到端、导出文件和桌面/手机测试 |
| scripts/teacher-view-boundary-test.mjs、teacher-export-boundary-test.mjs | 迟到响应、切学生/账号、撤权、空/错/越权预览 |
| scripts/workerd-teacher-smoke.mjs、verify-teacher-workspace-pdfs.py | 本地真实D1并发/权限与PDF逐页验证 |
| docs/API.md、openapi.json、EXPORT-INVENTORY.md | API1.5.1，仍46路径、25类导出、4个迁移；无新表 |

学习包使用GET/POST/PATCH packs及knowledge，作业使用既有homeworks/create/publish/submit/grade，公开摘要使用students/{id}/homework-summaries。字段始终是revision、teacherNote、feedback、familySummary，没有expectedVersion/teacherFeedback写入别名。见API完整请求/响应与错误约定。

失败处理有区别：409/网络错误保留输入；401/403/404关闭整个敏感工作区并提示重读授权。切账号、切学生、离开页面会清空未保存内容，界面事先提示。迟到响应有身份代次、学生、页面及所选资源多重检查。浏览器草稿不等于服务器记录，导出前重新读取保存版本。

## 最新并行交接复核

实施中原型继续更新。收尾读到HANDOFF为16274字节、13:23:58，app.js为152823字节、12:54:02，dataService.js为25098字节、13:15:27。它现在确有LiveService业务请求与真实联调产物；上方初始12:01交接观察是阶段开始时的快照，不能用于否认后续成果。

最新原型声称27项E2E与14份PDF，实际报告文件存在；本轮仅只读核对，未重跑这些脚本，也不把其中空/拒绝状态截图PDF计作成功业务导出。本平台独立验收数字见下表。

`codex-dropin/teacher-coaching-workspace.js`已阅读，暂未整包导入：其h/card/row/exportsFor调用签名与当前项目不同，未使用本项目视图失效守卫；批改分支还把每题earnedScore设为maxScore并发送confirmed:true，没有逐题录分和真人确认界面。这段不能当作人工评分能力。本轮采用其业务分组及失败保留草稿思路，以共用编辑器独立接入实际API，避免与Antigravity同时改同一文件。候选家长档案留到下一切片审查。

交接文字的expectedVersion/teacherFeedback与服务层实际revision/feedback仍不一致；同幂等键相同批改重试返回200已有记录，而非一律409。具体对齐记录见ANTIGRAVITY-HANDOFF-ALIGNMENT。新增54题草稿仍隔离、pending_human，未导入本平台；自动数学检查不等于真人审核或等值校准。

## 本轮实际验收

| 检查 | 真实结果与证据 |
|---|---|
| 业务/安全/契约Node测试 | **65/65通过**；stage7/node-tests.txt，包含新撤权写入竞争测试 |
| 新教师桌面/手机流程 | **122项通过**、8张真实截图；stage7/browser-results.json |
| 视图/身份/学生边界 | **10/10通过**；stage7/view-boundaries.json |
| 导出权限/空/失败/打印前撤权 | **10/10通过**；stage7/export-boundaries.json |
| 原闭环UI、作业UI、会话切换回归 | **16/16、24/24、4/4通过**；integration/ui-results.json、homework/ui-results.json、integration/session-race.json |
| Cloudflare workerd本地D1 | **7/7通过**；stage7/workerd.json，两个老师并发更新仅一个成功、作业非负责人拒绝、幂等重试与摘要隔离 |
| 静态与导出登记 | **89个JS/MJS文件通过**；46条契约路径、25类导出保留 |
| 普通本机启动 | **8/8通过**；stage7/local-startup.json：首页与新模块200，后端源码/密钥路径404，匿名作业401 |
| PDF实体 | **16份/32页**；stage7/pdf-validation.json，全部A4、中文可提取、长作答/反馈完整；全部页已渲染查看 |

桌面1440×1000、手机视口390×844。流程真实完成诊断→匹配→草稿→教师冲突比较与批准→布置/发布→学生提交→人工1.5/2→私密反馈与公开摘要。自动化选择和老师操作都是合成样本，不是人工审题证据或评分效果评估。后端是真实隔离SQLite/相同业务层，workerd另用本地D1；响应延迟/断开是明确故障注入，没有成功Mock业务结果。

PDF每种布局8份：草稿方案、批准方案、通关无答案练习单、已提交未批改作业、老师批改反馈、学生批改反馈、老师公开摘要、家长摘要。验证未保存指导语不混入、未批改不出现成绩、家长不收到私密字段。25段作答与24段反馈跨页完整；通常大小题目/公式不被截断，超一页长内容允许连续跨页。打印预览经过统一预检；未验证真实系统对话框保存和物理打印。

本轮新页面不包含图片/图表，未重跑OCR/PDF图片、成长图表或全部25种导出；历史实际验证记录保留，不能合并宣称全部本轮重测。作业CSV沿用逐题明细格式，整体反馈和公开摘要在JSON/PDF中；方案JSON/CSV已实际下载。两份加「合成样本」页脚的查看副本在output/pdf，原始16份测试PDF未改写。

测试过程中有两处断言定位失败：新测试同时命中隐藏面板与可见摘要，改为只选可见面板；原手机闭环脚本假设内容审核在底栏，改为从已有菜单打开。随后分别122项和16项通过，未修改业务返回或删掉权限断言来掩盖失败。第一处原始失败记录保留为stage7/first-run-selector-failure.json。

## 保留、启动与下一步

阶段基线含原型41文件，收尾44文件：22个并行修改、3个新增、0个缺失，全部保留；preservation-result.json记录具体哈希，保存检查因此非零退出，不声称原型未变化。旧math HEAD仍e56614db680fa83ac68210bec69f8d164e7c8fd0，tracked diff为空。本平台仍codex/mvp、全部未提交且无remote，原成果与本轮改动均保留；没有部署、推送、生产读写或付费模型调用。

普通库只读盘点为4知识点/12题，content_reviews、attempts、answers、packs、paper_assessments、ocr_runs、homeworks均0（stage7/ordinary-demo-state.json）。测试审核与成绩只在隔离库中。完整DeepTutor RAG/AI出题和AI判分仍未接通；本机OCR可显式启用，默认不可用，本轮未重跑OCR质量。

启动（Node24+，在独立项目目录）：

```powershell
cd C:\Users\Administrator\Desktop\junior-learning-platform
node scripts/setup.mjs
node scripts/dev.mjs
```

访问http://127.0.0.1:8788；初始密码仅在本机.local/accounts.txt，不在文档列出。setup保留已有账号和业务记录。普通库须真人核对示例内容后批准，再走实际闭环。测试开发服务已在验收结束停止。

复跑新UI与隔离API用README的teacher-workspace、teacher-view-boundary、teacher-export-boundary脚本；PDF检查用`python scripts/verify-teacher-workspace-pdfs.py`，需pdfplumber/Pillow/Poppler。workerd需先执行4个本地迁移并用`seed-pages-local.mjs --isolated-teacher-tests`写入`.local/workerd-stage7-tests`，启动Pages dev时指定相同persist-to，再运行`workerd-teacher-smoke.mjs --isolated-teacher-tests`；不要把该测试指向普通库或远端。

下一步按顺序：审查并接入家长只读档案；对隔离草稿题库建立逐题真人审核与来源/版本记录；明确独立课次反馈、授权和修订流程后再建模型；安排真实手机及物理A4打印验收。班级聚合和排课仍只是方案，不能用模拟平均分或课堂记录补齐。
