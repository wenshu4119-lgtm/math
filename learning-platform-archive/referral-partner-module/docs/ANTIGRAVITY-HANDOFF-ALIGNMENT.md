# 最新Antigravity交接与真实契约对齐

## 第七阶段最新复核（2026-11-14）

原型已继续演进：收尾HANDOFF为16274字节/13:23:58，app.js为152823字节/12:54:02，dataService.js为25098字节/13:15:27。index加载LiveService与app，旧Mock入口已归档；服务层确有实际业务fetch、身份守卫及对应API包装。不能把下文第六阶段“仅会话探针”的历史结论用于当前源码。27项E2E及14份PDF的原型报告实际存在，但本轮没有重跑；空/拒绝页面产物也不能算成功业务PDF。

独立平台第七阶段已完成真实教师方案/反馈切片，版本1.5.1、46路径。没有整包覆盖原型或运行它的生产脚本。对照最新建议的处理如下：

| 最新原型成果/描述 | 核验与采用决定 |
|---|---|
| app.js renderTeacherPacksPane、renderTeacherHomeworksPane、renderTeacherDispatch | 已是真实异步API页面；采用工作分组、资源选择与失败草稿保留思路，新平台用共享编辑器与既有API实现，具体通过的范围见STAGE7 |
| HANDOFF的expectedVersion、teacherFeedback | 实际服务层updatePack/gradeHomework仍发revision、feedback；契约无前两个别名，不照抄旧文字 |
| “重复批改一律409” | 同requestId同内容是幂等200已有记录；不同内容或其他完成竞争才409。前端须固定一次意图的requestId，丢响应后GET核实 |
| codex-dropin/teacher-coaching-workspace.js | 未直接合入。h(tag,props,text)、card/row数组和exportsFor数组签名与当前h(tag,text,class)/可变子项/exportsFor(kind,params,label)不匹配；还有每题maxScore直接当earnedScore及confirmed:true的批改分支，缺少逐题实际分/确认界面与视图失效守卫 |
| 候选teacher组件的校验/未接通提示 | 作为可参考成果保留；本轮新组件显式录每题分、明确批准/人工核对，并加入409比较与撤权关闭；不把默认满分当实际人工评分 |
| codex-dropin/parent-archive-workspace.js | 留作下一切片；须适配真实summary权限与ctx辅助函数，前端裁剪不能代替服务端授权，关联pack也不等于测量等值校准 |
| 54题/18点隔离草稿题库 | 本轮未导入。pending_human及隔离状态保留；自动核验/选项分布不等于真人审题或校准，当前普通库仍4点/12题、审核0 |
| 班级统计、排课建议 | 无对应模型/接口；本轮没有新增。现反馈只能依附真实作业，不伪造上课或签到 |

当前public实际是扁平模块目录，没有public/workspaces，不能按候选交接路径假定目录已存在。本轮新增teacher-workspace.js/teacher-editors.js，提取已有包和作业的表单供两边共用；Antigravity继续在platform-ui里编辑，避免同文件冲突。记录原型22个并行修改和3个新增，旧math tracked diff仍空，详见stage7/preservation-result.json。

## 第六阶段历史观察（当时的快照）

以下保持第六阶段核查时间点，后续变化以上方复核为准。日期：2026-11-14（Asia/Shanghai）。当时只读核对platform-ui/HANDOFF-TO-CODEX.md及dataService.js、app.js、index.html、mockData.js。交接文件当时17203字节，修改于12:01:27；app.js当时161793字节，修改于11:55:54。完整哈希与阶段基线差异见test-results/stage6/preservation-result.json。该文件是对齐说明，不改写对方交接或原型。

## 已接收的并行成果

原型新增/完善7态演练、局部覆盖/真实0分区分、保存失败提示、教师/学生视图边界、完整包打印、家长可比性提示及交接清单。dataService.js目前**确有**probeRealSession：同源GET /api/v1/auth/session，返回探针连接状态并读取X-Actor-Id；不能继续说它完全没有fetch。

该探针不等于业务已接入。源码仍使用MockData、localStorage、本地算分/进度、模拟OCR、模拟课堂与家庭历史；HANDOFF也明确其余业务仍是演示。原型声称的11份打印验收是原型Mock/本地数据，本轮没有重跑或把它计作真实平台PDF。独立平台的16份真实API样例及25类导出单独记录。

双方目录边界保持：Antigravity的platform-ui更新完整保留；本轮在junior-learning-platform新增pack-workspace.js并做最小入口接入，没有同步覆盖原型JS、Mock数据或最新样式。检测到5文件并行变化后记录差异，不重置基线、不回滚新成果，也不把保存检查写成全部未变化。

