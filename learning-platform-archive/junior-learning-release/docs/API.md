# 前后端 API v1 与 Antigravity 交接

艺考文化课为独立高中模块，追加接口见 [ARTS-API](ARTS-API.md)，采用`/arts/*`与`/public/arts/catalog`，不与本页初中题库、评分和统计合并。当前初中/学习问答补充契约仍为`content-api-contract.json`；所有当前API共享既有会话、CSRF和角色边界。

当前基础机器契约：[openapi.json](./openapi.json)（OpenAPI 3.1，业务版本 **1.6.1**）保持不变。本轮题库、分页、公开覆盖统计、DeepTutor 教师样例实验及受保护学习问答见独立补充契约 [content-api-contract.json](./content-api-contract.json)，补充版本 **1.8.0-content**，列出 23 路径/25 操作的实际方法、角色、严格请求字段、响应字段及错误语义；其中 `/health` 覆盖旧契约对应 AI 状态字段。生成命令为 `node scripts/generate-content-api-contract.mjs`，不修改原 `generate-contract.mjs`。补充文件保存11份相关后端/迁移/来源文件的SHA256。本文件描述本轮content-2候选代码，**不作为前后端均已发布的证明**；实际版本、启用开关和验收以本轮release发布报告及线上状态为准。

部署、题目核验与边界见 [题库发布交接](./QUESTION-BANK-RELEASE.md)、[DeepTutor 实验室交接](./DEEPTUTOR-LAB-HANDOFF.md) 和 [受保护学习问答交接](./LEARNING-QA-HANDOFF.md)。题库难度统一为超低、低、中等、高、超高；知识点统一定级与题目版本内的知识难度快照分别维护。教师审核、独立发布、撤回和修正均保留版本；自主练习不写正式成绩。公开统计仅聚合当前真实数据库，不能据全站计数推定某机构的审核或学生授权。`GET /bank/imports`还列出新学科pilot批次及`requiresTeacherReview`；导入仍只允许管理员，pilot强制待真人审核，`studentPracticeAdded=0`，不因数值检查通过而自动开放给学生。

本轮健康接口的`ai`枚举为`limited_learning_qa | limited_teacher_lab | unavailable`，同时固定返回`aiGeneration: "unavailable"`、`aiFormalGrading: false`。受保护学习问答就绪时优先报告`limited_learning_qa`；否则保留旧教师样例实验室状态。`GET /public/ai-status`因此有两个实际响应分支：学习问答分支带`capabilities.freeInput=true`，不返回旧lab分支的`checkedAt/cacheMaxAgeSeconds`；需要完整问答TTL/隐私状态请用`GET /public/learning-qa-status`。

`GET /bank/practice`保持`data`数组，新增`subject/grade/knowledge/difficulty/purpose/offset/limit`筛选分页，默认`limit=100`、最大100，网站每页20题。响应头`X-Total-Count/X-Offset/X-Limit`分别给出当前机构、当前筛选下的总数、偏移和上限；`data.length`只代表本页。未知或重复参数、不合法筛选值及分页返回400。列表不下发答案/解析，切换查询或页码须清除旧解析；作答后仍按具体版本请求答案。

受保护学习问答新增`GET /learning-qa/status`、`POST /learning-qa/jobs`、`GET /learning-qa/jobs/{id}`。只允许有效teacher/student会话，任务同时绑定本人和机构，其他教师也不能代读；写请求继承Origin与CSRF检查。POST仅接受`requestId`（UUID v4）、`subject`（math/english）、`question`、`noPersonalDataConfirmed:true`。问题在NFKC规范化、trim后须为5–300个UTF-16代码单元的普通文本，识别到的姓名、联系方式、学号等资料会被拒绝；规则有限，不能把通过过滤当作隐私许可。范围仅为已核对的原创讲解，当前包括等式与一元一次方程方法、有理数基础运算和一般现在时be，不读取学生档案或题库答案。

