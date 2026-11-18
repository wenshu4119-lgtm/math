// 许老师工作室 / 铭师学习规划管理平台 (mrxu.uk)
// 第二期：自助与 AI 一句话智能组卷引擎（按《过关手册》题型/难度抽题、单题换一题、缺题储备预警）

import { FULL_MANUAL_CATALOG, SUBJECT_ORDER, findManualNodeById } from './manual-catalog.mjs';

export const SEED_QUESTION_BANK = [
  // ==================== 高中数学（覆盖函数/不等式/导数/圆锥曲线/向量/三角，支持高一高二高三期中期末） ====================
  {
    qId: 'seed_sm_01', stage: 'senior', subjectKey: 'math', manualNodeId: 'senior_math_c1_i1',
    difficulty: '基础', questionType: '选择', defaultScore: 5,
    stem: '已知集合 A = {x | x² - 3x - 4 ≤ 0}，B = {x | y = ln(x - 1)}，则 A ∩ B = （  ）',
    options: ['A. (1, 4]', 'B. [1, 4]', 'C. [-1, 4]', 'D. (1, 4)'],
    answer: 'A',
    analysis: '【铭师解析】解得 A = [-1, 4]，对数真数 x - 1 > 0 得 B = (1, +∞)，故 A ∩ B = (1, 4]。对应手册《集合与常用逻辑用语》。'
  },
  {
    qId: 'seed_sm_02', stage: 'senior', subjectKey: 'math', manualNodeId: 'senior_math_c1_i2',
    difficulty: '基础', questionType: '选择', defaultScore: 5,
    stem: '命题“∀ x ∈ R，e^x > x + 1”的否定是（  ）',
    options: ['A. ∃ x ∈ R，e^x ≤ x + 1', 'B. ∀ x ∈ R，e^x ≤ x + 1', 'C. ∃ x ∈ R，e^x < x + 1', 'D. ∀ x ∉ R，e^x ≤ x + 1'],
    answer: 'A',
    analysis: '【铭师解析】全称量词命题的否定需将“∀”改写为“∃”，同时否定结论“>”为“≤”。'
  },
  {
    qId: 'seed_sm_03', stage: 'senior', subjectKey: 'math', manualNodeId: 'senior_math_c2_i2',
    difficulty: '中等', questionType: '选择', defaultScore: 5,
    stem: '已知正实数 a, b 满足 a + 2b = 2，则 1/a + 2/b 的最小值为（  ）',
    options: ['A. 9/2', 'B. 4', 'C. 5', 'D. 7/2'],
    answer: 'A',
    analysis: '【铭师解析】利用“1 的代换”：1/a + 2/b = 1/2 (a + 2b)(1/a + 2/b) = 1/2 (5 + 2b/a + 2a/b) ≥ 1/2 (5 + 4) = 9/2，当且仅当 a = b = 2/3 时取等。'
  },
  {
    qId: 'seed_sm_04', stage: 'senior', subjectKey: 'math', manualNodeId: 'senior_math_c3_i2',
    difficulty: '中等', questionType: '选择', defaultScore: 5,
    stem: '已知函数 f(x) 是定义在 R 上的奇函数，当 x ≥ 0 时 f(x) = x² + 2x，则不等式 f(2x - 1) > f(3) 的解集为（  ）',
    options: ['A. (2, +∞)', 'B. (-∞, 2)', 'C. (-1, 2)', 'D. (1, +∞)'],
    answer: 'A',
    analysis: '【铭师解析】由奇函数与 x ≥ 0 时单调递增可知 f(x) 在 R 上单调递增，故 2x - 1 > 3，解得 x > 2。'
  },
  {
    qId: 'seed_sm_05', stage: 'senior', subjectKey: 'math', manualNodeId: 'senior_math_c3_i2',
    difficulty: '中等', questionType: '选择', defaultScore: 5,
    stem: '若函数 f(x) = ln(x² - ax + 3a) 在区间 [2, +∞) 上单调递增，则实数 a 的取值范围是（  ）',
    options: ['A. (-4, 4]', 'B. [-4, 4]', 'C. (-∞, 4]', 'D. (-4, +∞)'],
    answer: 'A',
    analysis: '【铭师解析】需同时满足对称轴 a/2 ≤ 2 且端点真数 4 - 2a + 3a > 0，解得 -4 < a ≤ 4。易错点在于漏掉真数大于 0 约束。'
  },
  {
    qId: 'seed_sm_06', stage: 'senior', subjectKey: 'math', manualNodeId: 'senior_math_c8_i1',
    difficulty: '中等', questionType: '填空', defaultScore: 5,
    stem: '已知直线 l₁: ax + 2y - 1 = 0 与直线 l₂: x + (a + 1)y + 2 = 0 平行，则实数 a 的值为 ________。',
    options: [],
    answer: '1',
    analysis: '【铭师解析】由两直线平行条件 a(a + 1) - 2 = 0 解得 a = 1 或 a = -2。当 a = -2 时两直线重合舍去，故 a = 1。'
  },
  {
    qId: 'seed_sm_07', stage: 'senior', subjectKey: 'math', manualNodeId: 'senior_math_c10_i1',
    difficulty: '中等', questionType: '填空', defaultScore: 5,
    stem: '已知平面向量 a = (1, 2)，b = (m, -1)，若 (a + 2b) ⊥ a，则实数 m = ________。',
    options: [],
    answer: '-1/2',
    analysis: '【铭师解析】由 (a + 2b)·a = |a|² + 2a·b = 5 + 2(m - 2) = 2m + 1 = 0，得 m = -1/2。'
  },
  {
    qId: 'seed_sm_08', stage: 'senior', subjectKey: 'math', manualNodeId: 'senior_math_c5_i2',
    difficulty: '中等', questionType: '解答', defaultScore: 12,
    stem: '已知圆 C 经过 A(1, 3)，B(5, 1) 两点，且圆心 C 在直线 x - y + 1 = 0 上。\n（1）求圆 C 的标准方程；\n（2）若过点 P(0, 4) 的直线 l 与圆 C 相交于 M, N 两点，且 |MN| = 2√3，求直线 l 的方程。',
    options: [],
    answer: '（1）(x - 2)² + (y - 3)² = 10；（2）x = 0 或 3x + 4y - 16 = 0（需按弦心距公式核验双解）。',
    analysis: '【铭师解析】（1）AB 中垂线与 x - y + 1 = 0 联立得圆心与半径；（2）先验证斜率不存在 x = 0 是否满足弦长，再设点斜式利用垂径定理求解 k，防漏解。'
  },
  {
    qId: 'seed_sm_09', stage: 'senior', subjectKey: 'math', manualNodeId: 'senior_math_c7_i1',
    difficulty: '压轴', questionType: '选择', defaultScore: 5,
    stem: '已知椭圆 x²/a² + y²/b² = 1 (a > b > 0) 的左、右焦点分别为 F₁, F₂，过 F₁ 的直线交椭圆于 A, B 两点，若 |BF₂| + |AF₂| = 3|AB| 且 ∠ABF₂ = 90°，则椭圆的离心率为（  ）',
    options: ['A. √6/3', 'B. √3/2', 'C. √5/3', 'D. 2/3'],
    answer: 'A',
    analysis: '【铭师解析】利用椭圆定义 |AF₁|+|AF₂| = |BF₁|+|BF₂| = 2a，结合条件设 |AB| = 2t，由勾股定理在 Rt△ABF₂ 与 Rt△AF₁F₂ 中列方程可得 e = √6/3。'
  },
  {
    qId: 'seed_sm_10', stage: 'senior', subjectKey: 'math', manualNodeId: 'senior_math_c5_i1',
    difficulty: '压轴', questionType: '解答', defaultScore: 14,
    stem: '已知函数 f(x) = e^x - a(x + 1)（a ∈ R）。\n（1）讨论 f(x) 的单调区间；\n（2）当 a > 0 时，若对 ∀ x > 0，不等式 f(x) ≥ x²/2 恒成立，求实数 a 的最大值。',
    options: [],
    answer: '（1）a ≤ 0 时在 R 上单调递增；a > 0 时在 (-∞, lna) 递减，(lna, +∞) 递增；（2）a_max = 1。',
    analysis: '【铭师解析】第（2）问可采用必要性探路（令 x -> 0⁺ 观察二阶导数得 a ≤ 1）再放缩证明充分性，也可利用参变分离 + 洛必达法则求极限。'
  },
  {
    qId: 'seed_sm_11', stage: 'senior', subjectKey: 'math', manualNodeId: 'senior_math_c9_i1',
    difficulty: '中等', questionType: '解答', defaultScore: 12,
    stem: '在 △ABC 中，内角 A, B, C 的对边分别为 a, b, c，已知 √3 a cosC + c sinA = √3 b。\n（1）求角 C 的大小；\n（2）若 c = 2√3，求 △ABC 周长的最大值。',
    options: [],
    answer: '（1）C = π/3；（2）6√3。',
    analysis: '【铭师解析】（1）利用正弦定理边角互化，代入 sinB = sin(A+C) 化简得 tanC = √3；（2）余弦定理结合基本不等式 a + b ≤ 2c/√3 × √3 = 4√3。'
  },

  // ==================== 初中数学（覆盖有理数/方程/三角形/函数/圆压轴） ====================
  {
    qId: 'seed_jm_01', stage: 'junior', subjectKey: 'math', manualNodeId: 'junior_math_c1_i1',
    difficulty: '基础', questionType: '选择', defaultScore: 3,
    stem: '如果收入 120 元记作 +120 元，那么支出 85 元记作（  ）',
    options: ['A. -85 元', 'B. +85 元', 'C. -35 元', 'D. +35 元'],
    answer: 'A',
    analysis: '【铭师解析】用正负数表示具有相反意义的量，收入为正，则支出为负。'
  },
  {
    qId: 'seed_jm_02', stage: 'junior', subjectKey: 'math', manualNodeId: 'junior_math_c3_i1',
    difficulty: '基础', questionType: '选择', defaultScore: 3,
    stem: '已知 x = 2 是关于 x 的方程 3x - a = 4 的解，则 a 的值为（  ）',
    options: ['A. 2', 'B. -2', 'C. 10', 'D. -10'],
    answer: 'A',
    analysis: '【铭师解析】将 x = 2 代入原方程得 6 - a = 4，故 a = 2。'
  },
  {
    qId: 'seed_jm_03', stage: 'junior', subjectKey: 'math', manualNodeId: 'junior_math_c5_i2',
    difficulty: '中等', questionType: '填空', defaultScore: 3,
    stem: '若关于 x, y 的二元一次方程组 { x + 2y = 5k, x - 2y = k } 的解满足 2x + y = 13，则 k = ________。',
    options: [],
    answer: '13/7',
    analysis: '【铭师解析】两式相加得 2x = 6k ⇒ x = 3k；相减得 4y = 4k ⇒ y = k，代入 6k + k = 13 得 k = 13/7。'
  },
  {
    qId: 'seed_jm_04', stage: 'junior', subjectKey: 'math', manualNodeId: 'junior_math_c2_i1',
    difficulty: '中等', questionType: '解答', defaultScore: 8,
    stem: '先化简，再求值：(2x + y)² - (2x + y)(2x - y) - 2y²，其中 x = 1/2，y = -3。',
    options: [],
    answer: '化简结果为 4xy；代入 x = 1/2, y = -3，原式 = -6。',
    analysis: '【铭师解析】展开完全平方与平方差公式得 4x² + 4xy + y² - (4x² - y²) - 2y² = 4xy，消项后再代值。'
  },
  {
    qId: 'seed_jm_05', stage: 'junior', subjectKey: 'math', manualNodeId: 'junior_math_c5_i1',
    difficulty: '压轴', questionType: '解答', defaultScore: 12,
    stem: '如图，抛物线 y = -x² + 2x + 3 与 x 轴交于 A, B 两点（A 在 B 左侧），与 y 轴交于点 C，点 P 为直线 BC 上方抛物线上一动点。\n（1）求 A, B, C 三点坐标及直线 BC 解析式；\n（2）过 P 作水平与竖直线构造辅助三角形，求 △PBC 面积的最大值及此时点 P 的坐标。',
    options: [],
    answer: '（1）A(-1,0), B(3,0), C(0,3)，直线 BC: y = -x + 3；（2）P(3/2, 15/4) 时，S_△PBC 最大值为 27/8。',
    analysis: '【铭师解析】“铅垂高 × 水平宽 ÷ 2”模型：设 P(t, -t²+2t+3)，竖直高 h = (-t²+2t+3) - (-t+3) = -t²+3t，在 t = 3/2 时取得最大值 9/4。'
  },

  // ==================== 中考/高考物理 ====================
  {
    qId: 'seed_jp_01', stage: 'junior', subjectKey: 'phys', manualNodeId: 'junior_phys_c1_i1',
    difficulty: '基础', questionType: '选择', defaultScore: 3,
    stem: '下列对中学生常见物理量的估测，最接近实际的是（  ）',
    options: ['A. 物理课本的宽度约为 18 cm', 'B. 一名中学生质量约为 500 kg', 'C. 人正常步行速度约为 10 m/s', 'D. 教室内舒适室温约为 42 ℃'],
    answer: 'A',
    analysis: '【铭师解析】物理课本宽约 18cm；中学生质量约 50kg；步行速度约 1.1m/s；人体舒适室温约 23℃~26℃。'
  },
  {
    qId: 'seed_jp_02', stage: 'junior', subjectKey: 'phys', manualNodeId: 'junior_phys_c3_i1',
    difficulty: '中等', questionType: '填空', defaultScore: 4,
    stem: '甲、乙两车在同一平直公路上同时向东行驶，其 s-t 图像均是一条过原点的倾斜直线，在 t = 10 s 时甲通过路程 80 m，乙通过路程 50 m。则以甲车为参照物，乙车向 ________（选填“东”或“西”）运动，相对速度为 ________ m/s。',
    options: [],
    answer: '西；3',
    analysis: '【铭师解析】v_甲 = 8 m/s，v_乙 = 5 m/s，均向东运动，乙比甲慢 3 m/s，故相对甲向西退行。'
  },
  {
    qId: 'seed_sp_01', stage: 'senior', subjectKey: 'phys', manualNodeId: 'senior_phys_c14_i2',
    difficulty: '压轴', questionType: '解答', defaultScore: 14,
    stem: '光滑水平面上静止放置一质量为 M = 2 kg、长 L = 2.5 m 的长木板，一质量 m = 1 kg 的小物块以 v₀ = 6 m/s 的水平初速度滑上木板左端，已知物块与木板间动摩擦因数 μ = 0.4，g 取 10 m/s²。\n（1）判断物块是否会从木板右端滑落；\n（2）求整个系统因摩擦产生的热量 Q。',
    options: [],
    answer: '（1）相对位移 Δx = 3 m > 2.5 m，物块会从右端滑落；（2）Q = μmgL = 10 J。',
    analysis: '【铭师解析】先假设达到共速 v_共 = mv₀/(M+m) = 2 m/s，由能量守恒 μmgΔx = 1/2 mv₀² - 1/2 (M+m)v_共² 得所需 Δx = 3 m > L，确定滑落，摩擦生热按实际板长 L 计算。'
  },

  // ==================== 中考/高考化学 ====================
  {
    qId: 'seed_jc_01', stage: 'junior', subjectKey: 'chem', manualNodeId: 'junior_chem_c1_i1',
    difficulty: '基础', questionType: '选择', defaultScore: 3,
    stem: '下列我国古代传统工艺或日常现象中，主要涉及物理变化的是（  ）',
    options: ['A. 玉石雕刻成印章', 'B. 粮食发酵酿酒', 'C. 烧制陶瓷器具', 'D. 铁锅放置生锈'],
    answer: 'A',
    analysis: '【铭师解析】物理变化不产生新物质，雕刻仅改变形状；酿酒、烧陶、生锈均生成新物质。'
  },
  {
    qId: 'seed_sc_01', stage: 'senior', subjectKey: 'chem', manualNodeId: 'senior_chem_c1_i2',
    difficulty: '中等', questionType: '选择', defaultScore: 5,
    stem: '下列离子方程式书写正确的是（  ）',
    options: [
      'A. 向氯化铝溶液中加入过量氨水：Al³⁺ + 3NH₃·H₂O = Al(OH)₃↓ + 3NH₄⁺',
      'B. 金属钠与水反应：Na + 2H₂O = Na⁺ + 2OH⁻ + H₂↑',
      'C. 铁与稀硫酸反应：2Fe + 6H⁺ = 2Fe³⁺ + 3H₂↑',
      'D. 碳酸钙与醋酸反应：CaCO₃ + 2H⁺ = Ca²⁺ + H₂O + CO₂↑'
    ],
    answer: 'A',
    analysis: '【铭师解析】A 正确，Al(OH)₃ 不溶于弱碱氨水；B 电荷与原子不守恒；C 应生成 Fe²⁺；D 醋酸为弱酸不能拆写成 H⁺。'
  },

  // ==================== 初高中语英政史地生基础抽样题库 ====================
  {
    qId: 'seed_jcn_01', stage: 'junior', subjectKey: 'cn', manualNodeId: 'junior_cn_c1_i1',
    difficulty: '基础', questionType: '选择', defaultScore: 3,
    stem: '下列各组词语中，加点字注音和字形完全正确的一项是（  ）',
    options: ['A. 静谧(mì)  粗犷(guǎng)  截然不同', 'B. 莅临(wèi)  徘徊(huí)  美不胜收', 'C. 诀别(jué)  分歧(qí)  各得奇所', 'D. 匿笑(lì)  憔悴(cuì)  喜出望外'],
    answer: 'A',
    analysis: '【铭师解析】B“莅临”读 lì，“徘徊”读 huái；C“各得其所”；D“匿笑”读 nì。'
  },
  {
    qId: 'seed_scn_01', stage: 'senior', subjectKey: 'cn', manualNodeId: 'senior_cn_c3_i2',
    difficulty: '中等', questionType: '选择', defaultScore: 5,
    stem: '下列各句中，没有语病的一项是（  ）',
    options: [
      'A. 通过精准定位薄弱考点，学生的学习效率得到了显著提高。',
      'B. 能否坚持每日复盘错题，是高三冲刺阶段成绩稳步提升的关键条件。',
      'C. 本期规划手册涵盖了高中九大学科及各省近三年高频真题汇集而成。',
      'D. 校园读书节不仅开阔了同学们的视野，而且提高了大家的写作兴趣。'
    ],
    answer: 'A',
    analysis: '【铭师解析】B 两面对一面（能否 vs 关键）；C 句式杂糅（涵盖了…与由…汇集而成）；D“提高…兴趣”搭配不当，应为“激发兴趣”。'
  },
  {
    qId: 'seed_jen_01', stage: 'junior', subjectKey: 'en', manualNodeId: 'junior_en_c1_i1',
    difficulty: '基础', questionType: '选择', defaultScore: 2,
    stem: '— How many ________ are there in the basket?\n— About five. Let us wash them before dinner.',
    options: ['A. tomatoes', 'B. tomato', 'C. milk', 'D. bread'],
    answer: 'A',
    analysis: '【铭师解析】How many 修饰可数名词复数，以 o 结尾有生命/常见果蔬 tomato 的复数为 tomatoes。'
  },
  {
    qId: 'seed_sbio_01', stage: 'senior', subjectKey: 'bio', manualNodeId: 'senior_bio_c2_i2',
    difficulty: '中等', questionType: '选择', defaultScore: 5,
    stem: '将某绿色植物置于密闭透明玻璃罩内，在适宜温度下先黑暗处理 1 h，测得罩内 CO₂ 增加了 22 mg；随后给予一定光照 1 h，测得罩内 CO₂ 减少了 44 mg。假设呼吸速率不变，该植物光照 1 h 内通过光合作用实际固定的 CO₂ 总量为（  ）',
    options: ['A. 66 mg', 'B. 44 mg', 'C. 22 mg', 'D. 33 mg'],
    answer: 'A',
    analysis: '【铭师解析】总光合速率 = 净光合速率(44) + 呼吸速率(22) = 66 mg/h。'
  },
  {
    qId: 'seed_spol_01', stage: 'senior', subjectKey: 'politics', manualNodeId: 'senior_politics_c3_i1',
    difficulty: '中等', questionType: '选择', defaultScore: 4,
    stem: '推进全过程人民民主是中国式现代化的本质要求。下列对“全过程人民民主”的理解最准确的是（  ）',
    options: [
      'A. 实现了过程民主与成果民主、程序民主与实质民主的有机统一',
      'B. 表明我国公民均能直接参与国家所有立法决策的表决',
      'C. 意味着基层群众自治组织可以直接行使国家行政权力',
      'D. 是只存在于选举投票环节的阶段性政治制度安排'
    ],
    answer: 'A',
    analysis: '【铭师解析】我国实行代议制间接民主（人大代表），基层自治组织非国家行政机关，全过程涵盖民主选举、协商、决策、管理、监督全链条。'
  },
  {
    qId: 'seed_shist_01', stage: 'senior', subjectKey: 'hist', manualNodeId: 'senior_hist_c2_i1',
    difficulty: '中等', questionType: '选择', defaultScore: 4,
    stem: '1895年《马关条约》签订后，帝国主义对华经济侵略方式发生的最显著转变是（  ）',
    options: [
      'A. 从以商品输出为主转向以资本输出为主',
      'B. 中国开始丧失完全独立的关税自主权',
      'C. 列强彻底停止对华工业品倾销与原料掠夺',
      'D. 外国人首次获得在华通商口岸居住权'
    ],
    answer: 'A',
    analysis: '【铭师解析】《马关条约》允许日本在通商口岸开设工厂，标志着列强侵略进入资本输出为主的新阶段；B、D 均始于《南京条约》及附约。'
  },
  {
    qId: 'seed_sgeo_01', stage: 'senior', subjectKey: 'geo', manualNodeId: 'senior_geo_c2_i2',
    difficulty: '中等', questionType: '选择', defaultScore: 4,
    stem: '大气对流层中“高处不胜寒”与地膜覆盖保温效应分别主要对应的热力作用原理是（  ）',
    options: [
      'A. 对流层直接主要热源是地面辐射；地膜阻隔了地面热量散失与对流交换',
      'B. 海拔越高太阳辐射越弱；地膜吸收全部太阳短波辐射',
      'C. 对流层大气逆辐射随高度升高而剧增；地膜增强地面反射率',
      'D. 太阳辐射在地面以上全被臭氧吸收；地膜阻挡太阳辐射进入'
    ],
    answer: 'A',
    analysis: '【铭师解析】近地面大气的直接主要热源是地面长波辐射；地膜覆盖减少地面与外界空气的对流换热并截留水汽热量，从而保温保墒。'
  }
];

