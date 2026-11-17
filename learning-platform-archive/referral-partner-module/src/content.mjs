// Original illustrative material. Automated checks do NOT constitute human review.
export const topics = [
  {
    id: 'math-equation', subject: 'math', title: '一元一次方程：等式的性质',
    explanation: '等式两边同时加或减同一个数，等式仍成立；两边同时乘或除以同一个非零数，等式仍成立。先消去常数项，再化系数为 1，最后代回原式检验。',
    memory_card: '同加同减，等式不变；同乘同除，除数非零。解后代回检验。',
    questions: [
      ['diagnostic', '解方程 2x + 3 = 11，x = ?', ['4','7','5','8'], 0, '两边减 3 得 2x = 8，再除以 2 得 x = 4；代回 2×4+3=11。', '2 * 4 + 3 === 11'],
      ['practice', '解方程 3x − 4 = 8，x = ?', ['2','3','4','6'], 2, '两边加 4 得 3x = 12，再除以 3 得 x = 4。', '3 * 4 - 4 === 8'],
      ['retest', '解方程 5x + 2 = 17，x = ?', ['3','5','4','2'], 0, '两边减 2 得 5x = 15，再除以 5 得 x = 3。', '5 * 3 + 2 === 17']
    ]
  },
  {
    id: 'math-fraction', subject: 'math', title: '有理数：分数加减',
    explanation: '异分母分数先通分，再把分子相加或相减，分母不变；结果约分。注意减号和括号。例：1/2 + 1/6 = 3/6 + 1/6 = 2/3。',
    memory_card: '先通分，再算分子，最后约分。不能直接把分母相加。',
    questions: [
      ['diagnostic', '计算 1/3 + 1/6。', ['1/9','1/2','2/9','2/3'], 1, '1/3=2/6，所以 2/6+1/6=3/6=1/2。', 'exact rational: 1/3 + 1/6 = 1/2'],
      ['practice', '计算 3/4 − 1/2。', ['1/2','1/4','2/2','1/8'], 1, '1/2=2/4，所以 3/4−2/4=1/4。', 'exact rational: 3/4 - 1/2 = 1/4'],
      ['retest', '计算 2/5 + 1/10。', ['3/15','3/10','1/2','2/15'], 2, '2/5=4/10，所以 4/10+1/10=5/10=1/2。', 'exact rational: 2/5 + 1/10 = 1/2']
    ]
  },
  {
    id: 'english-be', subject: 'english', title: '一般现在时：be 动词',
    explanation: '在一般现在时中，I 搭配 am；单数 he、she、it 搭配 is；you、we、they 搭配 are。先识别主语，再选择 be 的形式。',
    memory_card: 'I am；he/she/it is；you/we/they are。',
    questions: [
      ['diagnostic', '用 be 动词的一般现在时填空：She ___ a student.', ['am','are','is','be'], 2, 'She 是第三人称单数，be 的一般现在时形式为 is。', 'explicit present tense; subject she -> is'],
      ['practice', '用 be 动词的一般现在时填空：They ___ in the classroom.', ['is','am','be','are'], 3, 'They 是复数主语，搭配 are。', 'explicit present tense; subject they -> are'],
      ['retest', '用 be 动词的一般现在时填空：I ___ ready.', ['are','is','am','be'], 2, '主语 I 搭配 am。', 'explicit present tense; subject I -> am']
    ]
  },
  {
    id: 'english-present', subject: 'english', title: '一般现在时：第三人称单数',
    explanation: '表达习惯时，一般现在时的肯定句中，第三人称单数主语后的实义动词通常加 -s；以辅音字母加 y 结尾时，变 y 为 i 再加 -es。',
    memory_card: 'He/She/It + 动词单三形式；play → plays，study → studies。',
    questions: [
      ['diagnostic', '选择一般现在时的正确形式：He ___ football every Sunday.', ['play','plays','playing','to play'], 1, 'He 是第三人称单数；play 的单三形式是 plays。', 'explicit present tense; he + play -> plays'],
      ['practice', '选择一般现在时的正确形式：She ___ English every day.', ['study','studying','studies','to study'], 2, 'study 以辅音字母加 y 结尾，变 y 为 i 再加 es，得到 studies。', 'explicit present tense; she + study -> studies'],
      ['retest', '选择一般现在时的正确形式：Tom ___ books after school every day.', ['reading','read','to read','reads'], 3, 'Tom 指一个人，read 的单三形式为 reads。', 'explicit present tense; Tom + read -> reads']
    ]
  }
];

export async function seedContent(db) {
  const statements = [];
  for (const t of topics) {
    statements.push(db.prepare('INSERT OR IGNORE INTO knowledge (id,subject,title,explanation,memory_card,version,source) VALUES (?,?,?,?,?,1,?)')
      .bind(t.id,t.subject,t.title,t.explanation,t.memory_card,'原创微型示例 / 2026-11-13 / 非教材题库；待本机构教师人工审核'));
    for (const [phase,prompt,options,correct,rationale,verification] of t.questions) {
      statements.push(db.prepare('INSERT OR IGNORE INTO questions VALUES (?,?,?,?,?,?,?,?)')
        .bind(`${t.id}-${phase}`,t.id,phase,prompt,JSON.stringify(options),correct,rationale,verification));
    }
  }
  await db.batch(statements);
}
