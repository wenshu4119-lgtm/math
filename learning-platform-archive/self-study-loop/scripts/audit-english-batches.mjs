import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

export const CHECKER='english-independent-closed-choice-v2';
export const CATALOG_SHA256='7f6fac3cb1b41eb49d92118ac57e9085bb589e72249733bf36eb0706e2a676a3';
export const CATALOG_JSON_SHA256='c936cbe80a60c105eab5a121985dbb64302943ccebe27c92230be845bcf0f847';
export const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const EVIDENCE={
 possessive:{title:'British Council: Possessives — pronouns',url:'https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/possessives-pronouns'},
 possessiveNoun:{title:'British Council: Possessives — nouns',url:'https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/possessives-nouns'},
 present:{title:'British Council: Present simple',url:'https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/present-simple'},
 perfect:{title:'British Council: Present perfect',url:'https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/present-perfect'},
 past:{title:'British Council: Past continuous and past simple',url:'https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/past-continuous-past-simple'},
 relative:{title:'Cambridge English Grammar Today: Relative pronouns',url:'https://dictionary.cambridge.org/grammar/british-grammar/pronouns-relative'},
 verb:{title:'Cambridge English Grammar Today: Verb + infinitive or -ing',url:'https://dictionary.cambridge.org/grammar/british-grammar/verb-patterns-verb-ing'},
 comparison:{title:'British Council: Comparative and superlative adjectives',url:'https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/comparative-superlative-adjectives'},
 time:{title:'British Council: Prepositions of time',url:'https://learnenglish.britishcouncil.org/grammar/a1-a2-grammar/prepositions-of-time-at-in-on'},
 condition:{title:'British Council: Verbs in time clauses and if clauses',url:'https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/verbs-time-clauses-if-clauses'},
 agreement:{title:'Cambridge English Grammar Today: Subject–verb agreement',url:'https://dictionary.cambridge.org/us/grammar/british-grammar/subject-verb-agreement?q=agreement'},
 borrow:{title:'Cambridge Dictionary: borrow (including until next week)',url:'https://dictionary.cambridge.org/dictionary/english/borrow'},
 lend:{title:'Cambridge English Grammar Today: Lend or borrow?',url:'https://dictionary.cambridge.org/grammar/british-grammar/lend-or-borrow.'},
 some:{title:'Cambridge English Grammar Today: Some and any',url:'https://dictionary.cambridge.org/grammar/british-grammar/some-and-any'},
 indefinite:{title:'Cambridge English Grammar Today: Indefinite pronouns and following modifiers',url:'https://dictionary.cambridge.org/us/grammar/british-grammar/pronouns-indefinite-body-one'},
 yet:{title:'Cambridge English Grammar Today: Already, still or yet?',url:'https://dictionary.cambridge.org/grammar/british-grammar/already-still-or-yet'},
 already:{title:'Cambridge English Grammar Today: Already — questions and end position',url:'https://dictionary.cambridge.org/grammar/british-grammar/already'},
 adverb:{title:'Cambridge English Grammar Today: Adverbs and adverb phrases — position',url:'https://dictionary.cambridge.org/us/grammar/british-grammar/adverbs-and-adverb-phrases-position%26lang%3Den'},
 reported:{title:'Cambridge English Grammar Today: Reported speech — no backshift',url:'https://dictionary.cambridge.org/grammar/british-grammar/reported-speech-indirect-speech?q=backshift'},
 unpolite:{title:'Merriam-Webster: unpolite',url:'https://www.merriam-webster.com/dictionary/unpolite'},
 very:{title:'Cambridge English Grammar Today: Very',url:'https://dictionary.cambridge.org/grammar/british-grammar/very'},
 too:{title:'Cambridge English Grammar Today: Too',url:'https://dictionary.cambridge.org/grammar/british-grammar/too-enough'},
 few:{title:'Cambridge English Grammar Today: Little, a little, few, a few',url:'https://dictionary.cambridge.org/grammar/british-grammar/little-a-little-few-a-few'},
 conjunction:{title:'Cambridge English Grammar Today: Conjunctions — contrasting',url:'https://dictionary.cambridge.org/grammar/british-grammar/even-if-even-though'}
};

