# DeepTutor 源码核查、复用边界与最小对接验证

核查日期：2026-11-13（Asia/Shanghai）。固定上游提交：[`60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db`](https://github.com/HKUDS/DeepTutor/tree/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db)，核查版本背景为 v1.7.2。源码取自 GitHub 的固定提交文件，保存在本项目已忽略的 `.local/references/deeptutor/`。该目录是部分相关源码的研究副本，不是一个已安装、可启动的完整 DeepTutor 发行包。尝试浅克隆曾遇 TLS 错误，改用 GitHub 连接器获取固定版本相关文件，没有执行参考项目的安装或部署脚本。

结论：可以实际复用 Apache-2.0 覆盖的资料命名、同名资料去重保存、来源引用结构，以及学习证据和待答题状态设计。完整知识库、学习引擎和模型出题适合放在独立 Python 服务中，通过受限适配层对接；不要把其文件存储、用户体系、默认无鉴权模式或通用判分逻辑原样当作本平台基础。

## 1. 本次真实完成与未完成

| 能力 | 证据与状态 |
| --- | --- |
| 真实源码研究 | 核查知识库 router/manager/staging、RAG factory/LlamaIndex pipeline、learning models/service/policy/grading/mastery/scheduler、题目 pipeline/router、auth 与 knowledge access |
| 真实最小对接 | 已执行 Node 启动器 → Python 回环 HTTP → 4 个固定版本原始 Python 模块；源码导入前校验 SHA-256，未重写这些模块的算法 |
| 文档暂存与去重 | 实际写入临时合成 Markdown；同内容同名复用，同名不同内容保留成第二个文件；不是向量知识库导入 |
| 判分与证据分数 | 实际运行上游 `grade_answer` 和 `compute_mastery`，发现具体反例，详见第 4 节 |
| 上游正式 HTTP/WebSocket 服务 | **未启动、未端到端调用**；路由和字段依据实际源码核查，不冒充已联调 |
| PDF/图片解析、Embedding、RAG检索 | **未运行**；没有评估中文教材、公式、图表召回或引用质量 |
| LLM 学习讲解和出题 | **未运行**；没有模型凭据，没有付费调用，没有题目准确率结论 |
| 学生数据和生产系统 | 未使用真实学生数据；未接入新平台运行流程、未部署、未推送、未访问生产数据 |

## 2. 关键源码与可落地复用方式

以下链接全部固定到本次核查提交，避免后续 main 变化导致结论失去依据。

| 关键文件 | 实际行为 | 对新平台的决定 |
| --- | --- | --- |
| [knowledge/naming.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/knowledge/naming.py) | NFC 标准化、长度限制、拒绝控制符和文件/URL保留字符 | 可直接复用到隔离 Python 导入服务；本平台仍用随机内部 ID，名称不充当授权边界 |
| [knowledge/staging.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/knowledge/staging.py) | SHA-256 流式散列；相同文件不重复复制；同名不同内容加编号，保留原文件 | 已真实验证。适合离线导入暂存；不把它当跨进程原子写入、病毒扫描、文件类型验证或完整知识库索引器 |
| [knowledge/manager.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/knowledge/manager.py) 与 [api/routers/knowledge.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/api/routers/knowledge.py) | 资料管理、原始文件、异步处理任务、引擎绑定、重索引、进度、来源同步；上传先校验资源写权限和模型绑定状态 | 复用完整模块前，应在隔离服务安装其真实依赖、测试异步失败恢复。本平台 D1 只记录任务与来源 ID，R2 保管授权资料，不能假定文件路径天然兼容 R2 |
| [services/rag/factory.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/rag/factory.py) | 默认 `llamaindex`；另有 pageindex/pageindex-oss/graphrag/lightrag/lightrag-server/ima/weknora/kiwix 等不同引擎，知识库创建后绑定引擎 | 第一轮只选一个引擎；不能把不同 provider 的认证、索引格式、成本混为一谈 |
| [services/rag/pipelines/llamaindex/pipeline.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/rag/pipelines/llamaindex/pipeline.py) | 解析/切块/Embedding，按 embedding signature 查索引；缺少匹配索引时返回 `needs_reindex`；引用结果含页码、chunk、document key、digest 等信息 | 借鉴模型版本固定、引用链及显式失败；透传为平台 `unavailable`/`needs_reindex`，不能生成伪检索结果。RAG检索分数不是答案正确率 |
| [multi_user/knowledge_access.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/multi_user/knowledge_access.py) | 区分个人/管理员/工作区知识库；管理员分配给用户的资料默认只读；读写分别检查 | 可借鉴显式授权和只读共享。不能替代本平台机构隔离、师生/亲子绑定；禁止所有学生共用一个上游管理员身份访问任意资料 |
| [learning/models.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/learning/models.py) 与 [learning/service.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/learning/service.py) | 知识类型、题目、学习证据、来源、练习与复习；待答题 ID 校验、过期交互拒绝、记录作答再更新状态 | 状态机和证据模型值得复用/移植；应将持久化适配为平台事务，不直接迁移整套文件用户存储。教师代录必须保留 actor 与 assisted/source |
| [learning/policy.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/learning/policy.py) | 记忆/程序型有量化门槛；概念/设计型采用定性评价；区分帮助下练习、独立展示、未验证讲解及用户自述掌握 | 借鉴证据来源区别，但不直接套用默认 0.9 门槛。本平台当前样题量不足，不能形成经校准能力判断 |
| [learning/mastery.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/learning/mastery.py) 与 [learning/scheduler.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/learning/scheduler.py) | 最近作答加权、低证据量封顶；复习间隔和遗忘模型策略可替换，源码明确不是校准过的 FSRS 拟合 | 纯模块可复用，但分数应标 `algorithmVersion`、`evidenceCount`，对教育效果另做校验；本次只执行 mastery，未执行完整 scheduler |
| [learning/grading.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/learning/grading.py) | choice 为文本归一后相等；short 对短答案允许字符相似度 ≥0.85；open 按关键词命中比例 | **不能直接用于本平台通用数学/英语自动评分**。已发现数值误判、等价分数拒绝、否定句误判；新平台首版坚持已审核选择题服务端判分 |
| [learning/question_card.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/learning/question_card.py) | 待答题公开结构与判分后回执分开，答案和解析在判分后给出 | 适合借鉴；本平台已自行实现提交前隐藏答案、快照和一次性提交 |
| [agents/question/pipeline.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/agents/question/pipeline.py) 与 [request_config.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/agents/question/request_config.py) | Explore→Plan→逐题生成、工具调用、结构化事件、JSON校验与修复；存在多轮调用及工具结果总结的额外模型请求 | 候选题生产线可实际复用，但需禁用不需要的 web/exec 工具、限制成本与任务时长；所有输出进入教师待审队列，不能自动标“已验证” |
| [api/routers/question.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/api/routers/question.py) | WebSocket 路由仍走 `AgentCoordinator.generate_from_topic`，与新版 QuestionPipeline 不是同一个入口 | 适配器必须锁定入口，不能读到 pipeline 就声称 WebSocket 已使用它；两条路径均未跑模型验证 |

## 3. 真实外部接口与认证

端点由 `modules/manifests/knowledge.json`、`mastery.json`、`questions.json` 的前缀，加对应 router 的装饰器共同确认；`api/module_routes.py` 将 `learning` 路由绑定 `require_learning_surface`。下面是**源码核查得到的上游契约**，不是本平台已公开接口。

| 方法/地址 | 重要输入和输出 | 当前验证状态 |
| --- | --- | --- |
| `POST /api/knowledge-bases` | multipart：`name`；可选 `files`、`rag_provider`、`embedding_model`、`storage_workspace_id` 等；有文件时排入处理任务，空知识库/特殊引擎返回形态不同；不能假定必有非空 `task_id` | 源码核查，未发真实上游HTTP |
| `POST /api/knowledge-bases/{kb_name}/upload` | multipart：`files`；可选 `rag_provider`、`rel_paths`、`dest_subdir`、`image_analysis`；成功包含 `message`、`files`、`task_id` | 源码核查。必须可写且绑定的 embedding 可用，否则可能409；暂存成功不等于索引成功 |
| `GET /api/knowledge-bases/{kb_name}/progress` | 异步索引进度；另有 `/api/knowledge-bases/tasks/{task_id}/stream` SSE、取消/重试/重索引接口 | 未跑真实索引任务，未验证断线恢复与任务授权 |
| `POST /api/mastery-paths/topics/draft` | JSON：`name` 1–120、`goal` 1–2000、`sources` ≤16、`must_cover` ≤40；来源 label/excerpt 有长度限制；生成失败可502 | 未调用模型，不保证输出课程可用 |
| `POST /api/mastery-paths/topics` | 确认目标与可选 `modules`、来源关系，返回 topic 与 `path_revision`；名称为空时可能调用模型建议名称 | 源码核查，不能当“永不调用模型”的保存接口 |
| `GET /api/mastery-paths/topics`、`/topics/{path_id}`、`/progress/{book_id}` | 当前用户学习目标和进度；还有映射、证据事件、复习策略接口 | 未运行完整 LearningStore |
| `WS /ws/questions/generate` | 首帧含 `requirement`（建议对象：knowledge_point/preference/difficulty/question_type）、`kb_name`、`count`；返回 `task_id`、状态、题目事件、`batch_summary` 等 | **不是**假定的 `POST /generate`；未连接上游WS/模型 |
| `WS /ws/mastery-paths` | 目标学习实时交互；另有知识库 `/ws/knowledge-bases/{kb_name}/progress` | 仅源码确认 |

上游认证关键点：

- [services/auth.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/auth.py) 默认本地关闭认证；`AUTH_ENABLED` 来源于运行配置，而不是本平台的开关。关闭时请求可解析为本地管理员。本平台不能沿用这个公网默认。
- [api/routers/auth.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/api/routers/auth.py) 的 HTTP 支持 Bearer 或 `dt_token` cookie；WS 的 `ws_require_auth` 在 accept 前核验查询 token 或 cookie。manifest 标为 `public` 的 WS 并不表示跳过内部鉴权。
- [api/main.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/api/main.py) 无鉴权模式的 CORS 更宽松。必须显式启用认证、限定来源、限制仅后端可达；不把上游令牌放 URL、前端 localStorage 或日志。
- 新平台四角色与上游 admin/user/工作区模型不是一对一映射。下一阶段应由后端维护“本机构资料→上游知识库/工作区”的白名单映射，先做平台资源鉴权，再调用上游；用户输入不能直接指定任意上游 kb/path/file。

## 4. 最小对接实验：可重跑，结果有边界

在独立平台目录执行：

```powershell
node scripts/experiments/deeptutor-probe.mjs
```

如果换电脑且参考源码缺失，可显式下载固定版本的四个模块和许可文件（只从固定 GitHub URL 取缺失文件，不覆盖现有文件）：

```powershell
node scripts/experiments/deeptutor-probe.mjs --fetch
```

需要 Python ≥3.11（本次实际 3.14.3）和 Node；实验仅用 Python/Node 标准库，无 pip 依赖、无需模型/GPU/API Key。可用 `DEEPTUTOR_PROBE_PYTHON` 指定 Python 可执行文件。原始模块没有修改；每次导入前核对脚本内固定 SHA-256。桥接器只监听 127.0.0.1 临时端口，用临时随机 token，正文限制 16 KiB，不允许调用者指定文件路径；完成后关闭端口并清理自己创建的临时目录。它没有启动 DeepTutor 的 FastAPI 应用。

本次实际结果（2026-11-13）：退出码 0，**18/18 行为断言通过**；端到端探测约 **252.85 ms**（单次本地测量，不是基准测试）。`modelCalls=0`、`ragIndexBuilt=false`、`officialFastApiServerStarted=false`、`questionGenerationExecuted=false`。

| 行为 | 观察结果 | 解释 |
| --- | --- | --- |
| 未带探测 token | HTTP401 | 本次实验桥接的鉴权，不代表上游正式鉴权已测试 |
| 中文资料名周围空格 | 归一为“初一数学” | 使用真实上游命名函数 |
| `../private`、带控制符名称 | HTTP400 | 名称校验可复用，但对象访问仍需独立鉴权 |
| 首次暂存 lesson.md | 文件真实落盘 | 只属于暂存，不是解析/检索 |
| 同名同内容 | 复用原文件、不再次复制 | 实测去重有效 |
| 同名不同内容 | 保存 lesson (2).md，原文件散列不变 | 实测保留成果有效 |
| choice：` a ` 对 `A` | 接受；`B` 对 `A` 拒绝 | 可用于标准选项标签，不能由学生提供答案 key |
| short：`12345678` 对 `12345679` | **错误地接受** | 字符相似不等于数学相等；构成明确不能直接复用通用判分的证据 |
| short：`0.5` 对 `1/2` | **拒绝等价答案** | 不具备有理数/代数等价验证 |
| open：`not correct` 对 `correct` | **错误地接受** | 关键词匹配未理解否定，不能直接评判英语开放回答 |
| mastery：0/1/2/3次且全答对 | 0 / 0.5 / 0.8 / 1.0 | 符合上游规则，但不证明三题就真正掌握 |

18/18 是程序行为被正确复现，包含刻意观察到的错误判分；**绝不是题目准确率或学生能力测量准确率**。详细结果在 `.local/deeptutor-probe-result.json`。两份可追踪的实验脚本是 `scripts/experiments/deeptutor-probe.mjs` 和 `deeptutor-module-probe.py`。

## 5. 运行条件和成本

完整上游与本次探测的运行条件不同：

- [pyproject.toml](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/pyproject.toml) 声明 Python `>=3.11,<3.15`，功能已拆成同版本模块发行包。需要 core、server、parsing、knowledge、mastery、questions 等相应模块；不建议直接装全部 optional extras。此次没有验证完整模块安装组合。
- server 依赖 FastAPI/Uvicorn/WebSocket/python-multipart/bcrypt/JWT 等；knowledge 依赖 LlamaIndex、BM25、FAISS、NumPy 等；parsing 含 PyMuPDF、Pillow、Office/PDF 相关库。安装包与本机编译轮子的可用性需锁版本实测。
- 可验证的后端启动对象为 `deeptutor.api.main:app`；下一轮应在完整固定版本环境中用 Uvicorn 仅监听回环地址。服务需要可写的持久化文件/索引/配置目录、上游真实账号设置及模型连接配置。不是把 Python 文件放进 Pages Functions 就能运行。
- RAG 首先需要授权语料、解析器、embedding 配置和磁盘索引；出题/讲解另需已配置的聊天模型。云模型或本地模型二选一涉及不同成本；没有实测，不能给最低显存、内存或并发保证。
- 本次实验没有付费模型/Embedding/存储调用。完整运行成本应按 `解析服务用量 + embedding tokens + 每轮输入/输出 tokens + 图像处理 + 外部检索 + 持久化/CPU` 计量。题目 pipeline 存在探索、计划、逐题循环、JSON修复和工具结果总结，不能按“一题一次调用”估算。
- 下一轮记录每个任务的 provider/model/version、token 用量、延迟、重试、峰值内存、索引字节数；先限制两份原创小资料、每科3道候选题、单任务预算与超时。预算数值在选定实际模型及价格后填写，本次不杜撰人民币成本。

## 6. Apache-2.0 与第三方许可

用户明确提供了“认识项目所有者并获允许使用全部”的授权背景。DeepTutor 自身已有 [Apache-2.0 LICENSE](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/LICENSE)，可按许可复用、修改、分发，包括商业用途；无需把主项目一律限制为只看架构。所有者的允许不自动转授其无权授予的第三方内容。

按 Apache-2.0 第4条，分发时保留许可证、相关版权/归属/专利等声明；修改过的源文件显著说明变更；若分发部分有适用 NOTICE，也保留相应告知。商标不因此授权。我们本轮只导入隔离参考目录中的原始模块，未将它们复制进新平台 `src/` 或 `public/`，没有发布或分发衍生成品。后续挑选 vendored 文件时必须同时建立来源/提交/修改清单及许可证目录。[Apache 许可原文](https://www.apache.org/licenses/LICENSE-2.0)

上游 [THIRD_PARTY_NOTICES.md](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/THIRD_PARTY_NOTICES.md) 目前列明 CSSwitch、Hermes Agent、thinking-orbs 的 MIT 来源/归属；若复用相关 OAuth、机器人注册或前端 vendor 文件，必须跟随所用文件保存通知。本次四个探测模块不涉及这些功能。

**必须单独处理的依赖：**[requirements/modules/parsing.txt](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/requirements/modules/parsing.txt) 包含 PyMuPDF。其官方说明为 AGPL 与商业双重许可，不能因 DeepTutor 是 Apache-2.0 就忽略它。采用该解析路径前，应确定满足 AGPL 的使用/分发安排、取得适用商业许可，或实际移除该依赖并验证替代解析路径；仅在设置中不用 PDF，不等于已经完成依赖许可隔离。[PyMuPDF 许可说明](https://pymupdf.readthedocs.io/en/latest/about.html#license-and-copyright)

本轮不是完整 SBOM 审计：尚未穷尽所有传递依赖、模型权重、云API条款、教材版权或字体/插图。下一阶段只安装实际选择的模块、锁定依赖，然后生成 SBOM 并逐项核查；参考库中的第三方图标/网页素材不导入本平台。

## 7. 新平台接口与阶段计划建议

当前 `/api/v1` 的学生身份、作答、学习包、审核与成长数据继续由本平台控制，DeepTutor 作为可替换的内容/检索供应方，不能成为自动修改成绩的后台。

下一阶段的**拟议内部契约，尚未实现**：

```json
{
  "jobId": "platform-generated-id",
  "provider": "deeptutor",
  "providerRevision": "60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db",
  "status": "unavailable|queued|running|needs_review|failed",
  "resourceScope": {"organizationId": "internal-id", "sourceIds": []},
  "candidates": [],
  "citations": [],
  "reviewStatus": "pending_human",
  "usage": {"model": null, "inputTokens": null, "outputTokens": null},
  "error": null
}
```

适配层不得接受浏览器传来的上游管理员 token、任意文件路径或 URL；固定服务地址从环境变量读取。超时/未配置/无索引必须返回明确不可用，不能返回模拟候选题；未审核生成物只允许教师读取。

建议顺序：

1. **当前已完成**：源码路由核查、四模块真实 HTTP 探测、新平台确定性闭环；模型能力保持 unavailable。
2. **下一轮技术验证**：完整固定版本隔离环境，启用认证，2份自有资料导入，验证 task_id 状态、解析后引用页/段定位、索引及跨用户访问；明确许可后才启用相关解析器。
3. **候选内容流水线**：一名教师的工作区，给两科各3题的限定要求；验证输入与输出schema、引用可定位、解答推导、去重、超时和计费，默认 pending_human。调用失败和零合格题必须真实呈现。
4. **学习功能筛选复用**：以平台事件和作答为唯一成绩源，逐步引入知识依赖、帮助程度、复习排程；对比规则基线，不接入相似度判分。规则或模型升级保留版本和可回放记录。
5. **扩大试点前**：教师逐题审核、真实样本评估、家长/学生数据边界验证、授权语料和传递依赖核查。没有本轮数据支持的能力，继续标注“未验证”。
