# 英语复核 v3：材料一致性与保守复核补充

生成时间：2026-11-14T12:56:28.235Z。本轮拟应用文件为 `data/question-bank/rechecks/english-recheck-v3.json`，未部署或写入生产。

v2完整保留。v3只修正三道原隔离题的知识讲解、记背卡和材料来源版本，并把一条简答题的唯一性疑点从passed改为needs_review。该简答题原题内容完全未改。

| 最终提案状态 | 数量 |
|---|---:|
| passed / available（仅非正式自主练习候选） | 123 |
| needs_review / pending | 18 |
| quarantined | 21 |
| 总计 | 162 |

9个新v3批次，每批18题。只有3个题目内容payload与v2不同，其余159个payload逐字节语义一致。实际应用仍须对原revision=1及原sourceContentHash执行CAS，并跳过任何教师修改或审核。

## 三项材料修正

1. 现在完成时题：讲解明确“本题指定现在完成时、当前仍未返回”的条件；删除borrow不能配for/until的错误绝对规则，说明借用期限和持续持有是不同读法，不能机械替换。
2. 不定代词题：讲解和记背卡保留名词短语及后置形容词的限定目标，明确something在期待肯定答复的疑问句也可使用，不能把疑问句一概判为anything。
3. yet整句题：讲解和记背卡改为“常用于”“通常位于”，承认yet有其他合适位置以及already可用于疑问句。本题选项的唯一性仍依据具体的分词、否定次序和动词/直接宾语位置，而非“疑问句只能yet”。

每题的prompt/options/correctOption/rationale沿用根代理抽检通过的v2修订；explanation/memoryCard同步更新。完整内容与每个干扰项排除理由在JSON中。

## 来源摘要与版本

三题保留 `originalSourceDigest` 指向原稿来源；`sourceVersion=2` 标识新的修订材料；`sourceDigest` 为下述确定性对象按键序JSON.stringify后UTF-8的SHA-256：

`{questionId,sourceVersion,explanation,memoryCard,prompt,options,correctOption,rationale}`

`sourceDigestFormat=sha256-utf8-json-learning-material-v1`，scope明确它是新修订材料摘要，不能说仍是未修改的Antigravity原文。originalContentHash、previousProposalContentHash和previousAuditSha256分别保留生产CAS原稿、v2提案和v2审计文件。auditRevision=3与sourceVersion=2及生产数据库revision互不混同。

| 题目ID | v3内容SHA | 新材料摘要 |
|---|---|---|
| draft-en-g8-present-perfect-prac | aa3dbad80d5d1d9d1a83ceec928f2127e27858a3d6b498ef66d5ffe54bb2ab51 | 39f6ca8ec86ead384cccc4339da5228e43355964fbacf17123c2f53b5e3b8e28 |
| draft-en-g8-indefinite-pronouns-freq-diag | e7d6e074728985d601759a7f0cb5d71d9ac6673e588c37ec4daa060df0c789ec | dc3273c63b565656e39b688c78b8d6738d318c339ce475cd5c78d790013d484c |
| draft-en-g8-perfect-adverbs-yet-already-diag | 8388fae09acac18c48afc5ec515d5e675cd44adce8fc38ff28779278b3128bed | 8b411f01b3b47c2f82a690cfb0dfbddd38a92ac16ae9ec972bdbbfb9fbd78972 |

## 新增待审项（不改题）

`draft-en-g7-be-subject-prep-basics-retest`：C “Yes, it is”是常规短答；原题没有明确排除指示/对比语境下A “Yes, this is”的可能性。因此不能用“所有this/that问句都必须换it”证明唯一。v3保守置pending，且不声称所有this is短答都规范。
参考范围：[Cambridge指示词说明](https://dictionary.cambridge.org/us/grammar/british-grammar/this-that-these-and-those)及[British Council短答说明](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/short-forms)仅说明一般用法，不冒称其中直接审定了本题雨伞句。

## 验证与封存

`node --test tests/english-rechecks-v3.test.mjs`：7项通过，含三项材料一致性专项、完整数量和CAS绑定、v2封存未变、159其他内容不变、新来源digest可重算、简答题保持待审及重复生成不覆盖。
运行 `node scripts/audit-english-batches-v3.mjs` 只复用完全一致的封存文件；内容改变必须另出新版本。脚本不连接生产、不调用外部模型，不创建教师审核。

v3文件SHA-256：`5e80a4e4308fa4badc8e6bc9d1bb564c9abe7850ffa96a0f936298c838ece298`
v3 proposalSetChecksum：`995296975a38185d8937ffb3e7d084dbbdae9ee258fc6466d1ac7a4281498a95`
v2文件SHA-256：`c255f36f65f99d2e44de1ec7e772bdfbabfa39c3b0b0f2939290f5112b279e1b`

所有humanReview/teacherReviewed均为false，正式评分禁止。通过仍只是固定题目上的自动辅助语言复核；教材、地区、真实年级适配与教学质量未经教师认证。含答案JSON只能留在受保护后端/运维材料，不能放到public静态目录。