每用户每小时最多8个新问答请求。同一请求UUID与相同规范化问题/学科幂等，不重复模型调用；改用另一问题返回409。平台数据库只保存按用户HMAC的问题摘要、所有权、状态、结果摘要和过期时间，不保存问题或回答原文。临时正文缓存最多30分钟，平台TTL到期GET返回410；上游缓存丢失也可能返回200且`state=expired/result=null`。30分钟不代表删除任务摘要，也不承诺所有运行时内存的物理擦除。POST返回`result:null`，客户端应继续GET；HTTP200/202均不等于可靠回答。`refused/unreliable`不提供替代答案，`needs_verification`仍明确未经老师审核且禁止正式评分。旧`/ai-lab`固定样例继续仅供教师，其失败详情与新问答的`state/outcome`结构分别按补充契约处理。完整全科自由问答、AI出题和正式AI评分均未开放。

以下保留既有阶段交接。第七阶段教师方案/课后反馈复用既有学习包、作业与家长摘要，不增加该阶段路由或表；学习包更新补充提交时原子授课授权检查。当前学习轮次、活动摘要、范围快照、独立作业、阅卷和OCR协议保留。

## 教师方案与课后反馈（第七阶段）

`public/teacher-workspace.js`使用真实`/students`授权名单作为学生上下文；导航只对老师可见，数据仍由服务端逐资源鉴权。新旧页面共享`teacher-editors.js`的审阅和批改表单。

| 页面行为 | 既有接口与边界 |
|---|---|
| 选择/匹配学习方案 | GET /packs、/attempts，POST /packs传diagnosticId；必须实际已提交筛查，匹配规则未改成AI |
| 保存方案草稿/批准 | GET /packs/{id}、/knowledge；PATCH /packs/{id}，字段为revision、knowledgeIds、teacherNote、approve |
| 从方案布置作业 | 复用已批准包worksheet和现有作业草稿创建/发布流程，不能自动提交学生作答 |
| 选择作业/人工反馈 | GET /homeworks、/homeworks/{id}；仅当前负责老师且仍绑定；submitted时才可POST /grade |
| 公开给家长 | GET /students/{id}/homework-summaries；老师仅看本人负责作业的摘要，家长按亲子关系读取授权摘要 |

方案草稿示例：`{"revision":1,"knowledgeIds":["math-equation"],"teacherNote":"先代回检验。","approve":false}`。响应片段：`{"data":{"status":"draft","revision":2,"teacherNote":"先代回检验。"}}`。批准使用同一PATCH与`approve:true`，开始学习后只读。所有绑定老师可审核学习包，独立作业则仍有创建老师所有权，不能混淆。

PATCH的revision检查和机构/有效师生关系检查位于同一UPDATE中；检查后撤销关系也无法写入。已无读取权返回404 NOT_FOUND，有权但版本或学习状态变化返回409 VERSION_CONFLICT；不伪造currentRevision。只有实际更新成功才写pack_reviewed审计。

冲突/网络失败时保留当前页面草稿。读取最新版本不替换输入，展示服务端值供比较，须明确确认后才能用当前输入更新。401/403/404关闭敏感工作区；切学生、账号或离开页面清除未保存输入。未保存内容不进入PDF、JSON、CSV或localStorage。

批改结构与下方v1.3一致：`feedback`是给学生的反馈，`familySummary`是公开摘要；不是teacherFeedback。同一requestId、同一内容重试成功返回已有记录，不是一概409；不同内容或其他已完成批改竞争返回409。若保存成功但响应丢失，可GET真实记录并查看已保存反馈，不能据网络错误认定保存失败。人工得分为空保持缺失，不默认0或满分；没有独立课次/课堂反馈接口。

Antigravity最新LiveService实际已使用revision/feedback，交接文字仍出现expectedVersion/teacherFeedback；以代码和本契约为准。候选drop-in与本项目的h/card/exportsFor签名不同，不能不经适配直接导入，详见ANTIGRAVITY-HANDOFF-ALIGNMENT。

## 通用约定

