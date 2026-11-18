// 许老师工作室 / 铭师学习规划管理平台 (mrxu.uk)
// Cloudflare Worker 后端引擎：版权接口隔离 + 常量时间访问校验 + AI仅抽题干结构红线 + 三大业务引擎API
// 严禁修改 wrangler.jsonc 项目名 muddy-wildflower-44b9；AI 绝不批改答案或读取姓名/学校/手写答案。

import {
  STUDIO_META,
  ZHONGKAO_REGIONS,
  GAOKAO_PROVINCES,
  ART_PROVINCE_FORMULAS,
  ART_PRESET_RATIOS,
  ART_SCHOOL_CUTOFFS,
  getGaokaoSchoolsFor,
  calculateArtCultureTarget,
  calculateEnrollmentPlan,
  generateMasterCommentary
} from './region-data.mjs';

import {
  DEFAULT_TRAFFIC_THRESHOLDS,
  SUBJECT_ORDER,
  getPublicCatalogPayload,
  findManualNodeById,
  computeTrafficLight,
  summarizeSubjectStats,
  buildLightClearPack,
  buildPaperPrompt
} from './manual-catalog.mjs';

import {
  assembleManualExam,
  swapExamQuestion,
  assembleAiExam
} from './exam-engine.mjs';

let d1Initialized = false;

