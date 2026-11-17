# DeepTutor 受限教师实验室交接

2026-11-14。本批仅连接两个原创固定样例：等式 `x + 2 = 5`、一般现在时 `She ___ a student`，另提供范围外拒答回归。完整自由问答、AI 出题、PDF 解析、AI 正式评分均未开放。自动检查不代表老师审核。

## 现场核查与真实执行

`test-results/deeptutor/live-inventory.json`：DeepTutor 1.7.2；既有 Qwen3-0.6B 与 Qwen3-Embedding-0.6B 仅在 127.0.0.1:18081/18082 监听，匿名调用401，DeepTutor知识库匿名401，生产8792匿名404。2核、约4GiB内存，检查时可用2367364KiB；模型服务各35%CPU/950MiB上限、NRestarts0。正式网站、试用网站、DeepTutor和代理当时均运行。

`ingestion.json`、`live-regression.json` 是本批真实执行证据：新建 `learning-lab-synthetic-20261114`，仅导入两份原创合成 TXT（648/505字节），实际建索引24.91秒；两条真实embedding均1024维、1.57秒；数学固定问答28.66秒返回3，英语19.99秒返回is，引用与原文逐字匹配并校验SHA。范围外先拒答、模型调用0。没有云模型、额外付费或真实学生材料；未修改既有模型profile及原知识库。不能把两个样例称为准确率认证或完整教学覆盖。

此前真实模型把She题选为am的错误不会静默修正：Python独立固定答案检查及Node二次检查均拒绝这一答案。模型新结果若不通过，则保留隔离状态，不返回正式答案或成绩。本实验不生成题库题目，不创建content_reviews、attempts、answers或question_drafts。

## 文件与接口

- `src/deeptutor-api.mjs`：认证后 `GET /ai-lab/status`、`POST /ai-lab/jobs`、`GET /ai-lab/jobs/:id`；仅teacher，实际有效会话及所有权再次核验。`/public/ai-status`只返回服务状态，15秒共享缓存、并发合并；不会触发模型或embedding调用。
- `migrations/0008_deeptutor_lab.sql`：独立教师实验记录，保存原始操作依据及完成状态，不关联学生评分。
- `public/ai-lab.html/js/css`：独立教师页面，固定选择，不接受自由文本；核对X-Actor-Id，页面隐藏/离开清空DOM，恢复重新鉴权，不使用localStorage存结果。
- `integrations/deeptutor-lab/bridge.py`：127.0.0.1:18083带私有令牌；仅固定预设和随机任务ID，永不接收账号、机构、学生、URL或任意提示词。单任务并发；每次推理检查仍使用既有本地模型及固定来源摘要，配置改变即拒绝。
- `integrations/deeptutor-lab/deeptutor-learning-lab.service`：独立deeptutor低权限服务，CPU20%、MemoryMax350MiB、仅回环网络；现有模型服务限额不变。

题库代理已在api.mjs挂接；根协调器负责复制明确文件、迁移8与最终上线。正式web health旧字段若仍写ai=unavailable，应以public/ai-status和教师入口的真实动态状态说明，不能冒称完整AI服务。

## 部署与回滚（只由根协调器执行）

本代理未安装/启停VPS服务或修改生产runtime。准备好的脚本：

```text
py -3.14 scripts/deploy-deeptutor-lab.py --stage
py -3.14 scripts/deploy-deeptutor-lab.py --activate
```

stage仅写`/opt/deeptutor-learning-lab/bridge.py`、独立systemd单元和随机私密令牌；变更前保留已有bridge/unit副本。activate启动独立服务并要求真实ready，然后只给`/etc/learning-platform/runtime.json`添加`DEEPTUTOR_LAB_ENABLED/ORIGIN/TOKEN`三键；旧值在同目录root私密rollback文件中。脚本不重启正式网站；根在其受控发布步骤重启。令牌仅存在私密文件和runtime，不打印或复制到前端。

部署后由根在新发布目录执行：

```text
node scripts/deeptutor-deployed-smoke.mjs /etc/learning-platform/runtime.json
```

该脚本导入实际部署API，使用独立`:memory:`SQLite和合成teacher/parent会话，仅继承三项bridge配置。不会打开生产库或真实账号。测试真实异步模型终态、父母403、匿名401、其他教师404、幂等，以及没有正式评分/审核。200/202本身不代表模型成功，报告分别记录outcome和answer。

回滚：`py -3.14 scripts/deploy-deeptutor-lab.py --rollback`只恢复三键并停用独立lab服务，然后由根重启网站使配置生效。保留新KB、源文件、模型、旧网站与实验历史。迁移8为追加表，代码回滚无需删除表。若要删除原创测试KB，需使用DeepTutor原生接口精准针对该名称，不批量删除知识库。

## 验证与限制

13项Node测试、4项Python桥接边界测试通过；覆盖实际handleApi接线、匿名/角色/CSRF/所有权、额外字段拒绝、幂等、会话和角色撤销竞态、错误答案、范围外模型调用阻止、不可用状态和禁止评分。模型现场测试与这些契约测试分别留证，契约测试不冒充真实模型测试。

桌面1440与手机390视口20项浏览器检查通过，见`test-results/deeptutor/browser-contract.json`与明确标记synthetic-fixture的截图；截图已目检。浏览器使用合成账号与明确本地契约替身检查异步交互，不冒充真实模型证据。修复了身份响应错配后错误提示被抑制的问题，以及长英文输出在手机溢出的问题；验证匿名/学生/家长限制、不可用提示、未审核标识、拒答、撤会话及身份错配清空、无页面错误。部署后服务限制验收由根统一执行；真机暂跳过。新服务350MiB内存上限尚待上线实际峰值核验；单任务CPU小模型可能缓慢。来源页应如实标识这是教师技术样例，不能描述为全科AI教师或完整RAG。

## 许可证核查

`docs/licenses/deeptutor-selected/inventory.json`与`metadata-check.json`保留实际安装元数据、文本路径和SHA。DeepTutor固定源码LICENSE为Apache2.0，完整文本已保留，VPS包元数据License字段为空；不能据此改称MIT。llama.cpp为MIT，Qwen两个模型卡/生成LICENSE声明Apache2.0。PyMuPDF现场literal `pymupdf-2.1.dist-info/METADATA` Version=2.1，声明AGPL3或Artifex商业许可；本批没有核查其商业授权，未开放PDF解析。COPYING仅64字节许可声明，不是完整AGPL文本。既有记录提到的libgomp版权指定路径现场不存在，属需补充核对的既有分发材料缺口，本批不分发模型或运行库二进制。

`deeptutor-selected`中以最新inventory列出的文件为准。`deeptutor-installed`是首次宽范围只读复制的未完成副本，保留但不作为正式发布清单。
