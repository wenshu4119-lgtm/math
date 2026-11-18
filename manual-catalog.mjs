// 许老师工作室 / 铭师学习规划管理平台 (mrxu.uk)
// 考点过关手册核心引擎：16学科合并导出、全自动红黄绿灯算法、DeepTutor【专属消灯任务包】与后端AI结构提示词

import { JUNIOR_CATALOG_RAW } from './catalog-junior.mjs';
import { SENIOR_MATH_LANG_RAW } from './catalog-senior-math-lang.mjs';
import { SENIOR_SCI_HUM_RAW } from './catalog-senior-sci-hum.mjs';

export const DEFAULT_TRAFFIC_THRESHOLDS = Object.freeze({
  redErrorRate: 0.40,       // >= 40% 亮红灯
  yellowErrorRate: 0.15,    // 15% ~ 39% 亮黄灯
  redConsecutiveWrong: 2    // 连续错误 >= 2 题亮红灯
});

export const SUBJECT_ORDER = {
  junior: [
    { key: 'cn', label: '初中语文', short: '语文' },
    { key: 'math', label: '初中数学', short: '数学' },
    { key: 'en', label: '初中英语', short: '英语' },
    { key: 'phys', label: '中考物理', short: '物理' },
    { key: 'chem', label: '中考化学', short: '化学' },
    { key: 'politics', label: '中考道法', short: '道法' },
    { key: 'hist', label: '中考历史', short: '历史' }
  ],
  senior: [
    { key: 'cn', label: '高考语文', short: '语文' },
    { key: 'math', label: '高考数学', short: '数学' },
    { key: 'en', label: '高考英语', short: '英语' },
    { key: 'phys', label: '高考物理', short: '物理' },
    { key: 'chem', label: '高考化学', short: '化学' },
    { key: 'politics', label: '高考政治', short: '政治' },
    { key: 'bio', label: '高考生物', short: '生物' },
    { key: 'hist', label: '高考历史', short: '历史' },
    { key: 'geo', label: '高考地理', short: '地理' }
  ]
};

function parseItemMeta(rawTitle) {
  const title = String(rawTitle || '').trim();
  let difficultyTag = '基础';
  if (/【培优】|压轴|拓展/.test(title)) difficultyTag = '培优';
  else if (/【扩展】|创新/.test(title)) difficultyTag = '扩展';
  else if (/中档|中等/.test(title)) difficultyTag = '中等';

  const mSmall = title.match(/（共(\d+)小题）/);
  let defaultPlannedCount = 5;
  if (mSmall) {
    defaultPlannedCount = Math.max(2, Math.min(30, Number(mSmall[1])));
  } else {
    const mType = title.match(/\((\d+)题型\)/);
    if (mType) defaultPlannedCount = Math.max(4, Math.min(20, Number(mType[1])));
  }

  return { title, difficultyTag, defaultPlannedCount };
}

function inflateSubject(stage, subjectKey, rawSubject) {
  const chapters = [];
  const flatNodes = [];
  let sortOrder = 0;

  (rawSubject.chapters || []).forEach((ch, cIdx) => {
    const chId = `${stage}_${subjectKey}_c${cIdx + 1}`;
    const items = (ch.items || []).map((itemTitle, iIdx) => {
      sortOrder += 1;
      const meta = parseItemMeta(itemTitle);
      const nodeId = `${stage}_${subjectKey}_c${cIdx + 1}_i${iIdx + 1}`;
      const leaf = {
        nodeId,
        stage,
        subjectKey,
        subjectLabel: rawSubject.label,
        chapterId: chId,
        chapterGroup: ch.group || '',
        chapterTitle: ch.title,
        sortOrder,
        title: meta.title,
        difficultyTag: meta.difficultyTag,
        defaultPlannedCount: meta.defaultPlannedCount
      };
      flatNodes.push(leaf);
      return leaf;
    });

    chapters.push({
      chapterId: chId,
      group: ch.group || '',
      title: ch.title,
      items
    });
  });

  return {
    stage,
    subjectKey,
    label: rawSubject.label,
    chapters,
    totalNodes: flatNodes.length,
    flatNodes
  };
}

