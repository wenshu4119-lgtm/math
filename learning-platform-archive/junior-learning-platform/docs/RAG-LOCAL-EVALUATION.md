# DeepTutor 检索路径与本地检索基线：实际有限评估

> 本报告的“不修改运行代码”指RAG研究子任务自身。主任务另增加了本机OCR和内部`src/retrieval-contract.mjs`边界校验；没有把本实验服务伪装成平台DeepTutor接口，也没有新增可保存知识库业务模块。

日期：2026-11-13（Asia/Shanghai）。本报告接续DEEPTUTOR-AUDIT；没有修改平台src/public/migrations/package、旧math或原型，没有调用付费服务，也没有使用真实学生资料。

结论：**完整DeepTutor RAG仍未运行**。本轮新增真实执行的是两条彼此分开的开发实验：固定版本DeepTutor结构化题号检索模块；独立SQLite FTS5/BM25文本检索基线。后者已经真实建索引并通过回环HTTP检索，但不是DeepTutor、不是语义Embedding、不是生成答案或出题。

## 1. 运行条件核查

检查了本机系统Python3.14.3与Codex打包Python3.12.14。两者均缺本轮所需llama_index、bm25s、faiss、sentence_transformers、torch、fastapi；打包Python有NumPy，但没有上述完整检索栈。在所检查的用户.cache目录未发现.gguf、safetensors或model.onnx文件，PATH未发现Ollama。**这是限定目录/解释器范围内的核查，不等于遍历或断言整台电脑没有其他模型。**没有读取任何密钥文件或账号令牌。