// Independently authored answer ledger. The answer letters below were obtained from
// prompts/options, then compared with the source key and explanation. They are NOT
// computed from correctOption, automatedCheckResult, or the original validation.
// P = supported unique ordinary standard-written-English answer; N = unresolved;
// Q = demonstrated multiple readings / erroneous exclusion. Multiple letters list
// supported alternatives, not a claim to enumerate every imaginable interpretation.
// This is a fixed, model-assisted linguistic audit of this exact catalog. It is NOT
// a general grammar theorem prover and is NOT a real teacher's review.
const LEDGER=`
1|A|P|name前需表示机器人所属的限定词its；it's是有限分句，it和itself不能在此修饰name。|possessive
2|B|P|回答说明物主Kevin，空位修饰backpack并询问所属；Whose符合，其他选项不是该物主限定词。|possessive
3|C|P|对Is this umbrella yours作所给简略肯定回答时，用单数it is；this's缺补足语且they数不符。|present
4|D|P|a new后需可数单数替代词；one代替另一把球拍，其他选项不能构成该名词短语。|
5|A|P|普通人两只手且已指定one hand，剩余那只特指the other hand；排除三者任选与复数代词。|
6|ABD|Q|题干未要求只递一支笔；another、others、the others分别表示再一支、另几支、剩余全部，都能形成请求。原解析擅自补入“只取一支”。|
7|C|P|此处描述煎饼的气味而非闻嗅能力，smell为系动词；wonderful是合义形容词。|
8|D|P|努力学习与取得进步构成普通语境下的前因后果；so表达该结果，其他选项不表达给定连贯关系。|conjunction
9|AB|Q|but可强调未接通的转折，and也能自然并列“尝试拨打”和“无人接听”；原句没有限定必须表达转折。|conjunction
10|BD|Q|I'd love to, but...与No, thanks, but...均可礼貌拒绝邀请；不能把一种推荐答法当成唯一允许答法。|
11|AC|N|had to符合过去被迫步行的读法；但broke down也可说明眼下能下车步行的原因。需明确事件已结束及考查客观必要性。|past
12|D|P|提醒带雨衣的普通建议语境支持天气可能变化；might表达可能，其他选项表达禁止或必要而不合此因果。|
13|AD|N|until表达等长者动筷才开始；while也能描述动筷过程中不开始。题干未明确所需时间关系，不能仅因有not便推出until。|condition
14|B|P|完整从句everyone can hear说明说清楚的目的，so that可引导；in order to不能直接接这个有主语的从句。|condition
15|C|P|修饰形容词busy并表达无论程度多大，结构为no matter how busy；其余选项的句法类别不匹配。|
16|D|P|began to后须原形，water level自行上升无宾语；rise为该不及物原形，raise需宾语。|
17|AB|Q|keep it until Wednesday与borrow it until Wednesday均成立；borrow可以接借用期限，不能宣称其一概不能配until。|borrow,lend
18|B|P|接to me且物品由表哥交给说话人，lend表示借出，过去式lent；borrow的借入方向不符。|lend
19|C|P|正式书面语中介词in前置、关系词指reading room这一物体并作介词宾语，用which。|relative
20|D|P|正式书面语中from前置且先行词doctor指人，所给合适宾格关系代词为whom。|relative
21|AB|Q|that常用于everything后，但限定性指物关系从句的which不能被普遍判为不合语法；原解析的“只用that”过强。|relative
22|C|P|在词典中查术语对应look it up；其余动词与up组合不表示在词典查词。|
23|D|P|until下周给出新的举办日期，语义是延期；put off可表达延期且被动结构完整，give up是放弃。|
24|A|P|午睡与a little指向调低音量；turn down符合，turn on不表示把现有音量调小。|
25|B|P|另一说话人也做了visited这一过去动作，肯定附和需so加过去助动词did再加I。|
26|C|P|另一说话人也尚未完成，需neither加与现在完成时匹配的have再加I。|
27|D|P|回应同一列车确实如此而非另列车也如此，用so it does；is不替代实义动词travels。|
28|CD|Q|usually可描述现在习惯也可描述过去习惯；未给出现在仍如此的时间条件，went和goes两种时间读法均可。|present,past
29|AB|N|there加并列存在项涉及就近一致、整体复数一致及语体差异；只写“就近原则”不足以证明所有规范均排除are。需改成单一名词或规定语体。|agreement
30|B|P|所给两个人称名词均单数，标准书面语neither...nor配单数be；interested要求be，所给单数形式只有is。|agreement
31|C|P|Look与right now明确当前正在进行，复数students搭配are singing；其他时态不表达所给正在发生的动作。|present
32|D|P|yesterday evening与并列found共同固定过去叙事，检查动作需checked。|past
33|A|P|问句明确last Saturday并用Did，回答同一日留家行为用stayed；其他选项时态不配。|past
34|B|P|两者比较且已有much和than，wide在普通标准比较式用wider；不以罕见特殊强调语境作为本题解。|comparison
35|C|P|of all the runners要求集合最高程度，修饰runs的fast最高级fastest；其他形式不构成所需最高级。|comparison
36|D|P|the...the...比较结构且空位修饰check，需副词比较级more carefully。|comparison
37|A|P|since过去起点与现时持续任教构成现在完成时，单数Miss Gao配has taught；其余选项不表达这一持续至今关系。|perfect
38|BCD|Q|has gone、went及正在出行读法的is going均能解释不在场并明日返回；will return不单独强制现在完成时。|perfect,past
39|AC|N|has kept表达已经持续持有；has borrowed也可能描述商定的借用期限或重复借用。未明确elapsed possession，不能用“borrow不能接for”一刀切。|borrow,perfect
40|D|P|树是被种植对象，last spring规定过去，复数主语对应were planted。|
41|A|P|工具承受保持干净的动作，must be kept为完整情态被动结构。|
42|B|P|主句已有has shortened，修饰bridge需被动过去分词built；was built会造成无连接词的第二谓语。|
43|C|P|嵌入问句后已有主谓the station opens，询问时间用when，其他选项含多余倒装或不合结构。|
44|D|P|先行词teacher为人，关系词在从句充当encouraged的主语，所给合法主语关系词为who。|relative
45|A|P|嵌入在knows后的问句使用陈述语序when our class will visit；其他选项倒装或叠加不合此结构的that。|
46|C|P|独立主语指姐姐的词典，需名词性物主代词Hers；Her后缺名词，She/Herself指人而非词典。|possessive
47|D|P|主语男孩给自己穿衣需反身宾语himself，与without parents' help的自理语境一致。|
48|A|P|所给单数desk按共同拥有的正常读法采用Tom and Jim's；分别拥有的所有格一般需相应复数物品。|possessiveNoun
49|BD|Q|未来条件从句既可用doesn't rain也可用isn't raining；“主将从现”不等于只能用一般现在时。|condition
50|C|P|until从句表示获准这一边界事件，主语单数teacher配gives；will give不用于普通未来时间从句。|condition
51|AD|N|Although给出逆境坚持的常见读法；Because也可表示挑战促使大家坚持。需明确让步关系，不能仅靠推断作者意图作唯一评分。|conjunction
52|A|P|advise us后的对象补语为to read；所给其他形式不能构成advise sb to do结构。|verb
53|B|P|mind后接动作名词-ing形式，关闭窗户用closing。|verb
54|C|P|be used to中的to是介词，后接riding；与前半句used to drive的过去习惯结构不同。|verb
55|C|P|泛指一小时，hour首音为元音，单数可数单位前用an。|
56|D|P|特定日期October 15th的下午使用on；不是泛指的in the afternoon。|time
57|A|P|普通“建议”义的advice不可数，two要求复数量词pieces，得到two pieces of advice。|
58|B|P|无主语礼貌祈使句以动词原形Keep开头；其他选项非该祈使谓语。|
59|CD|N|needn't准确回答无义务；shouldn't也可能表达建议今天别交且明天可以交。若只考“不必”需将该含义写清。|
60|D|P|标准否定祈使句为Don't加原形swim；No需另一种名词化结构。|
61|A|P|存在句未来形式will be合法；will have和going to have不构成there be，are与a match不配。|
62|B|P|milk不可数，enough和Don't worry明确肯定的少量，a little符合而little含不足倾向。|few
63|AC|N|few和a few均能表达数量少，区别在说话者态度；“题难”偏向few但未直接给出几乎无人/不足等结论。|few
64|CD|Q|开放疑问可用anything，期待肯定答复可用something；两者后置形容词均正确，原语境没有排除后一读法。|some
65|A|P|Three times a week直接给出频率，所以问频率的How often唯一对应。|
66|B|P|Everything是单数主语，当前规则评价用is；介词短语中的复数rules不改变主语数。|agreement
67|C|P|cars可数复数对应fewer，air pollution不可数对应less，双空只有该组合符合。|comparison,few
68|D|P|sounds作系动词评价方案，wonderful为合义形容词；其余副词或健康义well不适合此表语。|
69|AB|N|In two days是无额外参照的常规回答；After two days也可能以已知阶段为起点，需排除共享参照再作唯一判断。|time
70|B|P|过去明确时刻8点并遭门铃事件打断，进行中的背景用was doing。|past
71|BCD|Q|两件事都用过去进行时并不必然同时发生；while、before和until分别可叙述同时、先后或持续到另一事件，题干未给时间关系。|past
72|D|P|过去began to rain发生时等车作为持续背景，复数学生配were waiting。|past
73|A|P|不可数information为感叹中心，What加形容词和不可数名词；不能添a/an或改用How直接修饰该名词短语。|
74|B|P|姓名卡作为正向证据支持有把握的推断，must表达此读法；其余都是否定或非必要性。|
75|CD|N|只知早上去广州未说明现在仍在外地、未返回或说话地点；can't的排除推断缺前提，may亦不能被事实排除。|perfect
76|D|P|girl与notebook有所属关系，whose在从句内限定名词notebook。|relative
77|AB|Q|that常见于最高级后，但which亦可引导限定性指物从句；“宜用”不构成排除which的唯一性依据。|relative
78|B|P|从句read books已有宾语，缺的是图书馆这一地点状语；where可补该功能，which/that需介词。|relative
79|D|P|by过去到达点已累计播放十分钟，需过去完成时的延续状态had been on，其他选项不能表达该累计前时关系。|perfect,past
80|D|P|完成草稿先于过去的铃响，过去报告中用had finished表达前时关系；所给其他形式不配该过去完成事件。|reported
81|AB|Q|仍成立的事实可保留moves，也可在间接引语中用回溯的moved；客观事实并不普遍禁止时态回溯。|reported
82|D|P|题干自身给出March 12th，所求第12天的规范序数词拼写为twelfth。|
83|A|P|in one's sixties表示六十多岁，要求整十数词复数；其余形式不构成该年龄段用法。|
84|B|P|具体基数two后hundred不加s，也不直接加of，构成two hundred students。|
85|C|P|答语为货币金额，How much询问价格，其他问题类别与答语不对应。|
86|D|P|答语为two kilometers这一空间距离，How far对应，其他选项问时间或频度。|
87|A|P|What about后介词about接动作-ing形式，flying符合。|verb
88|B|P|It takes时间结构中的真实动作用to get不定式；其余所给形式不构成该结构。|verb
89|C|P|人作主语加时间再加practicing，搭配spends time doing；其他动词不配此完整句法。|verb
90|D|P|无冠词交通名词subway用于交通方式，固定表达by subway。|
91|A|P|句子报告队员听好消息后的情绪，excited描述体验者，其他选项为原因性质或非形容词。|
92|B|P|an之后修饰story的形容词须描述引发惊叹的故事特征，amazing符合。|
93|C|P|原因后项是名词短语而非从句，because of可直接带名词短语；because/since/as不能在这里实现同结构。|
94|ACD|Q|so difficult、very difficult和too difficult均可接for kids to work out；原题没给“无法解决”的事实，不能擅自补成too...to的否定含义。|very,too
95|A|P|按时赶到要求速度足够，fast enough可接目的/结果不定式；enough位置及其他搭配不合法或含义相反。|too
96|B|P|已有an educational museum这一名词短语并接that结果，需such an...that；so不能直接放在an前构成同结构。|
97|C|P|had better的否定补语为not加动词原形eat；其余选项多to、有限否定或名词化。|
98|D|P|Why not提出建议时直接接原形keep；不能接-ing、过去分词或to。|
99|A|P|mind后否定动作名词为not speaking；其余不是该-ing补语。|verb
100|B|P|meeting是单数且put off为可分离动副结构，代词it须置于put和off之间。|
101|CD|Q|alone既可作副词也可作表语形容词，feel alone可以表达孤单感；alone; alone与alone; lonely均能与邻居探访语境衔接。|
102|D|P|过去曾存在为There used to be；其余选项把there be与have或被动/习惯结构混合。|
103|A|P|one of后为带the的最高级和复数名词，the highest mountains同时满足三项结构要求。|comparison
104|B|N|fresh water不可数，语法答案is可独立确定；但“Look at the chart”所指图表不存在，需去除无用指示或补合法图表后再用。|agreement
105|C|N|中心词number单数且后接reached，语法答案has明确；但题干要求查看未提供的志愿名单，须修正文案或补材料。|agreement
106|D|P|表示手段的介词By后用listening这一-ing形式，而非有限动词或to不定式。|verb
107|A|P|find后的形式宾语代替后置to remember短语，用it；that/this/one不作该形式宾语。|
108|B|P|评价monitor体贴的品质使用thoughtful of someone to do，所给合适介词为of。|
109|A|P|apples为复数且over there明确远处，远指复数those符合。|
110|BD|Q|between两处之间与behind两处后方都能接the post office and the park；未给位置图或文字事实，不能只因and就排除behind。|
111|D|P|比较两个地区的同类不可数weather，that替代另一地区的天气；it指同一对象，one用于可数单数。|
112|C|P|已有like的天气问句用What was the weather like；How不能与给定like组成该问句。|
113|A|P|yesterday afternoon规定过去事件，drink的不规则过去式为drank，drunk是分词。|past
114|BD|Q|left可叙述完成离开，was leaving可叙述半小时前正在离开；ago并不一概禁止过去进行时。|past
115|AD|N|unless符合赶紧出发的常见警告；if也可表示即使此刻出发仍会错过，路程和时限未给，不能独立排除该条件读法。|condition
116|A|P|按时归还是借阅资格条件，as long as表达该条件；其他选项不表达给定权限与归还义务关系。|condition
117|CD|N|or可表示不照办的后果，but可提醒即便检查仍可能失分；原题未把后果明确限定在未检查时。|conjunction
118|AB|Q|already可在疑问句末表示提前完成/惊讶，yet可中性询问截至目前；答复已收好并不排除任何一个。|already,yet
119|D|P|现在完成时任教与过去毕业这一时间起点用since连接；for后应为时段，其他连接词不表达起点。|perfect
120|A|P|问经历的ever与No后的never形成一致否定经历回答，所给其余组合不能表达该问答。|perfect,yet
121|C|P|both A and B是复数且描述当前兴趣，用are。|agreement
122|BD|Q|was可报告刚才判断，is可报告钥匙现在仍不正确；just now只明说试钥匙的时间，不能强制第二分句只用过去。|past,present
123|D|P|yesterday固定过去，标准书面语not only...but also就近father为单数，所给对应was。|agreement
124|A|P|Nowadays与every year为当前周期生产，被生产的复数buses用are produced。|
125|C|P|普通未来建设事件由next autumn定位，museum承受建造，will be built给出所需未来被动。|
126|B|P|windows需要被清洁，need cleaning是主动-ing形式表达被动需要；to clean会把窗户当执行者。|verb
127|D|P|主动make加人加原形动作，feel为所给不带to的原形。|verb
128|A|P|prefer后与to watching并列比较活动，需playing形成doing A to doing B。|verb
129|B|P|被动were made后要求to work不定式，而非主动使役结构的裸原形。|verb
130|C|P|whether紧接or not引导是否判断；给定位置的if or not不成立，其他词不表达选择疑问。|
131|BCD|Q|老师可展示何时、何处或如何安全使用天平；safely不强制询问操作方式，when/where/how均有自然解释。|
132|A|P|about后的“是否组织”接to不定式，whether可构成该嵌入选择问句，if不能这样接不定式。|
133|BC|Q|impolite常用，但Merriam-Webster也收录形容词unpolite并释为impolite；原解析称其错误拼写不成立，题目未限定词频或词表。|unpolite
134|C|P|后项说明罐子有改造价值，not useless表达并非无用；其他选项词性或给定理由不合。|
135|D|P|the与of之间需保护这一抽象名词，protection合适；其他选项是动词或形容词/分词。|
136|A|P|those要求复数，knife的标准复数为knives；knifes不是这里的名词复数。|
137|B|P|日本人/日本籍的表语用Japanese，复数不加s；Japan、Germany为国家名。|
138|D|P|情态can后接原形play，不因she而用plays，也不用-ing或to。|
139|C|P|主语your brother单数、谓语walk为实义原形，当前习惯问句需要Does。|present
140|D|P|he加实义原形play的当前习惯否定结构需要doesn't。|present
141|AB|Q|are seldom是常见中位语序；seldom are可在强调be时使用，频度副词位置并非无例外固定在be后。|adverb
142|B|P|主句谓语helps前的活动作主语，Doing构成-ing名词化短语；所给其他形式不能构成标准主语。|verb
143|C|P|单个活动Reviewing...作主语是单数概念，陈述通常效果用is。|agreement
144|CD|Q|for nephew表示受益/收礼者，with nephew表示与侄子一起购物；原题没有给礼物归属，两种读法都合理。|
145|A|P|as...as同级比较内部使用原级fresh；比较级和最高级都不配此构式。|comparison
146|B|P|不断变长用重复比较级longer and longer，与每日更早鸣叫的渐变语境一致。|comparison
147|C|P|多音节popular的渐变比较使用more and more popular，其他组合不构成标准结构。|comparison
148|D|P|expects后的拟组织动作采用to organize不定式；其余形式不配此补语。|verb
149|A|P|avoid后用making这一-ing补语，其他所给形式不构成avoid doing。|verb
150|B|P|提醒的是尚待执行的关窗任务，forget to close匹配；forget closing表示忘记过去关过，不合后句将检查。|verb
151|BC|N|has gone to符合现在不在场的常见解；has been in也可能描述已在馆内，需明确当前仍在馆或已去未返的目标语义以排除。|perfect
152|ABD|Q|has been in可表持续居住，但has been to可表起点后去过、has gone to可表起点后已出发；since从句不自动保证连续居住。|perfect
153|AB|N|has been open准确表达连续开放状态；has opened可另作这段期间反复开放的事件读法，题干应明确连续营业/状态目标。|perfect
154|B|P|take place是不及物发生，无被动结构；since起点与复数changes匹配have taken place。|perfect
155|ACD|N|sells well是描述畅销属性的自然说法；被动is/has been sold well可转为销售执行或经历的读法，原解析的一概禁止需核定。|
156|D|P|被动take care of须保留of并用过去分词taken，完整形式taken care of。|
157|A|N|My pleasure为明确得体的谢意回应；其余短答的语用适切性受口语场景影响，原解析把多种交际短语用途绝对化，保留教师复核。|
158|B|P|Do you mind问是否介意，温暖房间支持同意开窗，Not at all表示不介意而不产生是/否矛盾。|
159|AC|Q|This is Coach Chen speaking为常见电话自报身份，但I am Coach Chen并非不合语法且同样能回应本人；不能把习惯表达当成唯一允许句。|present
160|D|P|a number of修饰复数volunteers，进行时helping前所给复数助动词为are。|agreement
161|A|P|五百公里作为一次骑行距离的整体量，用单数is评价太远；不是分别评价各公里。|agreement
162|B|P|each为单数语法中心，常规被动要求is asked，复数助动词均不配。|agreement
`.trim().split('\n').map(line=>{const[n,letters,kind,reason,refs]=line.split('|');return{ordinal:Number(n),optionIndexes:[...letters].map(c=>c.charCodeAt(0)-65),decision:{P:'passed',N:'needs_review',Q:'quarantined'}[kind],reason,evidenceIds:refs?refs.split(','):[]};});