function buildCatalog() {
  const junior = {};
  for (const [k, raw] of Object.entries(JUNIOR_CATALOG_RAW)) {
    junior[k] = inflateSubject('junior', k, raw);
  }

  const seniorRawMerged = { ...SENIOR_MATH_LANG_RAW, ...SENIOR_SCI_HUM_RAW };
  const senior = {};
  for (const [k, raw] of Object.entries(seniorRawMerged)) {
    senior[k] = inflateSubject('senior', k, raw);
  }

  return { junior, senior };
}

export const FULL_MANUAL_CATALOG = buildCatalog();

export function getPublicCatalogPayload() {
  // 去掉冗余 flatNodes 减小网络传输体积，前端直接按 chapters 渲染
  const out = { junior: {}, senior: {} };
  for (const stage of ['junior', 'senior']) {
    for (const [k, subj] of Object.entries(FULL_MANUAL_CATALOG[stage])) {
      out[stage][k] = {
        stage: subj.stage,
        subjectKey: subj.subjectKey,
        label: subj.label,
        totalNodes: subj.totalNodes,
        chapters: subj.chapters
      };
    }
  }
  return out;
}

export function findManualNodeById(nodeId) {
  const m = String(nodeId || '').match(/^(junior|senior)_([a-z]+)_/);
  if (!m) return null;
  const [, stage, subjKey] = m;
  const subj = FULL_MANUAL_CATALOG[stage]?.[subjKey];
  if (!subj) return null;
  return subj.flatNodes.find(n => n.nodeId === nodeId) || null;
}

// ==================== 全自动红黄绿灯亮灯核心算法 ====================
export function computeTrafficLight(progress = {}, thresholds = DEFAULT_TRAFFIC_THRESHOLDS) {
  const th = {
    redErrorRate: Number(thresholds?.redErrorRate ?? DEFAULT_TRAFFIC_THRESHOLDS.redErrorRate),
    yellowErrorRate: Number(thresholds?.yellowErrorRate ?? DEFAULT_TRAFFIC_THRESHOLDS.yellowErrorRate),
    redConsecutiveWrong: Number(thresholds?.redConsecutiveWrong ?? DEFAULT_TRAFFIC_THRESHOLDS.redConsecutiveWrong)
  };

  const planned = Math.max(1, Number(progress.planned_count ?? progress.plannedCount ?? 5));
  const completed = Math.max(0, Number(progress.completed_count ?? progress.completedCount ?? 0));
  const wrong = Math.max(0, Math.min(completed, Number(progress.wrong_count ?? progress.wrongCount ?? 0)));
  const explained = Math.max(0, Number(progress.explained_count ?? progress.explainedCount ?? 0));
  const consecutiveWrong = Math.max(0, Number(progress.consecutive_wrong ?? progress.consecutiveWrong ?? 0));

  if (completed === 0) {
    return {
      planned_count: planned,
      completed_count: 0,
      wrong_count: 0,
      explained_count: explained,
      consecutive_wrong: 0,
      error_rate: 0,
      errorRatePct: 0,
      light_status: explained > 0 ? 'yellow' : 'unstarted',
      lightLabel: explained > 0 ? '待复测(黄灯)' : '待排查',
      is_passed: false,
      triggerReason: explained > 0 ? '已完成讲解但尚未完成复测练习' : '尚未录入练习或测漏数据'
    };
  }

  const errorRate = Number((wrong / completed).toFixed(4));
  const errorRatePct = Math.round(errorRate * 100);

  if (errorRate >= th.redErrorRate || consecutiveWrong >= th.redConsecutiveWrong) {
    const reasons = [];
    if (errorRate >= th.redErrorRate) {
      reasons.push(`错误率 ${errorRatePct}%（≥ ${Math.round(th.redErrorRate * 100)}%）`);
    }
    if (consecutiveWrong >= th.redConsecutiveWrong) {
      reasons.push(`连续错题 ${consecutiveWrong} 题（≥ ${th.redConsecutiveWrong} 题）`);
    }
    return {
      planned_count: planned,
      completed_count: completed,
      wrong_count: wrong,
      explained_count: explained,
      consecutive_wrong: consecutiveWrong,
      error_rate: errorRate,
      errorRatePct,
      light_status: 'red',
      lightLabel: '红灯 · 未过关',
      is_passed: false,
      triggerReason: reasons.join(' 且 ')
    };
  }

  if (errorRate >= th.yellowErrorRate || completed < planned || (explained > 0 && wrong > 0 && errorRate >= th.yellowErrorRate * 0.6)) {
    let reason = `错误率 ${errorRatePct}%（处于巩固区间）`;
    if (errorRate < th.yellowErrorRate && completed < planned) {
      reason = `正确率达标，但题量 ${completed}/${planned} 尚未达到计划题数`;
    } else if (explained > 0) {
      reason = `已完成 ${explained} 次讲解，错误率 ${errorRatePct}%，需复测压至 ${Math.round(th.yellowErrorRate * 100)}% 以下转绿`;
    }
    return {
      planned_count: planned,
      completed_count: completed,
      wrong_count: wrong,
      explained_count: explained,
      consecutive_wrong: consecutiveWrong,
      error_rate: errorRate,
      errorRatePct,
      light_status: 'yellow',
      lightLabel: '黄灯 · 巩固中',
      is_passed: false,
      triggerReason: reason
    };
  }

  return {
    planned_count: planned,
    completed_count: completed,
    wrong_count: wrong,
    explained_count: explained,
    consecutive_wrong: consecutiveWrong,
    error_rate: errorRate,
    errorRatePct,
    light_status: 'green',
    lightLabel: '绿灯 · 已过关',
    is_passed: true,
    triggerReason: `已完成 ${completed}/${planned} 题，错误率 ${errorRatePct}% < ${Math.round(th.yellowErrorRate * 100)}%`
  };
}