- 同源 `/api/v1`，原生 fetch，`credentials:'same-origin'`。不允许将旧预览任意端口通过宽泛 CORS 接入；将前端放入独立项目 `public/` 或在同源本地代理调试。
- 成功 `{data: ...}`；错误 `{error:{code,message,requestId}}`，非2xx不能当空成功。具体含义在 OpenAPI。资源不存在和无权访问通常都返回404。
- Cookie：本地 `lp_session`；正式环境 `__Host-lp_session; Secure; HttpOnly; SameSite=Strict; Path=/`。8小时固定过期，登录撤销此前会话，改密/停用撤销会话。不在localStorage保存token或业务数据。
- 认证成功的API响应增加`X-Actor-Id`（服务端当前用户ID，不是凭据）。工作台按会话代次丢弃旧响应；读取数据时校验响应身份，避免共享浏览器账号切换后的界面串用。导出的一组读取绑定到同一个用户，身份变化立即停止预览。匿名health/login不要求此头。
- 登录也要求正确 `Origin`；其他写操作同时要求 `X-CSRF-Token`，来自登录或 `GET /auth/session`。服务端逐资源校验机构、角色、绑定；前端role只是展示。
- 时间：服务器UTC ISO8601，前端按本地时区展示；上传expiresAt为epoch毫秒。ID均为服务器生成，不编码真实身份。
- `revision` 乐观锁；冲突409后重新加载。作答单次提交，不重写历史；网络重试应先GET确认状态，不盲目重新生成作答。
- 未提交attempt不返回correctOption/rationale；真实分数仅由服务器从快照判定。教师录入标teacher_recorded，不把代录当student_self。
- 匹配是rule-v1规则。未审核内容409 CONTENT_NOT_REVIEWED；学习包须教师批准，练习提交后才能复测。已有学习包开始后锁定调整。

## 主要调用链与示例（结构示例，不是预置学生记录）

### v1.5：本轮下一步与学习包活动

- `GET /students/{id}/learning-cycle?subject=math`：本人或关联老师可读。按当前科目最新创建的diagnostic（同时间以rowid确定顺序）及其diagnostic_id关联包返回`{diagnostic,pack,practice,retest}`。无筛查时四项均null；新一轮不继承旧包复测。家长/管理员不使用此学习明细接口，继续走growth摘要。
- `GET /packs/{id}/activity`：同pack逐资源权限，返回`{pack,practice,retest}`。按该包直接查实际练习/复测，**不从最近100条列表中推断“没做过”**。没有对应作答时为null。
- diagnostic/practice/retest为`AttemptProgress`：id、subject、phase、packId、status、source、submittedAt、scope，以及result。open时result=null；submitted才有`{correct,total}`。没有题干、选项、正确答案或解析。pack为既有Pack结构。
- 两个接口均只读、不增加学习记录。界面标签/翻卡不是保存操作，不写已掌握、已学完、完成百分比或成长数据。实际作答仍经POST /attempts与submit，批准仍经原PATCH /packs revision。
- 前端须丢弃账号/学生/视图切换后的迟到响应；读取失败清空材料并提示重试，写请求响应丢失提示“结果尚未确认”，重新读取活动找回已创建作答，不能声称未保存或改用Mock。

结构示例（非已保存学生数据）：

```json
{"data":{"pack":{"id":"pack-id","studentId":"student-id","status":"approved","revision":2,"materials":[]},"practice":null,"retest":null}}
```

这里只示意外层结构，实际Pack字段以OpenAPI为准；有效学习包应有材料，空材料界面拒绝开始练习。包、作答、成长的既有导出仍分别使用原授权GET；新摘要不增加一个可绕过权限的PDF地址。

### v1.4：专项筛查与范围快照

`POST /attempts`在phase=diagnostic时可带可选knowledgeIds：

```json
{"studentId":"student-id","subject":"math","phase":"diagnostic","knowledgeIds":["math-equation"]}
```

必须1–20个不重复的当前科目知识点，全部经过当前机构教师审核。空数组、null、混科、未知/重复项400 INVALID_SCOPE；存在未审核项409 CONTENT_NOT_REVIEWED。所选范围缺少必需样题仍409 CONTENT_INCOMPLETE，不创建部分成绩。省略knowledgeIds保留原本科目全部示例筛查，仍要求本科目所有示例点审核完成。practice/retest若带该字段返回400，其范围只能来自批准学习包。

