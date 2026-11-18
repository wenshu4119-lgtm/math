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