function getSubjectLabel(stage, subjectKey) {
  return FULL_MANUAL_CATALOG?.[stage]?.[subjectKey]?.label
    || SUBJECT_ORDER?.[stage]?.find(s => s.key === subjectKey)?.label
    || `${stage === 'junior' ? '初中' : '高中'}${subjectKey}`;
}

function getAllNodesForSubject(stage, subjectKey) {
  const subj = FULL_MANUAL_CATALOG?.[stage]?.[subjectKey];
  if (!subj) return [];
  return subj.flatNodes || [];
}

function normalizeD1Question(row) {
  let opts = [];
  try {
    opts = JSON.parse(row.options_json || '[]');
    if (!Array.isArray(opts)) opts = [];
  } catch (_) { opts = []; }
  const node = row.manual_node_id ? findManualNodeById(row.manual_node_id) : null;
  return {
    qId: row.q_id,
    stage: row.stage,
    subjectKey: row.subject_key,
    manualNodeId: row.manual_node_id || '',
    manualNodeTitle: node?.title || '综合核心考点',
    chapterTitle: node?.chapterTitle || '',
    difficulty: ['基础', '中等', '压轴'].includes(row.difficulty) ? row.difficulty : '中等',
    questionType: row.question_type || '解答',
    defaultScore: row.question_type === '选择' || row.question_type === '填空' ? 5 : 12,
    stem: row.stem_text,
    options: opts,
    answer: row.answer_text,
    analysis: row.analysis_text,
    sourceType: 'd1_bank',
    needsBankReplenish: false
  };
}

