// 许老师工作室 / 铭师学习规划管理平台 (mrxu.uk)
// 第三期模块 5：智能文档切题、知识点归类、难易度三档识别与三级防重拦截引擎

import { FULL_MANUAL_CATALOG } from './manual-catalog.mjs';
import { SEED_QUESTION_BANK } from './exam-engine.mjs';

export function stripLeadingQuestionNo(text) {
  return String(text || '')
    .trim()
    .replace(/^(?:第\s*\d+\s*题|【\s*题?\s*\d+\s*】|\(?\d+\)?\s*[、.．:：\)]|\d+\s*[、.．])\s*/, '')
    .trim();
}

export function normalizeQuestionStem(text) {
  return stripLeadingQuestionNo(text)
    .replace(/[A-D]\s*[.．、]\s*[\s\S]*$/g, m => (m.length < 40 ? '' : m)) // 仅保留主题干部分比对或统一归一化
    .replace(/[\s\u3000，。、；：？！“”"'‘’（）()【】\[\]{}<>《》—\-_=+|\\/~`·]+/g, '')
    .toLowerCase();
}

export function normalizeFullTextForHash(text) {
  return stripLeadingQuestionNo(text)
    .replace(/[\s\u3000，。、；：？！“”"'‘’（）()【】\[\]{}<>《》—\-_]+/g, '')
    .toLowerCase();
}

export function computeTextHash(text) {
  const norm = normalizeFullTextForHash(text);
  let h1 = 0x811c9dc5;
  let h2 = 5381;
  for (let i = 0; i < norm.length; i++) {
    const code = norm.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (((h2 << 5) + h2) ^ code) >>> 0;
  }
  return `fp_${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

function getBigrams(str) {
  const s = String(str || '');
  if (s.length < 2) return [s];
  const grams = [];
  for (let i = 0; i < s.length - 1; i++) {
    grams.push(s.slice(i, i + 2));
  }
  return grams;
}

function diceCoefficient(aList, bList) {
  if (!aList.length || !bList.length) return 0;
  const counts = new Map();
  for (const g of aList) counts.set(g, (counts.get(g) || 0) + 1);
  let matches = 0;
  for (const g of bList) {
    const c = counts.get(g) || 0;
    if (c > 0) {
      matches += 1;
      counts.set(g, c - 1);
    }
  }
  return (2 * matches) / (aList.length + bList.length);
}

export function computeSemanticSignature(text) {
  const clean = normalizeFullTextForHash(text);
  const skeleton = clean.replace(/\d+(?:\.\d+)?/g, '#');
  return skeleton.slice(0, 180);
}

export function computeSimilarityScore(textA, textB) {
  const aFull = normalizeFullTextForHash(textA);
  const bFull = normalizeFullTextForHash(textB);
  if (!aFull || !bFull) return 0;
  if (aFull === bFull) return 1.0;

  const rawDice = diceCoefficient(getBigrams(aFull), getBigrams(bFull));
  const aSkel = aFull.replace(/\d+(?:\.\d+)?/g, '#');
  const bSkel = bFull.replace(/\d+(?:\.\d+)?/g, '#');
  const skelDice = diceCoefficient(getBigrams(aSkel), getBigrams(bSkel));

  const lenRatio = Math.min(aFull.length, bFull.length) / Math.max(aFull.length, bFull.length);
  const combined = (0.55 * rawDice + 0.45 * skelDice) * (lenRatio < 0.45 ? 0.6 : 1.0);
  return Number(Math.min(0.999, combined).toFixed(4));
}

function splitRawExamBlocks(rawText) {
  const text = String(rawText || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  // 优先按换行符前的常见题号切分（如 "1.", "2、", "第3题", "【题4】"）
  const markerRegex = /(?:^|\n)\s*(?=(?:第\s*\d+\s*题|【\s*题?\s*\d+\s*】|\d{1,2}\s*[.．、\)]))/g;
  const parts = text.split(markerRegex).map(s => s.trim()).filter(s => s.length >= 6);
  if (parts.length > 1) return parts;

  // 若用户按空行分段输入
  const byBlank = text.split(/\n{2,}/).map(s => s.trim()).filter(s => s.length >= 6);
  return byBlank.length ? byBlank : [text];
}

function parseSingleQuestionBlock(blockText) {
  let body = String(blockText || '').trim();
  let answer = '略（待教师核校补充标准答案）';
  let analysis = '按《考点过关手册》对应通法分步核对边界条件与解题链路。';

  const ansMatch = body.match(/(?:^|\n)\s*(?:【答案】|参考答案[:：]|答案[:：])\s*([\s\S]*?)(?=(?:\n\s*(?:【解析】|解析[:：]|思路[:：]))|$)/);
  if (ansMatch) {
    answer = ansMatch[1].trim() || answer;
  }
  const anaMatch = body.match(/(?:^|\n)\s*(?:【解析】|解析[:：]|思路[:：])\s*([\s\S]*)$/);
  if (anaMatch) {
    analysis = anaMatch[1].trim() || analysis;
  }

  // 剥离尾部的答案/解析行，得到干净题干+选项
  const stemAndOpts = body
    .replace(/(?:^|\n)\s*(?:【答案】|参考答案[:：]|答案[:：])[\s\S]*$/m, '')
    .trim();

  let options = [];
  let stem = stemAndOpts;
  const optStart = stemAndOpts.search(/(?:^|\n|\s)A\s*[.．、]/);
  if (optStart > 4) {
    const optBlock = stemAndOpts.slice(optStart).trim();
    const optMatches = optBlock.match(/[A-D]\s*[.．、][^A-D\n]*(?=\s+[B-D]\s*[.．、]|\n[B-D]\s*[.．、]|$)/g);
    if (optMatches && optMatches.length >= 3) {
      options = optMatches.map(o => o.trim());
      stem = stemAndOpts.slice(0, optStart).trim();
    }
  }

  stem = stripLeadingQuestionNo(stem);
  const questionType = options.length >= 3
    ? '选择'
    : (/_{3,}|（\s*）\s*$|填空/.test(stem) ? '填空' : '解答');

  return { stem, options, answer, analysis, questionType };
}

function inferDifficulty(stem, qType) {
  const s = String(stem || '');
  if (/压轴|恒成立|极值点偏移|存在性|最大值|最小值|动点|分类讨论|综合探究|（2）[\s\S]*（3）/.test(s)) {
    return '压轴';
  }
  if (/取值范围|若.*则|证明|讨论|变式|已知.*求|不等式|方程组|（1）[\s\S]*（2）/.test(s) || qType === '解答' || s.length > 72) {
    return '中等';
  }
  return '基础';
}

function matchManualNode(stage, subjectKey, text) {
  const subj = FULL_MANUAL_CATALOG?.[stage]?.[subjectKey];
  const nodes = subj?.flatNodes || [];
  if (!nodes.length) return null;

  const clean = String(text || '');
  let best = nodes[0];
  let bestScore = -1;
  const domainBoostKeywords = ['集合', '逻辑', '不等式', '单调', '奇偶', '导数', '极值', '三角', '解三角形', '向量', '椭圆', '双曲线', '圆', '直线', '方程', '抛物线', '二次函数', '有理数', '力学', '动量', '碰撞', '速度', '离子', '质量守恒', '氧化', '语病', '字音', '名词', '光合', '民主', '马关条约', '大气'];

  for (const n of nodes) {
    let score = 0;
    const target = `${n.chapterTitle} ${n.title}`;
    for (const kw of domainBoostKeywords) {
      if (clean.includes(kw) && target.includes(kw)) score += 6;
    }
    const stripped = clean.replace(/[^\u4e00-\u9fa5]/g, '');
    for (let i = 0; i < Math.min(stripped.length - 1, 60); i++) {
      if (target.includes(stripped.slice(i, i + 2))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return best;
}

// ==================== 1. 智能切题 + 难度分类 + 一二级查重预览 ====================
export async function splitAndClassifyDocument({
  rawText = '',
  stage = 'senior',
  subjectKey = 'math',
  aiBinding = null,
  existingQuestions = []
}) {
  const safeStage = stage === 'junior' ? 'junior' : 'senior';
  const safeSubj = FULL_MANUAL_CATALOG?.[safeStage]?.[subjectKey] ? subjectKey : 'math';

  // 若文本无明显题号且内容较长，并绑定了 Workers AI，可先尝试让 AI 拆成标准题号段
  let textToSplit = String(rawText || '').trim();
  let blocks = splitRawExamBlocks(textToSplit);

  if (blocks.length === 1 && textToSplit.length > 180 && aiBinding) {
    try {
      let timer;
      const aiRes = await Promise.race([
        aiBinding.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            { role: 'system', content: '将下面试卷文本按独立题目拆分成严格JSON数组：[{"stem":"题干","options":["A..."],"answer":"...","analysis":"...","difficulty":"基础|中等|压轴"}]。严禁改动题干数值，只输出JSON数组。' },
            { role: 'user', content: textToSplit.slice(0, 3500) }
          ],
          max_tokens: 1500,
          temperature: 0.1
        }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 10000); })
      ]).finally(() => clearTimeout(timer));

      const rawResp = String(aiRes?.response || '');
      const m = rawResp.match(/\[[\s\S]*\]/);
      if (m) {
        const arr = JSON.parse(m[0]);
        if (Array.isArray(arr) && arr.length >= 2) {
          blocks = arr.map((it, i) => `${i + 1}. ${it.stem || ''}\n${(it.options || []).join('\n')}\n【答案】${it.answer || ''}\n【解析】${it.analysis || ''}`);
        }
      }
    } catch (_) { /* keep rule-based blocks */ }
  }

  // 构建参考防重基准池（D1 题库 + 内置种子真题）
  const referencePool = [
    ...SEED_QUESTION_BANK.filter(q => q.stage === safeStage && q.subjectKey === safeSubj).map(q => ({
      qId: q.qId,
      stem: q.stem,
      textHash: computeTextHash(q.stem)
    })),
    ...(existingQuestions || []).map(q => ({
      qId: q.q_id || q.qId,
      stem: q.stem_text || q.stem,
      textHash: q.text_hash || computeTextHash(q.stem_text || q.stem)
    }))
  ];

  const items = [];
  let cleanCount = 0;
  let semanticWarningCount = 0;
  let exactDuplicateCount = 0;

  blocks.slice(0, 60).forEach((blk, idx) => {
    const parsed = parseSingleQuestionBlock(blk);
    if (!parsed.stem) return;

    const difficulty = inferDifficulty(parsed.stem, parsed.questionType);
    const node = matchManualNode(safeStage, safeSubj, `${parsed.stem} ${parsed.analysis}`);
    const textHash = computeTextHash(parsed.stem);
    const semanticSig = computeSemanticSignature(parsed.stem);

    // 执行一级（指纹精准查重）+ 二级（>=85% 语义相似度比对）
    let bestSim = 0;
    let bestMatch = null;
    let exactHit = referencePool.find(r => r.textHash === textHash) || null;

    if (exactHit) {
      bestSim = 1.0;
      bestMatch = exactHit;
    } else {
      for (const ref of referencePool) {
        const sim = computeSimilarityScore(parsed.stem, ref.stem);
        if (sim > bestSim) {
          bestSim = sim;
          bestMatch = ref;
        }
      }
    }

    // 同一批上传文档内部也互相防重
    for (const prev of items) {
      if (prev.textHash === textHash) {
        exactHit = { qId: prev.tempId, stem: prev.stem };
        bestSim = 1.0;
        bestMatch = exactHit;
        break;
      }
      const sim = computeSimilarityScore(parsed.stem, prev.stem);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatch = { qId: prev.tempId, stem: prev.stem };
      }
    }

    const similarityPct = Math.round(bestSim * 100);
    let dedupStatus = 'clean';
    let defaultDecision = 'approve';
    if (exactHit || bestSim >= 0.995) {
      dedupStatus = 'exact_duplicate';
      defaultDecision = 'discard';
      exactDuplicateCount += 1;
    } else if (bestSim >= 0.85) {
      dedupStatus = 'semantic_warning';
      defaultDecision = 'variant';
      semanticWarningCount += 1;
    } else {
      cleanCount += 1;
    }

    items.push({
      tempId: `tmp_${idx + 1}_${textHash.slice(-6)}`,
      seq: idx + 1,
      stage: safeStage,
      subjectKey: safeSubj,
      questionType: parsed.questionType,
      difficulty,
      manualNodeId: node?.nodeId || `${safeStage}_${safeSubj}_c1_i1`,
      manualNodeTitle: node?.title || '综合题型',
      chapterTitle: node?.chapterTitle || '',
      stem: parsed.stem,
      options: parsed.options,
      answer: parsed.answer,
      analysis: parsed.analysis,
      textHash,
      semanticSig,
      similarityPct,
      dedupStatus,
      similarTo: bestMatch ? { qId: bestMatch.qId, stem: String(bestMatch.stem || '').slice(0, 80) } : null,
      defaultDecision
    });
  });

  return {
    items,
    summary: {
      total: items.length,
      cleanCount,
      semanticWarningCount,
      exactDuplicateCount
    }
  };
}

// ==================== 2. 三级防重：【全库一键深度查重清理】 ====================
export async function runDeepBankDeduplication(db) {
  if (!db) {
    return { scannedCount: 0, exactRemovedCount: 0, variantMarkedCount: 0, details: [] };
  }

  const res = await db.prepare(
    `SELECT q_id, stage, subject_key, stem_text, text_hash, is_variant, variant_of_id, review_status
     FROM question_bank WHERE review_status != 'discarded' ORDER BY created_at ASC`
  ).all();
  const rows = res?.results || [];

  const canonicalPool = SEED_QUESTION_BANK.map(q => ({
    qId: q.qId,
    stage: q.stage,
    subjectKey: q.subjectKey,
    stem: q.stem,
    textHash: computeTextHash(q.stem)
  }));

  let exactRemovedCount = 0;
  let variantMarkedCount = 0;
  const details = [];
  const updateStmts = [];

  for (const row of rows) {
    const hash = row.text_hash || computeTextHash(row.stem_text);
    const sameBucket = canonicalPool.filter(c => c.stage === row.stage && c.subjectKey === row.subject_key);

    const exactHit = sameBucket.find(c => c.textHash === hash || computeSimilarityScore(row.stem_text, c.stem) >= 0.995);
    if (exactHit) {
      exactRemovedCount += 1;
      details.push({
        qId: row.q_id,
        action: 'discarded_exact',
        matchedId: exactHit.qId,
        similarityPct: 100,
        stemPreview: String(row.stem_text || '').slice(0, 50)
      });
      updateStmts.push(
        db.prepare(`UPDATE question_bank SET review_status = 'discarded' WHERE q_id = ?`).bind(row.q_id)
      );
      continue;
    }

    let bestSim = 0;
    let bestHit = null;
    for (const c of sameBucket) {
      const sim = computeSimilarityScore(row.stem_text, c.stem);
      if (sim > bestSim) {
        bestSim = sim;
        bestHit = c;
      }
    }

    if (bestSim >= 0.85 && bestHit && Number(row.is_variant) === 0) {
      variantMarkedCount += 1;
      details.push({
        qId: row.q_id,
        action: 'marked_variant',
        matchedId: bestHit.qId,
        similarityPct: Math.round(bestSim * 100),
        stemPreview: String(row.stem_text || '').slice(0, 50)
      });
      updateStmts.push(
        db.prepare(`UPDATE question_bank SET is_variant = 1, variant_of_id = ? WHERE q_id = ?`).bind(bestHit.qId, row.q_id)
      );
    }

    canonicalPool.push({
      qId: row.q_id,
      stage: row.stage,
      subjectKey: row.subject_key,
      stem: row.stem_text,
      textHash: hash
    });
  }

  for (let i = 0; i < updateStmts.length; i += 60) {
    await db.batch(updateStmts.slice(i, i + 60));
  }

  return {
    scannedCount: rows.length,
    exactRemovedCount,
    variantMarkedCount,
    details: details.slice(0, 30)
  };
}
