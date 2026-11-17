# 自学闭环首批内容与审计清单

更新：2026-11-15，内容包 **v2**。本文件描述独立 `self-study-loop` 工作区的真实内容产物，**不表示已经生产发布**。本期资格依据是独立 AI 对固定全文的复核，加上有限计算与结构检查；不等于真人教师审核、完整能力测量或正式考试成绩。

## 先核对现有资料，避免把目录当讲义

读取了 `data/question-bank/catalog.json`、`data/question-bank/expansion/subject-pilot.json`、`src/content.mjs`、两科独立复核文件、`data/arts-content.json` 和 `release/content-round2.json`。

| 现有来源 | 题目 | 知识点 | 实际材料形态 |
|---|---:|---:|---|
| 初中原题库 catalog | 324 | 108 | 短 explanation、memoryCard、逐题解析，没有完整讲义对象 |
| 物理／地理 pilot | 12 | 4 | 定义、记背提示、三题解析，没有完整讲义对象 |
| 旧 MVP 数学／英语 | 12 | 4 | 短讲解和记背卡，没有完整八段讲义 |
| 初中合计 | 348 | 116 | 不能称为 116 份已完成讲义 |
| 艺考 | 18 | 6 | 有 6 份实际完整结构讲义，可作有来源的适配基础 |

原 catalog/pilot 的 112 条去重知识项，短说明为 **64—230 字**。八段讲义的检查要求包含考点、前置、步骤、易错、例题、分层练习解析、记背卡及复测回练；现有初中来源中满足这套结构的数量为 **0**。这不代表原有短讲解无价值，而是其交付形态不同。

`release/content-round2.json` 记录的初中状态为 348 题、116 点、281 道非正式自主练习、12 道旧流程已审示例、30 道继续待审、25 道隔离。记录属于 `production-20261114.3` 的核查时点，不是本脚本重新查询当前生产数据库；后续真实教师操作可以改变状态。物理／地理 pilot 虽有数值核对，当时仍在教师适配待审队列，不能擅自算进 281 道可练习题。

新模块仅用**明确原知识点 ID**建立只读关联，不迁走旧题，不继承旧老师审核、不改旧作答。`legacyMapping`、`relatedKnowledgeIds` 和 `sourceLinks` 标明对应范围。`coverageRelation=explicit_partial_scope_mapping` 表示本点只覆盖列出的子范围，绝不意味着原知识项全部完成。

## 本批实际完成

| 项目 | 数量与口径 |
|---|---|
| 完整讲义版本 | **20**：14 份初中新讲义、6 份艺考讲义有来源适配并扩充 |
| 新原创题 | **180**：每点 9 题，旧题干直接复制数 0 |
| 三种用途 | 筛查 60、练习 60、复测 60；用途与难度分开 |
| 本期难度初标 | 超低 60、低 60、中等 60；高、超高尚未交付 |
| 讲义内典型例题 | 20，不重复计入 180 道题 |
| 讲义内分层练习 | 44，均有答案与解释，不重复计入题库题量 |
| 内容校核 | 180 题固定全文已由独立 AI 逐题复核，再通过本期有限数值／字面校核；20 点讲义全文、蓝图及结构均有固定版本复核记录 |
| 真人教师审核 | **0**，全部 `humanReview.status=pending` |
| 本次阻断问题处理 | 独立 AI 复核已报告的阻断项均已修复，当前新版本无待隔离项；不构成内容无误保证 |

每题 `maxScore=1` 只是自学小题组计数单位，不是该题在正式试卷中的分值。不把完成 9 题、20 点或某一难度直接换算成考试成绩、目标分或录取结果。

## 20 个可以实际走通的内容点

每行均有完整讲义和三阶段各 3 道不同题号的新题。年级是候选检索标签，教材版本、地区和具体教学进度尚需教师核对；尤其不得把基础方法训练称为整个年级课程覆盖。