function normalizeSeedQuestion(item) {
  const node = item.manualNodeId ? findManualNodeById(item.manualNodeId) : null;
  return {
    ...item,
    manualNodeTitle: node?.title || item.manualNodeId || '综合题型',
    chapterTitle: node?.chapterTitle || '',
    sourceType: 'builtin_bank',
    needsBankReplenish: false
  };
}

function synthesizeTopicQuestion({ stage, subjectKey, node, difficulty, qType, indexSeed = 1 }) {
  const subjLabel = getSubjectLabel(stage, subjectKey);
  const topicTitle = node?.title || `${subjLabel}核心综合专题`;
  const chapterTitle = node?.chapterTitle || `${subjLabel}目录专题`;
  const nodeId = node?.nodeId || `${stage}_${subjectKey}_c1_i1`;
  const diffLabel = ['基础', '中等', '压轴'].includes(difficulty) ? difficulty : '中等';
  const uid = `gen_${stage}_${subjectKey}_${diffLabel}_${Date.now().toString(36)}_${indexSeed}`;

  const isChoice = qType === '选择';
  const isBlank = qType === '填空';
  let stem = '';
  let options = [];
  let answer = '';

  if (isChoice) {
    stem = `【储备补充模版题·${diffLabel}】关于《${chapterTitle}》中的“${topicTitle}”，下列说法与解题逻辑判断最严谨的一项是（  ）\n（注：当前题库该细分题型真题储备不足，系统已按手册考点自动补位，待管理员补充真题原题。）`;
    options = [
      `A. 先界定“${topicTitle}”的适用条件与隐含边界，再按通法列式求解`,
      'B. 忽略前提约束直接套用特例结论',
      'C. 仅依据局部图像特征跳跃写出最终数值',
      'D. 以上推导均可不检验定义域或边界取值'
    ];
    answer = 'A';
  } else if (isBlank) {
    stem = `【储备补充模版题·${diffLabel}】针对《${chapterTitle} · ${topicTitle}》，在完成规范审题定型并排除常见边界陷阱后，核心转化关系式应标注为 ________。（题库待补充原题，请核对手册对应讲义训练）`;
    answer = `紧扣《${topicTitle}》核心定理与前提约束作答`;
  } else {
    stem = `【储备补充模版题·${diffLabel}】请围绕《${chapterTitle}》中的核心考点“${topicTitle}”，完成以下${diffLabel === '压轴' ? '综合探究与多步严谨推演' : '标准分步解答'}任务：\n（1）写出本题涉及的基本概念/核心关系及必要前提验证条件；\n（2）结合设问完成完整求解与${diffLabel === '压轴' ? '分类讨论边界核验' : '规范步骤作答'}。（注：当前题库该节点原题储备不足，已按手册自动补位）`;
    answer = `第（1）问需先明晰【${topicTitle}】限制条件；第（2）问按标准步骤推演并核验关键临界情况。`;
  }

  return {
    qId: uid,
    stage,
    subjectKey,
    manualNodeId: nodeId,
    manualNodeTitle: topicTitle,
    chapterTitle,
    difficulty: diffLabel,
    questionType: qType,
    defaultScore: isChoice || isBlank ? (stage === 'junior' ? 3 : 5) : (diffLabel === '压轴' ? 14 : 10),
    stem,
    options,
    answer,
    analysis: `【系统补位标签】本题归属《${subjLabel}》手册节点：${chapterTitle} → ${topicTitle}（难度：${diffLabel}）。因当前题库中该考点/难度档原题数量不足，已触发“储备预警并自动结构补位”。`,
    sourceType: 'template_supplement',
    needsBankReplenish: true
  };
}