Attempt、AttemptSummary（列表）和Growth.evidence新增服务器范围字段，响应片段如下：

```json
{"scope":{"mode":"selected_topics","topics":[{"id":"math-equation","title":"一元一次方程：等式的性质","version":1}]}}
```

mode含subject_examples（本科目全部示例）、selected_topics（明确选择）、pack_topics（学习包练习/复测）、legacy（历史快照未保存选择模式）。它不是能力等级。title/version来自创建时题目快照，不随目录更新改写；legacy可能title=null，只能显示保存的ID/版本及“历史题目范围”，不得推定为全科筛查。客户端不得自报scope、题干、分数或审核状态。

数据保存在既有attempt_items.snapshot_json中，新增scopeMode/knowledgeTitle，不修改历史行或新增数据库表。列表和成长按已授权attempt ID批量读取保存快照；返回scope不含答案/解析。前端与PDF统一使用public/assessment-scope.js，已有attempt/attempts/growth导出显示范围；学习包仍显示其实际材料范围。家长在授权成长摘要中可见范围，不因此获得测评题目或作答明细权限。

专项只覆盖所选示例点，未覆盖不补0；教师之后调整学习包可改变学习/复测范围，前后不同范围的计数不能换算成能力增长率。独立作业和人工阅卷仍不替代复测。

```js
const login = await fetch('/api/v1/auth/login', {
  method: 'POST', credentials: 'same-origin',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({username:'student', password: passwordFromUser})
});
const {data:{user,csrfToken}} = await login.json();
```

浏览器自动设置Origin，前端不伪造该头。这里的passwordFromUser只存在于输入/请求内存，不记录日志。

```json
{"data":{"user":{"id":"student-id","username":"student","displayName":"同学A","role":"student"},"csrfToken":"opaque-server-value"}}
```

老师调用 `GET /content/review-queue` 查看材料、选项、标准答案及独立推导，人工核对后：

```http
POST /api/v1/content/math-equation/review
Content-Type: application/json
X-CSRF-Token: <current-session-value>

{"version":1,"confirmed":true}
```

创建筛查，客户端不能传questionIds/score：

```http
POST /api/v1/attempts

{"studentId":"student-id","subject":"math","phase":"diagnostic"}
```

```json
{"data":{"id":"attempt-id","studentId":"student-id","subject":"math","phase":"diagnostic","packId":null,"status":"open","source":null,"submittedAt":null,"result":null,"questions":[{"id":"math-equation-diagnostic","knowledgeId":"math-equation","prompt":"解方程 2x + 3 = 11，x = ?","options":["4","7","5","8"],"isExample":true}]}}
```

上例仅展示题目结构；实际数学筛查包含2题，提交必须包括服务器返回的全部题目。提交body：`{"answers":[{"questionId":"...","selectedOption":0},...]}`，0起始选项索引。重复、遗漏、额外题目、无效选项、客户端score均拒绝。提交成功返回相同Attempt结构并增加逐题actual/correct/rationale与`result:{correct,total}`。

`POST /packs {"diagnosticId":"..."}` → 201新包或200已有包：

```json
{"data":{"id":"pack-id","studentId":"student-id","diagnosticId":"attempt-id","subject":"math","status":"draft","revision":1,"knowledgeIds":["math-equation"],"weakKnowledgeIds":["math-equation"],"materials":[{"id":"math-equation","title":"一元一次方程：等式的性质","explanation":"示例讲解文本","memoryCard":"示例卡片文本","version":1,"isExample":true}],"teacherNote":"","reviewedBy":null,"reviewedAt":null,"algorithm":"rule-v1:wrong-topics-else-consolidation","isExample":true}}
```

