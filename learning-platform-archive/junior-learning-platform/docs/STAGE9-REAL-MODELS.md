# 第九阶段：真实免费模型与检索验证（完成有限验证，未接网站）

2026-11-14。用户明确授权接通DeepTutor模型/embedding并进行小范围真实验证，不新增付费，不使用真实学生数据，不改已发布网站/安卓。

初读VPS实际仍为DeepTutor1.7.2、所有profiles为0。2 vCPU/约4GiB RAM、AVX2可用，可用内存约3.1GiB。已有网站、隧道与代理全部active；不改/opt/junior-learning-trial、jltrial、8791及其服务/资源限额，不重启网站隧道。

免费方案核查：Google Gemini官方价格页列有免费层（需API Key，免费层数据使用政策需留意）；OpenRouter的:free模型无须买额度但受请求限额及供应方可用性约束，且需要独立Key。本次没有为它们注册账户、充值或配置付费回退。选择Qwen官方Apache-2.0开放权重，自托管于已有VPS，仅使用既有CPU/磁盘/流量，不产生模型API账单。

计划固定llama.cpp b12375（MIT）、Qwen3-0.6B-Q8_0和Qwen3-Embedding-0.6B-Q8_0（均官方模型仓库）；下载前已记录上游revision、大小与SHA256，见scripts/experiments/stage9-artifacts.json。模型仅约0.6B，不承诺教学质量或准确率。

实施顺序：校验模型资产→添加两个仅回环、带随机本地密钥的低资源推理服务→备份并仅更新DeepTutor的LLM/task/embedding profiles→原创数学/英语两份短资料真实建索引与检索→通过DeepTutor LLM服务生成少量候选→保持pending_human并导出审阅证据。每步验证后继续；费用、失败与质量限制如实记录。已发布平台仍用第七阶段，不把测试题带入其题库。

拟独占目录/服务：/opt/deeptutor-models、/var/lib/deeptutor/local-models、deeptutor-local-llm.service与deeptutor-local-embedding.service。均使用现有普通deeptutor账号，绑定127.0.0.1:18081/18082；每服务CPUQuota35%、MemoryMax950M，低优先级，串行进行模型/检索任务，保留现有服务余量。实际稳定性与用量以后续结果为准。

