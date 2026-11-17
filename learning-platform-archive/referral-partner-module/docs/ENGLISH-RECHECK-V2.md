# 英语题库独立复核 v2（仅交付提案，未部署）

复核时间：2026-11-14T12:47:07.450Z。范围为当前目录中的英语 162 题（原159待审、3隔离），不包含原有6道英语示例，也未读取或写入生产数据库。

## 结果与边界

原题判定：121题在给定四选项和普通当代标准书面语语境下支持唯一答案；17题尚不能独立裁定；24题存在可接受的不同完成方式或原解析错误排除。
原3隔离题分别形成明确修改后的新内容提案。最终提案为124通过、17待审、21隔离。这里的“通过”是固定题目上的模型辅助语言复核，不是老师审核，不是普适语法证明器，也不批准用于自动正式评分。
所有162题的年级和五级难度保留原稿初标，知识点难度仍未自动编造。教材版本、地区和实际学段适用性全部留待教师核定。

| 原稿年级 | 通过提案 | 待审 | 隔离 | 总数 |
|---|---:|---:|---:|---:|
| 7 | 44 | 3 | 7 | 54 |
| 8 | 36 | 11 | 7 | 54 |
| 9 | 44 | 3 | 7 | 54 |

## 方法与可信范围

先只读题干和全部选项作独立判断，再对照原正确选项与原解析；未使用原automatedCheck、independentVerified声明证明答案。对争议规则查阅 Cambridge、British Council、Merriam-Webster 的公开原始语法/词典资料，网页只提供规则或词义依据，并不为本题背书。题目上的应用判断属于本轮自动辅助推断。
脚本保存了逐题独立答案台账，并固定原目录文件SHA和解析后JSON的SHA。运行脚本只编译已核定台账并检查版本/结构/一致性，不会重新调用外部模型，也不会把任何未来新题按相似题型自动宣布正确。
每条记录包括：原题完整内容SHA、expectedRevision=1、originalAssessment、最终decision、独立可接受选项及理由、问题/警告、引用来源、完整新内容proposal及其SHA。原解析存在问题的题也保留原文，不静默修正。
语义不充分但尚不足以断言严重多解的题保持needs_review；存在明确不同合法读法或错误排除的题quarantined。无图表但引用chart/list的两题也保持待审，等待删除无用指示或补充合法材料。

## 三道原隔离题的修订

以下均是内容修订，不是把原错误题直接放行。原题在originalAssessment中继续保留quarantined及多解理由。

| 题目ID | 修订 | 新目标答案 |
|---|---|---|
| draft-en-g8-present-perfect-prac | 明确医生目前仍在北京、尚未回，并明确要求现在完成时。保留原选项，消除原went/is going的时态选择歧义。 | B：has gone |
| draft-en-g8-indefinite-pronouns-freq-diag | 改成选择“任何有趣的内容”的名词短语，明确要求形容词修饰不定代词；替换原something/anything语用差异选项。 | D：anything interesting |
| draft-en-g8-perfect-adverbs-yet-already-diag | 改成选择标准书面语中语法完整、表示尚未打包的整句；三个干扰项分别含分词、否定次序或yet位置错误。 | B：I haven't packed my raincoat yet. |