老师 `PATCH /packs/{id}`：`{"revision":1,"knowledgeIds":["math-equation"],"teacherNote":"先代回检验","approve":true}`；同科目已审核点可调增/调减。学生再创建`phase:practice,packId`，提交后创建`phase:retest,packId`。若课程版本与已保存学习包不符，返回409并要求老师重新审核。

`GET /students/{id}/growth` 的在线测评evidence只从已提交answers生成；paperEvidence与homeworkEvidence分别保留人工阅卷和独立作业口径。以下是在线测评部分结构示例：

`topicEvidence`按知识点与phase只返回有实际提交答案的行，answered为正数；**未返回的知识点/阶段表示暂无有效样本或未覆盖，不是0分**。前端不得与整个knowledge目录合并后给缺失行补0、计算0/0或生成薄弱预警。correct=0且answered>0才表示真实答对0题。未提交attempt的result=null，不进入成长证据；缺少必需筛查题时创建返回CONTENT_INCOMPLETE/409，不生成部分成绩。人工卷面分的null与0也不同：缺分草稿report=null，已确认零分为正满分下的earned=0、percent=0。详见MISSING-EVIDENCE-VERIFICATION。

```json
{"data":{"studentId":"student-id","evidence":[{"id":"attempt-id","phase":"diagnostic","subject":"math","packId":null,"correct":1,"total":2,"source":"student_self","submittedAt":"2026-11-13T11:00:00.000Z"}],"topicEvidence":[{"knowledgeId":"math-equation","title":"一元一次方程：等式的性质","phase":"diagnostic","answered":1,"correct":0}],"comparisons":[],"notice":"仅反映已提交示例题作答，不代表完整能力。"}}
```

## 私有图片及人工核对

`POST /uploads?studentId=...`，Content-Type为image/png或image/jpeg，body是原始字节（不是multipart，不接URL或任意文件路径）。2MiB、尺寸上限及签名/结构检查；文件名不存储；PNG文本类元数据/JPEG EXIF等移除；内部随机对象键不返回。不是完整杀毒或图像解码器。

```json
{"data":{"id":"upload-id","studentId":"student-id","status":"needs_review","ocrStatus":"unavailable","correctedText":null,"revision":1,"expiresAt":1794660000000,"notice":"OCR未接通，请人工录入核对；不会自动成为题目或成绩。"}}
```

`POST /uploads/{id}/recognize`在未配置OCR时仍503，已启用本机OCR时按下节执行。`PATCH /uploads/{id}/review`仍仅保存原有人工文本，不等于教师OCR确认或阅卷完成。图片与OCR记录共用24小时访问期限，家长不可读。

## 真实本机OCR（v1.2）

`GET /capabilities`返回真实技术可用性；可用不代表当前角色获得资源权限。Node用`--ocr`加载经核验本机引擎；Cloudflare没有OCR binding时available=false，绝不自动代理到旧math或外部AI服务。

`POST /uploads/{id}/recognize {"requestId":"<UUID>","language":"chi_sim+eng"}`（或eng）。先鉴权/CSRF/限流，再从私有存储读取现有图片字节，不接受任意URL/path/模型。初次成功201，重复requestId返回200同一记录（仍需检查status）；换语言复用requestId冲突409。

```json
{"data":{"id":"ocr-id","uploadId":"upload-id","studentId":"student-id","language":"chi_sim+eng","status":"needs_review","revision":1,"provider":{"id":"tesseract-local","version":"7.0.0","mode":"local-only","modelRevision":"87416418657359cb625c412a48b6e1d6d41c29bd","languages":["eng","chi_sim+eng"],"networkImagesSent":false},"imageDigest":"sha256-of-stored-image","text":"真实引擎返回的原文（可能有错）","confidence":92,"elapsedMs":950,"errorCode":null,"reviewedText":null,"reviewedBy":null,"reviewedAt":null,"createdAt":"2026-11-13T14:00:00.000Z","completedAt":"2026-11-13T14:00:01.000Z","expiresAt":1794664800000,"needsReview":true,"notice":"OCR只提供未审核文字，不评分。"}}
```