async function ensureD1Tables(db) {
  if (!db || d1Initialized) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS sys_config_thresholds (config_key TEXT PRIMARY KEY, red_error_rate REAL NOT NULL DEFAULT 0.40, yellow_error_rate REAL NOT NULL DEFAULT 0.15, red_consecutive_wrong INTEGER NOT NULL DEFAULT 2, watermark_text TEXT NOT NULL DEFAULT '许老师工作室 / 铭师学习规划原创 · 盗版必究', points_rules_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS student_profiles (student_id TEXT PRIMARY KEY, display_alias TEXT NOT NULL, access_role TEXT NOT NULL DEFAULT 'student', stage TEXT NOT NULL, grade_label TEXT NOT NULL, enrollment_category TEXT NOT NULL, sprint_sub_type TEXT, growth_sub_type TEXT, province TEXT NOT NULL, city TEXT, subject_track TEXT, art_formula_preset TEXT, art_culture_weight REAL, art_major_weight REAL, art_major_score REAL, art_major_max REAL DEFAULT 300, target_school_name TEXT, target_cutoff_score REAL, local_max_score REAL, baseline_score REAL, required_culture_target REAL, advance_span_weeks INTEGER DEFAULT 0, target_difficulty TEXT DEFAULT '中等', target_mastery_level TEXT DEFAULT '良好', study_rhythm TEXT NOT NULL DEFAULT 'part_time', custom_cycle_days INTEGER NOT NULL DEFAULT 7, available_hours_per_day REAL NOT NULL DEFAULT 2.5, service_mode TEXT NOT NULL DEFAULT 'self_study', eval_frequency TEXT DEFAULT 'biweekly', course_enabled INTEGER NOT NULL DEFAULT 0, points_balance INTEGER NOT NULL DEFAULT 100, invite_code TEXT UNIQUE, invited_by_code TEXT, cleared_red_count INTEGER NOT NULL DEFAULT 0, tasks_json TEXT NOT NULL DEFAULT '[]', admin_commentary TEXT DEFAULT '', workspace_state_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS student_manual_progress (progress_id TEXT PRIMARY KEY, student_id TEXT NOT NULL, node_id TEXT NOT NULL, planned_count INTEGER NOT NULL DEFAULT 5, completed_count INTEGER NOT NULL DEFAULT 0, wrong_count INTEGER NOT NULL DEFAULT 0, explained_count INTEGER NOT NULL DEFAULT 0, is_passed INTEGER NOT NULL DEFAULT 0, consecutive_wrong INTEGER NOT NULL DEFAULT 0, error_rate REAL NOT NULL DEFAULT 0.0, light_status TEXT NOT NULL DEFAULT 'unstarted', last_diagnosed_at TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(student_id, node_id))`,
    `CREATE TABLE IF NOT EXISTS school_exam_scores (score_id TEXT PRIMARY KEY, student_id TEXT NOT NULL, exam_type TEXT NOT NULL, exam_name TEXT NOT NULL, exam_date TEXT NOT NULL, subject_key TEXT NOT NULL DEFAULT 'total', score_obtained REAL NOT NULL, max_score REAL NOT NULL, target_score REAL, rank_note TEXT DEFAULT '', entered_by_role TEXT NOT NULL DEFAULT 'parent', created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS planning_reports (report_id TEXT PRIMARY KEY, student_id TEXT NOT NULL, report_title TEXT NOT NULL DEFAULT '许老师工作室 · 独家升学规划与过关诊断报告', radar_metrics_json TEXT NOT NULL, battle_summary_json TEXT NOT NULL, auto_commentary TEXT NOT NULL, admin_polished_commentary TEXT, seal_label TEXT NOT NULL DEFAULT '许老师工作室 / 铭师学习规划专用章', signature_teacher TEXT NOT NULL DEFAULT '许老师', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS generated_exams (exam_id TEXT PRIMARY KEY, student_id TEXT, title TEXT NOT NULL, mode TEXT NOT NULL, prompt_text TEXT, stage TEXT NOT NULL, subject_key TEXT NOT NULL, grade_label TEXT DEFAULT '', total_score INTEGER NOT NULL DEFAULT 100, duration_minutes INTEGER NOT NULL DEFAULT 90, question_ids_json TEXT NOT NULL, exam_payload_json TEXT NOT NULL DEFAULT '{}', insufficient_warnings_json TEXT DEFAULT '[]', created_at TEXT NOT NULL DEFAULT (datetime('now')))`
  ];
  await db.batch(stmts.map(sql => db.prepare(sql)));
  d1Initialized = true;
}

async function loadApprovedD1Questions(db, stage, subjectKey) {
  if (!db) return [];
  try {
    const res = await db.prepare(
      'SELECT q_id, stage, subject_key, manual_node_id, difficulty, question_type, stem_text, options_json, answer_text, analysis_text FROM question_bank WHERE stage = ? AND subject_key = ? AND review_status != ? ORDER BY created_at DESC LIMIT 200'
    ).bind(stage, subjectKey, 'discarded').all();
    return res?.results || [];
  } catch (_) {
    return [];
  }
}

async function saveGeneratedExamToD1(db, exam, insufficientWarnings = [], studentId = '') {
  if (!db || !exam?.examId) return;
  try {
    await ensureD1Tables(db);
    await db.prepare(
      `INSERT INTO generated_exams (
        exam_id, student_id, title, mode, prompt_text, stage, subject_key,
        grade_label, total_score, duration_minutes, question_ids_json,
        exam_payload_json, insufficient_warnings_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(exam_id) DO UPDATE SET
        title = excluded.title,
        total_score = excluded.total_score,
        question_ids_json = excluded.question_ids_json,
        exam_payload_json = excluded.exam_payload_json,
        insufficient_warnings_json = excluded.insufficient_warnings_json`
    ).bind(
      exam.examId,
      studentId || null,
      exam.title || '未命名试卷',
      exam.mode || 'manual',
      exam.promptText || '',
      exam.stage || 'senior',
      exam.subjectKey || 'math',
      exam.gradeLabel || '',
      Number(exam.totalScore) || 100,
      Number(exam.durationMinutes) || 90,
      JSON.stringify((exam.questions || []).map(q => q.qId)),
      JSON.stringify(exam),
      JSON.stringify(insufficientWarnings || [])
    ).run();
  } catch (_) { /* do not block exam generation if optional D1 write hiccups */ }
}

const MODEL = '@cf/mistralai/mistral-small-3.1-24b-instruct';
const TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const MAX_BODY = 3 * 1024 * 1024;
const MAX_SMALL_JSON = 512 * 1024;
const MAX_IMAGE = 2 * 1024 * 1024;

const SUBJECTS = ['cn', 'math', 'en', 'phys', 'physics', 'chem', 'politics', 'bio', 'hist', 'geo', 'unknown'];
const QTYPES = ['选择', '填空', '计算', '证明', '实验', '阅读', '写作', '综合', '其他'];
const DIFFS = ['基础', '中档', '压轴', '待确认'];
const LOCAL_DEV_PREVIEW_CODE = 'MXU-LOCAL-DEV';

function reply(data, status = 200, extra = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra
    }
  });
}

function isLocalhost(url) {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

function sameOrigin(request, url) {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return true; // 同源无 Origin 头或命令行单测允许，浏览器跨域 POST 会带 Origin
  return origin === url.origin;
}

function enabled(env) {
  return env.PAPER_AI_ENABLED === 'true' && !!env.PAPER_ACCESS_CODE
    && !!env.AI && !!env.PAPER_RATE_LIMITER;
}

function canaryEnabled(request, env) {
  return env.PAPER_AI_ENABLED === 'false' && env.PAPER_CANARY_ENABLED === 'true'
    && request.headers.get('X-Paper-Canary') === env.PAPER_CANARY_CODE
    && !!env.PAPER_CANARY_CODE && !!env.PAPER_ACCESS_CODE
    && !!env.AI && !!env.PAPER_RATE_LIMITER;
}

async function constantTimeEqual(aStr, bStr) {
  if (!aStr || !bStr || aStr.length > 128) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([aStr, bStr].map(s => crypto.subtle.digest('SHA-256', enc.encode(s))));
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
}

async function authorized(request, env, url) {
  const supplied = request.headers.get('X-Paper-Access-Code') || '';
  const expected = String(env.PAPER_ACCESS_CODE || '');
  if (!expected) {
    // 生产环境严格阻断；仅本机 localhost 未配置 .dev.vars 时允许显式本地预览码
    if (url && isLocalhost(url)) {
      return constantTimeEqual(supplied, LOCAL_DEV_PREVIEW_CODE);
    }
    return false;
  }
  return constantTimeEqual(supplied, expected);
}

async function readJsonBody(request, maxBytes = MAX_SMALL_JSON) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
    throw Object.assign(new Error('invalid_content_type'), { status: 415 });
  }
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > maxBytes) {
    throw Object.assign(new Error('payload_too_large'), { status: 413 });
  }
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw Object.assign(new Error('payload_too_large'), { status: 413 });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function decodeImage(value) {
  if (typeof value !== 'string') throw new Error('invalid_image');
  const m = value.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!m || m[2].length > Math.ceil(MAX_IMAGE * 4 / 3) + 4) throw new Error('invalid_image');
  let raw;
  try { raw = atob(m[2]); } catch (_) { throw new Error('invalid_image'); }
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (bytes.length < 50 || bytes.length > MAX_IMAGE || (m[1] === 'png' ? !png : !jpeg)) {
    throw new Error('invalid_image');
  }
  return { bytes, mime: m[1] === 'png' ? 'image/png' : 'image/jpeg' };
}

export function normalizeResult(text) {
  if (typeof text !== 'string') throw new Error('invalid_result');
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('invalid_result');
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  const rawList = Array.isArray(parsed.questions)
    ? parsed.questions
    : (Array.isArray(parsed.items) ? parsed.items : null);
  if (!rawList || !rawList.length || rawList.length > 120) throw new Error('invalid_result');

  const ids = new Set();
  const questions = rawList.map(q => {
    if (!q || typeof q !== 'object') throw new Error('invalid_result');
    const no = String(q.no ?? q.qno ?? '').trim();
    if (!/^[A-Za-z0-9一二三四五六七八九十（）().、\-]{1,24}$/.test(no) || ids.has(no)) {
      throw new Error('duplicate_or_invalid_number');
    }
    ids.add(no);
    const rawSub = String(q.subject || parsed.subject || 'unknown').toLowerCase();
    const rawScore = q.maxScore ?? q.score;
    return {
      no,
      subject: SUBJECTS.includes(rawSub) ? rawSub : 'unknown',
      scope: String(q.scope || q.manualNodeHint || q.topicGuess || '').slice(0, 160),
      qtype: QTYPES.includes(q.qtype) ? q.qtype : '其他',
      diff: DIFFS.includes(q.diff ?? q.difficulty) ? (q.diff ?? q.difficulty) : '待确认',
      maxScore: typeof rawScore === 'number' && Number.isFinite(rawScore) && rawScore > 0 && rawScore <= 150
        ? rawScore : null,
      evidence: String(q.evidence || q.summary || '').slice(0, 180)
    };
  });

  // 严格丢弃一切 AI 可能附带的批改、对错、得分字段，强制标注 needsReview: true
  return {
    exam: String(parsed.exam || parsed.examTitle || '').slice(0, 120),
    questions,
    needsReview: true,
    reviewNotice: 'AI 仅提取打印题干结构，未读取学生作答；所有映射结果均须教师人工复核与手动勾选对错。',
    source: 'ai-structure-only'
  };
}

async function handlePaperAnalyze(request, env, url) {
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  if (!enabled(env) && !canaryEnabled(request, env)) {
    return reply({ error: 'service_not_enabled', message: '网站内识图服务尚未启用，可在工作台手工录题或使用离线结构导入。' }, 503);
  }
  if (!sameOrigin(request, url)) return reply({ error: 'origin_not_allowed' }, 403);
  if (!(await authorized(request, env, url))) return reply({ error: 'access_denied', message: '识别访问码不正确。' }, 401);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const limits = await Promise.all(['ip:' + ip, 'all'].map(key => env.PAPER_RATE_LIMITER.limit({ key })));
  if (limits.some(x => !x.success)) {
    return reply({ error: 'rate_limited', message: '识别请求太频繁，请稍后再试。' }, 429, { 'Retry-After': '60' });
  }

  let data;
  try {
    data = await readJsonBody(request, MAX_BODY);
    if (data.consent !== true) {
      return reply({ error: 'consent_required', message: '请先确认已遮挡学生姓名/学校/个人痕迹后再上传。' }, 400);
    }
  } catch (e) {
    return reply({ error: e.message || 'invalid_request' }, e.status || 400);
  }

  let image;
  try {
    image = decodeImage(data.image);
  } catch (_) {
    return reply({ error: 'invalid_image', message: '请上传不超过 2MB 的 JPEG 或 PNG 试卷图片。' }, 400);
  }

  const stage = data.stage === 'senior' ? 'senior' : 'junior';
  const subjectHint = typeof data.subjectHint === 'string' ? data.subjectHint : 'auto';
  const prompt = buildPaperPrompt(stage, subjectHint);

  let timer;
  try {
    const input = {
      messages: [
        {
          role: 'system',
          content: 'Extract only the printed exam-question structure. Ignore any student handwriting, names, schools, or scores. Never grade answers. Return JSON only using keys {"exam":"...","questions":[{"no":"1","subject":"...","scope":"...","qtype":"...","diff":"...","maxScore":null,"evidence":"..."}]}.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: 'data:' + image.mime + ';base64,' + bytesToBase64(image.bytes) } }
          ]
        }
      ],
      max_tokens: 2048,
      temperature: 0.1
    };

    const result = await Promise.race([
      env.AI.run(MODEL, input),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 150000); })
    ]);

    const text = typeof result.response === 'string'
      ? result.response
      : (result.response && typeof result.response === 'object'
        ? JSON.stringify(result.response)
        : (result.choices?.[0]?.message?.content));
    if (typeof text !== 'string') throw new Error('invalid_model_response');
    return reply(normalizeResult(text));
  } catch (error) {
    const msg = String(error.message || '');
    const code = /license|agree|acceptable use/i.test(msg) ? 'model_license_required'
      : /quota|neurons|limit exceeded/i.test(msg) ? 'ai_quota_exceeded'
      : msg === 'timeout' ? 'ai_timeout' : 'recognition_failed';
    const messages = {
      model_license_required: '模型要求站点管理员确认供应商许可，暂不能识别。',
      ai_quota_exceeded: '站点识图额度已用完，请稍后再试。',
      ai_timeout: '识别超时，未生成完整结果；可重新拍清晰图片或手工录入。',
      recognition_failed: '未能获得完整可靠的题号表，请重新拍照或手工建表。'
    };
    return reply({ error: code, message: messages[code] }, 502);
  } finally {
    clearTimeout(timer);
  }
}

async function handleApiV1(request, env, url) {
  const path = url.pathname;

  if (path === '/api/v1/auth/status' && request.method === 'GET') {
    const localPreviewAllowed = isLocalhost(url) && !env.PAPER_ACCESS_CODE;
    return reply({
      studio: {
        name: STUDIO_META.name,
        brand: STUDIO_META.brand,
        domain: STUDIO_META.domain,
        phone: STUDIO_META.phone,
        wechat: STUDIO_META.wechat,
        address: STUDIO_META.address
      },
      requiresAccessCode: true,
      aiEnabled: enabled(env),
      d1Enabled: Boolean(env.DB),
      localPreviewAllowed,
      localPreviewCodeHint: localPreviewAllowed ? LOCAL_DEV_PREVIEW_CODE : null
    });
  }

  if (path === '/api/v1/auth/verify' && request.method === 'POST') {
    if (!sameOrigin(request, url)) return reply({ error: 'origin_not_allowed' }, 403);
    let body = {};
    try {
      body = await readJsonBody(request, 16 * 1024);
    } catch (_) { /* header-only auth also supported */ }
    const supplied = request.headers.get('X-Paper-Access-Code') || String(body.accessCode || '');
    const reqForCheck = new Request(request.url, {
      headers: new Headers({ 'X-Paper-Access-Code': supplied })
    });
    if (!(await authorized(reqForCheck, env, url))) {
      return reply({ verified: false, error: 'access_denied', message: '授权访问码错误，无法读取平台题型库。' }, 401);
    }
    const requestedRole = ['student', 'parent', 'admin'].includes(body.role) ? body.role : 'student';
    return reply({
      verified: true,
      role: requestedRole,
      studio: STUDIO_META
    });
  }

  // 下方所有核心数据、地区线、目录树、亮灯/消灯引擎均受锁 1 保护：未验证授权码严禁访问
  if (!sameOrigin(request, url) && request.method !== 'GET') {
    return reply({ error: 'origin_not_allowed' }, 403);
  }
  if (!(await authorized(request, env, url))) {
    return reply({ error: 'unauthorized', message: '请先输入平台授权访问码解锁后台数据。' }, 401);
  }

  if (path === '/api/v1/bootstrap' && request.method === 'GET') {
    return reply({
      studio: STUDIO_META,
      d1Enabled: Boolean(env.DB),
      thresholds: DEFAULT_TRAFFIC_THRESHOLDS,
      subjectOrder: SUBJECT_ORDER,
      catalog: getPublicCatalogPayload(),
      regions: {
        zhongkao: ZHONGKAO_REGIONS,
        gaokaoProvinces: GAOKAO_PROVINCES,
        artProvinceFormulas: ART_PROVINCE_FORMULAS,
        artPresetRatios: ART_PRESET_RATIOS,
        artSchools: ART_SCHOOL_CUTOFFS
      }
    });
  }

  if (path === '/api/v1/regions/schools' && request.method === 'POST') {
    const body = await readJsonBody(request);
    const { sprintSubType, province = '湖北省', city = '武汉市', track = '物理类' } = body;
    if (sprintSubType === 'zhongkao') {
      const p = ZHONGKAO_REGIONS[province];
      const c = p?.cities?.[city];
      return reply({
        province,
        city,
        localMaxScore: c?.localMaxScore || p?.defaultMax || 680,
        note: c?.note || '未收录县市请点击“AI 参考检索”或直接在下方手动修正总满分与录取线。',
        schools: c?.schools || []
      });
    }
    if (sprintSubType === 'gaokao_art') {
      const rule = ART_PROVINCE_FORMULAS[province] || ART_PROVINCE_FORMULAS['湖北省'];
      return reply({
        province,
        localMaxScore: rule.cultureMax,
        formula: rule,
        schools: ART_SCHOOL_CUTOFFS
      });
    }
    return reply(getGaokaoSchoolsFor(province, track));
  }

  if (path === '/api/v1/ai/cutoff-lookup' && request.method === 'POST') {
    const body = await readJsonBody(request);
    const { examType = 'zhongkao', province = '湖北省', city = '', schoolName = '', track = '物理类' } = body;
    if (!schoolName.trim()) {
      return reply({ error: 'missing_school', message: '请输入需查询的县市高中或高校名称。' }, 400);
    }

    // 优先检查内置数据库模糊命中
    if (examType === 'zhongkao') {
      const provObj = ZHONGKAO_REGIONS[province];
      const cityObj = provObj?.cities?.[city];
      const hit = (cityObj?.schools || []).find(s => s.name.includes(schoolName.trim()));
      if (hit) {
        return reply({
          ...hit,
          localMaxScore: cityObj.localMaxScore,
          source: 'builtin',
          needsReview: false,
          note: '命中平台内置地市参考录取线，您仍可在下方输入框自由修正。'
        });
      }
    }

    const defaultMax = examType === 'zhongkao'
      ? (ZHONGKAO_REGIONS[province]?.cities?.[city]?.localMaxScore || ZHONGKAO_REGIONS[province]?.defaultMax || 700)
      : (GAOKAO_PROVINCES[province]?.localMaxScore || 750);

    // 若绑定了 Workers AI，尝试温和检索估计参考线；始终保留手动修正
    if (env.AI && env.PAPER_AI_ENABLED === 'true') {
      try {
        const q = `请根据中国${province}${city}${examType === 'zhongkao' ? '中考' : '高考' + track}公开历年投档参考口径，估算“${schoolName}”近三年大概录取平均分及当地满分。只返回JSON：{"localMaxScore":${defaultMax},"avgCutoffScore":数字,"note":"一句说明"}。若不确定请按省级重点平均水平估算并在note标注需人工核对。`;
        const aiRes = await env.AI.run(TEXT_MODEL, {
          messages: [{ role: 'user', content: q }],
          max_tokens: 256,
          temperature: 0.2
        });
        const txt = String(aiRes?.response || '');
        const m = txt.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          const maxS = Math.max(300, Math.min(1050, Number(parsed.localMaxScore) || defaultMax));
          const avgS = Math.max(200, Math.min(maxS, Number(parsed.avgCutoffScore) || Math.round(maxS * 0.85)));
          return reply({
            name: schoolName,
            localMaxScore: maxS,
            avg: avgS,
            y1: avgS - 4,
            y2: avgS,
            y3: avgS + 3,
            source: 'ai_estimated',
            needsReview: true,
            note: String(parsed.note || 'AI 公开口径参考估算，需人工复核并以目标校当年简章为准（支持下方随时手动修改）。')
          });
        }
      } catch (_) { /* fall back gracefully */ }
    }

    // 无 AI 或 AI 暂不可用时返回地区参考档位估值，不阻断建档
    const estAvg = Math.round(defaultMax * (/一中|实验|示范|重点|附中|大学/.test(schoolName) ? 0.86 : 0.76));
    return reply({
      name: schoolName,
      localMaxScore: defaultMax,
      avg: estAvg,
      y1: estAvg - 4,
      y2: estAvg,
      y3: estAvg + 3,
      source: 'tier_fallback',
      needsReview: true,
      note: '该县市/校未在本地库精确定位，已按地区同级参照比例预填，请结合当地实际在下方【当地考试总满分】与【目标校近三年平均线】手动修正。'
    });
  }

  if (path === '/api/v1/profile/calculate' && request.method === 'POST') {
    const profile = await readJsonBody(request);
    return reply({
      plan: calculateEnrollmentPlan(profile),
      artCalculation: profile.sprintSubType === 'gaokao_art' ? calculateArtCultureTarget({
        province: profile.province,
        preset: profile.artFormulaPreset,
        customCultureWeight: profile.artCultureWeight,
        customMajorWeight: profile.artMajorWeight,
        cultureMax: profile.localMaxScore,
        majorMax: profile.artMajorMax,
        majorScore: profile.artMajorScore,
        targetCombinedScore: profile.targetCutoffScore
      }) : null
    });
  }

  if (path === '/api/v1/progress/evaluate' && request.method === 'POST') {
    const body = await readJsonBody(request);
    const thresholds = body.thresholds || DEFAULT_TRAFFIC_THRESHOLDS;
    if (body.nodeProgress) {
      const evaluated = computeTrafficLight(body.nodeProgress, thresholds);
      return reply({ evaluated });
    }
    if (body.stage && body.subjectKey) {
      const stats = summarizeSubjectStats(body.stage, body.subjectKey, body.progressMap || {}, thresholds);
      if (!stats) return reply({ error: 'invalid_subject' }, 400);
      return reply({ stats });
    }
    return reply({ error: 'invalid_payload' }, 400);
  }

  if (path === '/api/v1/packs/generate' && request.method === 'POST') {
    const body = await readJsonBody(request);
    const node = findManualNodeById(body.nodeId);
    if (!node) return reply({ error: 'node_not_found' }, 404);
    const pack = buildLightClearPack({
      node,
      progress: body.progress || {},
      thresholds: body.thresholds || DEFAULT_TRAFFIC_THRESHOLDS
    });
    return reply({ pack });
  }

  if (path === '/api/v1/report/generate' && request.method === 'POST') {
    const body = await readJsonBody(request);
    const profile = body.profile || {};
    const stats = body.stats || {};
    const plan = body.plan || calculateEnrollmentPlan(profile);
    const commentary = body.adminPolishedCommentary && body.adminPolishedCommentary.trim()
      ? body.adminPolishedCommentary.trim()
      : generateMasterCommentary({ profile, stats, plan });

    return reply({
      reportTitle: STUDIO_META.reportTitle,
      sealText: STUDIO_META.sealText,
      watermarkText: STUDIO_META.watermarkText,
      generatedAt: new Date().toISOString().slice(0, 10),
      commentary,
      plan
    });
  }

  // ==================== 二期核心：Cloudflare D1 云端永久存档与多设备同步 ====================
  if (path === '/api/v1/cloud/students' && request.method === 'GET') {
    if (!env.DB) return reply({ d1Enabled: false, students: [] });
    await ensureD1Tables(env.DB);
    const rows = await env.DB.prepare(
      `SELECT student_id, display_alias, stage, grade_label, enrollment_category,
              sprint_sub_type, province, city, target_school_name, target_cutoff_score,
              study_rhythm, cleared_red_count, updated_at
       FROM student_profiles ORDER BY updated_at DESC LIMIT 60`
    ).all();
    return reply({ d1Enabled: true, students: rows?.results || [] });
  }

  if (path === '/api/v1/cloud/student' && request.method === 'GET') {
    if (!env.DB) return reply({ error: 'd1_not_configured', message: '云端数据库未绑定。' }, 503);
    const studentId = String(url.searchParams.get('studentId') || '').trim();
    if (!studentId) return reply({ error: 'missing_student_id' }, 400);
    await ensureD1Tables(env.DB);

    const row = await env.DB.prepare('SELECT * FROM student_profiles WHERE student_id = ?').bind(studentId).first();
    if (!row) return reply({ error: 'student_not_found', message: '未找到该云端学员档案。' }, 404);

    let fullState = {};
    try {
      fullState = JSON.parse(row.workspace_state_json || '{}');
    } catch (_) { fullState = {}; }

    const progRows = await env.DB.prepare(
      'SELECT node_id, planned_count, completed_count, wrong_count, explained_count, consecutive_wrong FROM student_manual_progress WHERE student_id = ?'
    ).bind(studentId).all();
    const dbProgress = {};
    for (const p of (progRows?.results || [])) {
      dbProgress[p.node_id] = {
        planned_count: p.planned_count,
        completed_count: p.completed_count,
        wrong_count: p.wrong_count,
        explained_count: p.explained_count,
        consecutive_wrong: p.consecutive_wrong
      };
    }

    const scoreRows = await env.DB.prepare(
      'SELECT exam_type, exam_name, exam_date, score_obtained, max_score, rank_note FROM school_exam_scores WHERE student_id = ? ORDER BY exam_date ASC, created_at ASC'
    ).bind(studentId).all();
    const dbScores = (scoreRows?.results || []).map(s => ({
      examType: s.exam_type,
      examName: s.exam_name,
      examDate: s.exam_date,
      totalScore: s.score_obtained,
      maxScore: s.max_score,
      rankNote: s.rank_note || ''
    }));

    const repRow = await env.DB.prepare(
      'SELECT admin_polished_commentary FROM planning_reports WHERE student_id = ? ORDER BY updated_at DESC LIMIT 1'
    ).bind(studentId).first();

    let tasks = [];
    try {
      tasks = JSON.parse(row.tasks_json || '[]');
    } catch (_) { tasks = []; }

    const mergedWorkspace = {
      ...fullState,
      studentId: row.student_id,
      wizardDone: true,
      manualStage: fullState.manualStage || row.stage || 'junior',
      manualSubject: fullState.manualSubject || 'math',
      profile: {
        ...(fullState.profile || {}),
        studentName: row.display_alias,
        grade: row.grade_label,
        stage: row.stage,
        enrollmentCategory: row.enrollment_category,
        sprintSubType: row.sprint_sub_type || 'zhongkao',
        growthSubType: row.growth_sub_type || 'advance',
        province: row.province,
        city: row.city || '',
        track: row.subject_track || '物理类',
        targetSchoolName: row.target_school_name || '',
        targetCutoffScore: row.target_cutoff_score ?? fullState.profile?.targetCutoffScore ?? 600,
        localMaxScore: row.local_max_score ?? fullState.profile?.localMaxScore ?? 680,
        baselineScore: row.baseline_score ?? fullState.profile?.baselineScore ?? 500,
        studyRhythm: row.study_rhythm || 'full_time',
        customCycleDays: row.custom_cycle_days || 1,
        availableHoursPerDay: row.available_hours_per_day || 6.5
      },
      progress: Object.keys(dbProgress).length > 0 ? dbProgress : (fullState.progress || {}),
      examScores: dbScores.length > 0 ? dbScores : (fullState.examScores || []),
      tasks: Array.isArray(tasks) && tasks.length > 0 ? tasks : (fullState.tasks || []),
      clearedRedCount: Number(row.cleared_red_count ?? fullState.clearedRedCount ?? 0),
      adminPolishedCommentary: repRow?.admin_polished_commentary || row.admin_commentary || fullState.adminPolishedCommentary || ''
    };

    return reply({
      studentId: row.student_id,
      updatedAt: row.updated_at,
      workspace: mergedWorkspace
    });
  }

  if (path === '/api/v1/cloud/student/save' && request.method === 'POST') {
    if (!env.DB) return reply({ error: 'd1_not_configured', message: '未绑定 Cloudflare D1 数据库。' }, 503);
    await ensureD1Tables(env.DB);
    const body = await readJsonBody(request, 2 * 1024 * 1024);
    const ws = body.workspace || {};
    const p = ws.profile || {};
    const studentId = String(body.studentId || ws.studentId || `stu_${Date.now().toString(36)}`).trim().slice(0, 64);
    const alias = String(p.studentName || '新学员').trim().slice(0, 40);
    const thresholds = ws.thresholds || DEFAULT_TRAFFIC_THRESHOLDS;

    const cleanWsSnapshot = {
      ...ws,
      studentId,
      profile: p,
      thresholds
    };

    await env.DB.prepare(
      `INSERT INTO student_profiles (
        student_id, display_alias, access_role, stage, grade_label, enrollment_category,
        sprint_sub_type, growth_sub_type, province, city, subject_track,
        art_formula_preset, art_culture_weight, art_major_weight, art_major_score, art_major_max,
        target_school_name, target_cutoff_score, local_max_score, baseline_score, required_culture_target,
        advance_span_weeks, target_difficulty, target_mastery_level, study_rhythm,
        custom_cycle_days, available_hours_per_day, cleared_red_count, tasks_json,
        admin_commentary, workspace_state_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(student_id) DO UPDATE SET
        display_alias = excluded.display_alias,
        access_role = excluded.access_role,
        stage = excluded.stage,
        grade_label = excluded.grade_label,
        enrollment_category = excluded.enrollment_category,
        sprint_sub_type = excluded.sprint_sub_type,
        growth_sub_type = excluded.growth_sub_type,
        province = excluded.province,
        city = excluded.city,
        subject_track = excluded.subject_track,
        art_formula_preset = excluded.art_formula_preset,
        art_culture_weight = excluded.art_culture_weight,
        art_major_weight = excluded.art_major_weight,
        art_major_score = excluded.art_major_score,
        art_major_max = excluded.art_major_max,
        target_school_name = excluded.target_school_name,
        target_cutoff_score = excluded.target_cutoff_score,
        local_max_score = excluded.local_max_score,
        baseline_score = excluded.baseline_score,
        required_culture_target = excluded.required_culture_target,
        advance_span_weeks = excluded.advance_span_weeks,
        target_difficulty = excluded.target_difficulty,
        target_mastery_level = excluded.target_mastery_level,
        study_rhythm = excluded.study_rhythm,
        custom_cycle_days = excluded.custom_cycle_days,
        available_hours_per_day = excluded.available_hours_per_day,
        cleared_red_count = excluded.cleared_red_count,
        tasks_json = excluded.tasks_json,
        admin_commentary = excluded.admin_commentary,
        workspace_state_json = excluded.workspace_state_json,
        updated_at = datetime('now')`
    ).bind(
      studentId,
      alias,
      ws.role === 'admin' ? 'admin' : 'student',
      p.stage === 'senior' ? 'senior' : 'junior',
      String(p.grade || '九年级（初三冲刺）'),
      p.enrollmentCategory === 'sync_growth' ? 'sync_growth' : 'graduation_sprint',
      p.sprintSubType || null,
      p.growthSubType || null,
      String(p.province || '湖北省'),
      String(p.city || ''),
      String(p.track || '物理类'),
      p.artFormulaPreset || 'province_default',
      Number(p.artCultureWeight ?? 0.5),
      Number(p.artMajorWeight ?? 0.5),
      Number(p.artMajorScore ?? 0),
      Number(p.artMajorMax ?? 300),
      String(p.targetSchoolName || ''),
      Number(p.targetCutoffScore ?? 0),
      Number(p.localMaxScore ?? 680),
      Number(p.baselineScore ?? 0),
      Number(ws.artCalculation?.requiredCultureTarget ?? ws.plan?.effectiveTargetScore ?? p.targetCutoffScore ?? 0),
      Number(p.advanceSpanWeeks ?? 0),
      String(p.targetDifficulty || '中等'),
      String(p.targetMasteryLevel || '良好'),
      p.studyRhythm === 'part_time' ? 'part_time' : 'full_time',
      Number(p.customCycleDays ?? 1),
      Number(p.availableHoursPerDay ?? 6),
      Number(ws.clearedRedCount ?? 0),
      JSON.stringify(ws.tasks || []),
      String(ws.adminPolishedCommentary || ''),
      JSON.stringify(cleanWsSnapshot)
    ).run();

    // 同步过关进度明细（仅存有记录的节点，支持大批量分块写入）
    const progMap = ws.progress || {};
    const progEntries = Object.entries(progMap).filter(([, v]) =>
      v && ((Number(v.completed_count) || 0) > 0 || (Number(v.wrong_count) || 0) > 0 || (Number(v.explained_count) || 0) > 0 || (Number(v.planned_count) || 5) !== 5)
    );
    await env.DB.prepare('DELETE FROM student_manual_progress WHERE student_id = ?').bind(studentId).run();
    for (let i = 0; i < progEntries.length; i += 60) {
      const slice = progEntries.slice(i, i + 60);
      const batchStmts = slice.map(([nodeId, rawVal]) => {
        const ev = computeTrafficLight(rawVal, thresholds);
        return env.DB.prepare(
          `INSERT INTO student_manual_progress (
            progress_id, student_id, node_id, planned_count, completed_count,
            wrong_count, explained_count, is_passed, consecutive_wrong,
            error_rate, light_status, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          `pr_${studentId}_${nodeId}`,
          studentId,
          nodeId,
          ev.planned_count,
          ev.completed_count,
          ev.wrong_count,
          ev.explained_count,
          ev.is_passed ? 1 : 0,
          ev.consecutive_wrong,
          ev.error_rate,
          ev.light_status
        );
      });
      await env.DB.batch(batchStmts);
    }

    // 同步家长考分记录
    const scores = Array.isArray(ws.examScores) ? ws.examScores : [];
    await env.DB.prepare('DELETE FROM school_exam_scores WHERE student_id = ?').bind(studentId).run();
    if (scores.length > 0) {
      const scoreStmts = scores.slice(0, 80).map((s, idx) => env.DB.prepare(
        `INSERT INTO school_exam_scores (
          score_id, student_id, exam_type, exam_name, exam_date,
          subject_key, score_obtained, max_score, target_score, rank_note, entered_by_role
        ) VALUES (?, ?, ?, ?, ?, 'total', ?, ?, ?, ?, ?)`
      ).bind(
        `sc_${studentId}_${idx}_${Date.now().toString(36)}`,
        studentId,
        String(s.examType || '月考'),
        String(s.examName || '阶段考'),
        String(s.examDate || new Date().toISOString().slice(0, 10)),
        Number(s.totalScore || 0),
        Number(s.maxScore || p.localMaxScore || 680),
        Number(ws.plan?.effectiveTargetScore || p.targetCutoffScore || 0),
        String(s.rankNote || ''),
        ws.role === 'admin' ? 'admin' : 'parent'
      ));
      await env.DB.batch(scoreStmts);
    }

    // 同步规划书润色评语与阈值配置
    const autoComm = generateMasterCommentary({ profile: p, stats: {}, plan: ws.plan || {} });
    await env.DB.prepare(
      `INSERT INTO planning_reports (
        report_id, student_id, report_title, radar_metrics_json,
        battle_summary_json, auto_commentary, admin_polished_commentary, updated_at
      ) VALUES (?, ?, ?, '{}', '{}', ?, ?, datetime('now'))
      ON CONFLICT(report_id) DO UPDATE SET
        auto_commentary = excluded.auto_commentary,
        admin_polished_commentary = excluded.admin_polished_commentary,
        updated_at = datetime('now')`
    ).bind(
      `rep_${studentId}`,
      studentId,
      STUDIO_META.reportTitle,
      autoComm,
      String(ws.adminPolishedCommentary || '')
    ).run();

    await env.DB.prepare(
      `INSERT INTO sys_config_thresholds (config_key, red_error_rate, yellow_error_rate, red_consecutive_wrong, updated_at)
       VALUES ('default', ?, ?, ?, datetime('now'))
       ON CONFLICT(config_key) DO UPDATE SET
         red_error_rate = excluded.red_error_rate,
         yellow_error_rate = excluded.yellow_error_rate,
         red_consecutive_wrong = excluded.red_consecutive_wrong,
         updated_at = datetime('now')`
    ).bind(
      Number(thresholds.redErrorRate ?? 0.4),
      Number(thresholds.yellowErrorRate ?? 0.15),
      Number(thresholds.redConsecutiveWrong ?? 2)
    ).run();

    return reply({
      saved: true,
      studentId,
      savedAt: new Date().toISOString(),
      progressCount: progEntries.length,
      scoresCount: scores.length
    });
  }

  if (path === '/api/v1/cloud/student' && request.method === 'DELETE') {
    if (!env.DB) return reply({ error: 'd1_not_configured' }, 503);
    const studentId = String(url.searchParams.get('studentId') || '').trim();
    if (!studentId) return reply({ error: 'missing_student_id' }, 400);
    await ensureD1Tables(env.DB);
    await env.DB.prepare('DELETE FROM student_profiles WHERE student_id = ?').bind(studentId).run();
    return reply({ deleted: true, studentId });
  }

  // ==================== 二期核心：自助与 AI 智能组卷中心（模块 3） ====================
  if (path === '/api/v1/exams/assemble-manual' && request.method === 'POST') {
    const body = await readJsonBody(request);
    const stage = body.stage === 'junior' ? 'junior' : 'senior';
    const subjectKey = String(body.subjectKey || 'math');
    const d1Questions = await loadApprovedD1Questions(env.DB, stage, subjectKey);
    const result = assembleManualExam({
      stage,
      gradeLabel: body.gradeLabel || '',
      subjectKey,
      selectedNodeIds: body.selectedNodeIds || [],
      counts: body.counts || { basic: 4, medium: 4, hard: 2 },
      examTitle: body.examTitle || '',
      durationMinutes: body.durationMinutes || 90,
      d1Questions
    });
    await saveGeneratedExamToD1(env.DB, result.exam, result.insufficientWarnings, body.studentId || '');
    return reply(result);
  }

  if (path === '/api/v1/exams/assemble-ai' && request.method === 'POST') {
    const body = await readJsonBody(request);
    const promptText = String(body.promptText || '').trim();
    if (!promptText) {
      return reply({ error: 'missing_prompt', message: '请输入一句话组卷要求，例如“高二数学第一学期期中考试试卷，中等偏难”。' }, 400);
    }
    const fallbackStage = body.fallbackStage === 'junior' ? 'junior' : 'senior';
    const fallbackSubjectKey = String(body.fallbackSubjectKey || 'math');
    const aiBinding = (env.AI && env.PAPER_AI_ENABLED === 'true') ? env.AI : null;
    const preStage = /初|七|八|九|中考/.test(promptText) ? 'junior' : (/高|高考|选必/.test(promptText) ? 'senior' : fallbackStage);
    const subjLookup = [['数学', 'math'], ['物理', 'phys'], ['化学', 'chem'], ['语文', 'cn'], ['英语', 'en'], ['政治', 'politics'], ['道法', 'politics'], ['生物', 'bio'], ['历史', 'hist'], ['地理', 'geo']].find(([kw]) => promptText.includes(kw));
    const preSubj = subjLookup ? subjLookup[1] : fallbackSubjectKey;
    const d1Questions = await loadApprovedD1Questions(env.DB, preStage, preSubj);

    const result = await assembleAiExam({
      promptText,
      fallbackStage,
      fallbackSubjectKey,
      aiBinding,
      d1Questions
    });
    await saveGeneratedExamToD1(env.DB, result.exam, result.insufficientWarnings, body.studentId || '');
    return reply(result);
  }

  if (path === '/api/v1/exams/swap-question' && request.method === 'POST') {
    const body = await readJsonBody(request);
    const currentQuestion = body.currentQuestion;
    if (!currentQuestion) return reply({ error: 'missing_question' }, 400);
    const stage = body.stage === 'junior' ? 'junior' : 'senior';
    const subjectKey = String(body.subjectKey || currentQuestion.subjectKey || 'math');
    const d1Questions = await loadApprovedD1Questions(env.DB, stage, subjectKey);
    const swapped = swapExamQuestion({
      stage,
      subjectKey,
      currentQuestion,
      excludeQuestionIds: body.excludeQuestionIds || [],
      d1Questions
    });

    if (body.examId && env.DB) {
      try {
        const row = await env.DB.prepare('SELECT exam_payload_json FROM generated_exams WHERE exam_id = ?').bind(body.examId).first();
        if (row?.exam_payload_json) {
          const parsed = JSON.parse(row.exam_payload_json);
          if (Array.isArray(parsed.questions)) {
            const idx = parsed.questions.findIndex(q => q.qId === currentQuestion.qId && q.no === currentQuestion.no);
            if (idx >= 0) {
              parsed.questions[idx] = swapped;
              await env.DB.prepare(
                'UPDATE generated_exams SET question_ids_json = ?, exam_payload_json = ? WHERE exam_id = ?'
              ).bind(
                JSON.stringify(parsed.questions.map(q => q.qId)),
                JSON.stringify(parsed),
                body.examId
              ).run();
            }
          }
        }
      } catch (_) { /* ignore swap persistence failure */ }
    }

    return reply({ question: swapped });
  }

  if (path === '/api/v1/exams/list' && request.method === 'GET') {
    if (!env.DB) return reply({ exams: [] });
    await ensureD1Tables(env.DB);
    const rows = await env.DB.prepare(
      'SELECT exam_id, student_id, title, mode, stage, subject_key, grade_label, total_score, duration_minutes, created_at FROM generated_exams ORDER BY created_at DESC LIMIT 30'
    ).all();
    return reply({ exams: rows?.results || [] });
  }

  if (path === '/api/v1/exams/detail' && request.method === 'GET') {
    if (!env.DB) return reply({ error: 'd1_not_configured' }, 503);
    const examId = String(url.searchParams.get('examId') || '').trim();
    if (!examId) return reply({ error: 'missing_exam_id' }, 400);
    await ensureD1Tables(env.DB);
    const row = await env.DB.prepare('SELECT exam_payload_json, insufficient_warnings_json FROM generated_exams WHERE exam_id = ?').bind(examId).first();
    if (!row) return reply({ error: 'exam_not_found' }, 404);
    return reply({
      exam: JSON.parse(row.exam_payload_json || '{}'),
      insufficientWarnings: JSON.parse(row.insufficient_warnings_json || '[]')
    });
  }

  return reply({ error: 'not_found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/paper/status') {
      return reply({
        available: enabled(env),
        model: MODEL,
        requiresAccessCode: true,
        localPreviewAllowed: isLocalhost(url) && !env.PAPER_ACCESS_CODE,
        message: enabled(env)
          ? '仅提取印刷题干结构，所有结果须教师人工复核。'
          : '网站内识图 AI 服务尚未启用，可先使用离线结构录入或手工打卡。'
      });
    }

    if (url.pathname === '/api/paper/analyze') {
      return handlePaperAnalyze(request, env, url);
    }

    if (url.pathname.startsWith('/api/v1/')) {
      try {
        return await handleApiV1(request, env, url);
      } catch (err) {
        return reply({ error: err.message || 'server_error' }, err.status || 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