| 点 ID | 学段／候选范围 | 实际教学范围 | 精确旧来源关联 |
|---|---|---|---|
| `study-jr-m7-equation` | 七年级数学 | 一次方程、同解变形、单层括号 | `math-equation`；`draft-math-g7-linear-eq-app` 的部分范围 |
| `study-jr-m8-linear-function` | 八年级数学 | 一次函数代入、求 k、交点横坐标 | `draft-math-g8-linear-func`；`draft-math-g8-linear-ineq-cost` |
| `study-jr-m9-quadratic` | 九年级数学 | 平方型双根、整数因式、判别式 | `draft-math-g9-quadratic-eq`；`draft-math-g9-quadratic-methods` |
| `study-jr-e7-be` | 七年级英语 | 明确一般现在时的 be 与主语一致 | `english-be`；`draft-en-g7-simple-present-be` 的部分范围 |
| `study-jr-e8-past-continuous` | 八年级英语 | 明确指定的过去进行时与组合时态 | `draft-en-g8-past-continuous-when-while` |
| `study-jr-e9-passive` | 九年级英语 | 一般现在时被动结构与同义改写 | `draft-en-g9-passive-voice`；`draft-en-g9-present-future-passive` 的部分范围 |
| `study-jr-physics-speed` | 八年级物理 | 总路程／总时间、换算、分段合成 | `pilot-physics-speed`；`pilot-physics-units` |
| `study-jr-chem-mixtures` | 九年级化学 | 物质种类、纯净物／混合物、给定分子模型 | 本批新点，旧库无相应已建讲义 |
| `study-jr-bio-cell` | 七年级生物 | 典型细胞结构功能与给定观察表比较 | 本批新点，不声称所有细胞类型都覆盖 |
| `study-jr-history-evidence` | 九年级历史基础方法 | 给定时序、直接记录、结论边界 | 本批新点；全部史料情境明确为虚构训练 |
| `study-jr-geo-scale` | 七年级地理 | 比例尺、统一单位、两图比较 | `pilot-geography-scale` |
| `study-jr-civics-rules` | 九年级道德与法治基础方法 | 给定规则条件、程序与规范表达 | 本批新点；假设规则不代替现实法律 |
| `study-jr-chinese-boundary` | 八年级语文基础方法 | 信息提取、限定词、因果边界 | 本批新点，不代替文学、古诗文或作文训练 |
| `study-jr-m9-exam-review` | 九年级中考数学综合专题 | 一次关系、费用相等、预算整数上限 | 原费用／函数点；另关联本批七年级方程与八年级一次函数 |
| `study-arts-zh-evidence` | 2027 艺考语文 | 信息材料范围、并列条件、多因素结论 | `arts-zh-evidence` 讲义 v1 适配，新题另写 |
| `study-arts-ma-log-domain` | 2027 艺考数学 | 真数条件、反向一次式、分母条件交集 | `arts-ma-log-domain` 讲义 v1 适配，新题另写 |
| `study-arts-en-detail` | 2027 艺考英语 | 明确原因、名词回指、时间条件组合 | `arts-en-detail` 讲义 v1 适配，新题另写 |
| `study-arts-hi-source` | 2027 艺考历史 | 直接证据、独立互证、统计口径 | `arts-hi-source` 讲义 v1 适配，新题另写 |
| `study-arts-ge-solar` | 2027 艺考地理 | 分日和已给直射纬度的正午高度 | `arts-ge-solar` 讲义 v1 适配，新题另写 |
| `study-arts-po-practice` | 2027 艺考思想政治 | 实践检验、认识指导、条件边界 | `arts-po-practice` 讲义 v1 适配，新题另写 |

中考综合专题保留 `subject=math`、`topicType=exam_review`，`knowledgeIds` 关联本点与两个数学前置点，不作为混合学科成绩。普通题的 `purposes` 仍分别为 diagnostic、practice、retest，不把“中考综合”伪装成难度等级。

六科艺考内容按 `stage=senior_arts`、`examYear=2027` 隔离，初中使用 `stage=junior`、`grade=7/8/9`、`examYear=null`。地理和政治的自学答对计数不能转换为正式等级分，也没有全省排名或官方赋分估计。

## 数据字段与可追溯闭环

主文件是 `data/study-content.json`，`points[]` 为扁平目录。点层含 stage、grade/examYear、subject、chapter、knowledgeIds、prerequisites、commonProblems、coverage/uncovered、来源、版本、旧 ID 映射及完整 handout。`estimatedMinutes` 是可调整的作者建议，不是实测耗时预测。

handout 沿用现有艺考结构：`focus`、`prerequisites`、`steps`、`pitfalls`、`workedExample`、`exercises`、`memoryCard`、`retestGuide`、`errorReplay`，并补充 audience 与覆盖范围。例题、分层练习均有答案和解释。

题目包含独立 ID/version、knowledgeIds、purposes、difficulty、practiceTier、prompt、四选项、correctOption、rationale、source、图片需求和审核字段。本批全部能由完整文本及公式作答，不需要缺失图。各阶段蓝图均为 **超低／低／中等各 1 题**；这是相同作者初标分布，不是统计等值校准。三阶段模板相近，便于在小范围内比较，但不能把模板熟悉度当成跨情境迁移能力；仍需延时、不同情境复测与教师核对。实际复测比较还必须同时核对得分点、内容版本、范围及完成证据，不能只看阶段名称。

## 固定独立复核与自动校核的真实范围

v2 使用两个必要层次，不能相互替代。独立于内容生成者的 AI 审阅代理实际逐题阅读了 **180 题（非数学 135、数学 45）**、20 份讲义、20 例题和44道内嵌练习；其中72道数值／符号题另作手算复核。它核对固定题干、全部四选项、答案、解析、条件、图依赖和范围，并单独建立 `data/study-reviewed-texts.json`。该文件标记 `reviewKind=independent_ai_text_reading`、`humanReview=false`，不是教师签核。

运行 `node scripts/verify-study-content.mjs --write-audit` 生成技术审计 `data/study-content-audit.json`。**脚本先精确匹配独立复核白名单，未知题干、选项、答案、解析、版本或讲义文字一律 draft。** 此命令从不新建或刷新独立复核白名单，不能靠重跑脚本让未经阅读的改写重新可用。