上例仅是响应结构示例，置信分不是准确率。空文字/失败/超时/过大输出不写替代文字，返回503及白名单错误码；已创建的失败记录可按资源GET读取。超过2分钟的running记录访问时标OCR_INTERRUPTED，不自动重跑。运行器忙429，同图重复并发409；每账号5次/15分钟，不宣称全局费用硬上限。

`GET /uploads/{id}/ocr-runs`返回最近20条状态/来源摘要，不带大段原文。`GET /ocr-runs/{id}`返回详情；本人和关联老师可读，家长/管理员不可读。`PATCH /ocr-runs/{id}/review {"revision":1,"text":"老师核对后的文字","confirmed":true}`只允许关联老师，状态需needs_review；确认后teacher_confirmed且文字冻结。学生原有上传文本确认不能绕过此门槛。

OCR输出不会自动创建题目、答案、分数或学习记录。老师确认后，`POST /papers`可带`ocrRunId`（其他字段照旧），只能引用同一学生的确认记录；建立空草稿，仍由老师手工拆题/录分。返回contentOrigin=teacher_reviewed_ocr_text及最小ocrProvenance（来源、摘要、教师/时间），不复制完整OCR原文。原图删除级联清除识别文字，既有阅卷最小来源摘要保留。

OCR记录清单/原文/修订/失败状态均有权限一致的PDF/打印。完整RAG与出题仍available=false；内部retrieveScoped只用于未来供应方边界验证，不是当前可调用的知识库API。

## 结构化人工阅卷（已实现）

`POST /papers`仅关联老师可调用：`{"studentId":"...","title":"随堂练习","subject":"math","kind":"scored_paper","requestId":"<UUID>","uploadId":null}`。kind也可为ability_observation，创建后不可切换。requestId同内容重试返回200已有记录，不同内容409；原图仅能关联同一学生有效上传。

`PATCH /papers/{id}`提交完整草稿：

```json
{"revision":1,"title":"随堂练习","items":[{"questionNo":"21(1)","parentNo":"21","prompt":"计算1/3+1/6，写出过程。","qtype":"solution","mappingLevel":"chapter","scopeText":"有理数","knowledgeId":null,"maxScore":4,"earnedScore":2.5,"observationLevel":null,"note":"依据原卷步骤给部分分","reviewed":true}]}
```

- 每份最多60条，请求≤64KiB。题号1–999、小题如21(1)，全角括号归一；不能重复、带前导零或同时录入父题与子题总分。
- 分值为数字，最多两位小数，服务端按整数百分位保存和求和；范围0–1000，满分>0。草稿可留空，确认须完整且实际分≤满分；0分必须明确填0。
- 映射为knowledge/chapter/unresolved；具体点须同科目，由服务端取标题/版本。章级或未映射范围不强制落入首个知识点。
- ability_observation只接受qtype=observation和observationLevel 0–3，maxScore/earnedScore须null，不换算72%或其他成绩。
- source/contentOrigin/AI分值不接受客户端自报。内容来源由服务端确定为manual_entry或teacher_reviewed_ocr_text；评分始终teacher_marked或teacher_observation，OCR/AI未参与评分。
- revision竞争失败时，后续所有明细删除/写入由本次随机write_token门控，因此不会覆盖获胜请求的题目。内部写令牌不返回前端。

`POST /papers/{id}/confirm {"revision":2,"confirmed":true}`在全部逐题reviewed且分值完整时原子冻结报告；重复确认409，只产生一次事件。确认后只读，更正/作废未实现。`GET /papers/{id}/report`对草稿返回409。

已确认卷面report示例：`{"kind":"scored_paper","algorithmVersion":"manual-paper-v1:explicit-leaf-score","itemCount":2,"score":{"max":10,"earned":6,"percent":60},"source":"teacher_marked","aiUsedForGrading":false,"byScope":[...],"observationCounts":[]}`。percent仅为卷面得分率。能力观察score=null，以observationCounts保存各档数量。

`GET /papers?studentId=...`中老师见关联学生草稿/确认，学生只见本人已确认。家长、管理员不能读明细/原图；家长通过`GET /students/{id}/paper-summaries`取已确认摘要。growth新增独立paperEvidence，不与选择题evidence或正确题数合并。

