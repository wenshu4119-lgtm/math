# 受保护学习问答：发布交接

本批允许学生、教师用自己的话输入学习问题，范围仅为三篇原创讲解：等式性质与一元一次方程的方法、有理数基础四则运算、一般现在时 be 动词。不是固定问题选择器，也不是完整全科AI教师。继续使用既有本地Qwen3-0.6B与真实embedding，不接外部模型、不产生模型API付费，不读取学生档案、作答表或题库答案。

## 实际验证

- `test-results/learning-qa/preflight.json`：正式站、代理、旧固定实验室与两个模型均active、NRestarts0；可用内存2154744KiB，旧lab约172MiB。
- `ingestion.json`：仅新建`learning-qa-original-20261114`，三份原创TXT（1107、1032、1107字节）真实建索引54.09秒，固定SHA，既有KB不变。
- `live-evaluation.json`：10条现场负例（范围外、提示注入、个人资料、二次方程、除零/无唯一解）全部在模型前拒答，模型调用0。5个不同自然语言学习问题实际运行模型，初轮2个概念解释可展示但待核对，3个被保守阻止。实际检索/调用进程峰值RSS210996KiB（约206MiB）。这些是很小的测试集，不能外推准确率。
- `output-diagnostics.json`保存三条合成问题的真实原始输出。两条数学只输出方法文字，没有给出数值；英语正确输出is，但最初被最小长度错误拒绝。
- 修复短答案误拒并要求模型自己计算后，`output-diagnostics-refined.json`中英语is通过；方程3x+4=19实际错答3（应5），3+4×2实际错答10（应11），两者仍被独立精确检查阻止。没有把计算器结果作为模型答案返回。
- 概念解释未完成语义正确性证明，统一显示“模型解释·待核对”；明确AI可能出错、未经老师审核、不评分。数值/英语样例通过检查也不等于教学正确性认证。

部署后两个英语问题的追加诊断，各仅一次真实调用，记录在`english-deployed-output-diagnostics.json`：问not放在哪里，模型仅回答“not”，没有提供位置；They ___ ready实际错答am。这不是引用错误形式作反例，也不是正确短答被误拒。保留拒绝，不修改validator门槛，不继续重试。添加对应自动回归后Python共8组；这些观察进一步说明现有0.6B在简单英语问题上仍不稳定。

精确解析器最终修正：数值常量通过`ast.get_source_segment`取得原始数值词法串后构造`Fraction`，不再先把AST浮点值转成字符串，避免长小数被预先舍入。`0.123456789012345678+0`保持精确值，舍入为`0.12345678901234568`的模型答案拒绝；普通`0.1+0.2`仍精确为`0.3`，数值绝对值10000上限也以精确有理数检查。新增本地回归后Python9组通过，保留14正例/34负例及禁日志检查。本修正没有增加模型调用或修改服务。

## 权限、隐私与运行限制

只有当前有效student/teacher会话可调用；每项任务同时绑定机构、本人及请求UUID。会话、角色撤销后，在最终写入或返回前再次检查。其他学生、其他老师、家长、管理员及其他机构不能读取任务。写操作继承CSRF与Origin检查。

接口只接subject、question、requestId与明确不含个人资料的确认；不接studentId、sourceIds、URL、上传或任意工具。5–300字、全角规范化，联系方式/明显身份字段先拒绝。个人资料检测是有限规则，页面仍明确要求不要提交任何真实学生材料。问题仅发127.0.0.1桥接；模型配置每次要求为既有本地端点，否则关闭。

数据库`learning_qa_jobs`只存按用户HMAC的问题摘要、所有权、状态与结果摘要，不存问题或回答原文。问答结果内存缓存有独立30分钟定时销毁（无后续访问也删除）；进程重启即丢失。界面没有localStorage，隐藏/返回/换号重新鉴权并清空旧输入；X-Actor-Id必须匹配。幂等重试读取已有完成结果，不再次执行模型。

上游DeepTutor默认日志会打印query前50字；本独立进程在导入/调用前禁用标准logging，独立service stdout/stderr为null。`log-audit.json`只读检查既有模型/embedding/旧lab最近2小时journal，没有发现本轮合成问题片段或模型密钥；未返回原始日志。临时问答缓存30分钟不等同于承诺整个共享模型进程的所有运行时内存已物理擦除。

单问答执行并发1、临时任务总数24、每用户每小时8次；新服务CPU20%、MemoryMax350MiB、仅localhost网络。旧固定实验室保持不变，两者共享原模型，若同时使用可能排队。尚未验证生产并发容量、真机和物理打印。