- 数学、速度、比例尺、太阳高度：对已复核的固定题干重新解析系数、数值、方向和条件，计算预期结果，再与既有选项的数值或固定字面形式比较。正负根换序、等价区间等新表达不能由字面比较自动认定唯一性；必须另行复核。
- 英语：只重放本批明确指定时态、主语和动词词表的有限规则；阅读题提取给定原因或逐个核对时间约束。正确同义改写可能不匹配预期字符串，因此未知选项不会通过白名单，不宣称通用语义判定。
- 化学与生物：固定文本复核后，核对给定组成、观察表和有限概念对应；不推广到复杂物质、所有细胞类型或现实实验。生物修订题明确限定核膜与核染色体，避免将线粒体遗传物质排除在宽泛表述之外。
- 语文、历史、道法、政治：固定材料及四个具体选项先经过独立 AI 阅读，再做预期字面与材料条件重放。**字面匹配不证明语义唯一性；这里不存在能自动接受任意新中文改写的语义证明器。**
- 结构层另查字面重复选项、题号与版本、来源、必需图、用途／难度分离、旧题干直接重复及三阶段蓝图。教学适配、语言风格、难度校准和地区教材仍需教师核对。

独立复核白名单使用 `textHash=SHA256(JSON.stringify({id,version,prompt,options,correctOption,rationale}))`（按该键序、四选项次序保留），以及 `handoutHash=SHA256(JSON.stringify({id,version,handout}))`。技术审计再绑定完整 `questionHash`、`pointHash` 和原文件 UTF-8 `contentFileHash`，并记录独立白名单文件哈希。后端只应给**固定复核匹配、技术审计 passed 且完整内容哈希相符**的版本 `auto_checked` 自学资格。教师 PATCH 后仍回 draft，不继承原自动资格或教师标记。

生成阶段曾修正一个交点的非终止小数表现、两道太阳高度题的字面重复干扰项及只换编号的材料变式。独立全文复核又发现以下问题，已进入 v2 修订记录 `data/study-content-revisions.json`：

1. 物理 `study-jr-physics-speed-retest-2` 干扰项 `46.800000000000004` 改为 `46.8`；题与所在点升至源版本2。
2. 地理讲义旧步骤无条件取直射纬度0°，与扩展范围冲突。现在先确定δ（分日取0°，否则采用题干值），再统一南负北正、求绝对纬度差；所在点升至源版本2。
3. 生物 `study-jr-bio-cell-practice-2` 原“含染色体的结构”表述可能包含线粒体。原版本已明确作歧义隔离记录，新版本限定核膜围成且含核染色体，解析和讲义边界同步修正，题与点升至源版本2。
4. 原核验器能漏掉新加入的正确同义选项或相反顺序根集合。v2 加入独立固定全文白名单，并移除 `all_four_options_checked`、`one_unique_correct_option` 这类泛化检查名称。v1 技术审计已被替代，不得作当前资格依据。

修订没有生产写入，没有改写真实作答或生成真人教师审核。审阅代理对三处修正再次阅读，并确认其余178题文本与17整点在恢复旧审计元数据后保持原样。

## 已运行的检查

`node --test tests/study-content.test.mjs` **14 项通过**：原实体／范围／结构检查，540 次答案索引变异均保持 draft，新增英文正确同义选项、中文正确改写、根集合换序三个反例均不能自行获准；题干、解析、选项次序、版本及讲义新文字同样留待独立复核。另验证白名单不会被验证调用刷新、版本2修订记录及检查名称不再冒充通用语义证明。

当前 active 内容的审计为 180 passed、0 draft、0 quarantined，真人审核0；被替代的歧义生物旧版本仍保留隔离修订记录。结果只对应独立复核与审计共同绑定的固定版本，不能外推到新选项、新题或未来内容。浏览器、角色权限、PDF和生产发布须另看独立验收记录。

基础定义参考已记录在内容中，主要包括 [British Council 过去进行时](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/past-continuous)、[British Council 被动语态](https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/passives)、[NIH 细胞说明](https://www.medlineplus.gov/genetics/understanding/basics/cell/)、[NHGRI 细胞核](https://www.genome.gov/genetics-glossary/Nucleus)、[NHGRI 线粒体 DNA](https://www.genome.gov/genetics-glossary/Mitochondrial-DNA)、[RSC 物质分类资源](https://edu.rsc.org/resources/atoms-elements-molecules-compounds-and-mixtures/617.article)、[USGS 地图比例尺说明](https://www.usgs.gov/educational-resources/finding-your-way-map-and-compass)。仅核对基础概念，未复制其题目、图片或成段讲义，也不声称这些机构认可本批题目。

## 仍未完成

当前每科只有少量代表性内容，尤其语文、历史、道法、生物、化学仍是基础方法或基础概念起点。没有完整初中全课程、全套中考卷、完整艺考六科冲刺课程、主观题教师量规、作文／听力／实验操作、真实耗时与难度校准。未确认省市教材适配处已明示，其他艺考选科组合和年度内容不自动套用。本批不向真实学生收集额外身份资料，不把自学记录并入旧正式成绩。