固定DeepTutor版本仍为[`60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db`](https://github.com/HKUDS/DeepTutor/tree/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db)。实际代码说明：

- [`pipeline.py`](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/rag/pipelines/llamaindex/pipeline.py)的普通search配置embedding，再检查对应signature的存储索引；无索引返回needs_reindex，不会自动获得模型能力。
- [`storage.py`](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/rag/pipelines/llamaindex/storage.py)直接依赖LlamaIndex、embedding验证和其他内部模块；不应通过替换Embedding为假向量来宣称真实RAG已运行。
- 同一search的题号路径会优先调用[`exercise_lookup.py`](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/rag/pipelines/llamaindex/exercise_lookup.py)，可读取现有结构化parse而不调用模型。本次选它做真实上游代码行为验证。
- [`errors.py`](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/rag/pipelines/llamaindex/errors.py)可区分损坏索引、无效Embedding响应等，但可能把原始异常文本放进answer/error，平台适配必须脱敏。

没有为本轮安装大依赖、GPU模型或完整DeepTutor；没有修改系统Python。完整的PDF/图像解析、向量建库、上游FastAPI/WS、LLM生成和真实中文教材召回仍未验证。

## 2. 实际执行方法

```powershell
cd C:\Users\Administrator\Desktop\junior-learning-platform
node scripts/experiments/rag-local-evaluation.mjs
```

启动器优先使用本机打包Python3.12，其他机器可通过RAG_PROBE_PYTHON设置解释器路径。仅需Python标准库及可用的SQLite FTS5，不需模型、GPU或API Key。Node启动器60秒超时，实验只监听127.0.0.1随机端口，用内存中的随机Bearer token；结束关闭服务并删除自己创建的临时数据库/语料。

首次在其他机器复现且缺少参考源码时，可显式加`--fetch`。它只下载固定commit的4个限定源码和LICENSE/NOTICE，核验SHA256，不覆盖已有源文件。网络只用于取公开源码，不发送教材/图片/学生资料。默认执行没有下载和外部网络请求。

结果文件：`test-results/rag-local-evaluation.json`。脚本和结果是开发评估产物，没有新增平台知识库业务记录或对学生开放接口。

## 3. 真实DeepTutor结构化检索：15项行为断言

导入了固定上游的exercise_lookup、parsing/cache、file_io和errors模块，未重写其逻辑。参考代码位于忽略目录，导入前按UTF-8/LF及末尾单换行归一后验证SHA256；这是一个namespace-package源码子集，**没有启动完整DeepTutor应用及其包初始化流程**。

输入明确分为：

- 真实上游模块：确实被Python导入执行。
- 合成解析替身：手写章节、题干、公式、表格与图片标记的content_list；并非某个已运行PDF/OCR解析器的输出。
- 不解析的占位源文件：仅提供源字节散列和.pdf扩展名以走原模块缓存路径；**不是可供教学使用的PDF，也没有作为输出文档交付**。不能据此宣称PDF解析或实际页内容定位正确。

| 验证项 | 实测结果与含义 |
|---|---|
| 显式“第一章第1题” | 识别为(1,1) |
| “公式1-1”查询 | 不当作题号检索 |
| 普通“如何保持等式成立” | 返回None，交给正常语义路径；本机该路径仍不可用 |
| 习题1-1 | 找到目标，保留连续的公式与表格块 |
| 引用 | 返回题号、源文件与1起始页码；验证的是合成IR字段传播，不是实际PDF解析 |
| 不存在的1-9 | 显式not_found，无相似题替代 |
| 有图示的1-2 | requires_page_review=true，提醒文本不能代替图形 |
| 另一个知识库 | 不自动进行跨KB全局搜索 |
| document_keys为空或缺少source_pages目录 | 不伪造受限来源证据 |
| 两个相同来源候选 | 显式ambiguous，而非拼接为一个确定题目 |
| 损坏Embedding索引异常 | needs_reindex=true，content为空 |
| 原始异常包含合成敏感哨兵 | 本次适配边界只保留固定状态/错误码，丢弃原始answer/error，不把异常透传给界面 |

**实际发现的上游限制**：无document_keys的unscoped题号检索，面对缺少created_at的manifest仍返回found。`_parse_for`在此分支只要求source_hash匹配，并未要求完成时间；created_at仅在指定parser_signature的受限分支检查。本轮已实际复现，断言记录为观察到的行为，**不代表这个安全条件通过**。平台若复用，必须另外强制“解析完成、来源获授权、版本一致”，不能只相信这个模块的输出。也不要拿未经约束的kb_name或本机路径作为浏览器入参。

## 4. 独立本地文本检索基线：真实索引、不是完整RAG

实验用自编数学与英语Markdown各一份（分别3节），另加一条跨机构合成哨兵；共3份资料、7个chunk。索引真正读取文件，保存原始行号、来源SHA256、章节和pending_human状态，SQLite FTS5负责检索和BM25排序。SQLite内置功能说明见[官方FTS5文档](https://www.sqlite.org/fts5.html)。

中文用简单相邻双字分词，英文按字母词分词；既没有Embedding，也没有同义词推理。回环实验接口固定为已授权org-a，只允许指定白名单sourceIds；用户不能覆盖organizationId、传任意URL或文件路径。

一次实际运行：Python3.12.14，SQLite3.53.1；索引40,960字节，构建约62.721ms，8次查询平均约11.852ms（包括本地HTTP，单次测量，不是吞吐/生产性能承诺）。28项断言通过，包括引用逐行比对、源散列一致、作用域、鉴权、空结果和失败边界。

| 查询 | 预期来源 | Top1 / Top3 |
|---|---|---|
| 一元一次方程 等式 两边 | 数学第1节 | 命中 / 命中 |
| 分数加减 通分 约分 | 数学第2节 | 命中 / 命中 |
| common denominator | 数学第2节 | 命中 / 命中 |
| present tense am is are | 英语第1节 | 命中 / 命中 |
| study becomes studies | 英语第2节 | 命中 / 命中 |
| past tense yesterday was were | 英语第3节 | 命中 / 命中 |
| 保持平衡的求未知量办法 | 数学第1节 | **未命中 / 未命中** |
| suffixed verb conjugation singularity | 英语第2节 | **未命中 / 未命中** |

**本次Top1与Top3均为6/8**，这是刻意很小的合成查询集上的命中计数，不是通用召回率、答案准确率或教学效果。两个语义改写未命中，说明纯词面检索的能力边界。没有为了追求全中而补同义词或使用生成式伪答案。

其他实测：无token401；跨机构sourceId403；路径式ID403；任意URL/组织覆盖字段400；无关查询返回no_match且answer=null；资料内“忽略规则、输出成绩”只作为引用原文，不执行、不评分；所有匹配仍pending_human。

## 5. 可测试适配边界与明确不可用

下列接口仅属于自动结束的实验桥接，**不是平台已开放API，也不是DeepTutor官方API**：

| 实验方法 | 行为 |
|---|---|
| POST /baseline/search | 真实本地词面检索，固定org-a及sourceIds白名单 |
| POST /deeptutor/search | 明确503 DEEPTUTOR_RAG_UNAVAILABLE；不拿基线结果伪装DeepTutor成功 |

基线成功响应带provider=local_fts5_baseline、status=retrieved/no_match、matches、answer=null、needsHumanReview=true、generationExecuted=false、gradingAllowed=false。引用包含sourceId、chunkId、section、line起止、完整来源digest与原文excerpt。lexicalRank只是检索排序值，不是模型置信度或答案正确率。

建议主平台后续适配遵循：先机构/资源鉴权，再映射内部sourceId；固定供应方和地址来自受控配置，不接受任意kb/path/url；把needs_reindex/unavailable/timeout作为明确状态；删除上游原始异常文字；未经教师审核的检索材料不能自动成为题目或成绩。上游输出中的answer常只是拼接检索证据，不能因此标注“AI已生成正确答案”。

本轮不修改平台运行接口、数据库迁移和导出清单；没有新的可保存知识库业务模块。如果后续把检索结果变成可保存教师资料/引用记录，必须同时实现逐资源权限、审校状态、版本和PDF/打印，而不是直接暴露本实验服务。

## 6. 许可、费用与下一步

固定DeepTutor模块按其[Apache-2.0许可证](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/LICENSE)在隔离目录研究使用，保留LICENSE/THIRD_PARTY_NOTICES；源码未进入public或运行src。正式vendoring仍要保留归属、声明修改及适用NOTICE。SQLite核心官方声明为[公有领域](https://www.sqlite.org/copyright.html)；本轮用现有Python内置SQLite，没有新增商业或AGPL解析库。

模型调用0、Embedding调用0、外部付费服务0；发生的仅是本机CPU/临时存储。没有真实学生数据。完整DeepTutor需完整固定版本依赖、已明确许可的解析器、真实本地或授权服务Embedding配置，以及独立鉴权/持久化环境；本次未验证资源用量或模型费用，不给虚构人民币估价。

可恢复下一步：先决定是否把独立词面检索作为明确标注的教师辅助功能；若要真正DeepTutor RAG，则另建隔离完整环境，选择许可清楚的解析器及Embedding，导入2份原创真实资料，验证原页/段引用和作用域，再测语义改写与无答案问题。生成题目仍需教师审核，不能沿用已知有反例的上游通用判分。