## 正式接入应使用的真实接口

下表中的差异包含原型内部命名和期望字段，并非认定其演示器必须完全采用服务端命名；正式接入时必须适配。依据是当前src、OpenAPI1.5.0及实际接口测试，不能根据交接中的示意接口推定已实现。

| 原型交接命名/期望 | 当前真实契约 / 处理 |
|---|---|
| attempts phase:screening | 必须diagnostic；另有practice、retest。screening实际返回400 INVALID_PHASE |
| scope.isPartialScope、coveredTopics、uncoveredTopics、modules、weakKps | 当前scope是mode/topics{id,title,version}；growth.topicEvidence只列有效样本，缺失不补零。没有这些额外响应字段；显式选择全部示例也可以是selected_topics，不能仅凭mode推断是否完整课程 |
| pack.approvalStatus、explanations[]、flashcards[]、practices[] | 使用activity.pack.status及materials[]中的explanation/memoryCard/version；practice/retest为实际记录摘要。当前每点一张保存记背卡，不用Mock多卡补齐 |
| attempts创建/submit带requestId重放 | 当前不支持，严格字段校验返回400。练习/复测依靠包状态与唯一约束防重；丢响应后GET activity/current-cycle确认已保存状态。不得盲重试新建诊断并声称完全幂等；作业/OCR/阅卷创建另有各自已支持的requestId规则 |
| POST /ocr-runs | 当前是POST /uploads/{id}/recognize，未接引擎503；GET /ocr-runs/{id}与教师review已存在。不能调用模拟OCR代替失败 |
| content/review-queue用于试卷识图放行 | 它是讲解/记背/样题内容审核；OCR文字复核、paper逐题人工阅卷是独立流程，不能混为同一审批 |
| paper rows[]含judge/diff/actualScore | 实际为items[]及questionNo/qtype/mappingLevel/knowledgeId/maxScore/earnedScore或observationLevel/reviewed。scored_paper与ability_observation互斥；缺满分不生成正式成绩，不采用0–3映射或启发式难度转分 |
| teacher-roster、review-queue导出kind | 未登记。使用roster、content；图片/OCR对应uploads、upload、ocr-runs、ocr-run。以export-registry.js 25项为准，不添加猜测别名 |
| 任何pending_review一律禁印 | 各实体不同：明确水印的草稿包/内容/阅卷明细可导出；未提交测评可导出无答案作答单。正式paper-report、未批准包worksheet仍被拒绝。不能取消已有草稿导出能力 |
| /print.html直接返回HTTP403且不加载脚本 | 当前是公开静态外壳，未内嵌学生数据；私有数据API逐资源鉴权，预览先检查真实会话/角色，失败/空态不加载业务内容或禁印，打印前再核验。不是声称HTML外壳已做HTTP级权限路由；脚本可读不代表业务数据可读 |
| REVISION_CONFLICT、error.currentRevision | 实际是409 VERSION_CONFLICT；错误信封为{error:{code,message,requestId}}，没有currentRevision。error.requestId是请求追踪号，不是业务幂等键。先GET当前资源再人工核对，失败时不静默覆盖草稿 |
| compareReason、overallPct、cycleStage与可比差值 | 不存在对应服务端字段；当前轮返回diagnostic/pack/practice/retest。growth仅给实际计数和来源，不承诺等值测量或能力增长率，不能把同范围就等同校准后的进步 |
| 班级weak分布、offlineSlot、持久studyScenario | 当前无班级/排课/场景偏好模型和接口，保留为后续切片；不能用Mock统计冒充已授权真实学员汇总 |

正式前端应复用当前api()或等价守卫：真实会话、CSRF、X-Actor-Id、组织/关系授权及迟到响应检查。不导入预览角色切换器或7态下拉来制造正式结果。知识点chip只改变当前阅读内容；练习覆盖服务端批准包范围，不只当前chip。

## 本轮核验与后续

新增契约回归实际验证screening错误、OCR集合不存在、attempts不支持requestId、旧revision拒绝且错误信封没有伪造字段、正确导出kind存在。权限和打印边界另由本轮真实浏览器/PDF检查支撑，未把原型模拟403演练当真实服务端测试。

对方提出的班级聚合、排课、偏好、保存冲突合并等建议作为后续需求保留，本轮没有因此扩张到全平台重写。下一切片应先明确数据模型和权限，再按实际API逐页替换Mock。原型新增内容只能作为候选，仍需来源、推导/核验和真人审核；当前普通库仍4点/12题且审核0条。