function getCombinedPool(stage, subjectKey, d1Questions = []) {
  const fromD1 = (d1Questions || [])
    .map(r => (r.stem ? r : normalizeD1Question(r)))
    .filter(q => q.stage === stage && q.subjectKey === subjectKey);
  const fromSeed = SEED_QUESTION_BANK
    .filter(q => q.stage === stage && q.subjectKey === subjectKey)
    .map(normalizeSeedQuestion);
  return [...fromD1, ...fromSeed];
}

// ==================== 1. 手动精准组卷引擎 ====================
export function assembleManualExam({
  stage = 'senior',
  gradeLabel = '高二',
  subjectKey = 'math',
  selectedNodeIds = [],
  counts = { basic: 4, medium: 4, hard: 2 },
  examTitle = '',
  durationMinutes = 90,
  mode = 'manual',
  promptText = '',
  d1Questions = []
}) {
  const safeStage = stage === 'junior' ? 'junior' : 'senior';
  const safeSubj = FULL_MANUAL_CATALOG?.[safeStage]?.[subjectKey] ? subjectKey : 'math';
  const subjLabel = getSubjectLabel(safeStage, safeSubj);
  const allNodes = getAllNodesForSubject(safeStage, safeSubj);

  const selectedSet = new Set(Array.isArray(selectedNodeIds) ? selectedNodeIds.filter(Boolean) : []);
  const targetNodes = selectedSet.size > 0
    ? allNodes.filter(n => selectedSet.has(n.nodeId))
    : allNodes;
  const fallbackNodes = targetNodes.length > 0 ? targetNodes : allNodes;

  const reqCounts = {
    '基础': Math.max(0, Math.min(20, Number(counts?.basic ?? 4))),
    '中等': Math.max(0, Math.min(20, Number(counts?.medium ?? 4))),
    '压轴': Math.max(0, Math.min(12, Number(counts?.hard ?? 2)))
  };

  const pool = getCombinedPool(safeStage, safeSubj, d1Questions);
  const usedIds = new Set();
  const picked = [];
  const insufficientWarnings = [];

  const qTypeCycleForDiff = {
    '基础': ['选择', '选择', '填空', '解答'],
    '中等': ['选择', '填空', '解答', '解答'],
    '压轴': ['解答', '选择', '解答']
  };

  let synthSeq = 0;
  for (const diff of ['基础', '中等', '压轴']) {
    const need = reqCounts[diff];
    if (need <= 0) continue;

    // 第一优先：命中已勾选题型节点且难度匹配的题库原题
    const exactMatches = pool.filter(q =>
      !usedIds.has(q.qId)
      && q.difficulty === diff
      && (selectedSet.size === 0 || selectedSet.has(q.manualNodeId))
    );
    // 第二优先：若勾选了特定节点但题库未精确覆盖，允许同科同难度真题（仅当未严格选节点或补不足时先记录缺题预警）
    let taken = 0;
    for (const q of exactMatches) {
      if (taken >= need) break;
      usedIds.add(q.qId);
      picked.push({ ...q });
      taken += 1;
    }

    if (taken < need) {
      const shortfall = need - taken;
      const scopeHint = selectedSet.size > 0
        ? `所选 ${selectedSet.size} 个手册节点（${fallbackNodes.slice(0, 2).map(n => n.title).join('、')}等）`
        : subjLabel;
      insufficientWarnings.push({
        difficulty: diff,
        requested: need,
        matchedInBank: taken,
        shortfall,
        message: `【题库储备提醒】${subjLabel} · ${scopeHint}【${diff}】档需抽 ${need} 题，当前题库仅匹配 ${taken} 题，尚缺 ${shortfall} 题（已先按手册考点结构生成补位模版题并建议管理员补充真题入库）。`
      });

      for (let i = 0; i < shortfall; i++) {
        synthSeq += 1;
        const targetNode = fallbackNodes[(taken + i) % fallbackNodes.length];
        const cycle = qTypeCycleForDiff[diff] || ['选择', '解答'];
        const qType = cycle[i % cycle.length];
        const synth = synthesizeTopicQuestion({
          stage: safeStage,
          subjectKey: safeSubj,
          node: targetNode,
          difficulty: diff,
          qType,
          indexSeed: synthSeq
        });
        usedIds.add(synth.qId);
        picked.push(synth);
      }
    }
  }

  // 按标准考卷大题结构排序：选择 -> 填空 -> 解答
  const typeRank = { '选择': 1, '填空': 2, '解答': 3, '计算': 3, '证明': 3, '实验': 3, '综合': 3 };
  picked.sort((a, b) => (typeRank[a.questionType] || 3) - (typeRank[b.questionType] || 3));

  const numbered = picked.map((q, idx) => ({
    ...q,
    no: idx + 1,
    score: Number(q.defaultScore || (q.questionType === '选择' || q.questionType === '填空' ? 5 : 12))
  }));

  const sections = [];
  const typeDefs = [
    { key: '选择', title: '一、选择题' },
    { key: '填空', title: '二、填空题' },
    { key: '解答', title: '三、解答与综合应用题' }
  ];
  for (const sec of typeDefs) {
    const items = numbered.filter(q => sec.key === '解答' ? (q.questionType !== '选择' && q.questionType !== '填空') : q.questionType === sec.key);
    if (items.length > 0) {
      sections.push({
        title: sec.title,
        questionNos: items.map(x => x.no),
        subtotalScore: items.reduce((acc, cur) => acc + cur.score, 0)
      });
    }
  }

  const totalScore = numbered.reduce((acc, cur) => acc + cur.score, 0);
  const finalTitle = (examTitle || '').trim()
    || `许老师工作室 · ${gradeLabel || ''}${subjLabel}过关检测卷`;

  return {
    exam: {
      examId: `exam_${safeStage}_${safeSubj}_${Date.now().toString(36)}`,
      mode,
      promptText,
      title: finalTitle,
      stage: safeStage,
      subjectKey: safeSubj,
      subjectLabel: subjLabel,
      gradeLabel: gradeLabel || (safeStage === 'junior' ? '初中' : '高中'),
      totalScore,
      durationMinutes: Math.max(30, Math.min(180, Number(durationMinutes) || 90)),
      sections,
      questions: numbered
    },
    insufficientWarnings
  };
}

