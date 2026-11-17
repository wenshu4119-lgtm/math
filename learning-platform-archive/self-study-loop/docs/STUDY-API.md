# 自学闭环 API 契约

前缀 `/api/v1/study`，共享现有 HttpOnly 会话、CSRF、机构及学生绑定。管理员无学情权限。所有响应 `no-store`，沿用主 API 的 `X-Actor-Id`；最终学生资源门禁以同一 SQL 验证会话、角色、机构、学生状态和教师/家长关系。

记录明确为“自学练习证据”，不是正式考试、教师批改、高考成绩或提分预测。阅读完成不等于掌握；照片不等于 OCR 或批改。

## 范围与目录

范围对象：`{stage:'junior',grade:7|8|9,examYear:null,subject:'math'...}` 或 `{stage:'senior_arts',grade:null,examYear:2027,subject:'math'...}`。不能混学段、年级/年度、学科建一轮。

- `GET /catalog?stage=&grade=&examYear=&subject=`：学生/教师；返回 `{scope,points,inventory,legacyReferences,notice}`。points 包含 `id,title,version,coverage,uncovered,qualityStatus,questionCounts,closedLoopReady`。缺讲义或三阶段蓝图不足会明确 `closedLoopReady:false`。
- `GET /library?...&pointId=&offset=0&limit=30`：native 多题库。学生仅题面、选项、来源、用途、难度和质量状态；教师可见当前版本答案与解析。
- 旧 legacy/bank/arts 库仅作实时只读索引及原入口链接，不复制为 auto_checked，不改变旧正式题组的人审门禁；其引用数量与新增资源分开，不能相加宣称全课程覆盖。

## 建立一轮与获取报告

- `POST /cycles`：`{requestId:UUID,studentId,stage,grade,examYear,subject,pointIds:[...],mode:'online'|'paper'}`。每轮1–3个同范围得分点。返回 `{cycle,attempt}`，attempt 为筛查题组。纸笔模式仍返回同一份题号/版本快照，不发答案。
- `GET /cycles?studentId=&stage=&grade=&examYear=&subject=`：返回当前授权学生此范围的轮次摘要。
- `GET /cycles/:id`：返回 `{cycle,report,task,attempts,pendingAttempts,comparison,nextRound,evidenceSummary}`。学生/教师看本人或绑定学生详细自学记录；家长只获摘要、任务执行计数和证据数量，不含题目、作答、原图、答案或内部备注。
- `POST /cycles/:id/next`：`{requestId:UUID,reason,pointIds?:[...],mode?:'online'|'paper'}`，已完成复测后开启下一轮；明确保存范围/方法调整理由、前轮ID和已见题提示。不会覆盖前轮。

cycle：`{id,studentId,stage,grade,examYear,subject,version,state,pointIds,mode,previousCycleId,createdAt}`。筛查/练习/复测及任务均有独立ID、版本、来源和证据快照。

## 实际作答与纸笔证据

- `GET /attempts/:id`：学生/绑定教师获取当前题组；提交之前没有答案。
- `POST /attempts/:id/submit`：`{expectedVersion,answers:[{questionId,selectedOption:number|null,manualText?:string}],confirmed?:true}`。online 直接记录实际选择；paper 必须已绑定有效照片且逐题人工核对后 `confirmed:true`，来源记录为 `student_verified_manual` 或 `teacher_verified_manual`。空白不当作错误；主观题保持 `pending_manual`，不自动给满分。
- `POST /attempts/:id/evidence`：`{expectedVersion,uploadIds:[...],reason}`。最多6页，只能关联现有 uploads 中同机构同学生的有效私有图片；不保存新的图片副本、不调用 OCR。
- `GET /attempts/:id/worksheet`：受权打印数据，含题号、题目/内容版本、空白作答区、范围及未覆盖项。学生没有未提交题的参考答案。
- `GET /attempts/:id/evidence`：学生/教师看已关联有效图片的元数据及现有受保护图片URL；家长只能在轮次摘要看到数量，不能用此接口读原图。

attempt：`{id,cycleId,phase:'diagnostic'|'practice'|'retest',version,state:'open'|'submitted',mode,source,questions:[{id,prompt,options,difficulty,questionVersion,...}],result}`。提交后客观题返回所选项、冻结参考答案、解析；错误类型仅 `suspectedErrorType` 提示，不能声称已确认错因。

## 针对学习与下一步

- 筛查提交后建立 task：按真实基础题错误/中档错误/全对，分别给出 `prerequisite` / `targeted` / `consolidation`；未作答或主观题不足为 `more_diagnosis`。每项保存具体 `evidenceId` 与题目证据，缺内容不凑题。
- `GET /tasks/:id` 返回 `{task}`，包括版本化讲义、分层题组安排和依据。
- `POST /tasks/:id/activity`：`{requestId:UUID,expectedVersion,kind:'reading_started'|'reading_completed'|'memory_reviewed'|'offline_guidance',note?:string}`。线下指导仅绑定老师可记；行为与实际答题分开统计。
- `POST /tasks/:id/practice`、`POST /tasks/:id/retest`：`{expectedVersion,mode?:'online'|'paper'}`。创建相应阶段；已有未提交题组时返回其ID供恢复。复测需先提交练习。
- `POST /tasks/:id/adjust`：`{expectedVersion,reason,pointOrder:[...],note?:string}`。调整执行顺序及备注，保存新任务版本；不能悄悄改变本轮测量范围或答案。

比较包含 `comparable`、`reasons`、前后客观作答计数、样本量与覆盖。方法、范围、题量、难度、内容版本/来源不同或隔离、主观题未核对、已见题等均有明确说明，不生成进步百分比。缺失点为 null/未覆盖。

## 教师版本审核、纠错与打印

- `POST /content/:id/review`：`{expectedVersion,confirmed:true,reason}`，仅教师对具体当前版本真实核对后标 `human_reviewed`。
- `PATCH /content/:id`：`{expectedVersion,payload,reason}`，保留历史，修订后恢复 `draft`，不继承审核标记。
- `POST /content/:id/report`：`{expectedVersion,severity:'minor'|'serious',reason}`；学生/老师可报告，严重问题隔离当前版本，旧作答保留但不作为有效进步结论。
- `GET /export?kind=report|task|handout|worksheet|evidence&id=...`：返回权限一致的打印数据；家长仅 report 摘要。不公开私有 PDF 或图片。

native 初始内容仅在来源、结构与固定独立自动校验清单的题/点 hash 全部匹配时允许 `auto_checked`。该状态永远不等于 `human_reviewed`；修改题、讲义或适用范围后不能继续使用旧自动校验结果。