export function summarizeSubjectStats(stage, subjectKey, progressMap = {}, thresholds = DEFAULT_TRAFFIC_THRESHOLDS) {
  const subj = FULL_MANUAL_CATALOG[stage]?.[subjectKey];
  if (!subj) return null;

  let redCount = 0;
  let yellowCount = 0;
  let greenCount = 0;
  let unstartedCount = 0;
  let totalPlanned = 0;
  let totalCompleted = 0;
  let totalWrong = 0;
  let totalExplained = 0;
  const redNodes = [];
  const yellowNodes = [];
  const groupStats = {};

  for (const node of subj.flatNodes) {
    const raw = progressMap[node.nodeId] || { planned_count: node.defaultPlannedCount };
    const ev = computeTrafficLight(raw, thresholds);
    totalPlanned += ev.planned_count;
    totalCompleted += ev.completed_count;
    totalWrong += ev.wrong_count;
    totalExplained += ev.explained_count;

    const grp = node.chapterGroup || node.chapterTitle || '综合专题';
    if (!groupStats[grp]) groupStats[grp] = { total: 0, passed: 0, red: 0, yellow: 0 };
    groupStats[grp].total += 1;

    if (ev.light_status === 'red') {
      redCount += 1;
      groupStats[grp].red += 1;
      redNodes.push({ ...node, progress: ev });
    } else if (ev.light_status === 'yellow') {
      yellowCount += 1;
      groupStats[grp].yellow += 1;
      yellowNodes.push({ ...node, progress: ev });
    } else if (ev.light_status === 'green') {
      greenCount += 1;
      groupStats[grp].passed += 1;
    } else {
      unstartedCount += 1;
    }
  }

  const startedNodes = redCount + yellowCount + greenCount;
  const passRatePct = startedNodes > 0 ? Math.round((greenCount / startedNodes) * 100) : 0;

  return {
    stage,
    subjectKey,
    subjectLabel: subj.label,
    totalNodes: subj.totalNodes,
    startedNodes,
    redCount,
    yellowCount,
    greenCount,
    unstartedCount,
    passRatePct,
    totalPlanned,
    totalCompleted,
    totalWrong,
    totalExplained,
    redNodes: redNodes.slice(0, 20),
    yellowNodes: yellowNodes.slice(0, 20),
    groupStats
  };
}

