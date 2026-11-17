# 独立作业实现只读复核

日期：2026-11-14。检查src/homeworks.mjs、migrations/0004_homeworks.sql、public/homework-workspace.js、成长/打印接入和已有作业测试。本子任务没有修改运行代码、迁移、旧math或原型，仅新增本文；复现均在fixture的内存SQLite、随机回环HTTP端口和独立浏览器上下文中使用合成账号。

## 1. 已发现并反馈的问题

### A. 来源学习包在校验后、发布前变化时仍能发布（已由主任务修复）

原publish逻辑先compiled读取并比较source_pack_json，再在batch中只检查作业revision、状态与授课关系。可在这两步之间通过合法`PATCH /packs/{id}`改变来源包，造成先读校验失效。

实际复现：

1. 关联老师审核数学内容；学生完成诊断，老师批准包含方程/分数的包（revision=2）。
2. 从该包建立两题作业草稿。
3. 在作业发布DB.batch入口确定性交错执行真实pack PATCH，把包改成仅分数（revision=3）。
4. 原实现两个请求都200；作业变published，来源快照仍revision=2且含方程题，而当前包只有分数。

观察值：`concurrentPackUpdate=200`、`publishStatus=200`、`storedSourceRevision=2`、`currentPackRevision=3`。这不是直接修改生产库；只安排了两个实际API动作的交错。

主任务已在publish UPDATE里增加来源包ID/revision/org/student/subject/status条件，失败方保持draft且不产生发布审计；新增回归并报告通过。本子任务只读复查了SQL谓词和新增测试，没有重复运行该已通过测试。DTO现有sourcePackRevision，界面也明确“作业保留发布时题目，链接打开当前学习包”。

### B. 同一主区内迟到的详情响应覆盖后来选择的作业（已反馈，待主任务修复/回归）

`openHomework`在await API之后只检查`main.isConnected`。A、B两个作业详情共用同一main，所以该检查只能挡跨主面板切换，不能挡同页资源切换。

真实浏览器复现：老师列表先点A，延迟A的GET；再点B并等到B草稿显示；随后释放A。没有进一步用户操作，标题从“后点击的作业 B”变成“先点击的作业 A”。这会覆盖B未保存的输入、造成误编辑/误批对象。

建议：视图代次/当前resource token在发请求前更新，并在异步读取后验证。renderHomeworks迟到列表和保存/提交/批改完成后的回调也要遵循同一个当前视图条件，不能自动覆盖用户后来打开的其他作业；仅main仍连接不够。

### C. 从通关包创建草稿的网络重试生成新requestId，导致重复草稿（已反馈，待主任务修复/回归）

普通editor把requestId固定于表单生命周期，处理正确；但`homeworkFromPack`每次调用都`crypto.randomUUID()`。如果服务端已经创建成功、响应丢失，仍留在原包页面的同一按钮再次点击会作为全新创建。

真实浏览器/API复现：第一POST经route.fetch真正返回201后丢弃响应，界面显示结果尚未确认；数据库已有1份草稿。点击同一按钮重试后，数据库变2份同来源草稿且requestId不同。

观察值：`firstStatus=201`、`afterLostResponse=1`、`afterRetry=2`、`distinctRequestIds=2`、`sameSourcePack=true`。

建议：在openPack构造该按钮时生成一次意图ID，闭包保存并传给homeworkFromPack，失败后同按钮重试复用；成功离开后重新生成的按钮再产生新ID。不应在服务端禁止一个学习包对应多份合法作业。

## 2. 本次审查未发现绕过的重点边界

- access明确检查teacher_id等于当前老师，且再次allowStudent；列表、summary、growth.homeworkEvidence均有teacher owner过滤。
- 学生draft不可见，未graded时DTO不含correctOption/rationale；sheet在服务端对所有角色剥离答案、提交内容和批改结果。没有发现仅靠CSS隐藏的答案路径。
- 家长summary独立查询，只给family_summary和总分/状态，不透传学生正文、feedback或逐题note；admin没有默认学习内容读取权。
- 发布后题目/分值不可改，答案和批改写入均由revision+write_token门控；关系/账号active条件进入提交、批改的SQL谓词。
- requestId重放比较语义哈希，不依赖最新revision；更改答案/反馈/分值的重放拒绝，正常重复不会插入新答案或审计。
- sourcePack检查同学生/科目/批准状态与选题范围；paper参考只接受同机构、同学生、同科目已confirmed scored_paper，没有从观察档位或OCR置信分生成分数。
- 作业实际提交单独进入homeworkEvidence，未批改score=null，合法零分仍为score对象；不新建attempt/retest，不自动修改pack状态或复制第二份paper。
- 运行判分没有导入DeepTutor通用相似度逻辑。

以上是有限代码审查结论，不是完整安全认证；浏览器打印、workerd事务和新UI回归最终结果以主任务验收为准。本次没有重跑已有整套测试，仅运行三项有明确假设的定向复现。

主任务仍在并行实施；本文问题状态应结合其随后修复和回归记录读取，不要把审查时缺陷当作最终代码仍存在。

## 主任务后续处理（2026-11-14）

上述A/B/C均已修复并完成定向回归：A由真实pack PATCH交错测试验证发布409且不写审计；B增加视图代次、当前DOM标记和科目目录代次，`homework-view-race-test.mjs`两项通过，迟到A和迟到数学目录均不覆盖后来内容；C在来源包按钮闭包持有同一requestId，桌面/手机真实响应丢失测试重试后只有一份草稿。保留上面的原始复现过程作为修复依据。