// ==================== 2. 单题“换一题”精准替补引擎 ====================
export function swapExamQuestion({
  stage = 'senior',
  subjectKey = 'math',
  currentQuestion,
  excludeQuestionIds = [],
  d1Questions = []
}) {
  const safeStage = stage === 'junior' ? 'junior' : 'senior';
  const safeSubj = FULL_MANUAL_CATALOG?.[safeStage]?.[subjectKey] ? subjectKey : 'math';
  const excludeSet = new Set(Array.isArray(excludeQuestionIds) ? excludeQuestionIds : []);
  if (currentQuestion?.qId) excludeSet.add(currentQuestion.qId);

  const pool = getCombinedPool(safeStage, safeSubj, d1Questions);
  const targetDiff = currentQuestion?.difficulty || '中等';
  const targetNodeId = currentQuestion?.manualNodeId || '';
  const targetType = currentQuestion?.questionType || '选择';

  // 优先找同节点+同难度 -> 其次同难度+同题型 -> 其次同难度
  let replacement = pool.find(q => !excludeSet.has(q.qId) && q.manualNodeId === targetNodeId && q.difficulty === targetDiff)
    || pool.find(q => !excludeSet.has(q.qId) && q.difficulty === targetDiff && q.questionType === targetType)
    || pool.find(q => !excludeSet.has(q.qId) && q.difficulty === targetDiff);

  if (!replacement) {
    const node = findManualNodeById(targetNodeId) || getAllNodesForSubject(safeStage, safeSubj)[0];
    replacement = synthesizeTopicQuestion({
      stage: safeStage,
      subjectKey: safeSubj,
      node,
      difficulty: targetDiff,
      qType: targetType,
      indexSeed: Math.floor(Math.random() * 900) + 100
    });
    replacement.stem = replacement.stem.replace('【储备补充模版题', '【变式替补题');
  }

  return {
    ...replacement,
    no: currentQuestion?.no || 1,
    score: Number(currentQuestion?.score || replacement.defaultScore || 5)
  };
}