原图删除时解除关联，到期停止读取图片，已确认分值仍保留。papers/paper/paper-report/paper-summaries导出复用上述授权GET；JSON/CSV同样重新读当前权限数据，CSV转义公式前缀。更正、历史导入、试卷自动匹配学习包不在当前契约中。

## PDF / 打印协议

独立作业新增接口与权限见下一节。所有导出依据同一角色DTO；作业单即使由老师导出也不含答案。

前端统一 `exportUrl(kind, params)` → `/print.html?kind=...`。参数只是资源定位，不是授权证明。预览重新调用上述受保护GET；不存在独立的无鉴权PDF下载服务。点击打印再次核验数据/权限，过期/撤权/变动/图片失败则清空或刷新并阻止打印。

`GET /packs/{id}/worksheet`只返回已批准学习包练习题，不带答案、不创建成绩。教师讲义使用review-queue；其未经审核部分带水印。管理员报表使用本机构管理GET，绝不包含密码。详细全清单、分页样式和后续模块准入见 `EXPORT-INVENTORY.md`。

已有JSON/CSV导出不得因PDF取消；新平台MVP没有删除旧项目的任何导出功能。

## 独立作业（v1.3，真实实现）

状态为`draft → published → submitted → graded`。一份作业对应一个学生和一个创建老师。老师须同时是负责人且仍与学生绑定；其他绑定老师也不可读。学生仅看自己的已发布作业；家长仅看独立摘要；管理员没有学习明细读取权。账号/机构/绑定仍由服务端判断。

| 方法与路径 | 行为 |
|---|---|
| GET /homework-catalog?subject=math | 老师获取本机构已审核practice题，含答案用于备课；不接受任意题干或AI题 |
| GET /homeworks?studentId=... | 学生本人已发布记录，或当前负责老师的草稿/记录；最近100条 |
| POST /homeworks | 创建草稿，同一requestId和同一内容重试返回已有记录 |
| GET /homeworks/{id} | 当前角色可见的保存记录，学生批改前没有correctOption/rationale |
| PATCH /homeworks/{id} | 仅草稿，整体更新题目和分值；revision并发冲突409 |
| POST /homeworks/{id}/publish | 老师确认发布，校验内容审核与来源包版本；发布后题目/分值冻结 |
| POST /homeworks/{id}/submit | 仅学生本人完整提交一次；不接收score或代录来源 |
| POST /homeworks/{id}/grade | 仅负责老师，对已提交记录逐题人工录分并确认 |
| GET /homeworks/{id}/sheet | 老师/本人授权作业单，所有角色均剥离答案、作答、反馈和成绩 |
| GET /homeworks/{id}/feedback | 仅graded记录，未批改409；权限同明细 |
| GET /students/{id}/homework-summaries | 本人/负责老师/关联家长，仅状态、实际总分、familySummary，无题目或作答正文 |

创建请求结构示例（示例ID，不是已创建的学生记录）：

```json
{"studentId":"student-id","subject":"math","title":"方程与分数巩固","instructions":"写出关键步骤","dueAt":null,"sourcePackId":null,"items":[{"questionId":"math-equation-practice","maxScore":4},{"questionId":"math-fraction-practice","maxScore":6}],"requestId":"12345678-1234-1234-1234-123456789abc"}
```

草稿PATCH字段为`revision,title,instructions,dueAt,sourcePackId,items`，不能更换学生/科目/负责人。最多20题，请求≤64KiB；满分0.01–1000，分值最多两位小数，整数百分位计算。dueAt为带时区ISO时间或null，只作为提示，迟交仍收取且不会自动扣分。sourcePackId仅接受同学生/科目已批准学习包，题目须在相同知识点版本范围；发布SQL再次校验来源包revision，阻止检查与提交之间的版本变化。记录返回sourcePackRevision，之后来源包变化不改写已发布题目。

发布：`{"revision":1,"confirmed":true}`。学生提交：