const CORRECTIONS={
 'draft-en-g8-present-perfect-prac':{
  prompt:"Dr Wang is attending a meeting in Beijing right now and has not returned. Choose the present-perfect form that expresses his current absence: 'Sorry, he ____ to Beijing for the meeting.'",
  options:['has been','has gone','went','is going'],correctOption:1,
  rationale:'本修订题明确要求现在完成时，并说明王医生目前仍在北京、尚未返回。has gone to表达去了某地而当前未回；has been to通常报告到访经历。went与is going在原题其他语境中可以成立，但不满足本题明确指定的现在完成时。不能据此推论所有询问不在场的句子只能用has gone。',
  reason:'原题仅说明将于明日返回，未限定时态；加入当前仍在北京与必须使用现在完成时两个可核对条件，修正唯一性。',
  proof:'在指定present perfect中C为一般过去时、D为现在进行时；B是has+gone并表达当前未回，A表达到访经历而非所问当前缺席。',evidenceIds:['perfect'],
  rejectedOptions:['has been：不表达题干指定的已去未回状态','went：不满足明确要求的现在完成时','is going：不满足明确要求的现在完成时']
 },
 'draft-en-g8-indefinite-pronouns-freq-diag':{
  prompt:'Choose the noun phrase that means “任何有趣的内容”, with an adjective modifying an indefinite pronoun.',
  options:['interesting anything','anything interest','anything interestingly','anything interesting'],correctOption:3,
  rationale:'本修订题限定考查一个名词短语：不定代词anything由形容词interesting作后置修饰语，故为anything interesting。A把形容词放在该不定代词前；B的interest不是所需形容词；C的interestingly是副词，不满足题干指定的形容词修饰。原题中的something interesting在期待肯定回答的疑问语境也可能正确，本修订不再声称所有疑问句都只能用anything。',
  reason:'原题something/anything取决于说话者预期。改为明确的词类与后置修饰结构任务，并替换歧义干扰项；这属于实质题干和选项修订。',
  proof:'题干同时要求名词短语、anything的目标语义和形容词修饰；仅D满足。A语序不符，B非所需形容词，C为副词。',evidenceIds:['some','indefinite'],
  rejectedOptions:['interesting anything：不定代词修饰位置不符','anything interest：interest不是所需形容词','anything interestingly：interestingly为副词']
 },
 'draft-en-g8-perfect-adverbs-yet-already-diag':{
  prompt:'Which sentence is correctly formed in standard written English and says that packing the raincoat is still unfinished?',
  options:["I haven't yet pack my raincoat.","I haven't packed my raincoat yet.","I not have packed my raincoat yet.","I haven't packed yet my raincoat."],correctOption:1,
  rationale:'本修订题考查现在完成时否定句与yet的常规位置。B具有have not+过去分词packed+宾语+yet，表示截至现在尚未完成。A在have后错误使用原形pack；C的not与have次序不合标准否定句；D把yet放在动词与其直接宾语之间。already可以出现在疑问句中，因此原题不能仅凭疑问句形式排除already；本修订改为结构明确的整句辨析。',
  reason:'原问句already和yet均可用，只是预期/惊讶语气不同。将题目改成完成时否定结构与yet位置辨析，移除有效但语用不同的干扰项。',
  proof:'在标准书面语中只有B同时具备have-not次序、过去分词packed和不分隔动词直接宾语的yet位置；其余各有独立形式错误。',evidenceIds:['yet','already','adverb'],
  rejectedOptions:['A：have后应为packed而非pack','C：否定词应位于have后','D：yet不应插在packed和直接宾语my raincoat之间']
 }
};