## 接线和必须打包的文件

根已在api.mjs接入：

```js
import {learningQaRoutes,publicLearningQaStatus} from './learning-qa.mjs';
// GET /api/v1/public/learning-qa-status => publicLearningQaStatus(env)
// 认证链 => learningQaRoutes(request,env,path,user,url)
```

新增路径：`GET /learning-qa/status`、`POST /learning-qa/jobs`、`GET /learning-qa/jobs/:id`。公开状态是15秒缓存的真实就绪探测，不运行模型或embedding。

正式后端必须包含：

- `src/learning-qa.mjs`
- `migrations/0009_learning_qa.sql`
- **`integrations/learning-qa/sources.json`**（后端模块直接import，遗漏会无法启动）
- `integrations/learning-qa/sources/*.txt`（三份原创源与哈希依据）
- 既有src/security.mjs与draft-provider.mjs依赖保持
- `scripts/learning-qa-deployed-smoke.mjs`（部署后隔离验收）

静态发布：`public/learning-qa.html`、`.js`、`.css`。只服务public目录；不要公开runtime、数据库、integrations或测试输出。

独立VPS安装输入：`integrations/learning-qa/bridge.py`、`learning-qa.service`。源声明是`platform-internal-use`（仅本平台教学使用），未替用户授予新公开许可；来源TXT内容哈希未因声明修改而改变。

## 根统一部署及回滚

本代理没有执行任何服务安装/启停或生产runtime修改。根审查后运行：

```text
py -3.14 scripts/deploy-learning-qa.py --stage
py -3.14 scripts/deploy-learning-qa.py --activate
```

stage仅写新`/opt/learning-qa/bridge.py`、`/etc/systemd/system/learning-qa.service`及`/var/lib/deeptutor/local-models/learning-qa.key`。activate先检查真实ready，再只给`/etc/learning-platform/runtime.json`增加`LEARNING_QA_ENABLED/ORIGIN/TOKEN`，原键备份到`/etc/learning-platform/learning-qa-before.json`，不输出令牌。该脚本不会重启网站；根用自己的受控发布流程切换新后端、迁移9并重启。

根应在新发布目录、启用新服务后，先运行受限环境真实测试：

```text
node scripts/learning-qa-deployed-smoke.mjs /etc/learning-platform/runtime.json
```

脚本导入实际新API，仅用独立`:memory:`数据库与合成teacher/student/parent/foreign账号；只继承三项QA配置，不打开生产DB。逐条真实自由输入至终态，核验负例0调用、跨机构404、幂等、原文不落DB、不生成正式成绩/真人审核。200/202不当作模型成功，分别报告needs_verification/unreliable/refused。

紧急关闭：runtime把`LEARNING_QA_ENABLED`设false并重启网站；原lab不受影响。完整功能回滚：`py -3.14 scripts/deploy-learning-qa.py --rollback`只恢复QA三键并停用新service，再由根重启网站；保留KB、源、模型、原lab及历史摘要。迁移9为追加独立表，旧代码可以保留该表，勿删库或回滚学生数据。

## 自动化与浏览器检查

15项Node测试通过，涵盖真实handleApi接线、CSRF/Origin、角色/所有权/跨机构、隐私拒绝、摘要保存、幂等及丢响应恢复、TTL、伪造引用、会话撤销、关闭开关、结果变更、每小时预算。Python7组测试涵盖9正例、22负例、精确线性/四则规则、错答案、无eval、禁日志与无后续请求的缓存销毁。

发布前独立复核发现并修复范围误放行：普通句子含is/be/subject或why不再当作语法意图，英语equality/equation采用词边界，含数字的历史问题不再当作普通运算。更新后的Python仍7组，通过14正例、34负例；`scope-regression-v2.json`证明这些规则在VPS现场运行时负例未进入模型路径，调用0，且禁query日志仍有效。此有限回归不能证明通用分类完美，可能保守拒绝有效问题。部署后smoke已加入sky/capital/favourite subject/be rich/social inequality/数字历史六例，需在实际新服务限制下再次核验。

桌面1440与手机390视口30项真实浏览器检查通过，包括学生/老师自由输入、家长/管理员拒绝、不可用提示、必选隐私确认、丢POST响应后复用完成结果、来源/待核对标签、TTL清空、拒答、服务失败、换号/撤会话/X-Actor-Id检查、无横向溢出和无页面异常。浏览器模型为明确的本地UI契约替身，截图和报告标注synthetic；不冒充上面的真实模型证据。手机截图已目检，按用户要求不做真机测试。