// ==================== DeepTutor 闭环：【专属消灯任务包】生成器 ====================
export function buildLightClearPack({ node, progress = {}, thresholds = DEFAULT_TRAFFIC_THRESHOLDS }) {
  const ev = computeTrafficLight(progress, thresholds);
  const subjectLabel = node.subjectLabel || '学科专题';
  const topicTitle = node.title;
  const chapterTitle = node.chapterTitle || '';

  const isStem = /数学|物理|化学|生物|地理/.test(subjectLabel);
  const isAdvanced = /培优|扩展|压轴|综合/.test(`${topicTitle}${node.difficultyTag || ''}`);

  const diagnosisReason = isStem
    ? `【错因解剖】学员在《${subjectLabel} · ${chapterTitle}》的“${topicTitle}”节点触发 ${ev.lightLabel}（${ev.triggerReason}）。通常暴露出两类核心问题：① 概念定义或公式适用前提未拆清（忽视隐含边界条件）；② 同题型多步骤推演中关键转化节点断链，导致同类题反复失分。`
    : `【错因解剖】学员在《${subjectLabel} · ${chapterTitle}》的“${topicTitle}”节点触发 ${ev.lightLabel}（${ev.triggerReason}）。主要源于：① 采分点关键词/高频句式提取不够规范；② 未形成“审题定型 → 模板迁移 → 语境验证”的稳定答题链路。`;

  const adviceText = isAdvanced
    ? `1. 先用 8 分钟精读【知识库·总结归纳类】模型拆解卡片，锁定破题母题；\n2. 独立完成下方 3 道梯级同题型消灯题（禁看解析做完再核对思路）；\n3. 将本题型标记“讲解数 +1”，待错误率降至 ${Math.round((thresholds?.yellowErrorRate ?? 0.15) * 100)}% 以下即可自动消红转绿。`
    : `1. 先花 5 分钟过一遍【知识库·基础必掌握类】核心概念清单；\n2. 逐题完成下方“基础巩固 → 变式进阶 → 达标复测”3 连击；\n3. 录入本次消灯训练结果，系统将按最新错误率实时刷新状态灯。`;

  const knowledgeDocs = [
    {
      docId: `kb_${node.nodeId}_base`,
      kbCategory: '基础必掌握类',
      title: `【基础讲义】${topicTitle} — 核心定义与易错边界`,
      summary: `围绕“${topicTitle}”提炼 3 条必背判定准则与考场常见 2 大失分陷阱（建议先复述一遍核心条件，再动笔刷题）。`,
      checklist: [
        `定义与适用条件：先辨明【${chapterTitle}】所属核心知识前提，避免套错公式或张冠李戴；`,
        '标准解题起步动作：圈出题干关键词、限定条件（范围/符号/单位/时段）；',
        '错题自检口诀：做完先核对“条件是否全用上、特殊情形/端点是否漏讨论”。'
      ]
    },
    {
      docId: `kb_${node.nodeId}_summary`,
      kbCategory: '总结归纳类',
      title: `【铭师归纳】${topicTitle} — 题型通法与母题模型`,
      summary: `将“${topicTitle}”高频考法归纳为标准化三步拆解流程，帮助学生实现从“会听”到“独立拿分”的闭环迁移。`,
      checklist: [
        '第一步·定型归类：依据题干特征识别本考点在手册中的母题模型；',
        '第二步·分步破局：拆解中间过渡量（或采分要素清单），规避跳跃步骤失分；',
        '第三步·复盘消灯：同类连对 3 题且总体错误率低于阈值后正式标记过关。'
      ]
    }
  ];

  const practiceQuestions = [
    {
      qId: `q_${node.nodeId}_1`,
      difficulty: '基础',
      type: '基础靶向巩固题',
      prompt: `【第 1 关·基础保底】请结合讲义完成关于《${topicTitle}》的基础辨析与核心步骤训练（要求：写出关键依据或第一转化步，避免跳步）。`,
      keyHint: `紧扣“${topicTitle}”最核心的概念/基本关系列式或作答。`
    },
    {
      qId: `q_${node.nodeId}_2`,
      difficulty: '中等',
      type: '同题型变式训练',
      prompt: `【第 2 关·变式迁移】在《${chapterTitle}》语境下变换条件或设问角度，完成“${topicTitle}”中等变式训练（重点核查隐含约束与边界讨论）。`,
      keyHint: '对比第 1 题条件变化点，找出新增隐含约束或易漏情况。'
    },
    {
      qId: `q_${node.nodeId}_3`,
      difficulty: isAdvanced ? '压轴' : '中等',
      type: '过关复测验收题',
      prompt: `【第 3 关·复测验收】限时完成一道《${topicTitle}》综合应用达标题，检验是否彻底消除连续错误与概念混淆。`,
      keyHint: '独立限时完成，完成后在本窗口如实勾选“做对/仍不会”题数以重算状态灯。'
    }
  ];

  return {
    packId: `pack_${node.nodeId}_${Date.now()}`,
    nodeId: node.nodeId,
    stage: node.stage,
    subjectKey: node.subjectKey,
    subjectLabel,
    chapterTitle,
    topicTitle,
    beforeLight: ev.light_status,
    beforeLightLabel: ev.lightLabel,
    beforeErrorRatePct: ev.errorRatePct,
    triggerReason: ev.triggerReason,
    diagnosisReason,
    adviceText,
    knowledgeDocs,
    practiceQuestions
  };
}