export function buildEnglishRecheck(catalog,{checkedAt=new Date().toISOString(),catalogSha256=CATALOG_SHA256}={}){
 assert.equal(catalogSha256,CATALOG_SHA256,'Catalog changed: the fixed independent ledger must be re-audited, not silently reused');
 assert.equal(sha(catalog),CATALOG_JSON_SHA256,'Catalog object changed: independent answer ledger does not authorize modified inputs');
 const input=catalog.records.filter(r=>r.question.subject==='english');assert.equal(input.length,162);assert.equal(LEDGER.length,162);
 const records=input.map((source,index)=>{
  const q=source.question,note=LEDGER[index];assert.equal(note.ordinal,index+1);assert(['passed','needs_review','quarantined'].includes(note.decision),'Invalid ledger decision '+note.ordinal);assert(note.optionIndexes.length>0&&note.optionIndexes.every(n=>n>=0&&n<4));
  const originalHash=sha(q),correction=CORRECTIONS[q.id],content=structuredClone(q);
  const originalIssues=note.decision==='quarantined'?['NON_UNIQUE_OR_FALSE_EXCLUSION']:[];
  const originalWarnings=note.decision==='needs_review'?['CONTEXT_OR_USAGE_NOT_INDEPENDENTLY_RESOLVED']:[];
  if([104,105].includes(note.ordinal)){originalWarnings.push('REFERENCED_DISPLAY_NOT_SUPPLIED');}
  const sourceKeySupported=note.optionIndexes.includes(q.correctOption);
  if(!sourceKeySupported)originalIssues.push('SOURCE_ANSWER_KEY_NOT_SUPPORTED');
  const originalDecision=sourceKeySupported?note.decision:'quarantined';
  if(correction){
   assert.equal(source.validation.status,'quarantined','Correction must target an originally isolated item');
   for(const key of ['prompt','options','correctOption','rationale'])content[key]=structuredClone(correction[key]);
   content.sourceLabel=q.sourceLabel+'；独立自动复核修订（未教师审核）';
   content.difficultyBasis=q.difficultyBasis+'；本轮修订题型，保留原初标，需教师重新定级';
   content.contentRevisionProvenance={method:CHECKER,originalContentHash:originalHash,change:'prompt/options/rationale correction',humanReview:false};
  }
  const decision=correction?'passed':originalDecision;
  const optionIndexes=correction?[correction.correctOption]:note.optionIndexes;
  assert(decision!=='passed'||optionIndexes.length===1);
  const issues=correction?[]:originalIssues,warnings=correction?[]:originalWarnings;
  const evidenceIds=[...new Set([...note.evidenceIds,...(correction?.evidenceIds||[])])];
  const evidence=evidenceIds.map(key=>{assert(EVIDENCE[key],key);return{id:key,...EVIDENCE[key],usage:'Grammar/lexical reference; application to this original question is the independent audit inference, not publisher approval'};});
  const independentAnswer={optionIndexes,answerText:optionIndexes.map(n=>content.options[n]),method:'model_assisted_independent_language_audit_of_fixed_question',reason:correction?.proof||note.reason,alternativesNotExhaustive:decision!=='passed'};
  const validation={validator:CHECKER,status:decision,issues,warnings,proof:decision==='passed'?{...independentAnswer,checkedContentHash:sha(content),sourceKeyUsedToDeriveAnswer:false}:null,humanReview:false,sourceRights:'author_declared_CC0_not_external_clearance',checkedAt,
   scope:'Exact prompt and four options under ordinary contemporary standard written English. This is a bounded model-assisted review, not a teacher review or a general grammar solver.',
   curriculumReview:'Grade is retained from source; textbook edition, region and age suitability remain for a teacher to confirm.'};
  return{questionId:q.id,sourceContentHash:originalHash,expectedRevision:1,subject:q.subject,grade:q.grade,sourceBatchId:source.batchId,decision,independentAnswer,issues,warnings,evidence,humanReview:false,
   originalAssessment:{decision:originalDecision,independentAnswer:{optionIndexes:note.optionIndexes,answerText:note.optionIndexes.map(n=>q.options[n]),reason:note.reason},sourceCorrectOption:q.correctOption,sourceKeySupported,rationaleAssessment:originalDecision==='passed'?'consistent_with_bounded_answer_reasoning':'source_explanation_does_not_establish_uniqueness_or_needs_correction',issues:originalIssues,warnings:originalWarnings,initialIsolation:source.validation.status==='quarantined'},
   contentChecks:{promptAndAllOptionsRead:true,sourceRationaleReadAfterIndependentAnswer:true,duplicateOptions:new Set(content.options).size!==4,formula:'not_applicable',image:[104,105].includes(note.ordinal)?'unprovided_chart_or_list_reference_needs_edit':'no_required_image_detected',grade:{sourceGrade:q.grade,independentlyCurriculumCertified:false,textbookEdition:'unconfirmed',region:'unconfirmed'},questionDifficulty:content.difficulty,knowledgeDifficulty:content.knowledgeDifficulty,levelAssignmentChanged:false},
   proposal:{expectedContentHash:originalHash,expectedRevision:1,content,contentHash:sha(content),state:decision==='passed'?'available':decision==='quarantined'?'quarantined':'pending',validation,reason:correction?.reason||note.reason,contentChanged:Boolean(correction),rejectedOptions:correction?.rejectedOptions||null,formalScoringAllowed:false,teacherReviewed:false}
  };
 });
 const batches=[];for(const grade of [7,8,9]){const graded=records.filter(r=>r.grade===grade);assert.equal(graded.length,54);for(let n=0;n<graded.length;n+=18)batches.push({id:`english-recheck-g${grade}-${String(n/18+1).padStart(2,'0')}`,subject:'english',grade,questionIds:graded.slice(n,n+18).map(r=>r.questionId)});}
 const countBy=(field)=>Object.fromEntries(['passed','needs_review','quarantined'].map(state=>[state,records.filter(r=>(field==='original'?r.originalAssessment.decision:r.decision)===state).length]));
 return{schemaVersion:2,checkedAt,checker:CHECKER,sourceCatalogSha256:catalogSha256,method:{description:'Each of 162 prompts and all four options were independently read before comparison with source keys and rationales. Decisions are a pinned model-assisted linguistic audit, with primary grammar references for disputed rules. The script checks integrity, version binding and consistency; it does not newly solve arbitrary English questions on every run.',inputCount:162,teacherReviewCount:0,liveDatabaseRead:false,productionWrites:false,externalModelCalls:false,formalScoringAllowed:false,gradeAndRegionalCurriculumCertified:false},batches,records,summary:{count:records.length,original:countBy('original'),proposed:countBy('proposal'),originalIsolated:records.filter(r=>r.originalAssessment.initialIsolation).length,correctedOriginalIsolated:records.filter(r=>r.originalAssessment.initialIsolation&&r.proposal.contentChanged).length,contentChanged:records.filter(r=>r.proposal.contentChanged).length,newlyQuarantined:records.filter(r=>!r.originalAssessment.initialIsolation&&r.decision==='quarantined').length,humanReviewsCreated:0},references:Object.entries(EVIDENCE).map(([id,value])=>({id,...value})),limitations:['Automatic/model-assisted review can be wrong; real teacher review remains pending for every new question.','Known multiple natural completions are isolated. Less certain context/register issues remain needs_review.','No claim that source grade mappings match every textbook or region.','Proposals may only be applied by current-version and exact-content-hash compare-and-swap, with no existing teacher review overwritten.','Only the three originally isolated questions are textually revised here; other problematic questions retain their source content for teacher correction.']};
}

async function main(){
 const path=new URL('../data/question-bank/catalog.json',import.meta.url),bytes=await readFile(path),catalog=JSON.parse(bytes.toString('utf8'));
 const directory=new URL('../data/question-bank/rechecks/',import.meta.url);await mkdir(directory,{recursive:true});const file=new URL('english-recheck-v2.json',directory);
 let prior=null;try{prior=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const report=buildEnglishRecheck(catalog,{catalogSha256:sha(bytes),...(prior?{checkedAt:prior.checkedAt}:{})});
 if(prior)assert.equal(sha(prior),sha(report),'Sealed report differs: use a new versioned audit artifact instead of overwriting it');
 else await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({output:file.pathname,summary:report.summary,batches:report.batches.length,sealedArtifactReused:Boolean(prior)}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
