// Public standalone demonstration content. Never load private learner records or private question banks.
export const DEMO_CONTENT = {
  "version": 1,
  "label": "本地演示题｜非真实学生记录｜不保存个人资料",
  "updatedAt": "2026-11-14",
  "synthetic": true,
  "stage": "senior_arts",
  "examYear": 2027,
  "subjects": [
    {
      "id": "chinese",
      "name": "语文",
      "maxScore": 150,
      "scoreType": "raw",
      "point": {
        "id": "demo-arts-zh-evidence",
        "subject": "chinese",
        "title": "信息类阅读：把结论限制在文本证据内",
        "questionType": "阅读理解单项选择（教学微题）",
        "ability": "识别范围、程度、条件，选取与文本直接对应的结论",
        "minutes": 25,
        "mastery": "在本点诊断与复测的同类微题中独立定位证据、圈出限定词并解释排除理由；1题答对仅是本次证据，需多次不同材料复现。",
        "coverage": [
          "条件与范围限定",
          "文本直接信息提取"
        ],
        "uncovered": [
          "长篇信息类文本的结构分析",
          "文学类阅读",
          "文言文与古诗鉴赏",
          "语言运用综合题",
          "作文"
        ],
        "prerequisites": [
          "能读懂句子主干",
          "理解“部分”“全部”“可能”“必然”的差异"
        ],
        "handout": {
          "focus": "遇到选项先回原文，不凭常识补充。得分动作是找证据、核范围、核程度、核条件。",
          "steps": [
            "在题干圈出“依据材料”等限制。",
            "找选项所对应的原句，划出主语和结论。",
            "核对范围（部分还是全部）、程度（可能还是必然）、条件（在什么情况下）。",
            "删去超出原文的选项，用一句话说明保留项的证据。"
          ],
          "pitfalls": [
            "把一次调查写成所有地区的共同结论。",
            "把“可以帮助”改成“必然实现”。",
            "把并列出现的现象当作已经证明的因果。"
          ],
          "workedExample": {
            "prompt": "原创短材料：在试点的三所学校中，午间开放图书馆后，到馆人数均有增加。作者提示，这一结果还需在更多学校观察。哪项能由材料支持？",
            "answer": "三所试点学校在开放后到馆人数增加。",
            "explanation": "范围是三所试点学校；“更多学校”尚待观察，不能推出所有学校都有效，也不能仅凭先后关系断定唯一原因。"
          },
          "exercises": [
            {
              "level": "基础",
              "prompt": "把“部分参加者表示愿意继续”改成“所有参加者都会继续”，改动了哪两类信息？",
              "answer": "范围和确定程度。",
              "explanation": "“部分→所有”扩大范围；“表示愿意→都会”把意愿变成确定行为。"
            },
            {
              "level": "巩固",
              "prompt": "材料说“在设备维护及时的条件下，该方案可能减少停机”。写一个不越界的结论。",
              "answer": "及时维护时，该方案可能减少停机。",
              "explanation": "同时保留条件和“可能”，不能写成无条件、必然减少。"
            }
          ],
          "memoryCard": {
            "front": "选项核对哪四项？",
            "back": "证据、范围、程度、条件。"
          },
          "retestGuide": "换用长度与语言难度相近的新材料，仍只测限定词，不把作文或整卷成绩纳入比较。",
          "errorReplay": "把错选项中的越界词圈出，改写成有证据支持的句子，再做同类新题。"
        },
        "questions": [
          {
            "id": "demo-zh-d1",
            "phase": "diagnostic",
            "prompt": "演示原创材料：本次调查的12名参加者中，8名表示图示帮助自己理解操作步骤。哪个结论与材料一致？",
            "options": [
              "图示保证所有人学会操作。",
              "所有人都比以前做得更快。",
              "本次12名参加者中，8名表示图示有帮助。",
              "未被调查的人都不需要图示。"
            ],
            "correctOption": 2,
            "rationale": "材料仅记录本次12人中的8人自述，不能扩大为所有人或实际操作成效。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          },
          {
            "id": "demo-zh-p1",
            "phase": "practice",
            "prompt": "演示原创材料：在风较小的测试日，该装置运行平稳。研究者尚未测试大风条件。哪个结论有依据？",
            "options": [
              "装置在任何天气都平稳。",
              "已测试的小风条件下运行平稳。",
              "大风中装置一定不能运行。",
              "天气对运行没有影响。"
            ],
            "correctOption": 1,
            "rationale": "只保留已经测试的条件，不推断未测试的大风。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          },
          {
            "id": "demo-zh-r1",
            "phase": "retest",
            "prompt": "演示原创材料：本次访谈的15名参加者中，10名表示语音提示帮助自己找到入口。哪个结论与材料一致？",
            "options": [
              "本次15名受访者中，10名表示语音提示有帮助。",
              "所有访客都依靠语音提示。",
              "语音提示保证每个人快速找到入口。",
              "没有受访的人都反对语音提示。"
            ],
            "correctOption": 0,
            "rationale": "只描述样本中10人的自述，保留范围与性质。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          }
        ],
        "version": 1,
        "applicableYears": [
          2027
        ],
        "yearNote": "2027备考规划用原创微题；非2027正式试卷结构或考点必考承诺。年度政策待持续复核。",
        "source": {
          "kind": "original",
          "title": "本平台独立公开演示微题与短讲义（AI辅助起草）",
          "license": "项目原创内容，可在本平台教学、阅读与打印；未引入外部试卷或版权材料。",
          "attribution": "AI辅助起草，尚待真人教师核验；不声称属于官方试题。"
        },
        "reviewStatus": "pending_human",
        "humanReview": {
          "status": "pending",
          "reviewedVersion": null,
          "reviewer": null,
          "reviewedAt": null
        },
        "automaticValidation": {
          "status": "structure_checked",
          "checkedAt": "2026-11-14",
          "scope": [
            "必填字段",
            "选项与答案索引",
            "三阶段配齐",
            "题号唯一",
            "目标分配和与上限"
          ],
          "limitation": "自动校验不等于学科质量全面核验，更不等于老师审核。"
        },
        "sampleSize": {
          "diagnostic": 1,
          "practice": 1,
          "retest": 1
        },
        "examPoints": null
      }
    },
    {
      "id": "math",
      "name": "数学",
      "maxScore": 150,
      "scoreType": "raw",
      "point": {
        "id": "demo-arts-ma-log-domain",
        "subject": "math",
        "title": "对数式定义域：先让真数大于零",
        "questionType": "函数定义域单项选择（教学微题）",
        "ability": "把对数真数条件转化为一元一次不等式",
        "minutes": 30,
        "mastery": "独立写出真数>0、解不等式、用区间表示，并用边界值检查；本批只覆盖一次式真数，不代表掌握整章函数。",
        "coverage": [
          "固定合法底数的对数式定义域",
          "一次式真数的严格不等式"
        ],
        "uncovered": [
          "含参底数",
          "对数运算综合",
          "复合函数",
          "多条件定义域",
          "函数性质与导数"
        ],
        "prerequisites": [
          "会解一元一次不等式",
          "理解开区间和不包含端点",
          "知道对数底数大于0且不等于1"
        ],
        "handout": {
          "focus": "logₐu有意义，需要a>0且a≠1，并且u>0。本点题目底数已给定且合法，只处理真数条件。",
          "steps": [
            "确认底数为正数且不等于1。",
            "找到整个真数，写成“真数>0”。",
            "解一次不等式。",
            "写开区间；把边界代回，真数为0的点不能取。"
          ],
          "pitfalls": [
            "把真数>0写成真数≥0。",
            "把条件误写成函数值>0。",
            "乘除负数时忘记不等号方向改变。"
          ],
          "workedExample": {
            "prompt": "求y=log₂(x−1)的定义域。",
            "answer": "x−1>0，所以x>1；定义域为(1,+∞)。",
            "explanation": "底数2合法。x=1时真数为0，不可取；x=2时真数为1，可以取。"
          },
          "exercises": [
            {
              "level": "基础",
              "prompt": "求y=log₃(x+2)的定义域。",
              "answer": "(−2,+∞)。",
              "explanation": "x+2>0，得到x>−2。"
            },
            {
              "level": "巩固",
              "prompt": "求y=log₂(5−x)的定义域。",
              "answer": "(−∞,5)。",
              "explanation": "5−x>0，得到−x>−5，乘以−1后不等号反向，x<5。"
            }
          ],
          "memoryCard": {
            "front": "logₐu有意义的条件？",
            "back": "a>0，a≠1，u>0。真数是严格大于0。"
          },
          "retestGuide": "诊断与复测均为合法固定底数、系数为1的一次真数，比较是否独立完成相同步骤；不外推函数大题得分。",
          "errorReplay": "保留原错误不等式，写出错因（漏条件／端点／变号），改正后代入边界和一个可取值检查。"
        },
        "questions": [
          {
            "id": "demo-ma-d1",
            "phase": "diagnostic",
            "prompt": "演示题：y=log₂(x+1)的定义域是：",
            "options": [
              "[−1,+∞)",
              "(−1,+∞)",
              "(0,+∞)",
              "(−∞,−1)"
            ],
            "correctOption": 1,
            "rationale": "真数x+1>0，x>−1，不含端点。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          },
          {
            "id": "demo-ma-p1",
            "phase": "practice",
            "prompt": "演示题：y=log₃(2x−6)的定义域是：",
            "options": [
              "(3,+∞)",
              "[3,+∞)",
              "(−∞,3)",
              "(6,+∞)"
            ],
            "correctOption": 0,
            "rationale": "2x−6>0，得到x>3。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          },
          {
            "id": "demo-ma-r1",
            "phase": "retest",
            "prompt": "演示题：y=log₄(x+4)的定义域是：",
            "options": [
              "[−4,+∞)",
              "(0,+∞)",
              "(−∞,−4)",
              "(−4,+∞)"
            ],
            "correctOption": 3,
            "rationale": "真数x+4>0，得到x>−4，不含端点。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          }
        ],
        "version": 1,
        "applicableYears": [
          2027
        ],
        "yearNote": "2027备考规划用原创微题；非2027正式试卷结构或考点必考承诺。年度政策待持续复核。",
        "source": {
          "kind": "original",
          "title": "本平台独立公开演示微题与短讲义（AI辅助起草）",
          "license": "项目原创内容，可在本平台教学、阅读与打印；未引入外部试卷或版权材料。",
          "attribution": "AI辅助起草，尚待真人教师核验；不声称属于官方试题。"
        },
        "reviewStatus": "pending_human",
        "humanReview": {
          "status": "pending",
          "reviewedVersion": null,
          "reviewer": null,
          "reviewedAt": null
        },
        "automaticValidation": {
          "status": "structure_checked",
          "checkedAt": "2026-11-14",
          "scope": [
            "必填字段",
            "选项与答案索引",
            "三阶段配齐",
            "题号唯一",
            "目标分配和与上限"
          ],
          "limitation": "自动校验不等于学科质量全面核验，更不等于老师审核。"
        },
        "sampleSize": {
          "diagnostic": 1,
          "practice": 1,
          "retest": 1
        },
        "examPoints": null
      }
    },
    {
      "id": "english",
      "name": "英语",
      "maxScore": 150,
      "scoreType": "raw",
      "point": {
        "id": "demo-arts-en-detail",
        "subject": "english",
        "title": "阅读细节：定位原因，不用常识替代原文",
        "questionType": "英语阅读细节单项选择（教学微题）",
        "ability": "依据why与because定位明确原因，识别干扰信息",
        "minutes": 25,
        "mastery": "先圈出问题对象与why，再划出原文原因并说明选项对应；一题样本不能估计整科阅读成绩。",
        "coverage": [
          "短段落明确原因信息",
          "because引导的原因定位"
        ],
        "uncovered": [
          "长篇阅读",
          "推理判断与主旨",
          "语法填空",
          "完形填空",
          "听力",
          "应用文和读后续写"
        ],
        "prerequisites": [
          "识别why和because",
          "能区分人物、动作和原因",
          "认识本点词汇closed/busy/quiet/borrow"
        ],
        "handout": {
          "focus": "问题问why时，优先寻找与题干动作对应的because句。选项即使合理，没有原文证据也不选。",
          "steps": [
            "读问题，圈出人物、动作和why。",
            "回到短文定位同一人物、同一动作。",
            "划出原因句；注意不要把相邻但无关的信息当原因。",
            "将原因句与选项对照，再回读一次。"
          ],
          "pitfalls": [
            "看见原文重复词就选择，却没有核对问题。",
            "用自己的生活经验替代文章的明确原因。",
            "把行为结果当作行为原因。"
          ],
          "workedExample": {
            "prompt": "原创短文：Mia usually studies at home. Today she went to the library because workers were repairing the room next door. Why did Mia go to the library today?",
            "answer": "Because workers were repairing the room next door.",
            "explanation": "题目动作是went to the library，because后给出直接原因；“通常在家学习”是背景。"
          },
          "exercises": [
            {
              "level": "基础",
              "prompt": "标出原因：Tom took a bus because his bike was broken.",
              "answer": "his bike was broken",
              "explanation": "because后解释了乘公交的原因，took a bus是动作。"
            },
            {
              "level": "巩固",
              "prompt": "原创短文：Lily likes music. She left the concert early because the last bus was at nine. 问题：Why did Lily leave early?",
              "answer": "To catch the last bus / Because the last bus was at nine.",
              "explanation": "喜欢音乐是干扰背景；离开早的原因是末班车时间。"
            }
          ],
          "memoryCard": {
            "front": "遇到why细节题先做什么？",
            "back": "定位同一人物与动作，再找because或明确原因句。"
          },
          "retestGuide": "诊断与复测均为两句短文和明确because原因；不把它称为整篇阅读能力复测。",
          "errorReplay": "在原文划出支持正确答案的一句，把错选项对应的信息标成背景、结果或无依据。"
        },
        "questions": [
          {
            "id": "demo-en-d1",
            "phase": "diagnostic",
            "prompt": "Demo text: Ben wanted to play tennis. He stayed indoors because it was raining. Why did Ben stay indoors?",
            "options": [
              "He disliked tennis.",
              "It was raining.",
              "He had lost his shoes.",
              "His friend was late."
            ],
            "correctOption": 1,
            "rationale": "because后明确给出原因：下雨。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          },
          {
            "id": "demo-en-p1",
            "phase": "practice",
            "prompt": "Demo text: Nora likes drawing. She took a coat because the evening was cold. Why did Nora take a coat?",
            "options": [
              "She wanted to draw it.",
              "It was a gift.",
              "The evening was cold.",
              "She could not find a bag."
            ],
            "correctOption": 2,
            "rationale": "带外套的直接原因是晚上冷，喜欢画画是背景。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          },
          {
            "id": "demo-en-r1",
            "phase": "retest",
            "prompt": "Demo text: Jack wanted to walk outside. He stayed indoors because it was snowing. Why did Jack stay indoors?",
            "options": [
              "It was snowing.",
              "He did not like walking.",
              "His shoes were new.",
              "He was waiting for a book."
            ],
            "correctOption": 0,
            "rationale": "because后说明下雪，与诊断保持明确原因信息范围。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          }
        ],
        "version": 1,
        "applicableYears": [
          2027
        ],
        "yearNote": "2027备考规划用原创微题；非2027正式试卷结构或考点必考承诺。年度政策待持续复核。",
        "source": {
          "kind": "original",
          "title": "本平台独立公开演示微题与短讲义（AI辅助起草）",
          "license": "项目原创内容，可在本平台教学、阅读与打印；未引入外部试卷或版权材料。",
          "attribution": "AI辅助起草，尚待真人教师核验；不声称属于官方试题。"
        },
        "reviewStatus": "pending_human",
        "humanReview": {
          "status": "pending",
          "reviewedVersion": null,
          "reviewer": null,
          "reviewedAt": null
        },
        "automaticValidation": {
          "status": "structure_checked",
          "checkedAt": "2026-11-14",
          "scope": [
            "必填字段",
            "选项与答案索引",
            "三阶段配齐",
            "题号唯一",
            "目标分配和与上限"
          ],
          "limitation": "自动校验不等于学科质量全面核验，更不等于老师审核。"
        },
        "sampleSize": {
          "diagnostic": 1,
          "practice": 1,
          "retest": 1
        },
        "examPoints": null
      }
    },
    {
      "id": "history",
      "name": "历史",
      "maxScore": 100,
      "scoreType": "raw",
      "point": {
        "id": "demo-arts-hi-source",
        "subject": "history",
        "title": "史料实证：为具体问题选择直接证据",
        "questionType": "史料证据单项选择（教学微题）",
        "ability": "依据研究对象、时间与指标判断材料的相关性和直接性",
        "minutes": 25,
        "mastery": "能说清研究问题、材料形成时间及能证明／不能证明什么；直接证据仍需核验真实性，不能由一道选择题确认完整史料能力。",
        "coverage": [
          "研究问题与材料匹配",
          "直接记录的证据范围"
        ],
        "uncovered": [
          "中国通史与世界史时序",
          "具体制度演变",
          "史料互证完整过程",
          "历史解释长材料题",
          "开放性论述"
        ],
        "prerequisites": [
          "分清史实记录、宣传和后人评价",
          "认识产量、到校人数等统计指标",
          "理解材料真实与否仍需核验"
        ],
        "handout": {
          "focus": "先问“研究什么”，再看哪份材料直接记录对应对象、时间与指标。直接不等于绝对可靠，还需核对真伪、形成目的和其他材料。",
          "steps": [
            "拆研究问题：对象＋时间＋具体指标。",
            "确认候选材料由谁、何时、为何形成。",
            "选择能直接回应指标的材料。",
            "给结论加边界：单一单位或单一年份不能直接代表全国、长期趋势。"
          ],
          "pitfalls": [
            "将广告宣传当成实际产量记录。",
            "以研究者名气替代材料与问题的对应关系。",
            "把“原始记录”理解为不必核实或永远真实。"
          ],
          "workedExample": {
            "prompt": "以下为虚构教学情境：研究某纺织厂1910年的实际月产量，现有当年月产登记表、厂庆纪念歌词、后来的旅游广告。哪项最直接相关？",
            "answer": "当年月产登记表。",
            "explanation": "它直接对应单位、时间和产量指标；仍要核对记录是否完整可信，不能直接推广为全国工业水平。"
          },
          "exercises": [
            {
              "level": "基础",
              "prompt": "研究某校1925年的实际在校人数，招生广告和当年学籍名册中哪项更直接？（虚构教学情境）",
              "answer": "当年学籍名册。",
              "explanation": "招生广告反映计划或宣传，学籍名册直接记录在校者，但仍应检查完整性与重复。"
            },
            {
              "level": "巩固",
              "prompt": "一份工厂账册显示其某月产量增长，能否据此断定全国全年工业产量都增长？",
              "answer": "不能。",
              "explanation": "单位、地域与时间范围均不足，需要更多可比材料。"
            }
          ],
          "memoryCard": {
            "front": "判断材料匹配看什么？",
            "back": "研究对象、时间、指标；再核查真实性、目的和局限。"
          },
          "retestGuide": "两次都用明确标注的虚构教学情境，测研究问题与直接记录匹配，不测未给出的历史年代记忆。",
          "errorReplay": "把研究问题拆成三项，与错选材料逐一对照，写出它到底能证明什么。"
        },
        "questions": [
          {
            "id": "demo-hi-d1",
            "phase": "diagnostic",
            "prompt": "虚构演示情境：研究某电车公司1930年每月实际运送的乘客人数，哪项最直接相关？假定来源已核实。",
            "options": [
              "公司庆典的请柬。",
              "后来的城市旅游广告。",
              "公司1930年逐月客运统计记录。",
              "其他城市的电车图片。"
            ],
            "correctOption": 2,
            "rationale": "记录直接对应公司、年份与客运人数，仍需核查统计完整性。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          },
          {
            "id": "demo-hi-p1",
            "phase": "practice",
            "prompt": "虚构演示情境：研究某图书馆1935年的实际借书量，哪项最直接相关？假定来源已核实。",
            "options": [
              "鼓励阅读的口号。",
              "当年的借阅登记记录。",
              "馆外建筑的照片。",
              "其他城市的文化报道。"
            ],
            "correctOption": 1,
            "rationale": "借阅登记直接记录所研究的借书活动，口号不能代替实际量。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          },
          {
            "id": "demo-hi-r1",
            "phase": "retest",
            "prompt": "虚构演示情境：研究某轮船公司1932年每月实际运送的货物重量，哪项最直接相关？假定来源已核实。",
            "options": [
              "后来的旅游线路介绍。",
              "公司成立时的致辞。",
              "其他公司的货船画作。",
              "公司1932年逐月货运统计记录。"
            ],
            "correctOption": 3,
            "rationale": "记录直接对应对象、时间与重量指标；不能据此推断全国运输总量。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          }
        ],
        "version": 1,
        "applicableYears": [
          2027
        ],
        "yearNote": "2027备考规划用原创微题；非2027正式试卷结构或考点必考承诺。年度政策待持续复核。",
        "source": {
          "kind": "original",
          "title": "本平台独立公开演示微题与短讲义（AI辅助起草）",
          "license": "项目原创内容，可在本平台教学、阅读与打印；未引入外部试卷或版权材料。",
          "attribution": "AI辅助起草，尚待真人教师核验；不声称属于官方试题。"
        },
        "reviewStatus": "pending_human",
        "humanReview": {
          "status": "pending",
          "reviewedVersion": null,
          "reviewer": null,
          "reviewedAt": null
        },
        "automaticValidation": {
          "status": "structure_checked",
          "checkedAt": "2026-11-14",
          "scope": [
            "必填字段",
            "选项与答案索引",
            "三阶段配齐",
            "题号唯一",
            "目标分配和与上限"
          ],
          "limitation": "自动校验不等于学科质量全面核验，更不等于老师审核。"
        },
        "sampleSize": {
          "diagnostic": 1,
          "practice": 1,
          "retest": 1
        },
        "examPoints": null
      }
    },
    {
      "id": "geography",
      "name": "地理",
      "maxScore": 100,
      "scoreType": "graded_target",
      "point": {
        "id": "demo-arts-ge-solar",
        "subject": "geography",
        "title": "春秋分正午太阳高度：先定位直射纬度",
        "questionType": "地理数值判断单项选择（教学微题）",
        "ability": "在给定春秋分条件下用纬度差求正午太阳高度",
        "minutes": 30,
        "mastery": "写出直射纬度0°、纬度差和H=90°−纬度差，说明这是地方时正午；本批不测空间图判读。",
        "coverage": [
          "春分或秋分直射赤道的简化模型",
          "非极地正午太阳高度计算"
        ],
        "uncovered": [
          "地方时与区时换算",
          "晨昏线图",
          "二分二至综合",
          "极昼极夜",
          "大气运动",
          "区域与人文地理"
        ],
        "prerequisites": [
          "认识南北纬与赤道",
          "会做角度减法",
          "区分正午太阳高度与一天中任意时刻高度"
        ],
        "handout": {
          "focus": "在忽略大气折射的学校地理简化模型中，春分、秋分太阳直射赤道。地方时正午太阳高度H=90°−当地与直射点的纬度差。",
          "steps": [
            "确认题目是地方时正午，日期是春分或秋分。",
            "写出直射纬度0°。",
            "求当地与0°之间的纬度差，即当地纬度的绝对值。",
            "用90°减去纬度差，并检查结果在0°至90°之间。"
          ],
          "pitfalls": [
            "把北京时间12点直接当成所有地点的地方时正午。",
            "把纬度本身当作太阳高度。",
            "春分秋分之外仍机械使用直射纬度0°。"
          ],
          "workedExample": {
            "prompt": "忽略大气折射。春分日，北纬20°某地在地方时正午的太阳高度是多少？",
            "answer": "70°。",
            "explanation": "直射纬度0°，纬度差20°；H=90°−20°=70°。"
          },
          "exercises": [
            {
              "level": "基础",
              "prompt": "秋分日南纬10°某地地方时正午太阳高度是多少？忽略大气折射。",
              "answer": "80°。",
              "explanation": "纬度差为10°，H=90°−10°=80°。"
            },
            {
              "level": "巩固",
              "prompt": "春分日北纬25°与北纬45°两地，哪地正午太阳高度较大，大多少？忽略大气折射。",
              "answer": "北纬25°较大，大20°。",
              "explanation": "两地分别为65°和45°，相差20°。"
            }
          ],
          "memoryCard": {
            "front": "春秋分地方时正午高度怎么求？",
            "back": "直射赤道；H=90°−当地纬度的绝对值。"
          },
          "retestGuide": "两次均给出北纬与分日，独立算一次角度减法；不与区域综合题或等级分直接比较。",
          "errorReplay": "按“时刻—直射纬度—纬度差—高度”补齐四格，指出漏掉的条件后再算新纬度。"
        },
        "questions": [
          {
            "id": "demo-ge-d1",
            "phase": "diagnostic",
            "prompt": "演示题：忽略大气折射，春分日北纬35°某地地方时正午太阳高度是多少？",
            "options": [
              "35°",
              "55°",
              "90°",
              "0°"
            ],
            "correctOption": 1,
            "rationale": "春分直射0°，90°−35°=55°。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          },
          {
            "id": "demo-ge-p1",
            "phase": "practice",
            "prompt": "演示题：忽略大气折射，秋分日南纬15°某地地方时正午太阳高度是多少？",
            "options": [
              "15°",
              "90°",
              "75°",
              "105°"
            ],
            "correctOption": 2,
            "rationale": "秋分直射0°，90°−15°=75°。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          },
          {
            "id": "demo-ge-r1",
            "phase": "retest",
            "prompt": "演示题：忽略大气折射，秋分日北纬25°某地地方时正午太阳高度是多少？",
            "options": [
              "90°",
              "25°",
              "115°",
              "65°"
            ],
            "correctOption": 3,
            "rationale": "秋分直射0°，90°−25°=65°。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          }
        ],
        "version": 1,
        "applicableYears": [
          2027
        ],
        "yearNote": "2027备考规划用原创微题；非2027正式试卷结构或考点必考承诺。年度政策待持续复核。",
        "source": {
          "kind": "original",
          "title": "本平台独立公开演示微题与短讲义（AI辅助起草）",
          "license": "项目原创内容，可在本平台教学、阅读与打印；未引入外部试卷或版权材料。",
          "attribution": "AI辅助起草，尚待真人教师核验；不声称属于官方试题。"
        },
        "reviewStatus": "pending_human",
        "humanReview": {
          "status": "pending",
          "reviewedVersion": null,
          "reviewer": null,
          "reviewedAt": null
        },
        "automaticValidation": {
          "status": "structure_checked",
          "checkedAt": "2026-11-14",
          "scope": [
            "必填字段",
            "选项与答案索引",
            "三阶段配齐",
            "题号唯一",
            "目标分配和与上限"
          ],
          "limitation": "自动校验不等于学科质量全面核验，更不等于老师审核。"
        },
        "sampleSize": {
          "diagnostic": 1,
          "practice": 1,
          "retest": 1
        },
        "examPoints": null
      }
    },
    {
      "id": "politics",
      "name": "思想政治",
      "maxScore": 100,
      "scoreType": "graded_target",
      "point": {
        "id": "demo-arts-po-practice",
        "subject": "politics",
        "title": "认识论：用实践检验认识",
        "questionType": "思想政治情境判断单项选择（教学微题）",
        "ability": "把检验结论的实践活动与权威、意见、设想区分开",
        "minutes": 25,
        "mastery": "从情境指出实际检验活动，并对应“实践是检验认识真理性的唯一标准”；不由单个实验推出认识永远不再发展。",
        "coverage": [
          "实践检验认识的作用",
          "区分实际检验与主观赞同"
        ],
        "uncovered": [
          "马克思主义哲学其他专题",
          "经济与社会",
          "政治与法治",
          "文化与哲学综合",
          "逻辑与思维",
          "法律与生活",
          "主观题论证"
        ],
        "prerequisites": [
          "理解认识是对事物的反映",
          "区分实际行动与仅有想法",
          "能在情境中找到检验结果"
        ],
        "handout": {
          "focus": "检验一个认识是否正确，不能只看谁说的、多少人赞同或设想是否美好，要放到实践中检验。新的实践也会推动认识发展。",
          "steps": [
            "找出材料里等待检验的看法或方案。",
            "找出实际做了什么、得到什么可观察结果。",
            "将“实际检验”与“仅表态、凭权威、凭想象”区分。",
            "对应原理并保留情境范围，不把一次检验写成所有条件下永久正确。"
          ],
          "pitfalls": [
            "把多数人赞同当成检验真理的标准。",
            "认为专家提出的结论不需要实践检验。",
            "从一次有效推成所有条件下永远有效。"
          ],
          "workedExample": {
            "prompt": "原创教学情境：小组提出一种节水方法，在相同条件的试验中测量实际用水量后，修改了原来的判断。这里检验判断的依据是什么？",
            "answer": "实际试验及其结果体现的实践检验。",
            "explanation": "判断依据不是提出者的名气或人数。要说明试验的条件和局限，后续实践仍可能带来新认识。"
          },
          "exercises": [
            {
              "level": "基础",
              "prompt": "“只要很多人赞同，一个判断就一定正确”是否恰当？",
              "answer": "不恰当。",
              "explanation": "赞同人数不是检验认识真理性的标准，应接受实践检验。"
            },
            {
              "level": "巩固",
              "prompt": "一种方案在特定试点有效，能否据此认定任何条件下都永远有效？",
              "answer": "不能。",
              "explanation": "认识有适用条件，需要在后续实践中继续检验和发展。"
            }
          ],
          "memoryCard": {
            "front": "检验认识真理性的唯一标准是什么？",
            "back": "实践。具体结论还须注意条件和范围。"
          },
          "retestGuide": "诊断与复测都要求从四个选项中区分实践检验与主观判断，不把结果当作政治整卷能力或正式等级分。",
          "errorReplay": "把错选理由标成“人数／权威／想象／实践”，重新指出情境中实际检验的行为与结果。"
        },
        "questions": [
          {
            "id": "demo-po-d1",
            "phase": "diagnostic",
            "prompt": "演示原创情境：为判断新的排队方案是否缩短等待，小组实际试行并记录等待时间，再修正看法。主要体现：",
            "options": [
              "多数人赞同就是正确。",
              "方案名称新颖就有效。",
              "实践是检验认识真理性的唯一标准。",
              "一次试行证明任何条件下都有效。"
            ],
            "correctOption": 2,
            "rationale": "实际试行和记录用于检验认识，不能由一次试行无限推广。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          },
          {
            "id": "demo-po-p1",
            "phase": "practice",
            "prompt": "演示题：判断新设计是否达到预期，哪种做法最符合实践检验要求？",
            "options": [
              "只听设计者保证。",
              "在条件可比的实际测试中观察结果。",
              "只看赞同人数。",
              "只凭设计图是否漂亮。"
            ],
            "correctOption": 1,
            "rationale": "实际测试提供实践检验，保证、赞同与美观不能替代。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          },
          {
            "id": "demo-po-r1",
            "phase": "retest",
            "prompt": "演示原创情境：为判断新的整理方法是否缩短取物时间，小组实际试行并记录，再修正看法。主要体现：",
            "options": [
              "实践是检验认识真理性的唯一标准。",
              "想法越美好就越正确。",
              "同意者越多就不必检验。",
              "一次试行使认识永不变化。"
            ],
            "correctOption": 0,
            "rationale": "通过实际试行检验判断，认识仍要随实践发展。",
            "difficulty": "低",
            "errorType": "证据或条件遗漏",
            "maxScore": 1,
            "version": 1
          }
        ],
        "version": 1,
        "applicableYears": [
          2027
        ],
        "yearNote": "2027备考规划用原创微题；非2027正式试卷结构或考点必考承诺。年度政策待持续复核。",
        "source": {
          "kind": "original",
          "title": "本平台独立公开演示微题与短讲义（AI辅助起草）",
          "license": "项目原创内容，可在本平台教学、阅读与打印；未引入外部试卷或版权材料。",
          "attribution": "AI辅助起草，尚待真人教师核验；不声称属于官方试题。"
        },
        "reviewStatus": "pending_human",
        "humanReview": {
          "status": "pending",
          "reviewedVersion": null,
          "reviewer": null,
          "reviewedAt": null
        },
        "automaticValidation": {
          "status": "structure_checked",
          "checkedAt": "2026-11-14",
          "scope": [
            "必填字段",
            "选项与答案索引",
            "三阶段配齐",
            "题号唯一",
            "目标分配和与上限"
          ],
          "limitation": "自动校验不等于学科质量全面核验，更不等于老师审核。"
        },
        "sampleSize": {
          "diagnostic": 1,
          "practice": 1,
          "retest": 1
        },
        "examPoints": null
      }
    }
  ],
  "tiers": [
    {
      "target": 400,
      "combination": "history_geography_politics",
      "allocation": {
        "chinese": 85,
        "math": 70,
        "english": 75,
        "history": 60,
        "geography": 55,
        "politics": 55
      },
      "label": "可调整规划示例，不是录取线、成绩预测或保证",
      "pointUses": [
        {
          "subject": "chinese",
          "pointId": "demo-arts-zh-evidence",
          "priority": "先筛查后决定",
          "purpose": "先用这一个代表点核实前置基础；仅在错误暴露且可掌握时安排学习。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "math",
          "pointId": "demo-arts-ma-log-domain",
          "priority": "先筛查后决定",
          "purpose": "先用这一个代表点核实前置基础；仅在错误暴露且可掌握时安排学习。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "english",
          "pointId": "demo-arts-en-detail",
          "priority": "先筛查后决定",
          "purpose": "先用这一个代表点核实前置基础；仅在错误暴露且可掌握时安排学习。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "history",
          "pointId": "demo-arts-hi-source",
          "priority": "先筛查后决定",
          "purpose": "先用这一个代表点核实前置基础；仅在错误暴露且可掌握时安排学习。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "geography",
          "pointId": "demo-arts-ge-solar",
          "priority": "先筛查后决定",
          "purpose": "先用这一个代表点核实前置基础；仅在错误暴露且可掌握时安排学习。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "politics",
          "pointId": "demo-arts-po-practice",
          "priority": "先筛查后决定",
          "purpose": "先用这一个代表点核实前置基础；仅在错误暴露且可掌握时安排学习。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        }
      ]
    },
    {
      "target": 450,
      "combination": "history_geography_politics",
      "allocation": {
        "chinese": 95,
        "math": 80,
        "english": 85,
        "history": 65,
        "geography": 62,
        "politics": 63
      },
      "label": "可调整规划示例，不是录取线、成绩预测或保证",
      "pointUses": [
        {
          "subject": "chinese",
          "pointId": "demo-arts-zh-evidence",
          "priority": "先筛查后决定",
          "purpose": "已掌握者缩短复习，把时间转向未覆盖项；未掌握者先完成本点闭环。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "math",
          "pointId": "demo-arts-ma-log-domain",
          "priority": "先筛查后决定",
          "purpose": "已掌握者缩短复习，把时间转向未覆盖项；未掌握者先完成本点闭环。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "english",
          "pointId": "demo-arts-en-detail",
          "priority": "先筛查后决定",
          "purpose": "已掌握者缩短复习，把时间转向未覆盖项；未掌握者先完成本点闭环。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "history",
          "pointId": "demo-arts-hi-source",
          "priority": "先筛查后决定",
          "purpose": "已掌握者缩短复习，把时间转向未覆盖项；未掌握者先完成本点闭环。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "geography",
          "pointId": "demo-arts-ge-solar",
          "priority": "先筛查后决定",
          "purpose": "已掌握者缩短复习，把时间转向未覆盖项；未掌握者先完成本点闭环。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "politics",
          "pointId": "demo-arts-po-practice",
          "priority": "先筛查后决定",
          "purpose": "已掌握者缩短复习，把时间转向未覆盖项；未掌握者先完成本点闭环。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        }
      ]
    },
    {
      "target": 500,
      "combination": "history_geography_politics",
      "allocation": {
        "chinese": 105,
        "math": 90,
        "english": 95,
        "history": 70,
        "geography": 70,
        "politics": 70
      },
      "label": "可调整规划示例，不是录取线、成绩预测或保证",
      "pointUses": [
        {
          "subject": "chinese",
          "pointId": "demo-arts-zh-evidence",
          "priority": "先筛查后决定",
          "purpose": "将本点作为基础稳定性检查，要求能解释排除理由；更高层次题组仍待建设。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "math",
          "pointId": "demo-arts-ma-log-domain",
          "priority": "先筛查后决定",
          "purpose": "将本点作为基础稳定性检查，要求能解释排除理由；更高层次题组仍待建设。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "english",
          "pointId": "demo-arts-en-detail",
          "priority": "先筛查后决定",
          "purpose": "将本点作为基础稳定性检查，要求能解释排除理由；更高层次题组仍待建设。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "history",
          "pointId": "demo-arts-hi-source",
          "priority": "先筛查后决定",
          "purpose": "将本点作为基础稳定性检查，要求能解释排除理由；更高层次题组仍待建设。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "geography",
          "pointId": "demo-arts-ge-solar",
          "priority": "先筛查后决定",
          "purpose": "将本点作为基础稳定性检查，要求能解释排除理由；更高层次题组仍待建设。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "politics",
          "pointId": "demo-arts-po-practice",
          "priority": "先筛查后决定",
          "purpose": "将本点作为基础稳定性检查，要求能解释排除理由；更高层次题组仍待建设。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        }
      ]
    },
    {
      "target": 550,
      "combination": "history_geography_politics",
      "allocation": {
        "chinese": 115,
        "math": 100,
        "english": 105,
        "history": 80,
        "geography": 75,
        "politics": 75
      },
      "label": "可调整规划示例，不是录取线、成绩预测或保证",
      "pointUses": [
        {
          "subject": "chinese",
          "pointId": "demo-arts-zh-evidence",
          "priority": "先筛查后决定",
          "purpose": "本点只作查漏与错题回练，不增加机械重复；综合迁移与主观题仍待建设。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "math",
          "pointId": "demo-arts-ma-log-domain",
          "priority": "先筛查后决定",
          "purpose": "本点只作查漏与错题回练，不增加机械重复；综合迁移与主观题仍待建设。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "english",
          "pointId": "demo-arts-en-detail",
          "priority": "先筛查后决定",
          "purpose": "本点只作查漏与错题回练，不增加机械重复；综合迁移与主观题仍待建设。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "history",
          "pointId": "demo-arts-hi-source",
          "priority": "先筛查后决定",
          "purpose": "本点只作查漏与错题回练，不增加机械重复；综合迁移与主观题仍待建设。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "geography",
          "pointId": "demo-arts-ge-solar",
          "priority": "先筛查后决定",
          "purpose": "本点只作查漏与错题回练，不增加机械重复；综合迁移与主观题仍待建设。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        },
        {
          "subject": "politics",
          "pointId": "demo-arts-po-practice",
          "priority": "先筛查后决定",
          "purpose": "本点只作查漏与错题回练，不增加机械重复；综合迁移与主观题仍待建设。",
          "coverageStatus": "本档仅列已完成的代表性基础微题组，非全套得分方案"
        }
      ]
    }
  ],
  "comparisonNote": "只有实际完成同范围诊断与复测后才并列展示本次答对数；各阶段每科仅1题，不是高考成绩、等级分或提分预测。"
};
export default DEMO_CONTENT;