// ==================== Worker 后端受保护的 AI 拍卷结构提示词生成器 ====================
export function buildPaperPrompt(stage = 'junior', subjectHint = 'auto') {
  const s = stage === 'senior' ? 'senior' : 'junior';
  const subjList = SUBJECT_ORDER[s].map(item => `${item.key}(${item.label})`).join('、');
  const subjCatalogPreview = SUBJECT_ORDER[s]
    .filter(item => subjectHint === 'auto' || subjectHint === item.key)
    .map(item => {
      const chTitles = FULL_MANUAL_CATALOG[s][item.key].chapters.slice(0, 12).map(c => c.title).join('；');
      return `- ${item.key}(${item.label}): ${chTitles}`;
    })
    .join('\n');

  return [
    '你是一个极度克制的试卷题目结构提取助手，只服务于中国初高中教师整理考点目录。',
    '【绝对隐私与安全红线】',
    '1. 绝对不要识别、读取或输出任何学生姓名、考号、学校名、手写答案或学生作答痕迹；如果图片中看到手写笔迹，请完全忽略手写内容，只读取印刷体题干结构。',
    '2. 绝对不要判断对错、不要打分、不要批改任何题目。',
    '3. 只输出严格合法的 JSON，格式：{"subject":"...","examTitle":"...","items":[{"qno":"1","qtype":"选择|填空|计算|证明|实验|阅读|写作|其他","difficulty":"基础|中档|压轴|待确认","score":null,"topicGuess":"...","manualNodeHint":"...","summary":"不超过24字打印体题干考点摘要"}]}。',
    `可选学科键名（按${s === 'junior' ? '初中' : '高中'}）：${subjList}。若无法确认输出 "unknown"。`,
    '请尽量将 manualNodeHint 映射到以下《考点过关手册》章节名称：',
    subjCatalogPreview
  ].join('\n');
}
