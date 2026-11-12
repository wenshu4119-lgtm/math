/* ============================================================
   初中全科能力筛查系统 v3
   - v2 五步范围选择器：科目 → 年级 → 学期 → 考次 → 章节范围
   - 章节 / 知识点两级勾选；九年级物理全一册自动跳过学期屏
   - 学生信息（可跳过）→ 逐题填分 → 诊断报告
   - 纯前端静态；全部内容来自 index.html 内联 window.SYS_CONFIG
   ============================================================ */
(function () {
  'use strict';

  function init(CFG) {
    if (!CFG) { showConfigError(); return; }

  /* ---------- 流程常量 ----------
     可由 SYS_CONFIG.flow 覆盖；未配置时使用下列默认值。
     调整考次、学期文案或题量配额，改配置即可，不必改 JS。 */
  var DEFAULT_FLOW = {
    semesters: [
      { key: 'shang', label: '上学期', tip: '秋季学期内容' },
      { key: 'xia', label: '下学期', tip: '春季学期内容' },
      { key: 'all', label: '全学年', tip: '上下两学期都查' }
    ],
    exams: [
      { key: 'qimo', label: '期末' },
      { key: 'qizhong', label: '期中' },
      { key: 'yuekao', label: '月考' },
      { key: 'danyuan', label: '单元测' },
      { key: 'moni', label: '模拟考' },
      { key: 'zhongkao', label: '中考' }
    ],
    weights: { math: 30, physics: 18, chem: 12 },
    maxQuestions: 60
  };
  var FLOW = CFG.flow || {};
  Object.keys(DEFAULT_FLOW).forEach(function (k) {
    if (FLOW[k] === undefined) FLOW[k] = DEFAULT_FLOW[k];
  });

  var STATE = {
    mode: null,          // 'wizard' | 'preset'
    presetKey: null,
    subjects: [],
    entries: [],         // 章节条目
    questions: [],
    answers: {},
    sceneText: '',
    student: { name: '', grade: '', school: '' }
  };

  var WIZ = {
    subjects: ['math'],
    grades: ['8'],
    semester: 'shang',
    exam: 'qimo',
    rangeMode: 'all',
    skipSemester: false,
    picked: {},          // sub|modKey|chapKey -> { kpKey: true }
    open: {}             // 展开的章节 key
  };

  var SUB_COLOR = { math: '#2563eb', physics: '#0d9488', chem: '#d97706' };
  var $ = function (s) { return document.querySelector(s); };
  var el = function (t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
  var show = function (id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    $('#' + id).classList.add('active');
    window.scrollTo(0, 0);
  };
  var toast = function (msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  };
  function labelOf(arr, key) {
    var hit = arr.filter(function (x) { return x.key === key; })[0];
    return hit ? hit.label : key;
  }
  function gradeName(g) {
    var hit = CFG.grades.filter(function (x) { return String(x.key) === String(g); })[0];
    return hit ? hit.name : g;
  }
  function subName(s) { return CFG.subjects[s] ? CFG.subjects[s].name : s; }
  function subIcon(s) { return CFG.subjects[s] ? CFG.subjects[s].icon : '✚'; }
  function unique(arr) {
    var out = [];
    arr.forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
    return out;
  }

  /* ============================================================
     范围推导：科目 × 年级 × 学期 → 学期模块 → 章节 → 知识点
     ============================================================ */
  // 由模块 key 推断学期：'8shang'→上、'8xia'→下、物理 '9' 为全一册
  function modSemesterOf(mk) {
    if (mk.indexOf('shang') >= 0) return 'shang';
    if (mk.indexOf('xia') >= 0) return 'xia';
    return 'all';
  }
  function availableGrades() {
    return CFG.grades.filter(function (g) {
      return WIZ.subjects.some(function (sub) {
        var mods = CFG.modules[sub] || {};
        return Object.keys(mods).some(function (mk) { return String(mods[mk].grade) === String(g.key); });
      });
    });
  }
  // 关键边界：所选科目 × 年级中，只要存在分上下学期的模块，就需要学期屏。
  // 只选九年级物理时，其模块为全一册，need=false → 自动跳过学期屏。
  function needSemester() {
    var need = false;
    WIZ.subjects.forEach(function (sub) {
      var mods = CFG.modules[sub] || {};
      WIZ.grades.forEach(function (g) {
        if (mods[g + 'shang'] || mods[g + 'xia']) need = true;
      });
    });
    return need;
  }
  function normalizeGrades() {
    var avail = availableGrades().map(function (g) { return String(g.key); });
    WIZ.grades = WIZ.grades.map(String).filter(function (g) { return avail.indexOf(g) >= 0; });
    if (!WIZ.grades.length) WIZ.grades = [avail[0]];
  }
  function candidateMods() {
    var out = [];
    WIZ.subjects.forEach(function (sub) {
      var mods = CFG.modules[sub] || {};
      Object.keys(mods).forEach(function (mk) {
        var mod = mods[mk];
        if (WIZ.grades.indexOf(String(mod.grade)) < 0) return;
        var ms = modSemesterOf(mk);
        // 全一册模块（如九年级物理）在任何学期选择下都纳入；
        // 跳过学期屏时不做学期过滤，避免状态污染。
        if (!WIZ.skipSemester && WIZ.semester !== 'all' && ms !== 'all' && ms !== WIZ.semester) return;
        out.push({ sub: sub, modKey: mk, modName: mod.name, mod: mod });
      });
    });
    return out;
  }
  function chapterEntries(mods) {
    var list = [];
    mods.forEach(function (m) {
      Object.keys(m.mod.children || {}).forEach(function (ck) {
        var chap = m.mod.children[ck];
        list.push({
          sub: m.sub, modKey: m.modKey, modName: m.modName,
          chapKey: ck, chapName: chap.name, kps: chap.kps || {}
        });
      });
    });
    return list;
  }
  function entryKey(e) { return e.sub + '|' + e.modKey + '|' + e.chapKey; }

  function buildSceneText() {
    var g = WIZ.grades.map(gradeName).join('+');
    var s = WIZ.subjects.map(subName).join('+');
    var sem = WIZ.skipSemester ? '全一册' : labelOf(FLOW.semesters, WIZ.semester);
    var exam = labelOf(FLOW.exams, WIZ.exam);
    return g + ' · ' + sem + ' · ' + exam + ' · ' + s;
  }

  /* ============================================================
     出题：按章节配额分配，单章节不少于 9 题，全科总量封顶
     ============================================================ */
  function diffAt(i, total) {
    if (total <= 2) return i === 0 ? '基础' : '中档';
    if (i === total - 1) return '压轴';
    if (i === total - 2) return '中档';
    var rest = total - 2;
    var base = Math.round(rest * 0.65);
    return i < base ? '基础' : '中档';
  }

  function buildQuestionsForEntry(e, kpKeys, quota) {
    var kps = kpKeys && kpKeys.length ? kpKeys : Object.keys(e.kps);
    if (!kps.length) kps = [e.chapKey];
    var items = [];
    for (var i = 0; i < quota; i++) {
      var kpKey = kps[i % kps.length];
      var kpName = e.kps[kpKey] || e.chapName;
      items.push({
        qid: entryKey(e) + '_' + i,
        subject: e.sub,
        modKey: e.modKey + '|' + e.chapKey,  // 报告按章节聚合
        modName: e.chapName,                 // 报告显示章节名
        chapKey: e.chapKey,
        kpKey: kpKey,
        kpName: kpName,
        diff: diffAt(i, quota),
        score: 3,
        label: kpName
      });
    }
    return items;
  }

  function buildAllQuestions(entries, getKps) {
    var subs = STATE.subjects;
    var multi = subs.length > 1;
    var MAX = FLOW.maxQuestions || 60;
    var perSub = {};
    if (multi) {
      var wsum = 0;
      subs.forEach(function (s) { wsum += (FLOW.weights[s] || 10); });
      subs.forEach(function (s) {
        perSub[s] = Math.max(9, Math.round(MAX * (FLOW.weights[s] || 10) / wsum));
      });
    } else {
      perSub[subs[0]] = MAX;
    }

    var qs = [];
    subs.forEach(function (sub) {
      var list = entries.filter(function (e) { return e.sub === sub; });
      if (!list.length) return;
      // 单科目按章节数控制：单章 9 题；多章每章约 6 题，总不超过 45
      var target = multi ? perSub[sub] : Math.min(45, Math.max(9, list.length * 6));
      var per = list.length === 1 ? 9 : Math.max(3, Math.min(9, Math.round(target / list.length)));
      var acc = [];
      list.forEach(function (e) {
        acc = acc.concat(buildQuestionsForEntry(e, getKps(e), per));
      });
      qs = qs.concat(acc.slice(0, target));
    });

    var counter = {};
    qs.forEach(function (q) {
      counter[q.subject] = (counter[q.subject] || 0) + 1;
      q.no = counter[q.subject];
    });
    return qs.slice(0, MAX);
  }

  /* ============================================================
     首页：五步入口 + 预设快捷入口
     ============================================================ */
  function renderPresets() {
    var box = $('#preset-list'); box.innerHTML = '';
    CFG.presets.forEach(function (p) {
      var item = el('div', 'preset-item');
      var subjName = p.subject === 'all' ? '数学+物理+化学'
        : (CFG.subjects[p.subject] ? CFG.subjects[p.subject].name : '');
      var icon = p.subject === 'all' ? '✚' : (CFG.subjects[p.subject] ? CFG.subjects[p.subject].icon : '✚');
      item.innerHTML =
        '<div class="p-label"><span class="ic">' + icon + '</span>' + p.label
        + ' <span style="font-weight:400;font-size:12px;color:#94a3b8">· ' + subjName + '</span></div>'
        + '<div class="p-tip">' + p.tip + '</div>';
      item.onclick = function () { showPresetConfirm(p); };
      box.appendChild(item);
    });
  }

  /* ============================================================
     预设快捷路径：范围确认
     ============================================================ */
  function showPresetConfirm(p) {
    STATE.mode = 'preset';
    STATE.presetKey = p.key;
    $('#scope-title').textContent = p.label;
    $('#scope-sub').textContent = '系统已按预设匹配考查范围，确认后即可开始填分';
    $('#preset-label').textContent = p.label;
    $('#preset-tip').textContent = p.tip;
    var chips = $('#preset-modules'); chips.innerHTML = '';
    if (p.subject === 'all') {
      Object.keys(p.modules).forEach(function (sub) {
        p.modules[sub].forEach(function (mk) {
          var mod = CFG.modules[sub] && CFG.modules[sub][mk];
          if (!mod) return;
          chips.appendChild(el('span', 'chip' + (sub === 'physics' ? ' sub' : (sub === 'chem' ? ' sub2' : '')), subName(sub) + '·' + mod.name));
        });
      });
    } else {
      p.modules.forEach(function (mk) {
        var mod = CFG.modules[p.subject] && CFG.modules[p.subject][mk];
        if (mod) chips.appendChild(el('span', 'chip', mod.name));
      });
    }
    show('screen-preset');
  }

  function applyPreset() {
    var p = CFG.presets.filter(function (x) { return x.key === STATE.presetKey; })[0];
    if (!p) return;
    var mods = [];
    if (p.subject === 'all') {
      Object.keys(p.modules).forEach(function (sub) {
        p.modules[sub].forEach(function (mk) {
          var mod = CFG.modules[sub] && CFG.modules[sub][mk];
          if (mod) mods.push({ sub: sub, modKey: mk, modName: mod.name, mod: mod });
        });
      });
    } else {
      p.modules.forEach(function (mk) {
        var mod = CFG.modules[p.subject] && CFG.modules[p.subject][mk];
        if (mod) mods.push({ sub: p.subject, modKey: mk, modName: mod.name, mod: mod });
      });
    }
    var entries = chapterEntries(mods);
    if (!entries.length) { toast('该预设暂无可用章节'); return; }
    STATE.mode = 'preset';
    STATE.subjects = unique(entries.map(function (e) { return e.sub; }));
    STATE.entries = entries;
    STATE.sceneText = p.label;
    STATE.questions = buildAllQuestions(entries, function (e) { return Object.keys(e.kps); });
    STATE.answers = {};
    gotoStudent();
  }

  /* ============================================================
     五步流程：屏1 科目 / 屏2 年级 / 屏3 学期 / 屏4 考次 / 屏5 章节
     ============================================================ */
  function startWizard() {
    WIZ = {
      subjects: ['math'], grades: ['8'], semester: 'shang', exam: 'qimo',
      rangeMode: 'all', skipSemester: false, picked: {}, open: {}
    };
    STATE.mode = 'wizard';
    renderSubjectScreen();
    show('screen-w-subject');
  }

  function renderSubjectScreen() {
    var box = $('#w-subject-list'); box.innerHTML = '';
    Object.keys(CFG.subjects).forEach(function (sub) {
      var s = CFG.subjects[sub];
      var on = WIZ.subjects.indexOf(sub) >= 0;
      var chip = el('div', 'subject-chip' + (on ? ' on' : ''), '<span class="ic">' + s.icon + '</span>' + s.name);
      chip.setAttribute('data-sub', sub);
      chip.onclick = function () {
        var i = WIZ.subjects.indexOf(sub);
        if (i >= 0) {
          if (WIZ.subjects.length === 1) { toast('至少保留一个科目'); return; }
          WIZ.subjects.splice(i, 1);
        } else {
          WIZ.subjects.push(sub);
        }
        normalizeGrades();
        renderSubjectScreen();
      };
      box.appendChild(chip);
    });
    $('#w-subject-summary').textContent = '已选：' + WIZ.subjects.map(subName).join(' + ');
  }

  function renderGradeScreen() {
    var box = $('#w-grade-list'); box.innerHTML = '';
    availableGrades().forEach(function (g) {
      var on = WIZ.grades.indexOf(String(g.key)) >= 0;
      var chip = el('div', 'grade-chip' + (on ? ' on' : ''), g.name);
      chip.setAttribute('data-grade', g.key);
      chip.onclick = function () {
        var k = String(g.key);
        var i = WIZ.grades.indexOf(k);
        if (i >= 0) {
          if (WIZ.grades.length === 1) { toast('至少保留一个年级'); return; }
          WIZ.grades.splice(i, 1);
        } else {
          WIZ.grades.push(k);
        }
        renderGradeScreen();
      };
      box.appendChild(chip);
    });
    $('#w-grade-summary').textContent = '已选科目：' + WIZ.subjects.map(subName).join(' + ')
      + '｜已选年级：' + WIZ.grades.map(gradeName).join(' + ');
    WIZ.skipSemester = !needSemester();
    $('#w-grade-next-label').textContent = WIZ.skipSemester ? '选考次（跳过学期）' : '选学期';
  }

  function renderSemesterScreen() {
    var box = $('#w-semester-list'); box.innerHTML = '';
    FLOW.semesters.forEach(function (s) {
      var on = WIZ.semester === s.key;
      var opt = el('div', 'opt-item' + (on ? ' on' : ''));
      opt.setAttribute('data-key', s.key);
      opt.innerHTML = '<span class="oi-check">' + (on ? '✓' : '') + '</span>'
        + '<span class="oi-body"><b>' + s.label + '</b><em>' + (s.tip || '') + '</em></span>';
      opt.onclick = function () { WIZ.semester = s.key; renderSemesterScreen(); };
      box.appendChild(opt);
    });
    $('#w-semester-summary').textContent = '已选：' + WIZ.grades.map(gradeName).join('+') + ' · ' + WIZ.subjects.map(subName).join('+');
  }

  function renderExamScreen() {
    var box = $('#w-exam-list'); box.innerHTML = '';
    FLOW.exams.forEach(function (x) {
      var on = WIZ.exam === x.key;
      var opt = el('div', 'opt-item' + (on ? ' on' : ''));
      opt.setAttribute('data-key', x.key);
      opt.innerHTML = '<span class="oi-check">' + (on ? '✓' : '') + '</span>'
        + '<span class="oi-body"><b>' + x.label + '</b><em>报告抬头会标注本次考次</em></span>';
      opt.onclick = function () { WIZ.exam = x.key; renderExamScreen(); };
      box.appendChild(opt);
    });
    $('#w-exam-summary').textContent = buildSceneText();
  }

  function renderRangeScreen() {
    var mods = candidateMods();
    var entries = chapterEntries(mods);
    $('#w-range-all').classList.toggle('on', WIZ.rangeMode === 'all');
    $('#w-range-pick').classList.toggle('on', WIZ.rangeMode === 'pick');
    $('#w-tree').style.display = WIZ.rangeMode === 'pick' ? '' : 'none';
    if (WIZ.rangeMode === 'pick') renderTree(mods);
    var hint = $('#w-range-hint');
    if (WIZ.rangeMode === 'all') {
      hint.textContent = '当前范围匹配 ' + mods.length + ' 个学期模块 / ' + entries.length + ' 个章节，将全部纳入';
      $('#w-range-next').disabled = entries.length === 0;
    } else {
      var chapters = 0, kps = 0;
      Object.keys(WIZ.picked).forEach(function (k) {
        var n = Object.keys(WIZ.picked[k]).length;
        if (n) { chapters++; kps += n; }
      });
      hint.textContent = '已选 ' + chapters + ' 个章节 / ' + kps + ' 个知识点';
      $('#w-range-next').disabled = chapters === 0;
    }
    $('#w-range-summary').textContent = buildSceneText();
    $('#w-range-tip').textContent = '当前范围：' + buildSceneText() + '；自选时可精确到知识点。';
  }

  // 两级章节树：章节行可整体勾选，展开后可单独勾选知识点（懒渲染，适配低端机）
  function renderTree(mods) {
    var box = $('#w-tree'); box.innerHTML = '';
    if (!mods.length) {
      box.innerHTML = '<p class="sub">当前条件下没有匹配章节，请返回上一步调整。</p>';
      return;
    }
    var frag = document.createDocumentFragment();
    mods.forEach(function (m) {
      var sec = el('div', 'tree-sec');
      var title = el('div', 'tree-sec-title', subName(m.sub) + ' · ' + m.modName);
      title.style.color = SUB_COLOR[m.sub];
      sec.appendChild(title);
      Object.keys(m.mod.children || {}).forEach(function (ck) {
        var chap = m.mod.children[ck];
        var key = m.sub + '|' + m.modKey + '|' + ck;
        var kpKeys = Object.keys(chap.kps || {});
        var picked = WIZ.picked[key] || {};
        var n = kpKeys.filter(function (k) { return picked[k]; }).length;
        var all = kpKeys.length > 0 && n === kpKeys.length;

        var wrap = el('div', 'tree-chap-wrap');
        var row = el('div', 'tree-chap' + (all ? ' on' : (n ? ' some' : '')));
        row.setAttribute('data-key', key);
        row.innerHTML = '<span class="tc-check">' + (all ? '✓' : (n ? '–' : '')) + '</span>'
          + '<span class="tc-name">' + chap.name + '</span>'
          + '<span class="tc-toggle">' + kpKeys.length + ' 个知识点 ' + (WIZ.open[key] ? '▴' : '▾') + '</span>';
        wrap.appendChild(row);

        var kpBox = el('div', 'tree-kps');
        kpBox.style.display = WIZ.open[key] ? '' : 'none';
        if (WIZ.open[key]) fillKps(kpBox, key, kpKeys, chap);
        wrap.appendChild(kpBox);

        row.onclick = function (ev) {
          if (ev.target.classList.contains('tc-toggle')) {
            if (WIZ.open[key]) {
              delete WIZ.open[key];
              kpBox.style.display = 'none';
              ev.target.innerHTML = kpKeys.length + ' 个知识点 ▾';
            } else {
              WIZ.open[key] = true;
              if (!kpBox.dataset.filled) fillKps(kpBox, key, kpKeys, chap);
              kpBox.style.display = '';
              ev.target.innerHTML = kpKeys.length + ' 个知识点 ▴';
            }
          } else {
            if (all) delete WIZ.picked[key];
            else {
              WIZ.picked[key] = {};
              kpKeys.forEach(function (k) { WIZ.picked[key][k] = true; });
            }
            renderRangeScreen();
          }
        };
        sec.appendChild(wrap);
      });
      frag.appendChild(sec);
    });
    box.appendChild(frag);
  }

  function fillKps(box, key, kpKeys, chap) {
    box.innerHTML = '';
    box.dataset.filled = '1';
    kpKeys.forEach(function (k) {
      var on = !!(WIZ.picked[key] && WIZ.picked[key][k]);
      var row = el('div', 'tree-kp' + (on ? ' on' : ''));
      row.innerHTML = '<span class="tk-check">' + (on ? '✓' : '') + '</span><span>' + (chap.kps[k] || k) + '</span>';
      row.onclick = function () {
        if (!WIZ.picked[key]) WIZ.picked[key] = {};
        if (WIZ.picked[key][k]) {
          delete WIZ.picked[key][k];
          if (!Object.keys(WIZ.picked[key]).length) delete WIZ.picked[key];
        } else {
          WIZ.picked[key][k] = true;
        }
        renderRangeScreen();
      };
      box.appendChild(row);
    });
  }

  function commitRange() {
    var entries = chapterEntries(candidateMods());
    var getKps;
    if (WIZ.rangeMode === 'all') {
      getKps = function (e) { return Object.keys(e.kps); };
    } else {
      entries = entries.filter(function (e) {
        var p = WIZ.picked[entryKey(e)];
        return p && Object.keys(p).length;
      });
      if (!entries.length) { toast('请至少勾选一个章节或知识点'); return false; }
      getKps = function (e) { return Object.keys(WIZ.picked[entryKey(e)] || {}); };
    }
    if (!entries.length) { toast('当前条件下没有匹配章节，请返回调整'); return false; }
    STATE.mode = 'wizard';
    STATE.presetKey = null;
    STATE.subjects = WIZ.subjects.slice();
    STATE.entries = entries;
    STATE.sceneText = buildSceneText();
    STATE.questions = buildAllQuestions(entries, getKps);
    STATE.answers = {};
    return true;
  }

  /* ============================================================
     屏6：学生信息（可跳过）
     ============================================================ */
  function gotoStudent() { show('screen-w-student'); }

  function readStudent() {
    STATE.student = {
      name: ($('#st-name').value || '').trim(),
      grade: ($('#st-grade').value || '').trim(),
      school: ($('#st-school').value || '').trim()
    };
  }
  function gotoForm() {
    renderForm();
    show('screen-form');
  }

  /* ============================================================
     屏7：渲染填分表单
     ============================================================ */
  function renderForm() {
    var grid = $('#grid'); grid.innerHTML = '';
    var byGroup = {};
    STATE.questions.forEach(function (q) {
      var k = q.subject + '@@' + q.modKey;
      (byGroup[k] = byGroup[k] || []).push(q);
    });

    var idx = 0;
    Object.keys(byGroup).forEach(function (key) {
      var arr = byGroup[key];
      var first = arr[0];
      var block = el('div', 'q-block open');
      var head = el('div', 'q-head');
      head.innerHTML =
        '<div><div class="qh-name" style="color:' + SUB_COLOR[first.subject] + '">'
        + subName(first.subject) + ' · ' + first.modName + '</div>'
        + '<div class="qh-sub">' + arr.length + ' 项能力核查</div></div>'
        + '<span class="qh-toggle">收起 ▴</span>';
      block.appendChild(head);

      var items = el('div', 'q-items');
      arr.forEach(function (q) {
        idx++;
        var row = el('div', 'q-row');
        row.innerHTML =
          '<div class="q-no">' + idx + '</div>'
          + '<div class="q-body">'
            + '<div class="q-meta">'
              + '<span class="qt">' + q.kpName + '</span>'
              + '<span class="tag ' + (q.diff === '基础' ? 'base' : q.diff === '中档' ? 'mid' : 'hard') + '">' + q.diff + '</span>'
            + '</div>'
            + '<div class="score-btns" data-qid="' + q.qid + '">'
              + '<button class="sbtn" data-v="0">0</button>'
              + '<button class="sbtn s2" data-v="1">1</button>'
              + '<button class="sbtn s2" data-v="2">2</button>'
              + '<button class="sbtn s3" data-v="3">3</button>'
            + '</div>'
          + '</div>';
        items.appendChild(row);
      });
      block.appendChild(items);
      head.onclick = function () {
        block.classList.toggle('open');
        head.querySelector('.qh-toggle').textContent = block.classList.contains('open') ? '收起 ▴' : '展开 ▾';
      };
      grid.appendChild(block);
    });

    grid.querySelectorAll('.score-btns').forEach(function (box) {
      var qid = box.getAttribute('data-qid');
      box.querySelectorAll('.sbtn').forEach(function (b) {
        b.onclick = function () {
          var v = parseInt(b.getAttribute('data-v'), 10);
          STATE.answers[qid] = v;
          box.querySelectorAll('.sbtn').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          updateProgress();
        };
      });
    });

    $('#form-brand').textContent = STATE.sceneText + ' · 初中全科筛查';
    $('#form-title').textContent = '逐题得分填写';
    $('#form-sub').textContent = '场景：' + STATE.sceneText + '｜共 ' + STATE.questions.length + ' 项核查';
    $('#prog-score').textContent = '共 ' + STATE.questions.length * 3 + ' 分';
    updateProgress();
  }

  function updateProgress() {
    var total = STATE.questions.length;
    var done = 0, sum = 0;
    STATE.questions.forEach(function (q) {
      if (STATE.answers[q.qid] != null) { done++; sum += STATE.answers[q.qid]; }
    });
    $('#prog-text').textContent = done + ' / ' + total + ' 项已填';
    var pct = total ? Math.round(done / total * 100) : 0;
    $('#prog-bar').style.width = pct + '%';
    $('#btn-report').disabled = done < total;
    $('#btn-report').textContent = done < total ? ('还差 ' + (total - done) + ' 项') : '生成诊断报告 →';
    return { done: done, total: total, sum: sum };
  }

  /* ============================================================
     报告计算与渲染（沿用既有链路，见下方保留代码）
     ============================================================ */

  /* ============================================================
     屏4：计算 + 渲染报告
     ============================================================ */
  function calcReport() {
    var modStat = {}; // key: sub|modKey
    var diffStat = { 基础: { got: 0, total: 0 }, 中档: { got: 0, total: 0 }, 压轴: { got: 0, total: 0 } };
    var totalGot = 0, totalMax = 0;

    STATE.questions.forEach(function (q) {
      var v = STATE.answers[q.qid] || 0;
      var got = v; // 0..3
      var key = q.subject + '|' + q.modKey;
      if (!modStat[key]) modStat[key] = { subject: q.subject, modName: q.modName, got: 0, total: 0, lost: 0 };
      modStat[key].got += got; modStat[key].total += q.score;
      diffStat[q.diff].got += got; diffStat[q.diff].total += q.score;
      totalGot += got; totalMax += q.score;
    });

    var modArr = Object.keys(modStat).map(function (k) {
      var m = modStat[k];
      var rate = m.total ? Math.round(m.got / m.total * 100) : 0;
      return { key: k, subject: m.subject, modName: m.modName, got: m.got, total: m.total, rate: rate, lost: m.total - m.got };
    });
    modArr.sort(function (a, b) { return a.rate - b.rate; });

    var rateAll = totalMax ? Math.round(totalGot / totalMax * 100) : 0;
    var diffRate = {};
    Object.keys(diffStat).forEach(function (d) {
      diffRate[d] = diffStat[d].total ? Math.round(diffStat[d].got / diffStat[d].total * 100) : 0;
    });

    return { modArr: modArr, diffRate: diffRate, diffStat: diffStat, totalGot: totalGot, totalMax: totalMax, rateAll: rateAll };
  }

  function levelOf(rate) {
    if (rate >= 90) return { name: '顶尖层', desc: '基础扎实，主攻压轴探究题与跨章节综合，冲刺高分。', cls: 'top' };
    if (rate >= 80) return { name: '拔高层', desc: '基础稳定，重点突破中档题与压轴第一问，强化综合应用。', cls: 'high' };
    if (rate >= 70) return { name: '中上层', desc: '基础较好，中档题是主要失分点，需针对性专项训练。', cls: 'mid' };
    if (rate >= 60) return { name: '基础层', desc: '回归课本与基础题型，先稳住计算与概念，再攻中档。', cls: 'base' };
    return { name: '补漏层', desc: '优先补齐七、八年级知识链缺口，建议从基础概念与简单题入手。', cls: 'low' };
  }

  function renderReport() {
    var R = calcReport();
    var L = levelOf(R.rateAll);

    var scopeTxt = STATE.sceneText || '能力筛查';
    var who = STATE.student.name ? STATE.student.name + ' · ' : '';

    $('#r-title').textContent = who + scopeTxt + ' · 能力诊断报告';
    $('#r-sub').textContent = '基于 ' + R.totalMax + ' 分能力核查生成';
    $('#report-brand').textContent = scopeTxt + ' · 初中全科筛查';

    // 成绩卡
    $('#r-score').textContent = R.totalGot;
    $('#r-total').textContent = '/' + R.totalMax;
    $('#r-rate').textContent = R.rateAll + '%';
    var lb = $('#r-level'); lb.textContent = L.name; lb.className = 'level-badge ' + L.cls;
    $('#r-level-desc').textContent = L.desc;

    var setDiff = function (idN, idS, label, val) {
      $(idN).textContent = val + '%';
      var s = $(idS);
      var cls = val >= 80 ? 'good' : val >= 60 ? 'warn' : 'bad';
      s.className = 'diff-state ' + cls;
      s.textContent = val >= 80 ? label + '稳固' : val >= 60 ? label + '关注' : label + '预警';
      s.style.color = val >= 80 ? 'rgba(134,239,172,.95)' : val >= 60 ? 'rgba(253,230,138,.95)' : 'rgba(252,165,165,.95)';
    };
    setDiff('#r-base', '#s-base', '基础题', R.diffRate['基础']);
    setDiff('#r-mid', '#s-mid', '中档题', R.diffRate['中档']);
    setDiff('#r-hard', '#s-hard', '压轴题', R.diffRate['压轴']);

    // 雷达图
    renderRadar(R.modArr);
    renderBar(R.modArr);
    renderModuleTable(R.modArr);
    renderWeak(R.modArr);
    renderLoss(R.modArr);
    renderPlan(R, L);
    renderStudio();
  }

  var _radarChart = null, _barChart = null;
  function renderRadar(arr) {
    var ctx = $('#radar');
    var labels = arr.map(function (m) {
      return CFG.subjects[m.subject].name + '·' + m.modName;
    });
    var data = arr.map(function (m) { return m.rate; });
    if (_radarChart) _radarChart.destroy();
    _radarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          label: '得分率',
          data: data,
          backgroundColor: 'rgba(37,99,235,.18)',
          borderColor: '#2563eb',
          pointBackgroundColor: data.map(function (v) { return v < 60 ? '#dc2626' : v < 80 ? '#f59e0b' : '#16a34a'; }),
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            min: 0, max: 100, ticks: { stepSize: 25, backdropColor: 'transparent', color: '#94a3b8' },
            pointLabels: { font: { size: 11 }, color: '#475569' },
            grid: { color: '#e2e8f0' }, angleLines: { color: '#e2e8f0' }
          }
        }
      }
    });
  }

  function renderBar(arr) {
    var ctx = $('#bar');
    var labels = arr.map(function (m) { return CFG.subjects[m.subject].name + '·' + m.modName; });
    var data = arr.map(function (m) { return m.rate; });
    if (_barChart) _barChart.destroy();
    _barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '得分率',
          data: data,
          backgroundColor: data.map(function (v) { return v < 60 ? '#dc2626' : v < 80 ? '#f59e0b' : '#16a34a'; }),
          borderRadius: 5
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { min: 0, max: 100, ticks: { stepSize: 25, color: '#94a3b8' }, grid: { color: '#f1f5f9' } },
          y: { ticks: { font: { size: 11 }, color: '#475569' }, grid: { display: false } }
        }
      }
    });
  }

  function renderModuleTable(arr) {
    var box = $('#module-table'); box.innerHTML = '';
    arr.forEach(function (m) {
      var row = el('div', 'mod-row');
      var cls = m.rate >= 80 ? 'good' : m.rate >= 60 ? 'midc' : 'bad';
      row.innerHTML =
        '<div class="mr-name">' + CFG.subjects[m.subject].name + '·' + m.modName + '</div>'
        + '<div class="mr-rate" style="color:' + (m.rate >= 80 ? '#16a34a' : m.rate >= 60 ? '#f59e0b' : '#dc2626') + '">' + m.rate + '%</div>'
        + '<div class="mr-bar"><i class="' + cls + '" style="width:' + m.rate + '%"></i></div>';
      box.appendChild(row);
    });
  }

  function renderWeak(arr) {
    var box = $('#weak-list'); box.innerHTML = '';
    var weak = arr.filter(function (m) { return m.rate < 80; });
    if (!weak.length) {
      box.innerHTML = '<div class="weak-item" style="border-left-color:#16a34a"><div class="wi-head"><span class="wi-name">全部模块达标</span></div><div class="wi-sub">所有模块得分率均不低于 80%，可进一步向压轴综合题发起挑战。</div></div>';
      return;
    }
    weak.slice(0, 8).forEach(function (m) {
      var item = el('div', 'weak-item' + (m.rate >= 60 ? ' warn' : ''));
      item.innerHTML =
        '<div class="wi-head"><span class="wi-name">' + CFG.subjects[m.subject].name + ' · ' + m.modName + '</span><span class="wi-rate">' + m.rate + '%</span></div>'
        + '<div class="wi-sub">失分 ' + m.lost + ' / ' + m.total + ' 分</div>'
        + '<div class="wi-action"><b>建议：</b>' + suggestFor(m) + '</div>';
      box.appendChild(item);
    });
  }

  function suggestFor(m) {
    // 优先读内联配置中的建议文案：改内容不需要改 JS
    if (CFG.suggestions && CFG.suggestions[m.modName]) return CFG.suggestions[m.modName];
    var map = {
      '全等三角形': '从 SSS/SAS 判定入手，重做 10 道基础证明题，规范"对应顶点"与步骤书写；辅助线重点练倍长中线与截长补短。',
      '轴对称': '先理清等腰与等边三角形性质，重点练习"无图题分类讨论"与最短路径模型的迁移。',
      '整式乘法与因式分解': '每日限时 20 题，先保符号不出错（平方差、完全平方是重灾区），再练十字相乘与整体代换。',
      '分式': '先练约分通分基本功，再集中攻克分式方程增根判断与应用题的等量关系列式。',
      '四边形': '用"性质判定双向表"拉通平行四边形家族，重点区分对角线与边角的判定条件。',
      '一元二次方程': '三种解法各做 5 题找手感，判别式与根与系数关系配套训练，应用题重点突破增长率与面积。',
      '二次函数': '图象性质与表达形式是地基，先画 20 个抛物线草图练准顶点与对称轴，再上压轴。',
      '相似': '平行线分线段成比例打底，判定与性质配对记忆，重点练 A 字型与 8 字型基本图。',
      '圆': '垂径定理与圆周角定理反复默写，切线证明的两条路径（半径垂直/距离等于半径）必须烂熟。',
      '机械运动': '把速度公式与图像结合练，s-t、v-t 图的斜率与面积含义反复对照。',
      '压强': '固体/液体/大气压强三类模型分开梳理，单位换算与公式适用条件是失分高发区。',
      '浮力': '阿基米德原理 + 浮沉条件两条主线，先练排液体积的判断，再攻综合计算。',
      '欧姆定律': '串并联电流电压电阻规律 + 动态分析，电路识别是前提，伏安法测电阻必须亲手做一遍。',
      '电功率': '电功与电功率公式辨析是第一步，测小灯泡电功率实验的步骤与故障分析是高频考点。',
      '空气和氧气': '氧气实验室制取的三种方法对比记忆，装置选择依据要能讲清楚。',
      '物质构成的奥秘': '分子、原子、离子的关系画一张结构图，元素符号与化合价口诀化记忆。',
      '化学方程式': '质量守恒定律的应用是核心，方程式配平从奇偶法练起，计算题按"设-写-找-列-解"五步。',
      '碳和碳的氧化物': 'CO₂ 的制取与性质实验为主线，CO 的毒性与还原性是易错点。'
    };
    return map[m.modName]
      || '先回归课本对应章节，梳理概念与公式，再按"例题→变式→同类题"三步专项训练，每周 2 次、每次 40 分钟。';
  }

  function renderLoss(arr) {
    var box = $('#loss-list'); box.innerHTML = '';
    var sorted = arr.slice().sort(function (a, b) { return b.lost - a.lost; });
    sorted.slice(0, 8).forEach(function (m, i) {
      var item = el('div', 'loss-item');
      item.innerHTML =
        '<span class="li-rank">' + (i + 1) + '</span>'
        + '<span class="li-name">' + CFG.subjects[m.subject].name + '·' + m.modName + '<span class="li-tag">（得分率 ' + m.rate + '%）</span></span>'
        + '<span class="li-val">-' + m.lost + '</span>';
      box.appendChild(item);
    });
  }

  function renderPlan(R, L) {
    var list = $('#plan-list'); list.innerHTML = '';
    var plans = [];
    if (R.rateAll >= 90) {
      plans = [
        ['压轴专攻', '把精力集中到压轴题第 2、3 问，重点练跨章节综合与探究过程，每周 2 道完整压轴。'],
        ['限时实战', '每周做 1 套完整卷限时训练，压轴题至少完整写完 2 问，训练考场节奏。'],
        ['错题深度复盘', '不只记正确答案，要写出"我当时为什么没想到"，建立个人易错点清单。']
      ];
    } else if (R.rateAll >= 80) {
      plans = [
        ['中档题突破', '找出得分率最低的两个模块，按"例题→变式→同类题"做专项，每次 40 分钟。'],
        ['压轴第一问', '压轴题不再整题放弃，保证第 1 问必拿，第 2 问争取部分分。'],
        ['计算零失误', '基础题的失分通常是符号、移项、约分，每日 10 题限时练，目标全对。']
      ];
    } else if (R.rateAll >= 70) {
      plans = [
        ['中档专项', '中档题是当前最大失分区，选 2 个最弱模块做 4 周专项，每周 3 次。'],
        ['回归基础', '基础题失分逐题复盘，把"会做但做错"和"真不会"分开处理。'],
        ['规范书写', '几何证明与理化计算严格按步骤书写，杜绝跳步，过程分必须拿满。']
      ];
    } else if (R.rateAll >= 60) {
      plans = [
        ['课本优先', '先回到课本梳理概念与公式，每章做 10 道基础题，做到能讲清原理。'],
        ['计算过关', '有理数运算、整式运算每日 15 题限时练，先把准确率提到 90% 以上。'],
        ['小步快跑', '每周只攻 1 个模块，按"概念→例题→练习"三步走，不贪多。']
      ];
    } else {
      plans = [
        ['知识链补齐', '优先补七、八年级缺口（有理数运算、方程、全等三角形），这些是后续一切的基础。'],
        ['一对一诊断', '建议做一次面对面的试卷诊断，逐题分析"真不会"和"粗心"各占多少。'],
        ['建立信心', '从最简单的章节入手，每天只做 5 道能拿分的题，先恢复做题手感与信心。']
      ];
    }
    plans.forEach(function (p, i) {
      var item = el('div', 'plan-item');
      item.innerHTML = '<span class="pi-no">' + (i + 1) + '</span><div class="pi-body"><div class="pi-t">' + p[0] + '</div><div class="pi-d">' + p[1] + '</div></div>';
      list.appendChild(item);
    });
  }

  function renderStudio() {
    var s = CFG.studio || {};
    var box = $('#studio-box');
    box.innerHTML =
      '<div class="sb-name">' + (s.name || 'XX教育工作室') + '</div>'
      + '<div>📞 ' + (s.phone || '138-XXXX-XXXX') + '</div>'
      + '<div>💬 微信：' + (s.wechat || '你的微信号') + '</div>'
      + '<div>📍 ' + (s.address || 'XX路XX号') + '</div>';
    var btn = $('#btn-share');
    if (navigator.share) {
      btn.style.display = '';
      btn.onclick = function () {
        navigator.share({
          title: (STATE.sceneText || '初中全科') + ' · 能力诊断报告',
          text: '孩子这份能力筛查报告，请老师帮忙解读一下薄弱模块。'
        }).catch(function () {});
      };
    } else {
      btn.onclick = function () { toast('可截图或长按保存后发送给老师'); };
    }
  }


  /* ============================================================
     导航绑定
     ============================================================ */
  $('#btn-report').onclick = function () {
    var p = updateProgress();
    if (p.done < p.total) { toast('请填写完整后再生成报告'); return; }
    renderReport();
    show('screen-report');
  };

  /* ---------- 首页 ---------- */
  $('#btn-start-wizard').onclick = startWizard;
  $('#btn-back-scene').onclick = function () { show('screen-home'); };
  $('#btn-confirm-preset').onclick = applyPreset;

  /* ---------- 屏1 科目 ---------- */
  $('#w-subject-next').onclick = function () {
    normalizeGrades();
    renderGradeScreen();
    show('screen-w-grade');
  };
  $('#w-subject-back').onclick = function () { show('screen-home'); };

  /* ---------- 屏2 年级 ---------- */
  $('#w-grade-next').onclick = function () {
    WIZ.skipSemester = !needSemester();
    if (WIZ.skipSemester) {
      // 九年级物理为全一册：没有上下学期之分，直接进入考次屏
      renderExamScreen();
      show('screen-w-exam');
      toast('该科目为全一册，已自动跳过学期选择');
    } else {
      renderSemesterScreen();
      show('screen-w-semester');
    }
  };
  $('#w-grade-back').onclick = function () {
    renderSubjectScreen();
    show('screen-w-subject');
  };

  /* ---------- 屏3 学期 ---------- */
  $('#w-semester-next').onclick = function () {
    renderExamScreen();
    show('screen-w-exam');
  };
  $('#w-semester-back').onclick = function () {
    renderGradeScreen();
    show('screen-w-grade');
  };

  /* ---------- 屏4 考次 ---------- */
  $('#w-exam-next').onclick = function () {
    WIZ.picked = {};
    WIZ.open = {};
    WIZ.rangeMode = 'all';
    renderRangeScreen();
    show('screen-w-range');
  };
  $('#w-exam-back').onclick = function () {
    if (WIZ.skipSemester) { renderGradeScreen(); show('screen-w-grade'); }
    else { renderSemesterScreen(); show('screen-w-semester'); }
  };

  /* ---------- 屏5 章节范围 ---------- */
  $('#w-range-all').onclick = function () { WIZ.rangeMode = 'all'; renderRangeScreen(); };
  $('#w-range-pick').onclick = function () { WIZ.rangeMode = 'pick'; renderRangeScreen(); };
  $('#w-range-next').onclick = function () {
    if (!commitRange()) return;
    gotoStudent();
  };
  $('#w-range-back').onclick = function () {
    renderExamScreen();
    show('screen-w-exam');
  };

  /* ---------- 屏6 学生信息 ---------- */
  $('#w-student-next').onclick = function () { readStudent(); gotoForm(); };
  $('#w-student-skip').onclick = function () {
    $('#st-name').value = ''; $('#st-grade').value = ''; $('#st-school').value = '';
    readStudent(); gotoForm();
  };
  $('#w-student-back').onclick = backToRange;

  /* ---------- 屏7 填分 / 屏8 报告 ---------- */
  $('#btn-back-scope').onclick = backToRange;
  $('#btn-restart').onclick = function () {
    STATE.mode = null; STATE.presetKey = null; STATE.answers = {};
    STATE.questions = []; STATE.entries = []; STATE.sceneText = '';
    $('#st-name').value = ''; $('#st-grade').value = ''; $('#st-school').value = '';
    renderPresets();
    show('screen-home');
  };

  function backToRange() {
    if (STATE.mode === 'preset') {
      var p = CFG.presets.filter(function (x) { return x.key === STATE.presetKey; })[0];
      if (p) { showPresetConfirm(p); return; }
    }
    renderRangeScreen();
    show('screen-w-range');
  }

  /* ---------- 初始化 ---------- */
  renderPresets();
  show('screen-home');
  } // end init

  function showConfigError() {
    document.body.innerHTML =
      '<div style="padding:40px 20px;text-align:center;color:#666;font-family:sans-serif">' +
      '<h2>配置未加载</h2><p>请确认内联配置 SYS_CONFIG 存在，或通过部署平台访问。</p></div>';
    return;
  }

  // 直接使用内联配置（无需网络、无需本地服务器，双击 index.html 即可运行）
  if (window.SYS_CONFIG) {
    init(window.SYS_CONFIG);
  } else {
    showConfigError();
  }
})();