这些修订没有声称“疑问句只能用any/yet”。[Cambridge的some/any说明](https://dictionary.cambridge.org/grammar/british-grammar/some-and-any)承认询问者预期会影响选择；[already说明](https://dictionary.cambridge.org/grammar/british-grammar/already)允许疑问句和句末用法。医生题的当前缺席目标参照[British Council现在完成时说明](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/present-perfect)。

## 新增隔离记录（完整替代读法见JSON）

| 题目ID | 可接受选项 | 独立发现 |
|---|---|---|
| draft-en-g7-other-another-pronouns-retest | A/B/D | 题干未要求只递一支笔；another、others、the others分别表示再一支、另几支、剩余全部，都能形成请求。原解析擅自补入“只取一支”。 |
| draft-en-g7-sensory-conjunctions-logic-retest | A/B | but可强调未接通的转折，and也能自然并列“尝试拨打”和“无人接听”；原句没有限定必须表达转折。 |
| draft-en-g8-invitations-modals-refusal-diag | B/D | I'd love to, but...与No, thanks, but...均可礼貌拒绝邀请；不能把一种推荐答法当成唯一允许答法。 |
| draft-en-g8-rise-raise-borrow-lend-pairs-prac | A/B | keep it until Wednesday与borrow it until Wednesday均成立；borrow可以接借用期限，不能宣称其一概不能配until。 |
| draft-en-g9-prep-which-whom-special-that-retest | A/B | that常用于everything后，但限定性指物关系从句的which不能被普遍判为不合语法；原解析的“只用that”过强。 |
| draft-en-g7-simple-present-be-diag | C/D | usually可描述现在习惯也可描述过去习惯；未给出现在仍如此的时间条件，went和goes两种时间读法均可。 |
| draft-en-g8-adverbial-clauses-diag | B/D | 未来条件从句既可用doesn't rain也可用isn't raining；“主将从现”不等于只能用一般现在时。 |
| draft-en-g8-past-continuous-when-while-prac | B/C/D | 两件事都用过去进行时并不必然同时发生；while、before和until分别可叙述同时、先后或持续到另一事件，题干未给时间关系。 |
| draft-en-g9-relative-clauses-whose-prep-prac | A/B | that常见于最高级后，但which亦可引导限定性指物从句；“宜用”不构成排除which的唯一性依据。 |
| draft-en-g9-past-perfect-reported-speech-retest | A/B | 仍成立的事实可保留moves，也可在间接引语中用回溯的moved；客观事实并不普遍禁止时态回溯。 |
| draft-en-g8-too-to-so-that-diag | A/C/D | so difficult、very difficult和too difficult均可接for kids to work out；原题没给“无法解决”的事实，不能擅自补成too...to的否定含义。 |
| draft-en-g8-phrasal-verbs-pronoun-prac | C/D | alone既可作副词也可作表语形容词，feel alone可以表达孤单感；alone; alone与alone; lonely均能与邻居探访语境衔接。 |
| draft-en-g7-demonstratives-locations-prac | B/D | between两处之间与behind两处后方都能接the post office and the park；未给位置图或文字事实，不能只因and就排除behind。 |
| draft-en-g7-weather-irregular-past-retest | B/D | left可叙述完成离开，was leaving可叙述半小时前正在离开；ago并不一概禁止过去进行时。 |
| draft-en-g9-correlative-conjunctions-prac | B/D | was可报告刚才判断，is可报告钥匙现在仍不正确；just now只明说试钥匙的时间，不能强制第二分句只用过去。 |
| draft-en-g9-whether-vs-if-wh-infinitive-prac | B/C/D | 老师可展示何时、何处或如何安全使用天平；safely不强制询问操作方式，when/where/how均有自然解释。 |
| draft-en-g9-word-formation-affixes-diag | B/C | impolite常用，但Merriam-Webster也收录形容词unpolite并释为impolite；原解析称其错误拼写不成立，题目未限定词频或词表。 |
| draft-en-g7-do-does-freq-order-retest | A/B | are seldom是常见中位语序；seldom are可在强调be时使用，频度副词位置并非无例外固定在be后。 |
| draft-en-g7-gerund-subj-double-obj-retest | C/D | for nephew表示受益/收礼者，with nephew表示与侄子一起购物；原题没有给礼物归属，两种读法都合理。 |
| draft-en-g8-been-vs-gone-in-duration-prac | A/B/D | has been in可表持续居住，但has been to可表起点后去过、has gone to可表起点后已出发；since从句不自动保证连续居住。 |
| draft-en-g9-daily-responses-politeness-retest | A/C | This is Coach Chen speaking为常见电话自报身份，但I am Coach Chen并非不合语法且同样能回应本人；不能把习惯表达当成唯一允许句。 |

其中borrow期限问题可直接核对[Cambridge borrow词条](https://dictionary.cambridge.org/dictionary/english/borrow)；条件从句允许现在进行时见[British Council time/if clauses](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/verbs-time-clauses-if-clauses)；unpolite确为收录词见[Merriam-Webster](https://www.merriam-webster.com/dictionary/unpolite)；频度副词位置有强调例外见[Cambridge adverb position](https://dictionary.cambridge.org/us/grammar/british-grammar/adverbs-and-adverb-phrases-position%26lang%3Den)。

## 待审记录

| 题目ID | 尚未解决事项 |
|---|---|
| draft-en-g8-invitations-modals-refusal-prac | had to符合过去被迫步行的读法；但broke down也可说明眼下能下车步行的原因。需明确事件已结束及考查客观必要性。 |
| draft-en-g8-until-so-that-no-matter-diag | until表达等长者动筷才开始；while也能描述动筷过程中不开始。题干未明确所需时间关系，不能仅因有not便推出until。 |
| draft-en-g7-simple-present-be-prac | there加并列存在项涉及就近一致、整体复数一致及语体差异；只写“就近原则”不足以证明所有规范均排除are。需改成单一名词或规定语体。 |
| draft-en-g8-present-perfect-retest | has kept表达已经持续持有；has borrowed也可能描述商定的借用期限或重复借用。未明确elapsed possession，不能用“borrow不能接for”一刀切。 |
| draft-en-g8-adverbial-clauses-retest | Although给出逆境坚持的常见读法；Because也可表示挑战促使大家坚持。需明确让步关系，不能仅靠推断作者意图作唯一评分。 |
| draft-en-g7-modals-imperatives-prac | needn't准确回答无义务；shouldn't也可能表达建议今天别交且明天可以交。若只考“不必”需将该含义写清。 |
| draft-en-g7-quantifiers-there-future-retest | few和a few均能表达数量少，区别在说话者态度；“题难”偏向few但未直接给出几乎无人/不足等结论。 |
| draft-en-g8-future-predictions-if-retest | In two days是无额外参照的常规回答；After two days也可能以已知阶段为起点，需排除共享参照再作唯一判断。 |
| draft-en-g9-exclamations-modals-deduction-retest | 只知早上去广州未说明现在仍在外地、未返回或说话地点；can't的排除推断缺前提，may亦不能被事实排除。 |
| draft-en-g8-fractions-one-of-superlative-prac | fresh water不可数，语法答案is可独立确定；但“Look at the chart”所指图表不存在，需去除无用指示或补合法图表后再用。 |
| draft-en-g8-fractions-one-of-superlative-retest | 中心词number单数且后接reached，语法答案has明确；但题干要求查看未提供的志愿名单，须修正文案或补材料。 |
| draft-en-g8-unless-as-long-as-diag | unless符合赶紧出发的常见警告；if也可表示即使此刻出发仍会错过，路程和时限未给，不能独立排除该条件读法。 |
| draft-en-g8-unless-as-long-as-retest | or可表示不照办的后果，but可提醒即便检查仍可能失分；原题未把后果明确限定在未检查时。 |
| draft-en-g8-been-vs-gone-in-duration-diag | has gone to符合现在不在场的常见解；has been in也可能描述已在馆内，需明确当前仍在馆或已去未返的目标语义以排除。 |
| draft-en-g8-been-vs-gone-in-duration-retest | has been open准确表达连续开放状态；has opened可另作这段期间反复开放的事件读法，题干应明确连续营业/状态目标。 |
| draft-en-g9-zero-passive-phrasal-passive-prac | sells well是描述畅销属性的自然说法；被动is/has been sold well可转为销售执行或经历的读法，原解析的一概禁止需核定。 |
| draft-en-g9-daily-responses-politeness-diag | My pleasure为明确得体的谢意回应；其余短答的语用适切性受口语场景影响，原解析把多种交际短语用途绝对化，保留教师复核。 |

## 批次、封存与应用要求

9批，每批18题，按原稿7/8/9年级各3批。batches只列questionIds，records保留全部162条，便于根发布代理逐批选取。
应用前必须在生产库再次比较机构、当前revision=1、当前content_hash等于sourceContentHash，且不得覆盖已存在的教师审核或教师修改。任一不符就跳过并报告冲突，不能强制覆盖。只能新增不可变版本，旧版本、原审核和既有作答依据继续保留。实际CAS、数据库备份、发布与回滚由根发布代理实施并另行验收。
“available”仅是经本轮复核后可考虑用于不计正式成绩的自主练习提案；不是此次已发布状态。humanReview、teacherReviewed均为false，formalScoringAllowed=false。
该JSON包含答案与完整题目，只能作为运维/后端受保护材料，不能复制到public静态目录。

封存文件：`data/question-bank/rechecks/english-recheck-v2.json`
文件SHA-256：`c255f36f65f99d2e44de1ec7e772bdfbabfa39c3b0b0f2939290f5112b279e1b`
来源目录文件SHA-256：`7f6fac3cb1b41eb49d92118ac57e9085bb589e72249733bf36eb0706e2a676a3`

运行：`node scripts/audit-english-batches.mjs`。已存在且完全相同的封存文件只校验复用；若台账或结果改变，脚本拒绝覆盖，必须创建新的版本化审计文件。

## 验证

`node --test tests/english-rechecks.test.mjs`：7项通过。覆盖162唯一记录与9批完整分区、固定源SHA、已知多解反例保持隔离、三原隔离修订、新内容hash与源内容hash分别校验、所有非修订内容不变、五级难度不擅改、零人审/零正式评分、篡改源文本/答案/年级无法复用台账、再次运行不改封存文件。
这些测试验证了台账完整性与安全属性；测试通过本身不是英语答案有效性的独立教师认证。
开发过程中曾发现台账P标签缺失导致统计遗漏，已修复并增加逐条枚举断言与总数检查；那份不完整中间输出未用于数据库或发布。最终162条都具有明确判定。

本轮没有部署、没有生产写入、没有调用付费模型或发送学生信息。
