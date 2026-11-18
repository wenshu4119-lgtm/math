// 许老师工作室 / 铭师学习规划管理平台 (mrxu.uk)
// 第一期核心前端交互逻辑：版权三道锁、入学建档向导、清爽三步走、红黄绿灯消灯闭环与精装报告输出
// 严禁在前端源码硬编码地区分数线或 16 学科题型目录；所有受保护数据经由 /api/v1/* 验证访问码后加载。

(() => {
  'use strict';

  const STORAGE_KEY = 'mxu_workspace_state_v1';
  const SESSION_CODE_KEY = 'mxu_session_access_code';
  const SESSION_ROLE_KEY = 'mxu_session_role';
  const WATERMARK_TEXT = '许老师工作室 / 铭师学习规划原创 · 盗版必究';

  const DEFAULT_STATE = {
    studentId: '',
    role: 'student',
    wizardDone: false,
    wizardStep: 1,
    activeView: 'viewStep1',
    manualStage: 'junior',
    manualSubject: 'math',
    profile: {
      studentName: '新学员01',
      grade: '九年级（初三冲刺）',
      stage: 'junior',
      enrollmentCategory: 'graduation_sprint',
      sprintSubType: 'zhongkao',
      province: '湖北省',
      city: '武汉市',
      track: '物理类',
      targetSchoolName: '湖北省武昌实验中学',
      localMaxScore: 680,
      targetCutoffScore: 618,
      baselineScore: 530,
      artFormulaPreset: 'province_default',
      artCultureWeight: 0.5,
      artMajorWeight: 0.5,
      artMajorMax: 300,
      artMajorScore: 238,
      growthSubType: 'advance',
      advanceSpanWeeks: 8,
      targetDifficulty: '中等',
      targetMasteryLevel: '良好',
      currentChapterNote: '期中阶段核心章节梳理',
      studyRhythm: 'full_time',
      customCycleDays: 1,
      availableHoursPerDay: 6.5
    },
    plan: null,
    artCalculation: null,
    thresholds: {
      redErrorRate: 0.40,
      yellowErrorRate: 0.15,
      redConsecutiveWrong: 2
    },
    progress: {},
    tasks: [],
    examScores: [],
    clearedRedCount: 0,
    adminPolishedCommentary: ''
  };

  let state = loadSavedState();
  let accessCode = sessionStorage.getItem(SESSION_CODE_KEY) || '';
  let bootstrap = null;
  let paperDraft = null;
  let currentPack = null;
  let currentExam = null;
  let currentExamWarnings = [];
  let examViewMode = 'student';
  let walletSummary = null;
  let ingestPreviewItems = [];
  let cloudSyncTimer = null;
  let trendChartInstance = null;
  let radarChartInstance = null;
  const openChapterIds = new Set();

  const $ = id => document.getElementById(id);

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return deepClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      return {
        ...deepClone(DEFAULT_STATE),
        ...parsed,
        profile: { ...DEFAULT_STATE.profile, ...(parsed.profile || {}) },
        thresholds: { ...DEFAULT_STATE.thresholds, ...(parsed.thresholds || {}) }
      };
    } catch (_) {
      return deepClone(DEFAULT_STATE);
    }
  }

  function saveState(triggerCloud = true) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) { /* ignore quota errors */ }
    if (triggerCloud && accessCode && bootstrap?.d1Enabled && state.wizardDone) {
      scheduleCloudSync();
    }
  }

  function setCloudBadge(text, ok = true) {
    const el = $('cloudSyncStatusBadge');
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? '#DDF3E6' : '#FDE68A';
  }

  function scheduleCloudSync() {
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    setCloudBadge('待同步...');
    cloudSyncTimer = setTimeout(() => {
      syncToCloudNow(true);
    }, 1500);
  }

  async function loadCloudStudentsList() {
    const sel = $('cloudStudentSelect');
    if (!sel || !accessCode) return;
    try {
      const res = await apiFetch('/api/v1/cloud/students');
      if (!res.d1Enabled) {
        setCloudBadge('本地存储模式', false);
        return;
      }
      const list = res.students || [];
      const currentOption = state.studentId ? '' : '<option value="">当前本地新建学员（未上云）</option>';
      const opts = list.map(s =>
        `<option value="${escapeHtml(s.student_id)}">${escapeHtml(s.display_alias)} · ${escapeHtml(s.grade_label)} (${escapeHtml(s.province || '')})</option>`
      ).join('');
      sel.innerHTML = currentOption + opts || '<option value="">暂无云端学员，建档后自动上云</option>';
      if (state.studentId && list.some(s => s.student_id === state.studentId)) {
        sel.value = state.studentId;
      }
      setCloudBadge(`云端 ${list.length} 档案`);
    } catch (_) {
      setCloudBadge('云端离线', false);
    }
  }

  async function syncToCloudNow(silent = false) {
    if (!accessCode || !bootstrap?.d1Enabled) {
      if (!silent) alert('当前环境未启用 Cloudflare D1 云端数据库，仅保留在本地浏览器。');
      return;
    }
    if (!state.studentId) {
      state.studentId = 'stu_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    }
    setCloudBadge('同步中...');
    try {
      const res = await apiFetch('/api/v1/cloud/student/save', {
        method: 'POST',
        body: JSON.stringify({
          studentId: state.studentId,
          workspace: state
        })
      });
      state.studentId = res.studentId;
      saveState(false);
      await loadCloudStudentsList();
      setCloudBadge('已云端同步 ✓');
      if (!silent) alert(`档案已安全保存至 Cloudflare D1 云端数据库！\n学员编号：${res.studentId}\n已同步过关节点：${res.progressCount} 项，考分记录：${res.scoresCount} 条。`);
    } catch (err) {
      setCloudBadge('同步失败', false);
      if (!silent) alert(`云端保存失败：${err.message}`);
    }
  }

  async function switchCloudStudent(studentId) {
    if (!studentId) return;
    setCloudBadge('拉取中...');
    try {
      const res = await apiFetch(`/api/v1/cloud/student?studentId=${encodeURIComponent(studentId)}`);
      if (!res?.workspace) throw new Error('云端返回档案为空');
      const keepRole = state.role;
      state = {
        ...deepClone(DEFAULT_STATE),
        ...res.workspace,
        role: keepRole,
        studentId: res.studentId,
        profile: { ...DEFAULT_STATE.profile, ...(res.workspace.profile || {}) },
        thresholds: { ...DEFAULT_STATE.thresholds, ...(res.workspace.thresholds || {}) }
      };
      openChapterIds.clear();
      saveState(false);
      enterMainWorkspace(true);
      setCloudBadge('已切换云端档案 ✓');
    } catch (err) {
      setCloudBadge('切换失败', false);
      alert(`读取云端档案失败：${err.message}`);
    }
  }

  function createNewStudentArchive() {
    const keepRole = state.role;
    state = {
      ...deepClone(DEFAULT_STATE),
      role: keepRole,
      studentId: 'stu_' + Date.now().toString(36),
      wizardDone: false,
      wizardStep: 1
    };
    openChapterIds.clear();
    saveState(false);
    enterMainWorkspace(true);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==================== 版权锁 2 & 3：水印叠加 + 禁右键/禁复制 ====================
  function installAntiTheftLocks() {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="380" height="240">
        <g transform="rotate(-24 190 120)">
          <text x="16" y="128" font-family="PingFang SC, Microsoft YaHei, sans-serif"
            font-size="14" font-weight="700" fill="#1B365D" fill-opacity="0.72">
            ${WATERMARK_TEXT}
          </text>
        </g>
      </svg>
    `.trim();
    const overlay = $('watermarkOverlay');
    if (overlay) {
      overlay.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
    }

    const isProtectedTarget = target => {
      if (!target || typeof target.closest !== 'function') return false;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'OPTION'].includes(target.tagName)) return false;
      return Boolean(target.closest('.anti-theft-protected'));
    };

    document.addEventListener('contextmenu', e => {
      if (isProtectedTarget(e.target)) e.preventDefault();
    });
    document.addEventListener('copy', e => {
      if (isProtectedTarget(e.target)) e.preventDefault();
    });
    document.addEventListener('cut', e => {
      if (isProtectedTarget(e.target)) e.preventDefault();
    });
    document.addEventListener('selectstart', e => {
      if (isProtectedTarget(e.target)) e.preventDefault();
    });
  }

  // ==================== API 请求封装 ====================
  async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (accessCode) headers.set('X-Paper-Access-Code', accessCode);
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(path, { ...options, headers });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }
    if (!res.ok) {
      const err = new Error(data.message || data.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ==================== 版权锁 1：鉴权与启动加载 ====================
  async function checkAuthStatus() {
    const localBox = $('localPreviewNotice');
    const fillBtn = $('fillLocalCodeBtn');

    try {
      const status = await apiFetch('/api/v1/auth/status');
      if (status.localPreviewAllowed && status.localPreviewCodeHint) {
        localBox.textContent = `检测到本地调试模式且未设定 .dev.vars 访问码，本地预览访问码为：${status.localPreviewCodeHint}`;
        localBox.classList.remove('hidden');
        fillBtn.classList.remove('hidden');
        fillBtn.dataset.hint = status.localPreviewCodeHint;
      }

      if (accessCode) {
        const savedRole = sessionStorage.getItem(SESSION_ROLE_KEY) || state.role || 'student';
        await unlockAndBootstrap(accessCode, savedRole, true);
      }
    } catch (_) {
      localBox.textContent = '未检测到 Cloudflare Worker 后端接口（若您正在使用纯静态预览服务器，请改用 npx wrangler dev 启动完整本地环境或访问 mrxu.uk）。';
      localBox.classList.remove('hidden');
    }
  }

  async function unlockAndBootstrap(code, role, silent = false) {
    const errBox = $('authErrorBox');
    errBox.classList.add('hidden');
    if (!code) {
      if (!silent) {
        errBox.textContent = '请输入授权访问码。';
        errBox.classList.remove('hidden');
      }
      return;
    }

    accessCode = code.trim();
    try {
      const verified = await apiFetch('/api/v1/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ accessCode, role })
      });
      sessionStorage.setItem(SESSION_CODE_KEY, accessCode);
      sessionStorage.setItem(SESSION_ROLE_KEY, verified.role || role);
      state.role = verified.role === 'admin' ? 'admin' : 'student';

      bootstrap = await apiFetch('/api/v1/bootstrap');
      if (bootstrap.thresholds && !localStorage.getItem(STORAGE_KEY)) {
        state.thresholds = { ...bootstrap.thresholds };
      }

      saveState();
      enterMainWorkspace();
    } catch (err) {
      accessCode = '';
      sessionStorage.removeItem(SESSION_CODE_KEY);
      if (!silent) {
        errBox.textContent = err.message || '授权码验证失败，请核对后重试。';
        errBox.classList.remove('hidden');
      }
    }
  }

  function lockApplication() {
    accessCode = '';
    bootstrap = null;
    sessionStorage.removeItem(SESSION_CODE_KEY);
    $('authGate').classList.remove('hidden');
    $('mainApp').classList.add('hidden');
    $('headerControls').classList.add('hidden');
    $('watermarkOverlay').classList.add('hidden');
    $('accessCodeInput').value = '';
  }

  function enterMainWorkspace(skipCloudList = false) {
    $('authGate').classList.add('hidden');
    $('mainApp').classList.remove('hidden');
    $('headerControls').classList.remove('hidden');
    $('watermarkOverlay').classList.remove('hidden');

    syncRoleUI();
    initWizardFromState();
    populatePaperSubjectHints();

    if (!state.wizardDone) {
      openWizard(false);
      renderStep1Tasks();
    } else {
      $('wizardSection').classList.add('hidden');
      $('mainNavBar').classList.remove('hidden');
      switchMainView(state.activeView || 'viewStep1');
    }
    updateHeaderPill();
    loadWalletSummary();
    try {
      const refParam = new URLSearchParams(window.location.search).get('ref');
      if (refParam && $('bindFriendCodeInput') && !$('bindFriendCodeInput').value) {
        $('bindFriendCodeInput').value = refParam.toUpperCase();
      }
    } catch (_) { /* ignore */ }
    if (!skipCloudList) loadCloudStudentsList();
  }

  function syncRoleUI() {
    const isAdmin = state.role === 'admin';
    $('roleStudentBtn').classList.toggle('active', !isAdmin);
    $('roleAdminBtn').classList.toggle('active', isAdmin);
    $('adminThresholdPanel').classList.toggle('hidden', !isAdmin);
    $('adminRefreshCutoffsBtn').classList.toggle('hidden', !isAdmin);
    $('adminEditCommentaryBtn').classList.toggle('hidden', !isAdmin);
    if (!isAdmin) $('adminCommentaryPanel').classList.add('hidden');

    $('thRedRateInput').value = Math.round((state.thresholds.redErrorRate ?? 0.4) * 100);
    $('thConsecutiveWrongInput').value = state.thresholds.redConsecutiveWrong ?? 2;
    $('thYellowRateInput').value = Math.round((state.thresholds.yellowErrorRate ?? 0.15) * 100);
  }

  function updateHeaderPill() {
    const p = state.profile;
    const targetText = p.enrollmentCategory === 'graduation_sprint'
      ? `${p.province}${p.city ? '·' + p.city : ''} | 目标 ${p.targetCutoffScore}分`
      : `非毕业成长 · ${p.targetDifficulty}/${p.targetMasteryLevel}`;
    const rhythm = p.studyRhythm === 'full_time' ? '全脱产每日' : `非脱产${p.customCycleDays || 7}天周期`;
    $('activeProfilePill').textContent = `${p.studentName || '学员'} · ${p.grade} · ${targetText} · ${rhythm}`;
  }

  // ==================== 模块 1：入学建档向导（地区精准匹配 + 目标倒推） ====================
  function openWizard(canClose = true) {
    $('wizardSection').classList.remove('hidden');
    $('closeWizardBtn').classList.toggle('hidden', !canClose && !state.wizardDone);
    setWizardStep(1);
  }

  function setWizardStep(step) {
    state.wizardStep = step;
    [1, 2, 3].forEach(n => {
      const ind = $('wizInd' + n);
      const pane = $('wizPane' + n);
      ind.classList.remove('active', 'done');
      if (n < step) ind.classList.add('done');
      else if (n === step) ind.classList.add('active');
      pane.classList.toggle('hidden', n !== step);
    });
  }

  function initWizardFromState() {
    const p = state.profile;
    $('stuNameInput').value = p.studentName || '';
    $('stuGradeSelect').value = p.grade || '九年级（初三冲刺）';

    document.querySelectorAll('#wizPane1 [data-category]').forEach(el => {
      el.classList.toggle('selected', el.dataset.category === p.enrollmentCategory);
    });
    toggleCategoryPanels();

    $('sprintSubTypeSelect').value = p.sprintSubType || 'zhongkao';
    initSprintRegionSelectors();

    $('localMaxScoreInput').value = p.localMaxScore || 680;
    $('targetCutoffScoreInput').value = p.targetCutoffScore || 618;
    $('baselineScoreInput').value = p.baselineScore || 530;

    $('artMajorMaxInput').value = p.artMajorMax || 300;
    $('artMajorScoreInput').value = p.artMajorScore || 238;
    $('artTargetCombinedInput').value = p.targetCutoffScore || 545;
    $('artCultureWeightInput').value = p.artCultureWeight || 0.5;
    $('artMajorWeightInput').value = p.artMajorWeight || 0.5;

    document.querySelectorAll('#syncConfigPanel [data-growth]').forEach(el => {
      el.classList.toggle('selected', el.dataset.growth === p.growthSubType);
    });
    $('syncSpanSelect').value = String(p.advanceSpanWeeks || 8);
    $('syncDifficultySelect').value = p.targetDifficulty || '中等';
    $('syncTargetGradeSelect').value = p.targetMasteryLevel || '良好';
    $('syncCurrentChapterInput').value = p.currentChapterNote || '';

    document.querySelectorAll('#wizPane3 [data-rhythm]').forEach(el => {
      el.classList.toggle('selected', el.dataset.rhythm === p.studyRhythm);
    });
    $('hoursPerDayInput').value = p.availableHoursPerDay || 6.5;
    $('cycleDaysSelect').value = String(p.customCycleDays || (p.studyRhythm === 'full_time' ? 1 : 7));
  }

  function toggleCategoryPanels() {
    const isSprint = state.profile.enrollmentCategory === 'graduation_sprint';
    $('sprintConfigPanel').classList.toggle('hidden', !isSprint);
    $('syncConfigPanel').classList.toggle('hidden', isSprint);
  }

  function initSprintRegionSelectors() {
    if (!bootstrap?.regions) return;
    const subType = $('sprintSubTypeSelect').value;
    state.profile.sprintSubType = subType;

    $('zkCityGroup').classList.toggle('hidden', subType !== 'zhongkao');
    $('gkTrackGroup').classList.toggle('hidden', subType !== 'gaokao_culture');
    $('artConfigBox').classList.toggle('hidden', subType !== 'gaokao_art');
    $('targetCutoffLabel').textContent = subType === 'gaokao_art'
      ? '目标院校综合分投档线（可手动改）'
      : '目标校近三年平均线（可手动改）';

    const provSelect = $('sprintProvinceSelect');
    let provinces = [];
    if (subType === 'zhongkao') {
      provinces = Object.keys(bootstrap.regions.zhongkao || {});
    } else {
      const gkProvs = Object.keys(bootstrap.regions.gaokaoProvinces || {});
      const artProvs = Object.keys(bootstrap.regions.artProvinceFormulas || {});
      provinces = Array.from(new Set([...gkProvs, ...artProvs]));
    }

    const currentProv = provinces.includes(state.profile.province) ? state.profile.province : provinces[0];
    state.profile.province = currentProv;
    provSelect.innerHTML = provinces.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
    provSelect.value = currentProv;

    if (subType === 'gaokao_art') {
      const ratioSelect = $('artRatioPresetSelect');
      const presets = bootstrap.regions.artPresetRatios || {};
      ratioSelect.innerHTML = Object.entries(presets)
        .map(([k, v]) => `<option value="${escapeHtml(k)}">${escapeHtml(v.label)}</option>`).join('');
      ratioSelect.value = state.profile.artFormulaPreset || 'province_default';
      $('artCustomWeightsWrap').classList.toggle('hidden', ratioSelect.value !== 'custom');
    }

    onProvinceChanged(false);
  }

  async function onProvinceChanged(userChanged = true) {
    if (!bootstrap?.regions) return;
    const subType = $('sprintSubTypeSelect').value;
    const prov = $('sprintProvinceSelect').value;
    state.profile.province = prov;

    if (subType === 'zhongkao') {
      const citiesObj = bootstrap.regions.zhongkao[prov]?.cities || {};
      const cityNames = Object.keys(citiesObj);
      const targetCity = cityNames.includes(state.profile.city) && !userChanged ? state.profile.city : cityNames[0];
      state.profile.city = targetCity || '';
      $('sprintCitySelect').innerHTML = cityNames.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
      $('sprintCitySelect').value = state.profile.city;
    } else if (subType === 'gaokao_culture') {
      const tracks = bootstrap.regions.gaokaoProvinces[prov]?.tracks || ['物理类', '历史类'];
      const targetTrack = tracks.includes(state.profile.track) && !userChanged ? state.profile.track : tracks[0];
      state.profile.track = targetTrack;
      $('sprintTrackSelect').innerHTML = tracks.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
      $('sprintTrackSelect').value = state.profile.track;
    }

    await fetchRegionalSchools();
  }

  async function fetchRegionalSchools() {
    const subType = $('sprintSubTypeSelect').value;
    const province = $('sprintProvinceSelect').value;
    const city = $('sprintCitySelect').value || '';
    const track = $('sprintTrackSelect').value || '物理类';

    state.profile.city = city;
    state.profile.track = track;

    try {
      const data = await apiFetch('/api/v1/regions/schools', {
        method: 'POST',
        body: JSON.stringify({ sprintSubType: subType, province, city, track })
      });

      const schoolSel = $('targetSchoolSelect');
      const schools = data.schools || [];
      schoolSel.innerHTML = schools.map((s, idx) => {
        const refScore = subType === 'gaokao_art' ? s.avgCombined : s.avg;
        return `<option value="${idx}">${escapeHtml(s.name)}（${escapeHtml(s.tier)} · 参考线 ${refScore}分）</option>`;
      }).join('');
      schoolSel.dataset.schools = JSON.stringify(schools);

      if (data.localMaxScore) {
        $('localMaxScoreInput').value = data.localMaxScore;
        state.profile.localMaxScore = Number(data.localMaxScore);
      }

      if (schools.length > 0) {
        const idx = Math.max(0, schools.findIndex(s => s.name === state.profile.targetSchoolName));
        schoolSel.value = String(idx);
        applySelectedSchool(schools[idx], data.note || data.formula?.label || '');
      } else {
        $('cutoffSourceNote').textContent = data.note || '当前地区未预置学校清单，请直接在上方检索或下方手动录入满分与录取线。';
      }

      if (subType === 'gaokao_art') {
        updateArtCalculationPreview();
      }
    } catch (err) {
      $('cutoffSourceNote').textContent = `地区参考线读取提示：${err.message}`;
    }
  }

  function applySelectedSchool(school, extraNote = '') {
    if (!school) return;
    const subType = $('sprintSubTypeSelect').value;
    state.profile.targetSchoolName = school.name;

    if (subType === 'gaokao_art') {
      const combined = Number(school.avgCombined || 540);
      $('artTargetCombinedInput').value = combined;
      $('targetCutoffScoreInput').value = combined;
      state.profile.targetCutoffScore = combined;
      $('cutoffSourceNote').innerHTML = `<strong>${escapeHtml(school.name)}</strong>（${escapeHtml(school.tier)}）：近三年综合分参照约 <strong>${combined} 分</strong>（参考纯文化最低控制约 ${school.cultureFloor || '--'} 分）。${escapeHtml(extraNote)}`;
      updateArtCalculationPreview();
    } else {
      const avg = Number(school.avg || 580);
      $('targetCutoffScoreInput').value = avg;
      state.profile.targetCutoffScore = avg;
      const threeYr = school.y1 ? `前3年：${school.y1} / ${school.y2} / ${school.y3} 分，均值 ${avg} 分` : `均值 ${avg} 分`;
      $('cutoffSourceNote').innerHTML = `<strong>${escapeHtml(school.name)}</strong>（${escapeHtml(school.tier)}）：${threeYr}。${escapeHtml(extraNote)}（如与本地当年政策有微差，直接在下方黄金校正框修改即可）`;
    }
  }

  async function lookupUnlistedSchoolCutoff() {
    const schoolName = $('customSchoolNameInput').value.trim();
    if (!schoolName) {
      $('cutoffSourceNote').textContent = '请先输入要查询的县市高中或目标院校名称。';
      return;
    }
    const btn = $('aiLookupCutoffBtn');
    btn.disabled = true;
    btn.textContent = '检索中...';
    try {
      const subType = $('sprintSubTypeSelect').value;
      const res = await apiFetch('/api/v1/ai/cutoff-lookup', {
        method: 'POST',
        body: JSON.stringify({
          examType: subType === 'zhongkao' ? 'zhongkao' : 'gaokao',
          province: $('sprintProvinceSelect').value,
          city: $('sprintCitySelect').value || '',
          track: $('sprintTrackSelect').value || '物理类',
          schoolName
        })
      });
      state.profile.targetSchoolName = res.name;
      $('localMaxScoreInput').value = res.localMaxScore;
      $('targetCutoffScoreInput').value = res.avg;
      if (subType === 'gaokao_art') $('artTargetCombinedInput').value = res.avg;

      $('cutoffSourceNote').innerHTML = `<strong>${escapeHtml(res.name)}</strong>（${res.needsReview ? '<span style="color:var(--red)">参照估算 · 需人工核对</span>' : '库内精确命中'}）：参考均值 <strong>${res.avg} 分</strong>（近3年估算 ${res.y1}/${res.y2}/${res.y3}，满分 ${res.localMaxScore}）。${escapeHtml(res.note)}`;
      if (subType === 'gaokao_art') updateArtCalculationPreview();
    } catch (err) {
      $('cutoffSourceNote').textContent = `检索失败：${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'AI 尝试检索参考线';
    }
  }

  function updateArtCalculationPreview() {
    if (!bootstrap?.regions) return;
    const province = $('sprintProvinceSelect').value;
    const preset = $('artRatioPresetSelect').value;
    $('artCustomWeightsWrap').classList.toggle('hidden', preset !== 'custom');

    const provRule = bootstrap.regions.artProvinceFormulas[province] || { cultureWeight: 0.5, majorWeight: 0.5, cultureMax: 750 };
    const cMax = Number($('localMaxScoreInput').value) || provRule.cultureMax || 750;
    const mMax = Number($('artMajorMaxInput').value) || 300;
    const mScore = Math.max(0, Math.min(mMax, Number($('artMajorScoreInput').value) || 0));
    const combinedTarget = Number($('artTargetCombinedInput').value) || Number($('targetCutoffScoreInput').value) || 540;
    $('targetCutoffScoreInput').value = combinedTarget;

    let wC = provRule.cultureWeight;
    let wM = provRule.majorWeight;
    if (preset === '50_50') { wC = 0.5; wM = 0.5; }
    else if (preset === '60_40') { wC = 0.6; wM = 0.4; }
    else if (preset === '40_60') { wC = 0.4; wM = 0.6; }
    else if (preset === 'custom') {
      const rC = Math.max(0.1, Number($('artCultureWeightInput').value) || 0.5);
      const rM = Math.max(0.1, Number($('artMajorWeightInput').value) || 0.5);
      wC = rC / (rC + rM);
      wM = rM / (rC + rM);
    }

    const majorConv = (mScore / mMax) * cMax;
    const majorContrib = majorConv * wM;
    const reqCulture = Math.max(0, Math.min(cMax, Math.ceil((combinedTarget - majorContrib) / wC)));
    const pctC = Math.round(wC * 100);
    const pctM = Math.round(wM * 100);

    $('artFormulaResultBox').innerHTML = `
      <strong>公式匹配：</strong>${escapeHtml(provRule.label || province + '艺考综合分')}<br>
      当前权重：文化 <strong>${pctC}%</strong> + 专业 <strong>${pctM}%</strong> | 专业课折算贡献：<strong>${majorContrib.toFixed(1)} 分</strong><br>
      🎯 <strong>自动倒推文化课最低目标分：${reqCulture} 分</strong>（目标综合分 ${combinedTarget} - 专业贡献 ${majorContrib.toFixed(1)}）÷ ${pctC}%
    `;
  }

  function collectProfileFromWizard() {
    const grade = $('stuGradeSelect').value;
    const isJuniorGrade = /七年级|八年级|九年级|初/.test(grade);
    const cat = state.profile.enrollmentCategory;
    const subType = $('sprintSubTypeSelect').value;

    const stage = (cat === 'graduation_sprint' && subType === 'zhongkao')
      ? 'junior'
      : ((cat === 'graduation_sprint' && subType.startsWith('gaokao')) ? 'senior' : (isJuniorGrade ? 'junior' : 'senior'));

    const p = {
      ...state.profile,
      studentName: $('stuNameInput').value.trim() || '铭师学员',
      grade,
      stage,
      sprintSubType: subType,
      province: $('sprintProvinceSelect').value || '湖北省',
      city: $('sprintCitySelect').value || '',
      track: $('sprintTrackSelect').value || '物理类',
      localMaxScore: Number($('localMaxScoreInput').value) || (stage === 'junior' ? 680 : 750),
      targetCutoffScore: Number(subType === 'gaokao_art' ? $('artTargetCombinedInput').value : $('targetCutoffScoreInput').value) || 600,
      baselineScore: Number($('baselineScoreInput').value) || 500,
      artFormulaPreset: $('artRatioPresetSelect').value || 'province_default',
      artCultureWeight: Number($('artCultureWeightInput').value) || 0.5,
      artMajorWeight: Number($('artMajorWeightInput').value) || 0.5,
      artMajorMax: Number($('artMajorMaxInput').value) || 300,
      artMajorScore: Number($('artMajorScoreInput').value) || 238,
      advanceSpanWeeks: Number($('syncSpanSelect').value) || 8,
      targetDifficulty: $('syncDifficultySelect').value || '中等',
      targetMasteryLevel: $('syncTargetGradeSelect').value || '良好',
      currentChapterNote: $('syncCurrentChapterInput').value.trim() || '同步章节跟进',
      customCycleDays: Number($('cycleDaysSelect').value) || 1,
      availableHoursPerDay: Number($('hoursPerDayInput').value) || 4
    };
    state.profile = p;
    state.manualStage = stage;
    if (bootstrap?.subjectOrder?.[stage]) {
      const validKeys = bootstrap.subjectOrder[stage].map(x => x.key);
      if (!validKeys.includes(state.manualSubject)) {
        state.manualSubject = validKeys.includes('math') ? 'math' : validKeys[0];
      }
    }
    return p;
  }

  async function calculateAndSaveWizard(finalize = false) {
    const profile = collectProfileFromWizard();
    try {
      const res = await apiFetch('/api/v1/profile/calculate', {
        method: 'POST',
        body: JSON.stringify(profile)
      });
      state.plan = res.plan;
      state.artCalculation = res.artCalculation;

      const p = state.plan;
      const previewHtml = `
        <div><strong>提分差距测算：</strong>当前起步基准 <strong>${p.baselineScore}</strong> 分 → 文化目标线 <strong>${p.effectiveTargetScore}</strong> 分（待提空间 <strong style="color:var(--red)">${p.scoreGap} 分</strong>，预计周期约 ${p.estimatedWeeksToTarget} 周）</div>
        <div style="margin-top:6px;"><strong>排期与提醒机制：</strong>${escapeHtml(p.reminderMode)}</div>
        <div style="margin-top:6px;"><strong>首发核心任务（${p.dailyTasks.length} 项）：</strong>${p.dailyTasks.map(t => escapeHtml(t.title)).join('；')}</div>
      `;
      $('wizardPlanPreviewBox').innerHTML = previewHtml;

      if (finalize) {
        state.wizardDone = true;
        state.tasks = p.dailyTasks.map(t => ({ ...t, done: false }));
        saveState(false);
        updateHeaderPill();
        $('wizardSection').classList.add('hidden');
        $('mainNavBar').classList.remove('hidden');
        switchMainView('viewStep1');
        syncToCloudNow(true);
      } else {
        saveState();
      }
    } catch (err) {
      $('wizardPlanPreviewBox').textContent = `测算失败：${err.message}`;
    }
  }

  // ==================== 导航与视图切换 ====================
  function switchMainView(viewId) {
    state.activeView = viewId;
    saveState(false);

    const views = ['viewStep1', 'viewStep2', 'viewStep3', 'viewPhase2Preview', 'viewPhase3Preview', 'viewAdminConsole'];
    views.forEach(id => $(id).classList.toggle('hidden', id !== viewId));

    document.querySelectorAll('.step-tab, .sub-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    if (viewId === 'viewStep1') renderStep1Tasks();
    if (viewId === 'viewStep2') renderStep2Manual();
    if (viewId === 'viewStep3') renderStep3ArchiveAndReport();
    if (viewId === 'viewPhase2Preview') initExamCenterView();
    if (viewId === 'viewPhase3Preview') initWalletView();
    if (viewId === 'viewAdminConsole') initAdminConsoleView();
  }

  // ==================== 第 1 步：今日任务 & 拍卷测漏 ====================
  function renderStep1Tasks() {
    const p = state.profile;
    const isFull = p.studyRhythm === 'full_time';
    $('rhythmModeBadge').textContent = isFull ? '全脱产 · 每日提醒' : `非脱产 · 每${p.customCycleDays || 7}天周期`;
    $('rhythmReminderBanner').innerHTML = state.plan?.reminderMode
      ? escapeHtml(state.plan.reminderMode)
      : '提示：建议每日打卡完成后前往【第 2 步：考点过关手册】查看红色红灯预警项。';

    const listEl = $('dailyTaskList');
    if (!state.tasks.length) {
      listEl.innerHTML = '<div style="color:var(--muted); font-size:13px; padding:12px 0;">暂无排期任务，可在上方向导重新生成或手动添加。</div>';
    } else {
      listEl.innerHTML = state.tasks.map((t, idx) => `
        <div class="task-item ${t.done ? 'done' : ''}">
          <label style="display:flex; gap:10px; align-items:flex-start; cursor:pointer; flex:1;">
            <input type="checkbox" data-task-idx="${idx}" ${t.done ? 'checked' : ''} style="margin-top:4px;">
            <div>
              <div style="font-weight:600; color:var(--primary);">${escapeHtml(t.title)}</div>
              <div style="font-size:12px; color:var(--muted); margin-top:2px;">预计时长：${escapeHtml(t.duration || '35 分钟')} · 优先级：${escapeHtml(t.priority || '必做')}</div>
            </div>
          </label>
          <span class="badge ${t.done ? 'badge-green' : 'badge-navy'}">${t.done ? '已完成' : '待打卡'}</span>
        </div>
      `).join('');
    }
    const doneCount = state.tasks.filter(t => t.done).length;
    $('taskProgressBadge').textContent = `${doneCount} / ${state.tasks.length}`;
  }

  function populatePaperSubjectHints() {
    if (!bootstrap?.subjectOrder) return;
    const stage = $('paperStageSelect').value || state.manualStage;
    const list = bootstrap.subjectOrder[stage] || [];
    $('paperSubjectHintSelect').innerHTML = '<option value="auto">自动识别学科</option>' +
      list.map(s => `<option value="${escapeHtml(s.key)}">${escapeHtml(s.label)}</option>`).join('');
  }

  async function compressExamImage(file) {
    const imgUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('无法解码所选图片，请更换清晰的 JPG/PNG 照片。'));
        el.src = imgUrl;
      });
      const maxEdge = 2000;
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      let dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      if (dataUrl.length > 2700000) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.68);
      }
      if (dataUrl.length > 2800000) {
        throw new Error('图片压缩后仍超出 2MB 上限，请裁切单页后上传。');
      }
      return dataUrl;
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  }

  async function analyzeSelectedPaper() {
    if (!$('paperConsentCheck').checked) {
      alert('请先勾选确认已遮挡学生姓名、学校与手写隐私痕迹。');
      return;
    }
    const file = $('paperFileInput').files?.[0];
    if (!file) {
      alert('请先点击上传区选择一张试卷照片（或点击右侧示例演练按钮）。');
      return;
    }

    const btn = $('analyzePaperBtn');
    btn.disabled = true;
    btn.textContent = 'AI 识别题干结构中...';
    try {
      const dataUrl = await compressExamImage(file);
      const stage = $('paperStageSelect').value;
      const subjectHint = $('paperSubjectHintSelect').value;
      const result = await apiFetch('/api/paper/analyze', {
        method: 'POST',
        body: JSON.stringify({ image: dataUrl, consent: true, stage, subjectHint })
      });
      renderPaperReviewTable(result, stage);
    } catch (err) {
      alert(`识图未能完成：${err.message}\n提示：若当前环境未配置 Cloudflare Workers AI 额度，可先点击“载入典型摸底卷示例”验证手工标注与消灯同步链路。`);
    } finally {
      btn.disabled = false;
      btn.textContent = '识别试卷题干结构';
    }
  }

  function loadDemoPaperStructure() {
    const stage = $('paperStageSelect').value || state.manualStage;
    const isJunior = stage === 'junior';
    const demo = isJunior
      ? {
          exam: '示例试卷结构：初中数学期中阶段诊断卷（未含手写答案）',
          needsReview: true,
          reviewNotice: '当前为典型摸底卷结构示例，供本地/线下流程演练；所有题号映射与对错请以教师人工复核为准。',
          questions: [
            { no: '3', subject: 'math', scope: '一元二次方程根的判别式与韦达定理', qtype: '选择', diff: '基础', maxScore: 3, evidence: '判别式及根系关系基础辨析' },
            { no: '9', subject: 'math', scope: '反比例函数k的几何意义与面积问题', qtype: '选择', diff: '中档', maxScore: 3, evidence: '双曲线图形面积定值' },
            { no: '16', subject: 'math', scope: '二次函数与线段最值问题（将军饮马、胡不归等）', qtype: '填空', diff: '中档', maxScore: 4, evidence: '抛物线对称轴动点周长最小' },
            { no: '24', subject: 'math', scope: '二次函数与三角形存在性问题（等腰、直角等）', qtype: '综合', diff: '压轴', maxScore: 12, evidence: '动点直角三角形分类讨论' }
          ]
        }
      : {
          exam: '示例试卷结构：高二/高三数学综合测漏卷（未含手写答案）',
          needsReview: true,
          reviewNotice: '当前为典型摸底卷结构示例，供本地/线下流程演练；所有题号映射与对错请以教师人工复核为准。',
          questions: [
            { no: '4', subject: 'math', scope: '复数的几何意义与模长', qtype: '选择', diff: '基础', maxScore: 5, evidence: '复平面两点距离几何含义' },
            { no: '11', subject: 'math', scope: '函数的单调性与奇偶性综合', qtype: '选择', diff: '中档', maxScore: 6, evidence: '抽象不等式解集求解' },
            { no: '14', subject: 'math', scope: '利用导数研究函数的极值与最值', qtype: '填空', diff: '中档', maxScore: 5, evidence: '含参三次函数极值点存在条件' },
            { no: '19', subject: 'math', scope: '椭圆与直线的位置关系及弦长问题', qtype: '综合', diff: '压轴', maxScore: 17, evidence: '联立韦达定理与面积定值论证' }
          ]
        };
    renderPaperReviewTable(demo, stage);
  }

  function findBestMatchingNode(stage, subjectKey, scopeText) {
    if (!bootstrap?.catalog?.[stage]) return null;
    const subj = bootstrap.catalog[stage][subjectKey] || Object.values(bootstrap.catalog[stage])[0];
    if (!subj) return null;
    const nodes = subj.chapters.flatMap(c => c.items);
    if (!scopeText) return nodes[0] || null;

    let best = nodes[0];
    let bestScore = -1;
    for (const n of nodes) {
      let score = 0;
      const chars = scopeText.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
      for (let i = 0; i < chars.length - 1; i++) {
        const bg = chars.slice(i, i + 2);
        if (n.title.includes(bg) || n.chapterTitle.includes(bg)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = n;
      }
    }
    return best;
  }

  function renderPaperReviewTable(result, stage) {
    paperDraft = { stage, ...result };
    $('paperResultWrap').classList.remove('hidden');
    $('paperExamTitleText').textContent = `${result.exam || '未命名试卷'} — 【需人工复核】`;

    const subjNodesCache = {};
    const getOptionsForSubj = (sKey, selectedNodeId) => {
      const k = bootstrap?.catalog?.[stage]?.[sKey] ? sKey : (Object.keys(bootstrap?.catalog?.[stage] || {})[0] || 'math');
      if (!subjNodesCache[k]) {
        subjNodesCache[k] = (bootstrap?.catalog?.[stage]?.[k]?.chapters || []).flatMap(c => c.items);
      }
      return subjNodesCache[k].slice(0, 120).map(n =>
        `<option value="${escapeHtml(n.nodeId)}" ${n.nodeId === selectedNodeId ? 'selected' : ''}>${escapeHtml(n.chapterTitle)} · ${escapeHtml(n.title)}</option>`
      ).join('');
    };

    $('paperQuestionsTableBody').innerHTML = (result.questions || []).map((q, idx) => {
      const subjKey = q.subject === 'physics' ? 'phys' : (bootstrap?.catalog?.[stage]?.[q.subject] ? q.subject : 'math');
      const matched = findBestMatchingNode(stage, subjKey, q.scope || q.evidence);
      q._mappedNodeId = matched?.nodeId || '';
      q._verdict = idx >= 2 ? 'wrong' : 'correct'; // 引导教师核对，用户可自由改选

      return `
        <tr>
          <td><strong>第 ${escapeHtml(q.no)} 题</strong></td>
          <td>
            <span class="badge badge-navy">${escapeHtml(subjKey)}</span>
            <div style="font-weight:600; margin-top:2px;">${escapeHtml(q.scope || q.evidence || '待定位考点')}</div>
            <div style="font-size:11.5px; color:var(--muted);">需人工复核 · 题型：${escapeHtml(q.qtype || '综合')}</div>
          </td>
          <td>${escapeHtml(q.diff || '待确认')}<br><span style="font-size:11.5px; color:var(--muted);">${q.maxScore ? q.maxScore + '分' : '--'}</span></td>
          <td>
            <select class="select" data-paper-node="${idx}" style="font-size:12px; min-width:210px;">
              ${getOptionsForSubj(subjKey, q._mappedNodeId)}
            </select>
          </td>
          <td>
            <select class="select" data-paper-verdict="${idx}" style="font-size:12px; min-width:140px;">
              <option value="correct" ${q._verdict === 'correct' ? 'selected' : ''}>✓ 教师核对：正确</option>
              <option value="wrong" ${q._verdict === 'wrong' ? 'selected' : ''}>✕ 教师核对：不会/做错</option>
              <option value="explained">💡 错题已当面讲解</option>
              <option value="ignore">暂不计入手册</option>
            </select>
          </td>
        </tr>
      `;
    }).join('');
  }

  function syncPaperResultsToManual() {
    if (!paperDraft?.questions?.length) return;
    let updatedCount = 0;
    let wrongAdded = 0;
    let firstTargetNode = null;

    paperDraft.questions.forEach((q, idx) => {
      const nodeSel = document.querySelector(`[data-paper-node="${idx}"]`);
      const verdictSel = document.querySelector(`[data-paper-verdict="${idx}"]`);
      const nodeId = nodeSel?.value;
      const verdict = verdictSel?.value;
      if (!nodeId || verdict === 'ignore') return;

      const prev = state.progress[nodeId] || {
        planned_count: 5,
        completed_count: 0,
        wrong_count: 0,
        explained_count: 0,
        consecutive_wrong: 0
      };
      const isWrong = verdict === 'wrong' || verdict === 'explained';
      const next = {
        planned_count: Math.max(prev.planned_count || 5, (prev.completed_count || 0) + 1),
        completed_count: (prev.completed_count || 0) + 1,
        wrong_count: (prev.wrong_count || 0) + (isWrong ? 1 : 0),
        explained_count: (prev.explained_count || 0) + (verdict === 'explained' ? 1 : 0),
        consecutive_wrong: isWrong ? Math.max(2, (prev.consecutive_wrong || 0) + 1) : 0
      };
      // 说明：拍卷测漏中若某单题教师判定不会/错，单题错误率即达 100%（>=40%），自动触发红灯提示学生排查
      state.progress[nodeId] = next;
      updatedCount += 1;
      if (isWrong) wrongAdded += 1;
      if (!firstTargetNode && isWrong) firstTargetNode = nodeId;
    });

    if (firstTargetNode) {
      const m = firstTargetNode.match(/^(junior|senior)_([a-z]+)_/);
      if (m) {
        state.manualStage = m[1];
        state.manualSubject = m[2];
        const chMatch = firstTargetNode.match(/^([a-z]+_[a-z]+_c\d+)_/);
        if (chMatch) openChapterIds.add(chMatch[1]);
      }
    }

    saveState();
    alert(`已将 ${updatedCount} 道人工核对题目写入《考点过关手册》（新增错题 ${wrongAdded} 处），系统已自动点亮红黄绿灯！即将为您跳转至第 2 步查看状态灯与生成消灯包。`);
    switchMainView('viewStep2');
  }

  // ==================== 第 2 步：考点过关手册（全自动红黄绿灯 + 5项字段） ====================
  function evaluateNodeProgress(raw = {}, defaultPlanned = 5) {
    const th = state.thresholds || { redErrorRate: 0.40, yellowErrorRate: 0.15, redConsecutiveWrong: 2 };
    const planned = Math.max(1, Number(raw.planned_count ?? defaultPlanned ?? 5));
    const completed = Math.max(0, Number(raw.completed_count ?? 0));
    const wrong = Math.max(0, Math.min(completed, Number(raw.wrong_count ?? 0)));
    const explained = Math.max(0, Number(raw.explained_count ?? 0));
    const consecutiveWrong = Math.max(0, Number(raw.consecutive_wrong ?? 0));

    if (completed === 0) {
      return {
        planned_count: planned,
        completed_count: 0,
        wrong_count: 0,
        explained_count: explained,
        consecutive_wrong: 0,
        errorRatePct: 0,
        light_status: explained > 0 ? 'yellow' : 'unstarted',
        lightLabel: explained > 0 ? '🟡 黄灯 · 待复测' : '⚪ 未排查',
        is_passed: false
      };
    }

    const rate = wrong / completed;
    const errorRatePct = Math.round(rate * 100);

    if (rate >= Number(th.redErrorRate) || consecutiveWrong >= Number(th.redConsecutiveWrong)) {
      return {
        planned_count: planned,
        completed_count: completed,
        wrong_count: wrong,
        explained_count: explained,
        consecutive_wrong: consecutiveWrong,
        errorRatePct,
        light_status: 'red',
        lightLabel: `🔴 红灯 · 错${errorRatePct}%`,
        is_passed: false
      };
    }

    if (rate >= Number(th.yellowErrorRate) || completed < planned || (explained > 0 && wrong > 0 && rate >= Number(th.yellowErrorRate) * 0.6)) {
      return {
        planned_count: planned,
        completed_count: completed,
        wrong_count: wrong,
        explained_count: explained,
        consecutive_wrong: consecutiveWrong,
        errorRatePct,
        light_status: 'yellow',
        lightLabel: `🟡 黄灯 · ${errorRatePct}%`,
        is_passed: false
      };
    }

    return {
      planned_count: planned,
      completed_count: completed,
      wrong_count: wrong,
      explained_count: explained,
      consecutive_wrong: consecutiveWrong,
      errorRatePct,
      light_status: 'green',
      lightLabel: `🟢 绿灯 · 已过关`,
      is_passed: true
    };
  }

  function computeSubjectStatsLocal(stage, subjectKey) {
    const subj = bootstrap?.catalog?.[stage]?.[subjectKey];
    if (!subj) return null;

    let redCount = 0;
    let yellowCount = 0;
    let greenCount = 0;
    let unstartedCount = 0;
    const redNodes = [];
    const yellowNodes = [];
    const groupStats = {};

    subj.chapters.forEach(ch => {
      const grp = ch.group || ch.title;
      if (!groupStats[grp]) groupStats[grp] = { total: 0, passed: 0, red: 0, yellow: 0 };

      ch.items.forEach(item => {
        const ev = evaluateNodeProgress(state.progress[item.nodeId], item.defaultPlannedCount);
        groupStats[grp].total += 1;
        if (ev.light_status === 'red') {
          redCount += 1;
          groupStats[grp].red += 1;
          redNodes.push({ ...item, progress: ev });
        } else if (ev.light_status === 'yellow') {
          yellowCount += 1;
          groupStats[grp].yellow += 1;
          yellowNodes.push({ ...item, progress: ev });
        } else if (ev.light_status === 'green') {
          greenCount += 1;
          groupStats[grp].passed += 1;
        } else {
          unstartedCount += 1;
        }
      });
    });

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
      redNodes,
      yellowNodes,
      groupStats
    };
  }

  function renderStep2Manual() {
    if (!bootstrap?.catalog) return;
    const stage = state.manualStage === 'senior' ? 'senior' : 'junior';
    $('manualStageJuniorBtn').className = `btn btn-sm ${stage === 'junior' ? 'btn-primary' : 'btn-outline'}`;
    $('manualStageSeniorBtn').className = `btn btn-sm ${stage === 'senior' ? 'btn-primary' : 'btn-outline'}`;

    const order = bootstrap.subjectOrder[stage] || [];
    if (!order.some(s => s.key === state.manualSubject)) {
      state.manualSubject = order[0]?.key || 'math';
    }

    $('subjectPillsBar').innerHTML = order.map(s => {
      const st = computeSubjectStatsLocal(stage, s.key);
      const redTag = st?.redCount > 0 ? ` · 🔴${st.redCount}` : '';
      return `<button type="button" class="subj-pill ${s.key === state.manualSubject ? 'active' : ''}" data-subj="${escapeHtml(s.key)}">${escapeHtml(s.label)}${redTag}</button>`;
    }).join('');

    const subj = bootstrap.catalog[stage][state.manualSubject];
    const stats = computeSubjectStatsLocal(stage, state.manualSubject);
    if (!subj || !stats) return;

    $('kpiTotalNodes').textContent = stats.totalNodes;
    $('kpiRedCount').textContent = stats.redCount;
    $('kpiYellowCount').textContent = stats.yellowCount;
    $('kpiGreenCount').textContent = stats.greenCount;
    $('kpiPassRate').textContent = `${stats.passRatePct}%`;

    const keyword = ($('manualSearchInput').value || '').trim().toLowerCase();
    const filterLight = $('manualLightFilter').value || 'all';

    // 默认展开前 1 个章或含筛选结果的章
    if (openChapterIds.size === 0 && subj.chapters[0]) {
      openChapterIds.add(subj.chapters[0].chapterId);
    }

    const html = subj.chapters.map(ch => {
      const filteredItems = ch.items.filter(item => {
        const ev = evaluateNodeProgress(state.progress[item.nodeId], item.defaultPlannedCount);
        const matchLight = filterLight === 'all' || ev.light_status === filterLight;
        const matchText = !keyword || item.title.toLowerCase().includes(keyword) || ch.title.toLowerCase().includes(keyword);
        return matchLight && matchText;
      });
      if (!filteredItems.length) return '';

      let chRed = 0;
      let chYellow = 0;
      let chGreen = 0;
      filteredItems.forEach(it => {
        const ev = evaluateNodeProgress(state.progress[it.nodeId], it.defaultPlannedCount);
        if (ev.light_status === 'red') chRed += 1;
        else if (ev.light_status === 'yellow') chYellow += 1;
        else if (ev.light_status === 'green') chGreen += 1;
      });

      const isOpen = openChapterIds.has(ch.chapterId) || Boolean(keyword) || filterLight !== 'all';

      const rowsHtml = filteredItems.map(item => {
        const ev = evaluateNodeProgress(state.progress[item.nodeId], item.defaultPlannedCount);
        const packBtnClass = ev.light_status === 'red' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline';
        const packBtnLabel = ev.light_status === 'red' ? '⚡ 一键消灯任务包' : '复习巩固包';
        return `
          <tr>
            <td>
              <div style="font-weight:600; color:var(--primary);">${escapeHtml(item.title)}</div>
              <div style="font-size:11.5px; color:var(--muted);">难度档：${escapeHtml(item.difficultyTag)}</div>
            </td>
            <td><input type="number" class="stat-num-input" min="1" max="99" value="${ev.planned_count}" data-node="${escapeHtml(item.nodeId)}" data-field="planned_count"></td>
            <td><input type="number" class="stat-num-input" min="0" max="99" value="${ev.completed_count}" data-node="${escapeHtml(item.nodeId)}" data-field="completed_count"></td>
            <td><input type="number" class="stat-num-input" min="0" max="99" value="${ev.wrong_count}" data-node="${escapeHtml(item.nodeId)}" data-field="wrong_count"></td>
            <td><input type="number" class="stat-num-input" min="0" max="99" value="${ev.explained_count}" data-node="${escapeHtml(item.nodeId)}" data-field="explained_count"></td>
            <td>
              <span class="light-dot ${ev.light_status}">${escapeHtml(ev.lightLabel)}</span>
              <div style="font-size:11px; color:var(--muted); margin-top:2px;">${ev.is_passed ? '已过关 ✓' : '未过关'}</div>
            </td>
            <td>
              <button type="button" class="${packBtnClass}" data-open-pack="${escapeHtml(item.nodeId)}">${packBtnLabel}</button>
            </td>
          </tr>
        `;
      }).join('');

      return `
        <div class="chapter-accordion">
          <div class="chapter-header" data-toggle-ch="${escapeHtml(ch.chapterId)}">
            <span>${ch.group ? `<span class="badge badge-navy" style="margin-right:6px;">${escapeHtml(ch.group)}</span>` : ''}${escapeHtml(ch.title)}</span>
            <span style="font-size:12px; color:var(--muted);">
              ${chRed ? `🔴${chRed} ` : ''}${chYellow ? `🟡${chYellow} ` : ''}${chGreen ? `🟢${chGreen} ` : ''}
              共 ${filteredItems.length} 考点 ${isOpen ? '▾' : '▸'}
            </span>
          </div>
          <div class="chapter-body ${isOpen ? '' : 'hidden'}">
            <table class="data-table">
              <thead>
                <tr>
                  <th>知识点 / 题型（来自原版目录）</th>
                  <th>计划做题数</th>
                  <th>已完成题数</th>
                  <th>不会/错误数</th>
                  <th>讲解数</th>
                  <th>是否过关</th>
                  <th>DeepTutor 消灯</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    $('manualChaptersContainer').innerHTML = html || '<div class="notice-box">当前筛选条件下暂无匹配考点，可切换状态灯筛选条件查看全部目录。</div>';
  }

  // ==================== DeepTutor 消灯任务包抽屉闭环 ====================
  async function openLightClearPackModal(nodeId) {
    const raw = state.progress[nodeId] || {};
    try {
      const { pack } = await apiFetch('/api/v1/packs/generate', {
        method: 'POST',
        body: JSON.stringify({
          nodeId,
          progress: raw,
          thresholds: state.thresholds
        })
      });
      currentPack = pack;
      $('packModalTitle').textContent = `专属消灯任务包 · ${pack.topicTitle}`;
      $('packLightBadge').textContent = pack.beforeLightLabel || '待消灯';
      $('packLightBadge').className = `badge ${pack.beforeLight === 'red' ? 'badge-red' : (pack.beforeLight === 'yellow' ? 'badge-yellow' : 'badge-navy')}`;
      $('packSubMeta').textContent = `${pack.subjectLabel} · ${pack.chapterTitle} · 触发依据：${pack.triggerReason}`;
      $('packDiagnosisText').textContent = pack.diagnosisReason;
      $('packAdviceText').textContent = pack.adviceText;

      $('packKbList').innerHTML = (pack.knowledgeDocs || []).map(doc => `
        <div class="kb-card">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:4px;">
            <strong>${escapeHtml(doc.title)}</strong>
            <span class="badge badge-navy">${escapeHtml(doc.kbCategory)}</span>
          </div>
          <div style="font-size:12.5px; color:var(--muted); margin-bottom:6px;">${escapeHtml(doc.summary)}</div>
          <ul style="margin:0; padding-left:18px; font-size:12.5px;">
            ${(doc.checklist || []).map(li => `<li>${escapeHtml(li)}</li>`).join('')}
          </ul>
        </div>
      `).join('');

      $('packQuestionsList').innerHTML = (pack.practiceQuestions || []).map((q, idx) => `
        <div class="practice-row">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <strong>第 ${idx + 1} 题 · ${escapeHtml(q.type)}</strong>
            <span class="badge badge-gold">难度：${escapeHtml(q.difficulty)}</span>
          </div>
          <div style="font-size:13.5px; margin-bottom:4px;">${escapeHtml(q.prompt)}</div>
          <div style="font-size:12px; color:var(--accent);">破题提示：${escapeHtml(q.keyHint)}</div>
        </div>
      `).join('');

      $('packRetestCompletedInput').value = 3;
      $('packRetestWrongInput').value = 0;
      $('packDrawerBackdrop').classList.remove('hidden');
      silentSelfStudyTrack('light_pack');
    } catch (err) {
      alert(`生成消灯包失败：${err.message}`);
    }
  }

  function submitPackRetest() {
    if (!currentPack?.nodeId) return;
    const nodeId = currentPack.nodeId;
    const addDone = Math.max(1, Number($('packRetestCompletedInput').value) || 3);
    const addWrong = Math.max(0, Math.min(addDone, Number($('packRetestWrongInput').value) || 0));

    const prev = state.progress[nodeId] || {
      planned_count: 5,
      completed_count: 0,
      wrong_count: 0,
      explained_count: 0,
      consecutive_wrong: 0
    };
    const beforeEv = evaluateNodeProgress(prev);

    const next = {
      planned_count: Math.max(prev.planned_count || 5, (prev.completed_count || 0) + addDone),
      completed_count: (prev.completed_count || 0) + addDone,
      wrong_count: (prev.wrong_count || 0) + addWrong,
      explained_count: (prev.explained_count || 0) + 1,
      consecutive_wrong: addWrong === 0 ? 0 : Math.min(2, addWrong)
    };
    state.progress[nodeId] = next;
    const afterEv = evaluateNodeProgress(next);

    if (beforeEv.light_status === 'red' && afterEv.light_status !== 'red') {
      state.clearedRedCount = (state.clearedRedCount || 0) + 1;
    }

    saveState();
    $('packDrawerBackdrop').classList.add('hidden');
    renderStep2Manual();
    alert(`消灯复测已入库！\n当前错误率更新为 ${afterEv.errorRatePct}%，状态灯已自动更新为【${afterEv.lightLabel}】。`);
  }

  // ==================== 第 3 步：成长档案、考分曲线与精装定制规划书 ====================
  function aggregateStageStats(stage) {
    const order = bootstrap?.subjectOrder?.[stage] || [];
    let totalRed = 0;
    let totalYellow = 0;
    let totalGreen = 0;
    let totalStarted = 0;
    const redNodes = [];
    const yellowNodes = [];
    const subjectBreakdown = [];

    order.forEach(s => {
      const st = computeSubjectStatsLocal(stage, s.key);
      if (!st) return;
      totalRed += st.redCount;
      totalYellow += st.yellowCount;
      totalGreen += st.greenCount;
      totalStarted += st.startedNodes;
      redNodes.push(...st.redNodes);
      yellowNodes.push(...st.yellowNodes);
      const masteryPct = st.startedNodes > 0 ? st.passRatePct : 65;
      subjectBreakdown.push({ label: s.short, fullLabel: s.label, masteryPct, red: st.redCount, yellow: st.yellowCount, green: st.greenCount });
    });

    const passRatePct = totalStarted > 0 ? Math.round((totalGreen / totalStarted) * 100) : 0;
    return {
      stage,
      redCount: totalRed,
      yellowCount: totalYellow,
      greenCount: totalGreen,
      startedNodes: totalStarted,
      passRatePct,
      redNodes: redNodes.slice(0, 12),
      yellowNodes: yellowNodes.slice(0, 8),
      subjectBreakdown
    };
  }

  async function renderStep3ArchiveAndReport() {
    if (!bootstrap?.catalog) return;
    const p = state.profile;
    const overall = aggregateStageStats(state.manualStage);

    $('archiveBaselineScore').textContent = p.enrollmentCategory === 'graduation_sprint'
      ? `${p.baselineScore} / ${p.localMaxScore}`
      : `${p.targetMasteryLevel}`;
    $('archiveClearedRedCount').textContent = `${state.clearedRedCount || 0} 项`;
    $('archiveOverallPassRate').textContent = `${overall.passRatePct}%`;
    $('archiveExamCount').textContent = `${state.examScores.length} 次`;

    $('examMaxScoreInput').value = p.localMaxScore || (state.manualStage === 'junior' ? 680 : 750);
    if (!$('examDateInput').value) {
      $('examDateInput').value = new Date().toISOString().slice(0, 10);
    }

    renderExamScoresTable();
    renderTrendChart();
    await refreshHardcoverReport(overall);
  }

  function renderExamScoresTable() {
    const tbody = $('examScoreHistoryBody');
    if (!state.examScores.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--muted); text-align:center;">暂未录入学校阶段考分数，建议录入月考/期中分数生成成长趋势曲线。</td></tr>';
      return;
    }
    tbody.innerHTML = state.examScores.map((s, idx) => `
      <tr>
        <td><strong>${escapeHtml(s.examName)}</strong><br><span style="font-size:11.5px; color:var(--muted);">${escapeHtml(s.examDate)} · ${escapeHtml(s.examType)}</span></td>
        <td><strong>${s.totalScore}</strong> / ${s.maxScore}</td>
        <td>${escapeHtml(s.rankNote || '--')}</td>
        <td><button type="button" class="btn btn-outline btn-sm" data-del-score="${idx}">删除</button></td>
      </tr>
    `).join('');
  }

  function renderTrendChart() {
    const canvas = $('scoreTrendChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (trendChartInstance) trendChartInstance.destroy();

    const p = state.profile;
    const sorted = [...state.examScores].sort((a, b) => a.examDate.localeCompare(b.examDate));
    const labels = sorted.length
      ? ['建档基准', ...sorted.map(x => `${x.examDate.slice(5)} ${x.examName.slice(0, 6)}`)]
      : ['建档基准', '第1阶段目标线', '冲刺目标线'];
    const base = Number(p.baselineScore) || 500;
    const target = state.plan?.effectiveTargetScore || Number(p.targetCutoffScore) || base + 60;

    const values = sorted.length
      ? [base, ...sorted.map(x => Number(x.totalScore))]
      : [base, Math.round((base + target) / 2), target];
    const targetLine = labels.map(() => target);

    trendChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '实际考试/阶段分数',
            data: values,
            borderColor: '#1B365D',
            backgroundColor: 'rgba(27, 54, 93, 0.12)',
            borderWidth: 3,
            tension: 0.28,
            fill: true,
            pointRadius: 5,
            pointBackgroundColor: '#1F4E46'
          },
          {
            label: '目标学校录取基准线',
            data: targetLine,
            borderColor: '#B58938',
            borderDash: [6, 5],
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: {
            beginAtZero: false,
            suggestedMin: Math.max(0, Math.min(...values, base) - 40),
            suggestedMax: Number(p.localMaxScore) || Math.max(target + 30, 750)
          }
        }
      }
    });
  }

  function renderRadarChart(subjectBreakdown) {
    const canvas = $('radarGapChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (radarChartInstance) radarChartInstance.destroy();

    const items = subjectBreakdown.slice(0, 7);
    const labels = items.map(x => x.label);
    const actualData = items.map(x => x.masteryPct);
    const targetData = items.map(() => 88);

    radarChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: '当前手册过关评估(%)',
            data: actualData,
            borderColor: '#1B365D',
            backgroundColor: 'rgba(27, 54, 93, 0.18)',
            borderWidth: 2
          },
          {
            label: '名校目标安全区(%)',
            data: targetData,
            borderColor: '#1F4E46',
            backgroundColor: 'rgba(31, 78, 70, 0.08)',
            borderDash: [5, 4],
            borderWidth: 1.5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: { min: 0, max: 100, ticks: { stepSize: 25 } }
        }
      }
    });
  }

  async function refreshHardcoverReport(precomputedStats = null) {
    const overall = precomputedStats || aggregateStageStats(state.manualStage);
    const p = state.profile;
    try {
      const report = await apiFetch('/api/v1/report/generate', {
        method: 'POST',
        body: JSON.stringify({
          profile: p,
          stats: overall,
          plan: state.plan,
          scores: state.examScores,
          adminPolishedCommentary: state.adminPolishedCommentary
        })
      });

      state.plan = report.plan || state.plan;
      $('repStudentName').textContent = `${p.studentName}（${p.grade}）`;
      $('repRegionTarget').textContent = p.enrollmentCategory === 'graduation_sprint'
        ? `${p.province}${p.city ? '·' + p.city : ''} · ${p.targetSchoolName || '目标校'}`
        : `${p.targetDifficulty} · ${p.targetMasteryLevel}`;
      $('repRhythm').textContent = p.studyRhythm === 'full_time' ? '全脱产每日规划' : `非脱产 ${p.customCycleDays || 7} 天周期`;
      $('repDate').textContent = report.generatedAt;

      const pl = state.plan || {};
      $('repGapSummaryBox').innerHTML = `
        <div><strong>考试满分基数：</strong>${pl.localMaxScore || p.localMaxScore} 分</div>
        <div><strong>当前基准 / 目标线：</strong>${pl.baselineScore ?? p.baselineScore} 分 → <strong style="color:var(--accent)">${pl.effectiveTargetScore ?? p.targetCutoffScore} 分</strong>（目标差额 ${pl.scoreGap ?? 0} 分）</div>
        <div><strong>全科灯态统计：</strong>🟢 已过关 ${overall.greenCount} 项 | 🟡 巩固中 ${overall.yellowCount} 项 | 🔴 未过关 ${overall.redCount} 项 | 已消红灯 ${state.clearedRedCount || 0} 项</div>
        ${pl.artCalculation ? `<div style="margin-top:4px; color:var(--accent);"><strong>艺考公式倒推：</strong>${escapeHtml(pl.artCalculation.formulaDisplay)}</div>` : ''}
      `;

      renderRadarChart(overall.subjectBreakdown);

      const priorityNodes = [...overall.redNodes, ...overall.yellowNodes];
      $('repBattleTableBody').innerHTML = priorityNodes.length
        ? priorityNodes.map(n => `
            <tr>
              <td><strong>[${escapeHtml(n.subjectLabel)}]</strong> ${escapeHtml(n.chapterTitle)} · ${escapeHtml(n.title)}</td>
              <td>${n.progress.planned_count}</td>
              <td>${n.progress.completed_count}</td>
              <td>${n.progress.wrong_count}</td>
              <td>${n.progress.explained_count}</td>
              <td><span class="light-dot ${n.progress.light_status}">${escapeHtml(n.progress.lightLabel)}</span></td>
            </tr>
          `).join('')
        : '<tr><td colspan="6" style="color:var(--muted); text-align:center;">暂无重点红色或黄色预警节点，请在第 2 步录入或通过拍卷测漏触发诊断明细。</td></tr>';

      const taskLines = (pl.dailyTasks || state.tasks || []).map((t, i) => `${i + 1}. ${t.title}（${t.duration || '45分钟'}）`).join('<br>');
      $('repScheduleBox').innerHTML = `<div>${escapeHtml(pl.reminderMode || '每日过关与阶段复盘机制')}</div><div style="margin-top:6px;">${taskLines || '按《考点过关手册》按章推进每日打卡。'}</div>`;
      $('repCommentaryText').textContent = report.commentary;
      $('adminCommentaryTextarea').value = state.adminPolishedCommentary || report.commentary;
    } catch (err) {
      $('repCommentaryText').textContent = `生成报告失败：${err.message}`;
    }
  }

  // ==================== 原生离屏 Canvas 导出高清长图 PNG（无外网 CDN 依赖） ====================
  function wrapTextLines(ctx, text, maxWidth) {
    const paragraphs = String(text || '').split('\n');
    const lines = [];
    for (const para of paragraphs) {
      if (!para.trim()) {
        lines.push('');
        continue;
      }
      let line = '';
      for (const ch of para) {
        if (ctx.measureText(line + ch).width > maxWidth) {
          lines.push(line);
          line = ch;
        } else {
          line += ch;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  function exportReportLongImage() {
    const p = state.profile;
    const overall = aggregateStageStats(state.manualStage);
    const priorityNodes = [...overall.redNodes, ...overall.yellowNodes].slice(0, 10);
    const commentary = $('repCommentaryText').textContent || '';

    const W = 1080;
    const PAD = 64;
    const CONTENT_W = W - PAD * 2;

    const tmp = document.createElement('canvas').getContext('2d');
    tmp.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif';
    const commentLines = wrapTextLines(tmp, commentary, CONTENT_W - 40);

    const hasRadar = Boolean($('radarGapChart') && $('radarGapChart').width > 0);
    const radarHeight = hasRadar ? 320 : 0;
    const tableHeight = 84 + Math.max(1, priorityNodes.length) * 44;
    const totalH = 380 + radarHeight + tableHeight + commentLines.length * 30 + 360;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');

    // 背景与精装装订边框
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, totalH);
    ctx.strokeStyle = '#1B365D';
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, W - 40, totalH - 40);
    ctx.strokeStyle = '#B58938';
    ctx.lineWidth = 2;
    ctx.strokeRect(32, 32, W - 64, totalH - 64);

    // 封面抬头
    ctx.fillStyle = '#B58938';
    ctx.font = 'bold 16px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('XU STUDIO · MINGSHI ACADEMIC PLANNING SYSTEM', W / 2, 86);

    ctx.fillStyle = '#1B365D';
    ctx.font = 'bold 34px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('《许老师工作室 · 独家升学规划与过关诊断报告》', W / 2, 138);

    ctx.fillStyle = '#475569';
    ctx.font = '18px "PingFang SC", sans-serif';
    ctx.fillText(`学员：${p.studentName} (${p.grade})  |  目标：${p.province}${p.city} · ${p.targetSchoolName || p.targetMasteryLevel}  |  签发：${$('repDate').textContent}`, W / 2, 180);

    ctx.strokeStyle = '#B58938';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, 204);
    ctx.lineTo(W - PAD, 204);
    ctx.stroke();

    // 1. 学情总览
    let y = 248;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1B365D';
    ctx.font = 'bold 24px "PingFang SC", sans-serif';
    ctx.fillText('一、学情差距定位与关键过关指标', PAD, y);
    y += 20;

    ctx.fillStyle = '#F6F8F7';
    ctx.fillRect(PAD, y, CONTENT_W, 92);
    ctx.fillStyle = '#1F2937';
    ctx.font = '18px "PingFang SC", sans-serif';
    const pl = state.plan || {};
    ctx.fillText(`起步基准 ${pl.baselineScore ?? p.baselineScore} 分  →  文化目标线 ${pl.effectiveTargetScore ?? p.targetCutoffScore} 分（当地满分 ${pl.localMaxScore ?? p.localMaxScore} 分，待提差额 ${pl.scoreGap ?? 0} 分）`, PAD + 20, y + 36);
    ctx.fillText(`红黄绿灯统计：🟢 绿灯过关 ${overall.greenCount} 项  |  🟡 黄灯巩固 ${overall.yellowCount} 项  |  🔴 红灯未过关 ${overall.redCount} 项  |  累计已消红灯 ${state.clearedRedCount || 0} 项`, PAD + 20, y + 70);
    y += 116;

    if (hasRadar) {
      try {
        ctx.drawImage($('radarGapChart'), (W - 460) / 2, y, 460, 290);
        y += radarHeight;
      } catch (_) { /* ignore tainted */ }
    }

    // 2. 红黄绿灯作战表
    ctx.fillStyle = '#1B365D';
    ctx.font = 'bold 24px "PingFang SC", sans-serif';
    ctx.fillText('二、红黄绿灯考点过关作战表（重点清零清单）', PAD, y);
    y += 22;

    ctx.fillStyle = '#EFF2F1';
    ctx.fillRect(PAD, y, CONTENT_W, 42);
    ctx.fillStyle = '#1B365D';
    ctx.font = 'bold 16px "PingFang SC", sans-serif';
    ctx.fillText('学科 / 专题与题型', PAD + 14, y + 27);
    ctx.fillText('计划/完成/错题/讲解', W - PAD - 360, y + 27);
    ctx.fillText('状态灯', W - PAD - 140, y + 27);
    y += 42;

    if (!priorityNodes.length) {
      ctx.fillStyle = '#5C6773';
      ctx.font = '16px "PingFang SC", sans-serif';
      ctx.fillText('暂未检出红色/黄色预警节点，继续按计划推进手册打卡即可。', PAD + 14, y + 28);
      y += 44;
    } else {
      priorityNodes.forEach((n, i) => {
        ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#FAFBFB';
        ctx.fillRect(PAD, y, CONTENT_W, 42);
        ctx.fillStyle = '#1F2937';
        ctx.font = '15px "PingFang SC", sans-serif';
        const titleTxt = `[${n.subjectLabel}] ${n.title}`.slice(0, 34);
        ctx.fillText(titleTxt, PAD + 14, y + 27);
        const statTxt = `${n.progress.planned_count} / ${n.progress.completed_count} / ${n.progress.wrong_count} / ${n.progress.explained_count}`;
        ctx.fillText(statTxt, W - PAD - 335, y + 27);
        ctx.fillStyle = n.progress.light_status === 'red' ? '#C84B4B' : '#C98A1B';
        ctx.font = 'bold 15px "PingFang SC", sans-serif';
        ctx.fillText(n.progress.lightLabel, W - PAD - 150, y + 27);
        y += 42;
      });
    }

    // 3. 名师评语
    y += 40;
    ctx.fillStyle = '#1B365D';
    ctx.font = 'bold 24px "PingFang SC", sans-serif';
    ctx.fillText('三、铭师学情总评与下阶段行动处方', PAD, y);
    y += 18;

    const boxH = Math.max(120, commentLines.length * 30 + 36);
    ctx.fillStyle = '#FAF8F2';
    ctx.fillRect(PAD, y, CONTENT_W, boxH);
    ctx.strokeStyle = '#E5DEC9';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD, y, CONTENT_W, boxH);

    ctx.fillStyle = '#2A3138';
    ctx.font = '18px "PingFang SC", sans-serif';
    commentLines.forEach((line, idx) => {
      ctx.fillText(line, PAD + 20, y + 36 + idx * 30);
    });
    y += boxH + 40;

    // 签章与红色工作室圆章
    ctx.fillStyle = '#5C6773';
    ctx.font = '17px "PingFang SC", sans-serif';
    ctx.fillText('主规划导师签字：_______________________', PAD, y + 30);
    ctx.fillText('家长 / 学员确认：_______________________', PAD, y + 66);
    ctx.fillText('许老师工作室（mrxu.uk） · 电话/微信：18986280310', PAD, y + 102);

    const sealX = W - PAD - 90;
    const sealY = y + 52;
    ctx.save();
    ctx.translate(sealX, sealY);
    ctx.rotate(-0.22);
    ctx.strokeStyle = 'rgba(196, 40, 40, 0.88)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(196, 40, 40, 0.88)';
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('★', 0, -22);
    ctx.font = 'bold 14px "PingFang SC", sans-serif';
    ctx.fillText('许老师工作室', 0, 2);
    ctx.fillText('铭师学习规划', 0, 22);
    ctx.fillText('诊断专用章', 0, 42);
    ctx.restore();

    // 斜向全屏防伪水印
    ctx.save();
    ctx.fillStyle = 'rgba(27, 54, 93, 0.08)';
    ctx.font = 'bold 18px "PingFang SC", sans-serif';
    for (let wy = 140; wy < totalH; wy += 240) {
      for (let wx = 40; wx < W; wx += 420) {
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(-0.4);
        ctx.fillText(WATERMARK_TEXT, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();

    const a = document.createElement('a');
    a.download = `铭师升学规划诊断报告_${p.studentName || '学员'}_${new Date().toISOString().slice(0, 10)}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  // ==================== 模块 3：自助与 AI 智能组卷中心 ====================
  const checkedExamNodes = new Set();

  function initExamCenterView() {
    if (!bootstrap?.catalog) return;
    if (!$('examStageSelect').dataset.inited) {
      $('examStageSelect').value = state.manualStage === 'junior' ? 'junior' : 'senior';
      $('examStageSelect').dataset.inited = '1';
      renderExamSubjectOptions();
      $('examSubjectSelect').value = state.manualSubject || 'math';
    } else {
      renderExamNodeChecklist();
    }
    loadSavedExamsDropdown();
    if (currentExam) renderAssembledExam();
  }

  function renderExamSubjectOptions() {
    if (!bootstrap?.subjectOrder) return;
    const stage = $('examStageSelect').value === 'junior' ? 'junior' : 'senior';
    const order = bootstrap.subjectOrder[stage] || [];
    const cur = $('examSubjectSelect').value;
    $('examSubjectSelect').innerHTML = order
      .map(s => `<option value="${escapeHtml(s.key)}">${escapeHtml(s.label)}</option>`)
      .join('');
    if (order.some(s => s.key === cur)) $('examSubjectSelect').value = cur;
    checkedExamNodes.clear();
    renderExamNodeChecklist();
  }

  function renderExamNodeChecklist() {
    const stage = $('examStageSelect').value === 'junior' ? 'junior' : 'senior';
    const subjKey = $('examSubjectSelect').value || 'math';
    const subj = bootstrap?.catalog?.[stage]?.[subjKey];
    const container = $('examNodeChecklist');
    if (!subj || !container) return;

    const kw = ($('examNodeSearchInput').value || '').trim().toLowerCase();
    const blocks = (subj.chapters || []).map(ch => {
      const items = (ch.items || []).filter(it => !kw || it.title.toLowerCase().includes(kw) || ch.title.toLowerCase().includes(kw));
      if (!items.length) return '';
      const itemsHtml = items.map(it => {
        const ev = evaluateNodeProgress(state.progress[it.nodeId], it.defaultPlannedCount);
        const dot = ev.light_status === 'red' ? '🔴 ' : (ev.light_status === 'yellow' ? '🟡 ' : (ev.light_status === 'green' ? '🟢 ' : ''));
        return `
          <label class="node-check-label">
            <input type="checkbox" data-exam-node="${escapeHtml(it.nodeId)}" ${checkedExamNodes.has(it.nodeId) ? 'checked' : ''}>
            <span>${dot}${escapeHtml(it.title)}</span>
          </label>
        `;
      }).join('');
      return `
        <div class="node-check-chapter">
          <div class="node-check-chapter-title">${escapeHtml(ch.title)}（${items.length}）</div>
          <div class="node-check-items">${itemsHtml}</div>
        </div>
      `;
    }).join('');
    container.innerHTML = blocks || '<div style="color:var(--muted); font-size:12.5px;">暂无匹配题型节点</div>';
  }

  function selectWeakManualNodesForExam() {
    const stage = $('examStageSelect').value === 'junior' ? 'junior' : 'senior';
    const subjKey = $('examSubjectSelect').value || 'math';
    const subj = bootstrap?.catalog?.[stage]?.[subjKey];
    if (!subj) return;
    checkedExamNodes.clear();
    let count = 0;
    subj.chapters.forEach(ch => {
      ch.items.forEach(it => {
        const ev = evaluateNodeProgress(state.progress[it.nodeId], it.defaultPlannedCount);
        if (ev.light_status === 'red' || ev.light_status === 'yellow') {
          checkedExamNodes.add(it.nodeId);
          count += 1;
        }
      });
    });
    renderExamNodeChecklist();
    if (!count) {
      alert('当前所选学科暂未标记红黄灯薄弱节点；您可以先到第 2 步标记薄弱项，或直接不勾选节点按全科抽题组卷。');
    }
  }

  async function loadSavedExamsDropdown() {
    if (!accessCode) return;
    try {
      const res = await apiFetch('/api/v1/exams/list');
      const list = res.exams || [];
      const sel = $('savedExamsSelect');
      if (!list.length) {
        sel.innerHTML = '<option value="">云端暂无历史试卷，完成组卷后将自动存档</option>';
        return;
      }
      sel.innerHTML = list.map(e =>
        `<option value="${escapeHtml(e.exam_id)}">[${e.mode === 'ai_nl' ? 'AI' : '手动'}] ${escapeHtml(e.title)}（${e.total_score}分 · ${escapeHtml(e.created_at.slice(0, 16))}）</option>`
      ).join('');
    } catch (_) { /* optional */ }
  }

  async function loadSavedExamById() {
    const examId = $('savedExamsSelect').value;
    if (!examId) return;
    try {
      const res = await apiFetch(`/api/v1/exams/detail?examId=${encodeURIComponent(examId)}`);
      if (!res?.exam?.questions) throw new Error('试卷数据为空');
      currentExam = res.exam;
      currentExamWarnings = res.insufficientWarnings || [];
      renderAssembledExam();
    } catch (err) {
      alert(`调取云端试卷失败：${err.message}`);
    }
  }

  async function generateManualExam() {
    const btn = $('generateManualExamBtn');
    btn.disabled = true;
    btn.textContent = '抽题组卷并校验题库中...';
    try {
      const res = await apiFetch('/api/v1/exams/assemble-manual', {
        method: 'POST',
        body: JSON.stringify({
          studentId: state.studentId || '',
          stage: $('examStageSelect').value,
          gradeLabel: $('examGradeSelect').value,
          subjectKey: $('examSubjectSelect').value,
          selectedNodeIds: Array.from(checkedExamNodes),
          counts: {
            basic: Number($('examBasicCountInput').value) || 0,
            medium: Number($('examMediumCountInput').value) || 0,
            hard: Number($('examHardCountInput').value) || 0
          },
          examTitle: $('examCustomTitleInput').value.trim(),
          durationMinutes: Number($('examDurationInput').value) || 90
        })
      });
      currentExam = res.exam;
      currentExamWarnings = res.insufficientWarnings || [];
      renderAssembledExam();
      loadSavedExamsDropdown();
      silentSelfStudyTrack('smart_exam');
    } catch (err) {
      alert(`手动组卷失败：${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = '按手册勾选题型智能抽题组卷 →';
    }
  }

  async function generateAiExam() {
    const promptText = $('aiExamPromptInput').value.trim();
    if (!promptText) {
      alert('请先输入一句话组卷要求，例如：“高二数学第一学期期中考试试卷，中等偏难”。');
      return;
    }
    const btn = $('generateAiExamBtn');
    btn.disabled = true;
    btn.textContent = '✨ AI 规划试卷结构与抽题中...';
    try {
      const res = await apiFetch('/api/v1/exams/assemble-ai', {
        method: 'POST',
        body: JSON.stringify({
          studentId: state.studentId || '',
          promptText,
          fallbackStage: $('examStageSelect').value || state.manualStage,
          fallbackSubjectKey: $('examSubjectSelect').value || state.manualSubject
        })
      });
      currentExam = res.exam;
      currentExamWarnings = res.insufficientWarnings || [];
      if (res.blueprint) {
        currentExamWarnings.unshift({
          message: `✨ AI 结构识别结果：学段【${res.blueprint.gradeLabel}】 · 学科【${res.blueprint.subjectLabel}】 · 难度【${res.blueprint.difficultyProfile}】 · 命中《过关手册》节点 ${res.blueprint.matchedNodeCount} 个（基础 ${res.blueprint.counts.basic} / 中等 ${res.blueprint.counts.medium} / 压轴 ${res.blueprint.counts.hard}）。`
        });
      }
      renderAssembledExam();
      loadSavedExamsDropdown();
      silentSelfStudyTrack('smart_exam');
    } catch (err) {
      alert(`AI 智能组卷失败：${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ AI 自动识别结构并智能组卷 →';
    }
  }

  async function swapSingleExamQuestion(qIdx) {
    if (!currentExam?.questions?.[qIdx]) return;
    const curQ = currentExam.questions[qIdx];
    try {
      const res = await apiFetch('/api/v1/exams/swap-question', {
        method: 'POST',
        body: JSON.stringify({
          examId: currentExam.examId,
          stage: currentExam.stage,
          subjectKey: currentExam.subjectKey,
          currentQuestion: curQ,
          excludeQuestionIds: currentExam.questions.map(q => q.qId)
        })
      });
      if (res?.question) {
        currentExam.questions[qIdx] = res.question;
        renderAssembledExam();
      }
    } catch (err) {
      alert(`换一题失败：${err.message}`);
    }
  }

  function renderAssembledExam() {
    if (!currentExam) return;
    $('examResultToolbar').classList.remove('hidden');
    $('examPaperSheet').classList.remove('hidden');

    const warnBox = $('examShortageAlertBox');
    if (currentExamWarnings.length > 0) {
      warnBox.innerHTML = currentExamWarnings.map(w => `<div>• ${escapeHtml(w.message)}</div>`).join('');
      warnBox.classList.remove('hidden');
    } else {
      warnBox.classList.add('hidden');
    }

    const isTeacher = examViewMode === 'teacher';
    $('examViewStudentBtn').className = `btn btn-sm ${!isTeacher ? 'btn-primary' : 'btn-outline'}`;
    $('examViewTeacherBtn').className = `btn btn-sm ${isTeacher ? 'btn-accent' : 'btn-outline'}`;

    const modeBadge = isTeacher ? '【教师解析版 · 含答案解析及手册标签】' : '【学生原卷版 · 无答案】';
    $('examPaperMainTitle').textContent = `${currentExam.title} ${isTeacher ? '（教师解析版）' : ''}`;
    $('examPaperMetaRow').textContent = `${modeBadge} | 年级学科：${currentExam.gradeLabel} · ${currentExam.subjectLabel} | 考试时长：${currentExam.durationMinutes} 分钟 | 满分：${currentExam.totalScore} 分`;

    const secScores = { '选择': 0, '填空': 0, '解答': 0 };
    (currentExam.questions || []).forEach(q => {
      if (q.questionType === '选择') secScores['选择'] += Number(q.score || 0);
      else if (q.questionType === '填空') secScores['填空'] += Number(q.score || 0);
      else secScores['解答'] += Number(q.score || 0);
    });
    $('examScoreTableBody').innerHTML = `
      <tr>
        <td><strong>满分 / 得分</strong></td>
        <td>${secScores['选择']} 分 / ____</td>
        <td>${secScores['填空']} 分 / ____</td>
        <td>${secScores['解答']} 分 / ____</td>
        <td><strong>${currentExam.totalScore} 分</strong></td>
        <td>________</td>
        <td>________</td>
      </tr>
    `;

    let lastSectionType = '';
    const sectionTitles = { '选择': '一、选择题', '填空': '二、填空题', '解答': '三、解答与综合应用题' };
    const html = (currentExam.questions || []).map((q, idx) => {
      const secKey = (q.questionType === '选择' || q.questionType === '填空') ? q.questionType : '解答';
      const banner = secKey !== lastSectionType
        ? `<div class="exam-section-banner">${sectionTitles[secKey]}</div>`
        : '';
      lastSectionType = secKey;

      const optionsHtml = Array.isArray(q.options) && q.options.length > 0
        ? `<div class="exam-options-grid">${q.options.map(opt => `<div>${escapeHtml(opt)}</div>`).join('')}</div>`
        : (!isTeacher && secKey === '解答' ? '<div class="exam-answer-space"></div>' : '');

      const teacherBox = isTeacher
        ? `
          <div class="teacher-analysis-box">
            <div><strong>【参考答案】</strong>${escapeHtml(q.answer)}</div>
            <div style="margin-top:4px;"><strong>【精讲解析】</strong>${escapeHtml(q.analysis)}</div>
            <div style="margin-top:4px; font-size:12px; color:var(--primary);">
              <strong>【《过关手册》映射标签】</strong>${escapeHtml(q.chapterTitle || currentExam.subjectLabel)} → ${escapeHtml(q.manualNodeTitle || '综合题型')}（难度：${escapeHtml(q.difficulty)}${q.needsBankReplenish ? ' · ⚠️ 待补充原题' : ''}）
            </div>
          </div>
        `
        : '';

      return `
        ${banner}
        <div class="exam-question-card">
          <div class="exam-q-head">
            <div>
              <strong>第 ${q.no} 题</strong>
              <span class="badge badge-navy" style="margin-left:6px;">${escapeHtml(q.difficulty)} · ${q.score}分</span>
              ${q.needsBankReplenish ? '<span class="badge badge-yellow">储备补位</span>' : ''}
            </div>
            <button type="button" class="btn btn-outline btn-sm no-print" data-swap-q="${idx}">🔄 换一题</button>
          </div>
          <div class="exam-q-stem">${escapeHtml(q.stem)}</div>
          ${optionsHtml}
          ${teacherBox}
        </div>
      `;
    }).join('');

    $('examQuestionsList').innerHTML = html;
  }

  function exportExamLongImage() {
    if (!currentExam?.questions?.length) return;
    const isTeacher = examViewMode === 'teacher';
    const W = 1080;
    const PAD_L = 88;
    const PAD_R = 54;
    const CONTENT_W = W - PAD_L - PAD_R;

    const tmp = document.createElement('canvas').getContext('2d');
    tmp.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif';

    const blocks = currentExam.questions.map(q => {
      const stemLines = wrapTextLines(tmp, `第 ${q.no} 题（${q.difficulty} · ${q.score}分）  ${q.stem}`, CONTENT_W - 12);
      const optLines = (q.options || []).flatMap(o => wrapTextLines(tmp, `    ${o}`, CONTENT_W - 24));
      const teacherLines = isTeacher
        ? [
            ...wrapTextLines(tmp, `【答案】${q.answer}`, CONTENT_W - 24),
            ...wrapTextLines(tmp, `【解析】${q.analysis}`, CONTENT_W - 24),
            ...wrapTextLines(tmp, `【手册标签】${q.chapterTitle || currentExam.subjectLabel} → ${q.manualNodeTitle}`, CONTENT_W - 24)
          ]
        : [];
      const h = 24 + (stemLines.length + optLines.length) * 28 + (isTeacher ? (teacherLines.length * 26 + 24) : (q.questionType === '解答' ? 68 : 10));
      return { q, stemLines, optLines, teacherLines, h };
    });

    const totalH = 290 + blocks.reduce((a, b) => a + b.h, 0) + 120;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, totalH);

    // 左侧标准 A4 装订密封线
    ctx.strokeStyle = '#64748B';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(64, 30);
    ctx.lineTo(64, totalH - 30);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.translate(36, Math.min(720, totalH / 2));
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#475569';
    ctx.font = '15px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('班级：___________    姓名：___________    学号：___________    密 封 线 内 请 勿 答 题', 0, 0);
    ctx.restore();

    // 试卷抬头
    ctx.fillStyle = '#1B365D';
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px "PingFang SC", sans-serif';
    ctx.fillText(`${currentExam.title}${isTeacher ? '（教师解析版）' : '（学生原卷）'}`, (PAD_L + W - PAD_R) / 2, 76);

    ctx.fillStyle = '#5C6773';
    ctx.font = '16px "PingFang SC", sans-serif';
    ctx.fillText(`时长：${currentExam.durationMinutes} 分钟   总分：${currentExam.totalScore} 分   得分：_______   复核：_______`, (PAD_L + W - PAD_R) / 2, 114);

    ctx.strokeStyle = '#1B365D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD_L, 136);
    ctx.lineTo(W - PAD_R, 136);
    ctx.stroke();

    let y = 178;
    ctx.textAlign = 'left';
    blocks.forEach(b => {
      ctx.fillStyle = '#111827';
      ctx.font = '18px "PingFang SC", sans-serif';
      b.stemLines.forEach(ln => {
        ctx.fillText(ln, PAD_L, y);
        y += 28;
      });
      ctx.fillStyle = '#334155';
      b.optLines.forEach(ln => {
        ctx.fillText(ln, PAD_L, y);
        y += 28;
      });
      if (isTeacher && b.teacherLines.length > 0) {
        const boxH = b.teacherLines.length * 26 + 16;
        ctx.fillStyle = '#F2F8F5';
        ctx.fillRect(PAD_L, y - 10, CONTENT_W, boxH);
        ctx.fillStyle = '#1F4E46';
        ctx.font = '16px "PingFang SC", sans-serif';
        let ty = y + 14;
        b.teacherLines.forEach(ln => {
          ctx.fillText(ln, PAD_L + 12, ty);
          ty += 26;
        });
        y += boxH + 10;
      } else {
        y += (b.q.questionType === '解答' ? 68 : 14);
      }
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD_L, y - 6);
      ctx.lineTo(W - PAD_R, y - 6);
      ctx.stroke();
      y += 22;
    });

    // 全屏防伪水印
    ctx.save();
    ctx.fillStyle = 'rgba(27, 54, 93, 0.08)';
    ctx.font = 'bold 18px "PingFang SC", sans-serif';
    for (let wy = 160; wy < totalH; wy += 240) {
      for (let wx = 90; wx < W; wx += 420) {
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(-0.4);
        ctx.fillText(WATERMARK_TEXT, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();

    const a = document.createElement('a');
    a.download = `${currentExam.title}_${isTeacher ? '教师解析版' : '学生原卷版'}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  // ==================== 模块 4：积分钱包、四种服务模式、推广海报与提现 ====================
  const MODE_LABELS = {
    self_study: '自学模式',
    qa_tutoring: '答疑模式',
    periodic_eval: '定期测评模式',
    enrolled_course: '报课模式'
  };

  function getActiveStudentId() {
    if (!state.studentId) {
      state.studentId = 'stu_' + Date.now().toString(36);
      saveState(false);
    }
    return state.studentId;
  }

  async function loadWalletSummary() {
    if (!accessCode || !bootstrap?.d1Enabled) return;
    try {
      const sid = getActiveStudentId();
      const alias = encodeURIComponent(state.profile?.studentName || '新学员');
      walletSummary = await apiFetch(`/api/v1/wallet/summary?studentId=${encodeURIComponent(sid)}&alias=${alias}`);
      updateHeaderWalletButton();
      if (state.activeView === 'viewPhase3Preview') renderWalletView();
    } catch (_) { /* ignore if offline */ }
  }

  function updateHeaderWalletButton() {
    const btn = $('headerWalletBtn');
    if (!btn) return;
    if (!walletSummary) {
      btn.textContent = '💰 积分钱包 · 加载中';
      return;
    }
    const modeLabel = MODE_LABELS[walletSummary.serviceMode] || '自学模式';
    btn.textContent = `💰 积分: ${walletSummary.pointsBalance} · ${modeLabel}`;
  }

  async function silentSelfStudyTrack(moduleKey) {
    if (!accessCode || !bootstrap?.d1Enabled) return;
    if (walletSummary && walletSummary.serviceMode !== 'self_study' && !walletSummary.courseEnabled) return;
    try {
      const res = await apiFetch('/api/v1/wallet/consume', {
        method: 'POST',
        body: JSON.stringify({ studentId: getActiveStudentId(), kind: 'self_study', moduleKey })
      });
      if (walletSummary) walletSummary.pointsBalance = res.balanceAfter;
      updateHeaderWalletButton();
    } catch (_) { /* non-blocking usage tracking */ }
  }

  function initWalletView() {
    loadWalletSummary().then(() => {
      renderWalletView();
      drawReferralPoster();
    });
    updateQaCostPreview();
  }

  function renderWalletView() {
    if (!walletSummary) return;
    const w = walletSummary;
    $('walletPointsVal').textContent = `${w.pointsBalance} 分`;
    $('walletModeVal').textContent = MODE_LABELS[w.serviceMode] || '自学模式';
    $('walletCourseVal').textContent = w.courseEnabled ? '已开通（除答疑全免）' : '未开通';
    $('walletInviteCodeVal').textContent = w.inviteCode || '--';
    $('evalFreqSelect').value = w.evalFrequency || 'biweekly';

    document.querySelectorAll('#viewPhase3Preview [data-service-mode]').forEach(card => {
      card.classList.toggle('selected', card.dataset.serviceMode === w.serviceMode);
    });

    const shareUrl = `${window.location.origin}/?ref=${encodeURIComponent(w.inviteCode || '')}`;
    $('inviteShareLinkInput').value = shareUrl;

    const wds = w.withdrawals || [];
    $('walletWithdrawalsBody').innerHTML = wds.length
      ? wds.map(r => {
          const stLabel = r.audit_status === 'approved' ? '<span class="badge badge-green">已审核打款</span>' : (r.audit_status === 'rejected' ? '<span class="badge badge-red">已驳回退分</span>' : '<span class="badge badge-yellow">待审核</span>');
          return `<tr><td><strong>${r.points_amount}分</strong> (¥${r.cash_yuan})</td><td>${escapeHtml(r.admin_note || '--')}</td><td>${stLabel}</td></tr>`;
        }).join('')
      : '<tr><td colspan="3" style="color:var(--muted); text-align:center;">暂无提现记录</td></tr>';

    const led = w.ledger || [];
    $('walletLedgerBody').innerHTML = led.length
      ? led.map(l => {
          const sign = l.delta > 0 ? `<span style="color:var(--green); font-weight:700;">+${l.delta}</span>` : `<span style="color:var(--red); font-weight:700;">${l.delta}</span>`;
          return `<tr><td>${sign}</td><td>${l.balance_after}</td><td>${escapeHtml(l.description)}<br><span style="font-size:11px; color:var(--muted);">${escapeHtml(l.created_at || '')}</span></td></tr>`;
        }).join('')
      : '<tr><td colspan="3" style="color:var(--muted); text-align:center;">暂无收支明细</td></tr>';
  }

  function updateQaCostPreview() {
    const subMode = $('qaSubModeSelect').value;
    const stage = $('qaGradeStageSelect').value;
    const dur = Math.max(10, Math.min(180, Number($('qaDurationInput').value) || 20));
    const base = subMode === 'full_package' ? 30 : 8;
    const extra = Math.max(0, Math.ceil((dur - 15) / 15)) * 4;
    const factor = stage === 'senior' ? 1.2 : 1.0;
    const total = Math.round((base + extra) * factor);
    $('qaCostPreviewText').textContent = `预计扣除：${total} 积分（基础功能 ${base} 分 + 时长加项 ${extra} 分 × 年级系数 ${factor}）`;
  }

  async function switchServiceMode(mode) {
    try {
      const res = await apiFetch('/api/v1/wallet/switch-mode', {
        method: 'POST',
        body: JSON.stringify({
          studentId: getActiveStudentId(),
          serviceMode: mode,
          evalFrequency: $('evalFreqSelect').value
        })
      });
      if (walletSummary) {
        walletSummary.serviceMode = res.serviceMode;
        walletSummary.evalFrequency = res.evalFrequency;
      }
      updateHeaderWalletButton();
      renderWalletView();
    } catch (err) {
      alert(err.message);
    }
  }

  async function executeWalletConsume(payload) {
    try {
      const res = await apiFetch('/api/v1/wallet/consume', {
        method: 'POST',
        body: JSON.stringify({ studentId: getActiveStudentId(), ...payload })
      });
      await loadWalletSummary();
      const rebateMsg = res.rebateAwarded > 0 ? `\n（已同步向您的邀请人返利 ${res.rebateAwarded} 积分）` : '';
      alert(`业务已入账！\n${res.description}\n本次扣分：${res.deducted} 分，当前余额：${res.balanceAfter} 分。${rebateMsg}`);
    } catch (err) {
      alert(`扣分结算提示：${err.message}`);
    }
  }

  async function bindFriendInviteCode() {
    const code = $('bindFriendCodeInput').value.trim().toUpperCase();
    if (!code) {
      alert('请输入好友分享的邀请码。');
      return;
    }
    try {
      const res = await apiFetch('/api/v1/wallet/referral-bind', {
        method: 'POST',
        body: JSON.stringify({ studentId: getActiveStudentId(), inviteCode: code })
      });
      await loadWalletSummary();
      alert(`绑定成功！\n已为您增加迎新奖励 +${res.welcomeBonus} 积分（当前余额 ${res.balanceAfter} 分），同时已为好友【${res.inviterName}】发放 +${res.inviterBonus} 邀请积分！`);
    } catch (err) {
      alert(`绑定失败：${err.message}`);
    }
  }

  async function submitWithdrawRequest() {
    if (!$('withdrawRulesCheck').checked) {
      alert('请先勾选《积分与奖励规则》（含未成年人在家长监护下参与提示）。');
      return;
    }
    const pts = Number($('withdrawPointsInput').value) || 0;
    const account = $('withdrawAccountInput').value.trim();
    try {
      const res = await apiFetch('/api/v1/wallet/withdraw-request', {
        method: 'POST',
        body: JSON.stringify({
          studentId: getActiveStudentId(),
          pointsAmount: pts,
          accountNote: account,
          rulesAccepted: true
        })
      });
      $('withdrawAccountInput').value = '';
      await loadWalletSummary();
      alert(`提现申请已提交审核（单号 ${res.withdrawId}）！\n申请 ${res.pointsAmount} 积分折合 ¥${res.cashYuan}，当前剩余积分 ${res.balanceAfter}。`);
    } catch (err) {
      alert(`申请提现失败：${err.message}`);
    }
  }

  function drawReferralPoster() {
    const canvas = $('referralPosterCanvas');
    if (!canvas) return;
    const W = 720;
    const H = 960;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#1B365D');
    grad.addColorStop(0.65, '#173F47');
    grad.addColorStop(1, '#1F4E46');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#B58938';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    ctx.fillStyle = '#F6E5B8';
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px "PingFang SC", sans-serif';
    ctx.fillText('XU STUDIO · 铭师学习规划管理平台', W / 2, 92);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 38px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('16 科考点过关红黄绿灯', W / 2, 165);
    ctx.fillText('一站式定制提分方案', W / 2, 222);

    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.font = '20px "PingFang SC", sans-serif';
    ctx.fillText('拍卷结构测漏 · 专属消灯任务包 · AI 智能组卷 · 精装成长报告', W / 2, 278);

    // 居中白色卡片
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(68, 330, W - 136, 470);

    const code = walletSummary?.inviteCode || 'MXU2026';
    const stuName = state.profile?.studentName || '铭师学员';

    ctx.fillStyle = '#1B365D';
    ctx.font = 'bold 24px "PingFang SC", sans-serif';
    ctx.fillText(`来自【${stuName}】的专属学习邀请函`, W / 2, 392);

    ctx.fillStyle = '#5C6773';
    ctx.font = '18px "PingFang SC", sans-serif';
    ctx.fillText('访问 https://mrxu.uk 绑定下方邀请码', W / 2, 434);
    ctx.fillText('新人立享 +10 积分，消费再返 10% 积分奖励', W / 2, 466);

    // 专属邀请码金色框
    ctx.fillStyle = '#FBF6EA';
    ctx.fillRect(140, 500, W - 280, 96);
    ctx.strokeStyle = '#B58938';
    ctx.lineWidth = 2;
    ctx.strokeRect(140, 500, W - 280, 96);

    ctx.fillStyle = '#8A621B';
    ctx.font = '16px "PingFang SC", sans-serif';
    ctx.fillText('专属邀请码（点击复制或绑定）', W / 2, 532);
    ctx.fillStyle = '#1B365D';
    ctx.font = 'bold 38px monospace';
    ctx.fillText(code, W / 2, 578);

    // 机构印章与二维码矩阵标识
    ctx.strokeStyle = '#1B365D';
    ctx.lineWidth = 2;
    ctx.strokeRect(W / 2 - 58, 622, 116, 116);
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (((r * 7 + c + code.charCodeAt(r % code.length)) % 2) === 0 || (r < 2 && c < 2) || (r < 2 && c > 4) || (r > 4 && c < 2)) {
          ctx.fillStyle = '#1B365D';
          ctx.fillRect(W / 2 - 48 + c * 14, 632 + r * 14, 11, 11);
        }
      }
    }
    ctx.fillStyle = '#1F4E46';
    ctx.font = 'bold 16px "PingFang SC", sans-serif';
    ctx.fillText('mrxu.uk · 扫码 / 访问绑定即刻启程', W / 2, 772);

    ctx.fillStyle = '#F6E5B8';
    ctx.font = '17px "PingFang SC", sans-serif';
    ctx.fillText('许老师工作室 · 电话/微信：18986280310 · 百步亭现代城一区', W / 2, 868);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '14px "PingFang SC", sans-serif';
    ctx.fillText('温馨提示：未成年学员请在家长监护下参与积分活动 · 原创体系 盗版必究', W / 2, 906);
  }

  // ==================== 模块 5：管理员全能总控台 & 智能切题三级去重入库 ====================
  function initAdminConsoleView() {
    if (!$('ingestStageSelect').dataset.inited) {
      $('ingestStageSelect').value = state.manualStage === 'junior' ? 'junior' : 'senior';
      $('ingestStageSelect').dataset.inited = '1';
      renderIngestSubjectAndNodeSelects();
    }
    loadAdminOverview();
  }

  function renderIngestSubjectAndNodeSelects() {
    if (!bootstrap?.subjectOrder) return;
    const stage = $('ingestStageSelect').value === 'junior' ? 'junior' : 'senior';
    const order = bootstrap.subjectOrder[stage] || [];
    const curSubj = $('ingestSubjectSelect').value;
    $('ingestSubjectSelect').innerHTML = order
      .map(s => `<option value="${escapeHtml(s.key)}">${escapeHtml(s.label)}</option>`)
      .join('');
    if (order.some(s => s.key === curSubj)) $('ingestSubjectSelect').value = curSubj;

    const subjKey = $('ingestSubjectSelect').value || 'math';
    const nodes = (bootstrap.catalog?.[stage]?.[subjKey]?.chapters || []).flatMap(c => c.items);
    $('ingestKbNodeSelect').innerHTML = nodes.slice(0, 120).map(n =>
      `<option value="${escapeHtml(n.nodeId)}">${escapeHtml(n.chapterTitle)} · ${escapeHtml(n.title)}</option>`
    ).join('');
  }

  async function loadAdminOverview() {
    if (!accessCode || !bootstrap?.d1Enabled) return;
    try {
      const data = await apiFetch('/api/v1/admin/overview');
      const stus = data.students || [];
      $('adminStudentsTableBody').innerHTML = stus.length
        ? stus.map(s => `
            <tr>
              <td>
                <strong>${escapeHtml(s.display_alias)}</strong>
                <div style="font-size:11.5px; color:var(--muted);">${escapeHtml(s.grade_label)} · ${escapeHtml(s.province || '')}${escapeHtml(s.city || '')}</div>
              </td>
              <td><span class="badge badge-navy">${escapeHtml(MODE_LABELS[s.service_mode] || s.service_mode || '自学模式')}</span></td>
              <td><strong style="color:var(--accent);">${s.points_balance ?? 100}</strong> 分</td>
              <td>${Number(s.course_enabled) === 1 ? '<span class="badge badge-green">已开通报课</span>' : '<span class="badge badge-yellow">未开通</span>'}</td>
              <td style="display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" class="btn btn-primary btn-sm" data-adm-proxy="${escapeHtml(s.student_id)}">代管切换</button>
                <button type="button" class="btn btn-outline btn-sm" data-adm-pts="${escapeHtml(s.student_id)}" data-delta="100">+100分</button>
                <button type="button" class="btn btn-outline btn-sm" data-adm-pts="${escapeHtml(s.student_id)}" data-delta="-50">-50分</button>
                <button type="button" class="btn btn-accent btn-sm" data-adm-course="${escapeHtml(s.student_id)}" data-enable="${Number(s.course_enabled) === 1 ? '0' : '1'}">${Number(s.course_enabled) === 1 ? '关闭报课' : '开通报课'}</button>
              </td>
            </tr>
          `).join('')
        : '<tr><td colspan="5" style="color:var(--muted); text-align:center;">暂无云端学员记录</td></tr>';

      const wds = data.withdrawals || [];
      $('adminWithdrawalsTableBody').innerHTML = wds.length
        ? wds.map(w => `
            <tr>
              <td>${escapeHtml(w.display_alias || w.student_id)}</td>
              <td><strong>${w.points_amount}分</strong> / ¥${w.cash_yuan}</td>
              <td>${escapeHtml(w.admin_note || '--')}</td>
              <td>${w.audit_status === 'pending' ? '<span class="badge badge-yellow">待审核</span>' : (w.audit_status === 'approved' ? '<span class="badge badge-green">已通过</span>' : '<span class="badge badge-red">已驳回</span>')}</td>
              <td>
                ${w.audit_status === 'pending'
                  ? `<button type="button" class="btn btn-accent btn-sm" data-wd-audit="${escapeHtml(w.withdraw_id)}" data-dec="approved">✓ 批准</button>
                     <button type="button" class="btn btn-outline btn-sm" data-wd-audit="${escapeHtml(w.withdraw_id)}" data-dec="rejected">✕ 驳回退分</button>`
                  : '<span style="font-size:12px; color:var(--muted);">已完结</span>'}
              </td>
            </tr>
          `).join('')
        : '<tr><td colspan="5" style="color:var(--muted); text-align:center;">暂无提现审核申请</td></tr>';

      const kbs = data.knowledgeDocs || [];
      $('kbDocsTableBody').innerHTML = kbs.length
        ? kbs.map(d => `
            <tr>
              <td><span class="badge ${d.kb_category === '总结归纳类' ? 'badge-gold' : 'badge-navy'}">${escapeHtml(d.kb_category)}</span></td>
              <td><strong>${escapeHtml(d.title)}</strong><br><span style="font-size:11.5px; color:var(--muted);">${escapeHtml(d.stage)} · ${escapeHtml(d.subject_key)}</span></td>
              <td style="font-size:12px; color:var(--muted);">${escapeHtml(d.created_at || '')}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="3" style="color:var(--muted); text-align:center;">暂无已上传的知识库讲义</td></tr>';

      $('qbStatsBadge').textContent = `云端题库：${data.questionBankCount || 0} 题（含变式 ${data.variantQuestionCount || 0} 题）`;

      const qs = data.recentQuestions || [];
      $('recentQuestionsBody').innerHTML = qs.length
        ? qs.map(q => `
            <tr>
              <td><span class="badge badge-navy">${escapeHtml(q.question_type)} · ${escapeHtml(q.difficulty)}</span></td>
              <td>${escapeHtml(String(q.stem_text || '').slice(0, 75))}</td>
              <td>${Number(q.is_variant) === 1 ? '<span class="badge badge-gold">变式训练题</span>' : '<span class="badge badge-green">标准原题</span>'}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="3" style="color:var(--muted); text-align:center;">云端自定义题库暂无新增试题，请使用上方切题工具入库</td></tr>';
    } catch (err) {
      console.error('admin overview err', err);
    }
  }

  // 零外部依赖解析 .docx (ZIP -> word/document.xml) / .txt / PDF 文本流
  async function extractTextFromUploadedFile(file) {
    const name = (file?.name || '').toLowerCase();
    if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')) {
      return await file.text();
    }
    if (name.endsWith('.docx')) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const view = new DataView(buf.buffer);
      let offset = 0;
      const decoder = new TextDecoder('utf-8');
      while (offset + 30 < buf.length) {
        if (view.getUint32(offset, true) !== 0x04034b50) break;
        const method = view.getUint16(offset + 8, true);
        const compSize = view.getUint32(offset + 18, true);
        const nameLen = view.getUint16(offset + 26, true);
        const extraLen = view.getUint16(offset + 28, true);
        const fname = decoder.decode(buf.subarray(offset + 30, offset + 30 + nameLen));
        const dataStart = offset + 30 + nameLen + extraLen;
        const dataEnd = dataStart + compSize;
        if (fname === 'word/document.xml') {
          let xmlStr = '';
          const payload = buf.subarray(dataStart, dataEnd);
          if (method === 0) {
            xmlStr = decoder.decode(payload);
          } else if (method === 8 && typeof DecompressionStream !== 'undefined') {
            const ds = new DecompressionStream('deflate-raw');
            const stream = new Blob([payload]).stream().pipeThrough(ds);
            xmlStr = await new Response(stream).text();
          }
          if (xmlStr) {
            const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
            const paras = Array.from(doc.getElementsByTagName('w:p')).map(p =>
              Array.from(p.getElementsByTagName('w:t')).map(t => t.textContent).join('')
            ).filter(Boolean);
            return paras.join('\n');
          }
        }
        offset = dataEnd;
      }
      throw new Error('未能从该 .docx 中提取出 XML 段落，请尝试另存为标准 docx 或直接复制正文粘贴。');
    }
    if (name.endsWith('.pdf')) {
      const raw = await file.text();
      const chunks = raw.match(/\(([^()\\]{4,200})\)/g) || [];
      const text = chunks.map(c => c.slice(1, -1)).filter(s => /[\u4e00-\u9fa5A-Za-z0-9]/.test(s)).join('\n');
      if (text.length < 30) {
        throw new Error('检测到该 PDF 为扫描图片版或压缩流格式，建议在 Step 1【拍卷测漏】传图提取或复制 PDF 文本粘贴到下方文本框。');
      }
      return text;
    }
    return await file.text();
  }

  function loadSampleIngestText() {
    $('ingestTargetSelect').value = 'question_bank';
    $('ingestStageSelect').value = 'senior';
    renderIngestSubjectAndNodeSelects();
    $('ingestSubjectSelect').value = 'math';
    $('ingestKbPanel').classList.add('hidden');
    $('ingestQbPanel').classList.remove('hidden');

    $('ingestRawTextInput').value = [
      '1. 已知集合 A = {x | x² - 3x - 4 ≤ 0}，B = {x | y = ln(x - 1)}，则 A ∩ B = （  ）',
      'A. (1, 4]  B. [1, 4]  C. [-1, 4]  D. (1, 4)',
      '【答案】A',
      '【解析】解得 A = [-1, 4]，B = (1, +∞)，故交集为 (1, 4]。',
      '',
      '2. 已知正实数 a, b 满足 a + 2b = 4，则 1/a + 2/b 的最小值为（  ）',
      'A. 9/4  B. 4  C. 5/2  D. 3',
      '【答案】A',
      '【解析】把 a+2b=4 除 4 进行“1 的代换”展开，用基本不等式求最小值。',
      '',
      '3. 已知函数 f(x) = x³ - 3ax² + 2 在 x = 2 处取得极小值，若对任意 x ∈ [-1, 3] 不等式 f(x) ≤ m 恒成立，求实数 a 的值及 m 的最小值。',
      '【答案】a = 1，m 的最小值为 2。',
      '【解析】由 f\'(2) = 0 解出 a = 1，再求导确定闭区间 [-1, 3] 上的最大值即可。'
    ].join('\n');
  }

  async function runIngestPreview() {
    const rawText = $('ingestRawTextInput').value.trim();
    if (!rawText) {
      alert('请先上传试卷文档或点击右上角“载入演练样卷”。');
      return;
    }
    const btn = $('runIngestPreviewBtn');
    btn.disabled = true;
    btn.textContent = '切题分析与三级防重中...';
    try {
      const stage = $('ingestStageSelect').value;
      const subjectKey = $('ingestSubjectSelect').value;
      const res = await apiFetch('/api/v1/admin/ingest-preview', {
        method: 'POST',
        body: JSON.stringify({ rawText, stage, subjectKey })
      });
      ingestPreviewItems = res.items || [];
      const sum = res.summary || {};

      const alertBox = $('ingestDedupAlertBox');
      if (sum.semanticWarningCount > 0 || sum.exactDuplicateCount > 0) {
        alertBox.innerHTML = `<strong>三级防重拦截预警：</strong>共切出 <strong>${sum.total}</strong> 题，其中 <span style="color:var(--red);">精确重复 ${sum.exactDuplicateCount} 题</span>（默认舍弃）、<span style="color:var(--yellow);">语义相似度 ≥ 85% 预警 ${sum.semanticWarningCount} 题</span>（请下方决定“作为重复题舍弃”或“归类为变式训练题”），干净新题 ${sum.cleanCount} 题。`;
        alertBox.classList.remove('hidden');
      } else {
        alertBox.innerHTML = `<strong>切题查重通过：</strong>共切分 <strong>${sum.total}</strong> 道独立单题，未检出重复或高相似题，请核对下方难度与手册标签后点击确认入库。`;
        alertBox.classList.remove('hidden');
      }

      const nodes = (bootstrap.catalog?.[stage]?.[subjectKey]?.chapters || []).flatMap(c => c.items);
      const getNodeOpts = selId => nodes.slice(0, 120).map(n =>
        `<option value="${escapeHtml(n.nodeId)}" ${n.nodeId === selId ? 'selected' : ''}>${escapeHtml(n.chapterTitle)} · ${escapeHtml(n.title)}</option>`
      ).join('');

      $('ingestPreviewWrap').classList.remove('hidden');
      $('ingestPreviewTableBody').innerHTML = ingestPreviewItems.map((it, idx) => {
        const rowCls = it.dedupStatus === 'exact_duplicate' ? 'dedup-row-exact' : (it.dedupStatus === 'semantic_warning' ? 'dedup-row-warn' : '');
        const dedupTag = it.dedupStatus === 'exact_duplicate'
          ? `<span class="badge badge-red">一级拦截 · 100% 文本重复</span>`
          : (it.dedupStatus === 'semantic_warning'
            ? `<span class="badge badge-yellow">二级预警 · 语义相似 ${it.similarityPct}%</span>`
            : `<span class="badge badge-green">查重通过 (${it.similarityPct}%)</span>`);
        const simHint = it.similarTo ? `<div style="font-size:11.5px; color:var(--muted); margin-top:4px;">相似基准题：${escapeHtml(it.similarTo.stem)}</div>` : '';

        return `
          <tr class="${rowCls}">
            <td><strong>#${it.seq}</strong><br><span class="badge badge-navy">${escapeHtml(it.questionType)}</span></td>
            <td>
              <div style="font-size:13px;">${escapeHtml(it.stem)}</div>
              <div style="margin-top:4px;">${dedupTag}</div>
              ${simHint}
            </td>
            <td>
              <select class="select" data-ing-diff="${idx}" style="font-size:12px;">
                <option value="基础" ${it.difficulty === '基础' ? 'selected' : ''}>基础</option>
                <option value="中等" ${it.difficulty === '中等' ? 'selected' : ''}>中等</option>
                <option value="压轴" ${it.difficulty === '压轴' ? 'selected' : ''}>压轴</option>
              </select>
            </td>
            <td>
              <select class="select" data-ing-node="${idx}" style="font-size:12px; min-width:190px;">
                ${getNodeOpts(it.manualNodeId)}
              </select>
            </td>
            <td>
              <select class="select" data-ing-dec="${idx}" style="font-size:12px; min-width:160px;">
                <option value="approve" ${it.defaultDecision === 'approve' ? 'selected' : ''}>✓ 作为标准题入库</option>
                <option value="variant" ${it.defaultDecision === 'variant' ? 'selected' : ''}>★ 归类为变式训练题</option>
                <option value="discard" ${it.defaultDecision === 'discard' ? 'selected' : ''}>✕ 作为重复题舍弃</option>
              </select>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      alert(`切题查重失败：${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ AI 自动切题 · 匹配难度标签 · 一二级防重预览 →';
    }
  }

  async function confirmIngestToBank() {
    if (!ingestPreviewItems.length) return;
    const payload = ingestPreviewItems.map((it, idx) => ({
      ...it,
      difficulty: document.querySelector(`[data-ing-diff="${idx}"]`)?.value || it.difficulty,
      manualNodeId: document.querySelector(`[data-ing-node="${idx}"]`)?.value || it.manualNodeId,
      decision: document.querySelector(`[data-ing-dec="${idx}"]`)?.value || it.defaultDecision
    }));

    try {
      const res = await apiFetch('/api/v1/admin/ingest-commit', {
        method: 'POST',
        body: JSON.stringify({ items: payload })
      });
      $('ingestPreviewWrap').classList.add('hidden');
      $('ingestDedupAlertBox').classList.add('hidden');
      ingestPreviewItems = [];
      await loadAdminOverview();
      alert(`入库完成！\n标准原题入库：${res.approvedCount} 题\n变式训练题入库：${res.variantCount} 题\n已舍弃重复题：${res.discardedCount} 题`);
    } catch (err) {
      alert(`确认入库失败：${err.message}`);
    }
  }

  async function runDeepDedupCleanup() {
    try {
      const res = await apiFetch('/api/v1/admin/deep-dedup-clean', { method: 'POST', body: '{}' });
      await loadAdminOverview();
      alert(`全库深度查重清理完成！\n累计扫描云端题库：${res.scannedCount} 题\n清理精确重复题：${res.exactRemovedCount} 题\n自动归类变式训练题：${res.variantMarkedCount} 题`);
    } catch (err) {
      alert(`深度查重失败：${err.message}`);
    }
  }

  async function saveKbDoc() {
    const title = $('ingestKbTitleInput').value.trim();
    const content = $('ingestKbContentInput').value.trim();
    if (!title || !content) {
      alert('请填写知识库讲义标题与正文内容。');
      return;
    }
    try {
      const res = await apiFetch('/api/v1/admin/kb-save', {
        method: 'POST',
        body: JSON.stringify({
          stage: $('ingestStageSelect').value,
          subjectKey: $('ingestSubjectSelect').value,
          kbCategory: $('ingestKbCategorySelect').value,
          manualNodeId: $('ingestKbNodeSelect').value,
          title,
          contentMarkdown: content
        })
      });
      $('ingestKbTitleInput').value = '';
      $('ingestKbContentInput').value = '';
      await loadAdminOverview();
      alert(`知识库讲义已安全归档！（分类：${res.kbCategory}）`);
    } catch (err) {
      alert(`知识库归档失败：${err.message}`);
    }
  }

  // ==================== 事件绑定 ====================
  function bindEvents() {
    $('fillLocalCodeBtn').addEventListener('click', () => {
      $('accessCodeInput').value = $('fillLocalCodeBtn').dataset.hint || 'MXU-LOCAL-DEV';
    });

    $('unlockBtn').addEventListener('click', () => {
      unlockAndBootstrap($('accessCodeInput').value, $('authRoleSelect').value, false);
    });

    $('accessCodeInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') $('unlockBtn').click();
    });

    $('lockAppBtn').addEventListener('click', lockApplication);
    $('openWizardBtn').addEventListener('click', () => openWizard(true));
    $('closeWizardBtn').addEventListener('click', () => $('wizardSection').classList.add('hidden'));

    // 视角切换（学员 vs 管理员）
    ['roleStudentBtn', 'roleAdminBtn'].forEach(id => {
      $(id).addEventListener('click', () => {
        state.role = $(id).dataset.role;
        sessionStorage.setItem(SESSION_ROLE_KEY, state.role);
        saveState();
        syncRoleUI();
        if (state.activeView === 'viewStep2') renderStep2Manual();
      });
    });

    // 主导航点击
    document.querySelectorAll('#mainNavBar [data-view]').forEach(btn => {
      btn.addEventListener('click', () => switchMainView(btn.dataset.view));
    });

    // 向导 Step 1
    document.querySelectorAll('#wizPane1 [data-category]').forEach(card => {
      card.addEventListener('click', () => {
        state.profile.enrollmentCategory = card.dataset.category;
        document.querySelectorAll('#wizPane1 [data-category]').forEach(c => c.classList.toggle('selected', c === card));
        toggleCategoryPanels();
      });
    });
    $('wizNext1Btn').addEventListener('click', () => setWizardStep(2));

    // 向导 Step 2
    $('sprintSubTypeSelect').addEventListener('change', initSprintRegionSelectors);
    $('sprintProvinceSelect').addEventListener('change', () => onProvinceChanged(true));
    $('sprintCitySelect').addEventListener('change', fetchRegionalSchools);
    $('sprintTrackSelect').addEventListener('change', fetchRegionalSchools);

    $('targetSchoolSelect').addEventListener('change', e => {
      try {
        const list = JSON.parse(e.target.dataset.schools || '[]');
        applySelectedSchool(list[Number(e.target.value)]);
      } catch (_) { /* ignore */ }
    });

    $('aiLookupCutoffBtn').addEventListener('click', lookupUnlistedSchoolCutoff);
    $('adminRefreshCutoffsBtn').addEventListener('click', async () => {
      await fetchRegionalSchools();
      alert('已完成本地区最新年度录取线基准校准！');
    });

    ['artRatioPresetSelect', 'artCultureWeightInput', 'artMajorWeightInput', 'artMajorMaxInput', 'artMajorScoreInput', 'artTargetCombinedInput', 'localMaxScoreInput'].forEach(id => {
      $(id).addEventListener('input', () => {
        if ($('sprintSubTypeSelect').value === 'gaokao_art') updateArtCalculationPreview();
      });
      $(id).addEventListener('change', () => {
        if ($('sprintSubTypeSelect').value === 'gaokao_art') updateArtCalculationPreview();
      });
    });

    $('targetCutoffScoreInput').addEventListener('input', () => {
      if ($('sprintSubTypeSelect').value === 'gaokao_art') {
        $('artTargetCombinedInput').value = $('targetCutoffScoreInput').value;
        updateArtCalculationPreview();
      }
    });

    document.querySelectorAll('#syncConfigPanel [data-growth]').forEach(card => {
      card.addEventListener('click', () => {
        state.profile.growthSubType = card.dataset.growth;
        document.querySelectorAll('#syncConfigPanel [data-growth]').forEach(c => c.classList.toggle('selected', c === card));
      });
    });

    $('wizBack2Btn').addEventListener('click', () => setWizardStep(1));
    $('wizNext2Btn').addEventListener('click', () => setWizardStep(3));

    // 向导 Step 3
    document.querySelectorAll('#wizPane3 [data-rhythm]').forEach(card => {
      card.addEventListener('click', () => {
        const rhythm = card.dataset.rhythm;
        state.profile.studyRhythm = rhythm;
        document.querySelectorAll('#wizPane3 [data-rhythm]').forEach(c => c.classList.toggle('selected', c === card));
        $('hoursPerDayInput').value = rhythm === 'full_time' ? 6.5 : 2.5;
        $('cycleDaysSelect').value = rhythm === 'full_time' ? '1' : '7';
      });
    });

    $('wizBack3Btn').addEventListener('click', () => setWizardStep(2));
    $('calculatePlanBtn').addEventListener('click', () => calculateAndSaveWizard(false));
    $('finishWizardBtn').addEventListener('click', () => calculateAndSaveWizard(true));

    // 第 1 步：任务打卡与拍卷测漏
    $('dailyTaskList').addEventListener('change', e => {
      const idx = e.target.dataset.taskIdx;
      if (idx === undefined) return;
      state.tasks[Number(idx)].done = Boolean(e.target.checked);
      saveState();
      renderStep1Tasks();
    });

    $('addTaskBtn').addEventListener('click', () => {
      const title = $('newTaskTitleInput').value.trim();
      if (!title) return;
      state.tasks.push({ id: 'custom_' + Date.now(), title, duration: '35 分钟', priority: '自定义', done: false });
      $('newTaskTitleInput').value = '';
      saveState();
      renderStep1Tasks();
    });

    $('paperStageSelect').addEventListener('change', populatePaperSubjectHints);
    $('paperDropZone').addEventListener('click', () => $('paperFileInput').click());
    $('paperFileInput').addEventListener('change', e => {
      const f = e.target.files?.[0];
      $('paperFileStatus').textContent = f
        ? `已选文件：${f.name}（${Math.round(f.size / 1024)} KB），准备压缩提取结构`
        : '尚未选择图片文件';
    });

    $('analyzePaperBtn').addEventListener('click', analyzeSelectedPaper);
    $('demoPaperAnalyzeBtn').addEventListener('click', loadDemoPaperStructure);
    $('syncPaperToManualBtn').addEventListener('click', syncPaperResultsToManual);

    // 第 2 步：考点过关手册与消灯
    $('manualStageJuniorBtn').addEventListener('click', () => {
      state.manualStage = 'junior';
      state.manualSubject = 'math';
      openChapterIds.clear();
      saveState();
      renderStep2Manual();
    });
    $('manualStageSeniorBtn').addEventListener('click', () => {
      state.manualStage = 'senior';
      state.manualSubject = 'math';
      openChapterIds.clear();
      saveState();
      renderStep2Manual();
    });

    $('subjectPillsBar').addEventListener('click', e => {
      const btn = e.target.closest('[data-subj]');
      if (!btn) return;
      state.manualSubject = btn.dataset.subj;
      openChapterIds.clear();
      saveState();
      renderStep2Manual();
    });

    $('manualSearchInput').addEventListener('input', renderStep2Manual);
    $('manualLightFilter').addEventListener('change', renderStep2Manual);

    $('saveThresholdsBtn').addEventListener('click', () => {
      const redPct = Math.max(15, Math.min(90, Number($('thRedRateInput').value) || 40));
      const conWrong = Math.max(1, Math.min(10, Number($('thConsecutiveWrongInput').value) || 2));
      const yellowPct = Math.max(1, Math.min(redPct - 1, Number($('thYellowRateInput').value) || 15));
      state.thresholds = {
        redErrorRate: redPct / 100,
        yellowErrorRate: yellowPct / 100,
        redConsecutiveWrong: conWrong
      };
      saveState();
      renderStep2Manual();
    });

    $('manualChaptersContainer').addEventListener('click', e => {
      const chHeader = e.target.closest('[data-toggle-ch]');
      if (chHeader) {
        const chId = chHeader.dataset.toggleCh;
        if (openChapterIds.has(chId)) openChapterIds.delete(chId);
        else openChapterIds.add(chId);
        renderStep2Manual();
        return;
      }
      const packBtn = e.target.closest('[data-open-pack]');
      if (packBtn) {
        openLightClearPackModal(packBtn.dataset.openPack);
      }
    });

    $('manualChaptersContainer').addEventListener('change', e => {
      const nodeId = e.target.dataset.node;
      const field = e.target.dataset.field;
      if (!nodeId || !field) return;
      const val = Math.max(0, Number(e.target.value) || 0);
      const prev = state.progress[nodeId] || {
        planned_count: 5,
        completed_count: 0,
        wrong_count: 0,
        explained_count: 0,
        consecutive_wrong: 0
      };
      const beforeEv = evaluateNodeProgress(prev);
      const next = { ...prev, [field]: val };
      if (field === 'wrong_count' && val > (next.completed_count || 0)) {
        next.completed_count = val;
      }
      state.progress[nodeId] = next;
      const afterEv = evaluateNodeProgress(next);
      if (beforeEv.light_status === 'red' && afterEv.light_status !== 'red') {
        state.clearedRedCount = (state.clearedRedCount || 0) + 1;
      }
      saveState();
      renderStep2Manual();
    });

    $('closePackDrawerBtn').addEventListener('click', () => $('packDrawerBackdrop').classList.add('hidden'));
    $('packCompleteBtn').addEventListener('click', submitPackRetest);

    // 第 3 步：家长录分、报告输出与管理员润色
    $('addExamScoreBtn').addEventListener('click', () => {
      const examName = $('examNameInput').value.trim();
      const totalScore = Number($('examTotalScoreInput').value);
      const maxScore = Number($('examMaxScoreInput').value) || state.profile.localMaxScore || 680;
      const examDate = $('examDateInput').value || new Date().toISOString().slice(0, 10);
      if (!examName || !Number.isFinite(totalScore)) {
        alert('请填写完整的考试名称与实得总分。');
        return;
      }
      state.examScores.push({
        examName,
        examType: $('examTypeSelect').value,
        examDate,
        totalScore,
        maxScore,
        rankNote: $('examRankNoteInput').value.trim()
      });
      $('examNameInput').value = '';
      $('examTotalScoreInput').value = '';
      $('examRankNoteInput').value = '';
      saveState();
      renderStep3ArchiveAndReport();
    });

    $('examScoreHistoryBody').addEventListener('click', e => {
      const btn = e.target.closest('[data-del-score]');
      if (!btn) return;
      state.examScores.splice(Number(btn.dataset.delScore), 1);
      saveState();
      renderStep3ArchiveAndReport();
    });

    $('refreshReportBtn').addEventListener('click', () => renderStep3ArchiveAndReport());
    $('adminEditCommentaryBtn').addEventListener('click', () => {
      $('adminCommentaryPanel').classList.toggle('hidden');
    });
    $('applyAdminCommentaryBtn').addEventListener('click', () => {
      state.adminPolishedCommentary = $('adminCommentaryTextarea').value.trim();
      saveState();
      refreshHardcoverReport();
    });
    $('resetAdminCommentaryBtn').addEventListener('click', () => {
      state.adminPolishedCommentary = '';
      saveState();
      refreshHardcoverReport();
    });
    $('printReportBtn').addEventListener('click', () => window.print());
    $('exportLongImageBtn').addEventListener('click', exportReportLongImage);

    // 顶部云端多学员档案同步与切换
    $('syncCloudNowBtn').addEventListener('click', () => syncToCloudNow(false));
    $('newStudentBtn').addEventListener('click', createNewStudentArchive);
    $('cloudStudentSelect').addEventListener('change', e => {
      if (e.target.value) switchCloudStudent(e.target.value);
    });

    // 模块 3：自助与 AI 智能组卷中心事件
    $('examModeManualBtn').addEventListener('click', () => {
      $('examManualPanel').classList.remove('hidden');
      $('examAiPanel').classList.add('hidden');
      $('examModeManualBtn').className = 'btn btn-sm btn-primary';
      $('examModeAiBtn').className = 'btn btn-sm btn-outline';
    });
    $('examModeAiBtn').addEventListener('click', () => {
      $('examManualPanel').classList.add('hidden');
      $('examAiPanel').classList.remove('hidden');
      $('examModeAiBtn').className = 'btn btn-sm btn-accent';
      $('examModeManualBtn').className = 'btn btn-sm btn-outline';
    });

    $('examStageSelect').addEventListener('change', renderExamSubjectOptions);
    $('examSubjectSelect').addEventListener('change', () => {
      checkedExamNodes.clear();
      renderExamNodeChecklist();
    });
    $('examNodeSearchInput').addEventListener('input', renderExamNodeChecklist);
    $('examNodeChecklist').addEventListener('change', e => {
      const nid = e.target.dataset.examNode;
      if (!nid) return;
      if (e.target.checked) checkedExamNodes.add(nid);
      else checkedExamNodes.delete(nid);
    });
    $('examSelectWeakNodesBtn').addEventListener('click', selectWeakManualNodesForExam);
    $('examSelectAllNodesBtn').addEventListener('click', () => {
      document.querySelectorAll('#examNodeChecklist [data-exam-node]').forEach(cb => {
        cb.checked = true;
        checkedExamNodes.add(cb.dataset.examNode);
      });
    });
    $('examClearNodesBtn').addEventListener('click', () => {
      checkedExamNodes.clear();
      renderExamNodeChecklist();
    });

    $('generateManualExamBtn').addEventListener('click', generateManualExam);
    $('generateAiExamBtn').addEventListener('click', generateAiExam);
    $('loadSavedExamBtn').addEventListener('click', loadSavedExamById);
    document.querySelectorAll('[data-ai-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        $('aiExamPromptInput').value = btn.dataset.aiPreset;
      });
    });

    $('examViewStudentBtn').addEventListener('click', () => {
      examViewMode = 'student';
      renderAssembledExam();
    });
    $('examViewTeacherBtn').addEventListener('click', () => {
      examViewMode = 'teacher';
      renderAssembledExam();
    });
    $('printExamPaperBtn').addEventListener('click', () => window.print());
    $('exportExamImageBtn').addEventListener('click', exportExamLongImage);
    $('examQuestionsList').addEventListener('click', e => {
      const btn = e.target.closest('[data-swap-q]');
      if (!btn) return;
      swapSingleExamQuestion(Number(btn.dataset.swapQ));
    });

    // 顶栏积分钱包快捷按钮
    $('headerWalletBtn').addEventListener('click', () => switchMainView('viewPhase3Preview'));

    // 模块 4：服务模式切换、扣点结算、邀请海报裂变与提现申请
    $('refreshWalletBtn').addEventListener('click', () => loadWalletSummary());
    document.querySelectorAll('#viewPhase3Preview [data-service-mode]').forEach(card => {
      card.addEventListener('click', () => switchServiceMode(card.dataset.serviceMode));
    });
    $('selfStudyConsumeBtn').addEventListener('click', () => {
      executeWalletConsume({ kind: 'self_study', moduleKey: $('selfStudyModuleSelect').value });
    });
    $('triggerPeriodicEvalBtn').addEventListener('click', () => {
      executeWalletConsume({ kind: 'periodic_eval', evalFrequency: $('evalFreqSelect').value });
    });
    ['qaSubModeSelect', 'qaGradeStageSelect', 'qaDurationInput'].forEach(id => {
      $(id).addEventListener('input', updateQaCostPreview);
      $(id).addEventListener('change', updateQaCostPreview);
    });
    $('submitQaConsumeBtn').addEventListener('click', () => {
      executeWalletConsume({
        kind: 'qa_tutoring',
        qaSubMode: $('qaSubModeSelect').value,
        gradeStage: $('qaGradeStageSelect').value,
        durationMinutes: Number($('qaDurationInput').value) || 20
      });
    });

    $('copyInviteLinkBtn').addEventListener('click', async () => {
      const link = $('inviteShareLinkInput').value;
      try {
        await navigator.clipboard.writeText(link);
        alert('专属邀请链接已复制到剪贴板！');
      } catch (_) {
        $('inviteShareLinkInput').select();
      }
    });
    $('generatePosterBtn').addEventListener('click', drawReferralPoster);
    $('downloadPosterBtn').addEventListener('click', () => {
      drawReferralPoster();
      const a = document.createElement('a');
      a.download = `许老师工作室_专属推广海报_${walletSummary?.inviteCode || 'MXU'}.png`;
      a.href = $('referralPosterCanvas').toDataURL('image/png');
      a.click();
    });
    $('bindFriendCodeBtn').addEventListener('click', bindFriendInviteCode);
    $('submitWithdrawBtn').addEventListener('click', submitWithdrawRequest);

    // 模块 5：管理员总控台 & 智能切题三级去重入库事件
    $('refreshAdminOverviewBtn').addEventListener('click', loadAdminOverview);
    $('adminStudentsTableBody').addEventListener('click', async e => {
      const proxyBtn = e.target.closest('[data-adm-proxy]');
      if (proxyBtn) {
        state.role = 'admin';
        sessionStorage.setItem(SESSION_ROLE_KEY, 'admin');
        await switchCloudStudent(proxyBtn.dataset.admProxy);
        switchMainView('viewStep1');
        return;
      }
      const ptsBtn = e.target.closest('[data-adm-pts]');
      if (ptsBtn) {
        try {
          const sid = ptsBtn.dataset.admPts;
          const delta = Number(ptsBtn.dataset.delta);
          await apiFetch('/api/v1/admin/points-adjust', {
            method: 'POST',
            body: JSON.stringify({ studentId: sid, delta, reason: `管理员后台快捷操作（${delta > 0 ? '+' : ''}${delta}积分）` })
          });
          await loadAdminOverview();
          if (sid === state.studentId) loadWalletSummary();
        } catch (err) { alert(err.message); }
        return;
      }
      const courseBtn = e.target.closest('[data-adm-course]');
      if (courseBtn) {
        try {
          const sid = courseBtn.dataset.admCourse;
          const enable = courseBtn.dataset.enable === '1';
          await apiFetch('/api/v1/admin/toggle-course', {
            method: 'POST',
            body: JSON.stringify({ studentId: sid, courseEnabled: enable })
          });
          await loadAdminOverview();
          if (sid === state.studentId) loadWalletSummary();
        } catch (err) { alert(err.message); }
      }
    });

    $('adminWithdrawalsTableBody').addEventListener('click', async e => {
      const btn = e.target.closest('[data-wd-audit]');
      if (!btn) return;
      try {
        await apiFetch('/api/v1/admin/withdraw-audit', {
          method: 'POST',
          body: JSON.stringify({ withdrawId: btn.dataset.wdAudit, decision: btn.dataset.dec })
        });
        await loadAdminOverview();
        loadWalletSummary();
      } catch (err) { alert(err.message); }
    });

    $('ingestTargetSelect').addEventListener('change', e => {
      const isKb = e.target.value === 'knowledge_base';
      $('ingestKbPanel').classList.toggle('hidden', !isKb);
      $('ingestQbPanel').classList.toggle('hidden', isKb);
    });
    $('ingestStageSelect').addEventListener('change', renderIngestSubjectAndNodeSelects);
    $('ingestSubjectSelect').addEventListener('change', renderIngestSubjectAndNodeSelects);

    $('ingestDropZone').addEventListener('click', () => $('ingestFileInput').click());
    $('ingestFileInput').addEventListener('change', async e => {
      const f = e.target.files?.[0];
      if (!f) return;
      $('ingestFileStatus').textContent = `正在解析文件：${f.name}...`;
      try {
        const text = await extractTextFromUploadedFile(f);
        $('ingestRawTextInput').value = text;
        if ($('ingestTargetSelect').value === 'knowledge_base') {
          $('ingestKbContentInput').value = text;
        }
        $('ingestFileStatus').textContent = `已解析导入《${f.name}》（共提取 ${text.length} 字符）`;
      } catch (err) {
        $('ingestFileStatus').textContent = err.message;
        alert(err.message);
      }
    });

    $('loadSampleIngestBtn').addEventListener('click', loadSampleIngestText);
    $('runIngestPreviewBtn').addEventListener('click', runIngestPreview);
    $('confirmIngestBtn').addEventListener('click', confirmIngestToBank);
    $('runDeepDedupBtn').addEventListener('click', runDeepDedupCleanup);
    $('saveKbDocBtn').addEventListener('click', saveKbDoc);
  }

  document.addEventListener('DOMContentLoaded', () => {
    installAntiTheftLocks();
    bindEvents();
    checkAuthStatus();
  });
})();