// ==================== 3. AI 一句话自然语言智能组卷引擎 ====================
function deterministicParseNlPrompt(promptText, fallbackStage = 'senior', fallbackSubjectKey = 'math') {
  const text = String(promptText || '').trim();
  let stage = fallbackStage === 'junior' ? 'junior' : 'senior';
  if (/高一|高二|高三|高中|高考|选必|必修/.test(text)) stage = 'senior';
  else if (/初一|初二|初三|七年级|八年级|九年级|初中|中考/.test(text)) stage = 'junior';

  let gradeLabel = stage === 'junior' ? '初三' : '高二';
  const gradeMatches = ['高一', '高二', '高三', '初一', '初二', '初三', '七年级', '八年级', '九年级'];
  for (const g of gradeMatches) {
    if (text.includes(g)) {
      gradeLabel = g;
      break;
    }
  }

  let subjectKey = fallbackSubjectKey || 'math';
  const subjMap = [
    ['数学', 'math'], ['物理', 'phys'], ['化学', 'chem'],
    ['语文', 'cn'], ['英语', 'en'], ['道法', 'politics'],
    ['政治', 'politics'], ['生物', 'bio'], ['历史', 'hist'], ['地理', 'geo']
  ];
  for (const [kw, key] of subjMap) {
    if (text.includes(kw)) {
      subjectKey = key;
      break;
    }
  }
  if (!FULL_MANUAL_CATALOG?.[stage]?.[subjectKey]) {
    subjectKey = 'math';
  }

  let difficultyProfile = '标准中等';
  let counts = { basic: 4, medium: 4, hard: 2 };
  if (/中等偏难|中上|偏难|培优|提优|拔高/.test(text)) {
    difficultyProfile = '中等偏难（提优）';
    counts = { basic: 3, medium: 5, hard: 3 };
  } else if (/压轴|冲刺|模考|难题/.test(text)) {
    difficultyProfile = '高难度压轴冲刺';
    counts = { basic: 2, medium: 4, hard: 4 };
  } else if (/基础|巩固|入门|查漏/.test(text)) {
    difficultyProfile = '基础夯实';
    counts = { basic: 6, medium: 3, hard: 1 };
  }

  const durationMinutes = /全真|模考|高考|中考|综合/.test(text) ? 120 : 90;

  // 提取常见学期/学段高频章节关键词以自动锚定《过关手册》目录
  const focusKeywords = [];
  if (subjectKey === 'math' && stage === 'senior') {
    if (/高二.*(第一学期|上).*期中/.test(text)) {
      focusKeywords.push('直线', '圆', '椭圆', '双曲线', '向量', '空间');
    } else if (/高一.*期中/.test(text)) {
      focusKeywords.push('集合', '逻辑', '不等式', '函数概念', '单调性', '奇偶性');
    } else if (/导数|极限/.test(text)) {
      focusKeywords.push('导数', '极值', '恒成立');
    }
  }
  if (focusKeywords.length === 0) {
    const kws = ['函数', '导数', '不等式', '三角', '圆', '椭圆', '方程', '向量', '力学', '电磁', '氧化', '平衡', '遗传', '近代'];
    kws.forEach(k => { if (text.includes(k)) focusKeywords.push(k); });
  }

  const subjLabel = getSubjectLabel(stage, subjectKey);
  const examTitle = text.length > 4 && text.length <= 36
    ? `许老师工作室 · ${text}`
    : `许老师工作室 · ${gradeLabel}${subjLabel}${/期中/.test(text) ? '期中' : (/期末/.test(text) ? '期末' : '专项')}诊断试卷`;

  return {
    stage,
    gradeLabel,
    subjectKey,
    examTitle,
    durationMinutes,
    difficultyProfile,
    focusKeywords,
    counts
  };
}