参考：[Qwen生成模型](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF)、[Qwen嵌入模型](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF)、[llama.cpp服务端](https://github.com/ggml-org/llama.cpp/blob/b12375/tools/server/README.md)、[Gemini价格](https://ai.google.dev/gemini-api/docs/pricing/)、[OpenRouter免费层](https://openrouter.ai/collections/free-models)。

## 已完成与现场证据

两个官方Q8_0模型分别639446688和639150592字节，文件SHA256与固定上游LFS一致。llama.cpp b12375官方Ubuntu x64包SHA256一致，实际二进制版本1.0.0-dev build12375/commit9d25e0014。缺失libgomp.so.1时首次执行失败；随后从Ubuntu已有包索引取得libgomp1固定版本并核验包SHA，**仅解包至模型专用目录，没有升级系统包**。MIT、模型卡/Apache许可声明与GCC运行库版权文件已保留。

已通过DeepTutor认证的`/api/settings/apply/provider`更新llm、task、embedding三个专用profile；其余服务不变。生成端点/v1，embedding为完整/v1/embeddings；协议openai_chat，工具/视觉/思考禁用。随机本地服务密钥只保存在VPS私密文件与DeepTutor私密catalog，未复制进源码或报告。旧catalog原始备份SHA256为912d122e83ea6973530b55a1eed54c8637b8a53216c6a84155e41bcace0705f1。

服务已经启用，均仅回环监听，匿名/v1/models返回401。没有重启网站、隧道、DeepTutor主服务或代理。现场模型服务合计约665MiB，VPS可用内存约2.3GiB；两个模型服务NRestarts=0。此为小样本瞬时测量，不是并发容量保证。网站8791直连404与发布副本的凭据网关保护一致，不能将其误报为模型导致站点宕机。

## 真实检索与生成结果

1. DeepTutor自身EmbeddingClient调用成功：两条合成文本得到真实1024维有限向量，范数约1；耗时约1.03秒。
2. DeepTutor `complete`基础调用成功，实际文本READY.，约2.58秒。不是模拟返回。
3. 原生`POST /api/knowledge-bases`上传两份原创TXT（648/505字节）；实际异步任务处理后completed，约27秒。知识库stage9-synthetic-20261114，未覆盖任何原库。
4. 实际LlamaIndex检索为hybrid（向量+BM25，fusion_num_queries=1，无reranker）。4个相关查询Top1命中4个预期来源，另1个无关月球问题仍返回两条引用。**没有可靠拒答门槛**，4/4不是通用召回率或答案准确率。
5. 实际向量索引/节点/BM25文件已经持久化，清单和哈希见index-evidence.json。TXT原生metadata只有文件名/路径，缺少原生页码/来源digest；本实验另外核对原始SHA和引用逐字出现，不能冒充页级引用能力。pipeline返回的answer只是检索上下文，不是LLM回答。
6. 基于相同合成源文本，通过DeepTutor统一LLM服务真实生成数学/英语各1题，max_retries=0、非思考、限420输出tokens。这里未运行官方多代理QuestionPipeline或其WS出题入口。

| 候选 | 真实观察 | 自动预检/状态 |
|---|---|---|
| 解x+2=5 | 选项0/1/2/3，correctOption=3，答案3 | 简单代入预检通过；仍pending_human |
| She ___ a student | 选项am/is/are/be，correctOption=0，错误指向am；解析却说明she用is | 预检失败；原始错误保留，仍pending_human，禁止发布 |

两题JSON结构有效，但只有1题通过这个极小答案检查；不能报成“出题准确率50%”来推广。数学/英语分别约32.25/24.89秒，不符合第八阶段同步桥接12秒上限。因此本轮**没有打开网站DRAFT_PROVIDER，也没有假装现有同步桥接已经接通真实生成**。

共3次明确的DeepTutor LLM调用（1次基础文本、2次出题），embedding包含探测/建库/查询等真实调用；无云端模型计费请求、无新订阅。全部材料原创合成，没有学生身份/试卷上传。索引流程内部关闭LLM查询扩写的MockLLM不是embedding替身，不计作生成调用。

## 保存、导出和测试

两题按原始模型字段转存到`.local/real-model-labs`独立合成账号SQLite；来源/模型版本保留，均pending_human，真人审核0、正式发布0、正式样题仍12条。英语错答案未被静默修正。具体库位置见test-results/stage9/candidate-import.json。

通过既有授权打印加载器对真实候选记录生成桌面/手机各2份PDF，共4份/8页；已核验中文、候选标签、失败提示、A4与分页并目检交付副本。没有修改正式页面或取消JSON/CSV。两份加“真实模型/合成材料/待审”页脚的查看副本在output/pdf，原始证据保留。

业务/安全/契约回归**85/85通过**，包含保留英文错答案与禁止进入正式测评的证据回归；静态**107文件通过**。这些测试不是模型效果认证。首次运行库缺失、首次审计误把有守卫的8791入口当普通health导致404，以及出题错误都记录，没有用模拟成功替换。

## 运行与回滚

仍用既有本机Open-DeepTutor工具建立SSH隧道后访问127.0.0.1:3782/login。模型配置中可见Stage9自托管LLM/task/embedding，合成知识库可见；不开放新公网模型端口。当前仅适合短文本技术验证，2048上下文、单并发、CPU低优先级；完整Agent大提示词、图形/PDF解析、复杂题与高并发未验证。

`stage9-rollback.py`默认只展示操作；`--apply`才通过原生API移除本任务三个profile并停用两个新增模型服务。它保留模型、索引、原始备份和其他profile，不改网站或代理。未实际执行回滚，避免把已接通服务停掉。原始完整catalog备份另存于VPS私密local-models目录；若以后有新配置，不应整份覆盖恢复旧文件。

新增代码集中在scripts/experiments/stage9*、tests/stage9-evidence.test.mjs及本报告。第八阶段已交付src/API/迁移/交接文件和主public保持冻结；网站/安卓发布副本未由本线程修改。下一步是审题与检索拒答评估、异步受控桥接设计；不能把这个小模型直接升级为正式运营出题能力。