```json
{"revision":2,"requestId":"22345678-1234-1234-1234-123456789abc","answers":[{"questionId":"math-equation-practice","selectedOption":0,"workText":"我先移项，再除以系数。"},{"questionId":"math-fraction-practice","selectedOption":0,"workText":"先通分。"}]}
```

selectedOption为0起始索引；须覆盖全部题目且不可重复。workText可选，每题≤2000字符，作为原始学生文字保存，不当成已核验公式。提交后返回status=submitted、result=null；**直到教师完成批改，学生才获得参考答案与解析**。没有自动评分或教师冒充学生提交。

教师批改：

```json
{"revision":3,"requestId":"32345678-1234-1234-1234-123456789abc","marks":[{"questionId":"math-equation-practice","earnedScore":4,"note":"步骤完整"},{"questionId":"math-fraction-practice","earnedScore":1.5,"note":"通分正确，后续计算待复习"}],"feedback":"请重点复习分数计算。","familySummary":"已完成作业，建议复习分数。","paperId":null,"confirmed":true}
```

所有题目必须录入0至满分之间的实际分；feedback为给学生的反馈，familySummary为可选家长公开摘要（≤300字）。paperId只能引用同学生/科目已确认的scored_paper，不能引用观察档位或未确认卷；引用不复制、不自动取分，也不创建第二份人工阅卷记录。返回示例片段：`{"status":"graded","result":{"score":{"max":10,"earned":5.5,"percent":55},"source":"teacher_homework_marked","aiUsedForGrading":false}}`。完整字段以OpenAPI及契约测试为准。

create/submit/grade的requestId须在同一用户意图重试时复用；语义内容相同返回原记录（允许旧revision），不同内容409。不同请求竞争仅一个成功，失败请求的明细与审计由write_token门控。断网不能假称未保存：先重新读取状态；原包页面同一创建按钮重试保持requestId，仍允许以后主动布置另一份作业。

关系失效后学生可保留本人既有记录，但不可再提交给失效老师；老师读写均被拒绝。graded记录只读；当前不提供重新批改、作废、转交或批改草稿持久化。导出只取服务器保存版本。

成长新增`homeworkEvidence`，仅submitted/graded；未批改score=null，真实零分为`{max:10,earned:0,percent:0}`，不能混为“无数据”。作业不会完成pack、创建attempt/retest或推断提高。原`assignment`导出仍为通关练习单，和新独立作业并存。

## Antigravity 分工和保留边界

旧`platform-ui/services/dataService.js`仍原样保留。独立平台已复用其CSS并接真实API，没有加载原型Mock/localStorage数据层。下表映射已应用，人工阅卷另使用上节新增接口：

| 预览能力 | live 接入 | 禁止做法 |
|---|---|---|
| 角色切换/示例学生 | auth/session、students | 本地role决定权限 |
| 本地筛查与评分 | attempts创建+submit | 直接上传computeQuizReport分数 |
| 今日包/完成度 | packs、practice/retest | calcPackCompletion写入真实成长 |
| 独立作业 | homeworks、submit、grade与单独摘要 | 浏览器状态代替真实收交；未批改展示分数或提前下发答案 |
| 教师审核 | content/review、pack PATCH | 只切前端approved |
| simulateMockPaperOcr | uploads + recognize + review | 503后回落到Mock成功 |
| 成长历史/家长页面 | scoped growth | 合并mock家长历史或默认成绩 |
| 后台 | admin users/relationships/audit | 管理员默认读取全校试卷 |
| PDF/打印 | 复用export registry与print入口 | 另做只导出当前DOM的无权控通道 |

`judgeRatio`档位映射与旧math不同；`_isMock:false`也可能来自模拟OCR后人工点击，因此不能作为可信来源。live与demo数据必须独立，生产模式默认没有模拟基线。

建议所有权：Antigravity负责public/视觉和交互；后端维护src/、migrations/；共同维护OpenAPI与export registry。修改契约先更新示例与测试；每新增可保存页面同时增加PDF/打印、空/错/权限与分页验收。