export async function assembleAiExam({
  promptText = '',
  fallbackStage = 'senior',
  fallbackSubjectKey = 'math',
  aiBinding = null,
  d1Questions = []
}) {
  const bp = deterministicParseNlPrompt(promptText, fallbackStage, fallbackSubjectKey);

  // 若绑定 Workers AI 且提示词有效，温和请求 AI 精修章节关键词与试卷蓝图（10秒超时兜底，永不阻塞）
  if (aiBinding && promptText.trim()) {
    try {
      const subjNodesPreview = getAllNodesForSubject(bp.stage, bp.subjectKey)
        .slice(0, 40)
        .map(n => n.title)
        .join('；');
      const aiSys = '你是教研组智能组卷规划助手。根据教师输入的一句话组卷需求，返回严格JSON：{"examTitle":"试卷正式名称","durationMinutes":90或120,"basicCount":数字,"mediumCount":数字,"hardCount":数字,"focusKeywords":["关键词1","关键词2"]}。数量范围在1到8之间，只输出JSON。';
      const aiUser = `教师需求：${promptText}\n初步识别学科：${getSubjectLabel(bp.stage, bp.subjectKey)}（${bp.gradeLabel}）\n可选《过关手册》部分章节：${subjNodesPreview}`;
      let timer;
      const aiRes = await Promise.race([
        aiBinding.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            { role: 'system', content: aiSys },
            { role: 'user', content: aiUser }
          ],
          max_tokens: 320,
          temperature: 0.2
        }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('ai_timeout')), 10000); })
      ]).finally(() => clearTimeout(timer));

      const rawTxt = String(aiRes?.response || '');
      const m = rawTxt.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (parsed.examTitle && typeof parsed.examTitle === 'string') {
          bp.examTitle = `许老师工作室 · ${parsed.examTitle.replace(/^许老师工作室\s*[·・]\s*/, '').slice(0, 40)}`;
        }
        if (Number(parsed.basicCount) > 0 && Number(parsed.basicCount) <= 10) bp.counts.basic = Number(parsed.basicCount);
        if (Number(parsed.mediumCount) > 0 && Number(parsed.mediumCount) <= 10) bp.counts.medium = Number(parsed.mediumCount);
        if (Number(parsed.hardCount) > 0 && Number(parsed.hardCount) <= 8) bp.counts.hard = Number(parsed.hardCount);
        if (Array.isArray(parsed.focusKeywords) && parsed.focusKeywords.length > 0) {
          bp.focusKeywords = Array.from(new Set([...bp.focusKeywords, ...parsed.focusKeywords.map(String)])).slice(0, 8);
        }
      }
    } catch (_) {
      /* Workers AI 超时或格式波动时自动回退至确定性规则蓝图 */
    }
  }

  // 根据 focusKeywords 自动匹配《过关手册》具体题型节点
  const allNodes = getAllNodesForSubject(bp.stage, bp.subjectKey);
  const matchedNodeIds = [];
  if (bp.focusKeywords.length > 0) {
    for (const node of allNodes) {
      const haystack = `${node.chapterTitle} ${node.title}`;
      if (bp.focusKeywords.some(kw => kw && haystack.includes(kw))) {
        matchedNodeIds.push(node.nodeId);
      }
    }
  }

  const assembled = assembleManualExam({
    stage: bp.stage,
    gradeLabel: bp.gradeLabel,
    subjectKey: bp.subjectKey,
    selectedNodeIds: matchedNodeIds,
    counts: bp.counts,
    examTitle: bp.examTitle,
    durationMinutes: bp.durationMinutes,
    mode: 'ai_nl',
    promptText,
    d1Questions
  });

  return {
    ...assembled,
    blueprint: {
      stage: bp.stage,
      gradeLabel: bp.gradeLabel,
      subjectKey: bp.subjectKey,
      subjectLabel: getSubjectLabel(bp.stage, bp.subjectKey),
      difficultyProfile: bp.difficultyProfile,
      focusKeywords: bp.focusKeywords,
      matchedNodeCount: matchedNodeIds.length,
      counts: bp.counts
    }
  };
}
