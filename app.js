/* ============================================================
   初中全科能力筛查系统 v2
   - 多学段预设 + 自定义范围
   - 科目(数学/物理/化学) → 年级 → 模块 → 知识点 两级勾选
   - 动态生成填分题 → 计算模块画像 / 难度分层 / 失分归因 / 分层方案
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 配置加载 ---------- */
  function boot(CFG) {
    init(CFG);
  }

  function init(CFG) {
    if (!CFG) { showConfigError(); return; }

  var STATE = {
    mode: null,        // 'preset' | 'custom'
    presetKey: null,
    subjects: [],       // 勾选的科目
    selected: {},       // {subject: [{modKey, modName, kpKeys:[], kpNames:[]}]}
    questions: [],      // 动态生成的题目
    answers: {}         // {qid: score}
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

  /* ---------- 工具：模块 → 动态生成题目 ---------- */
  // 每个模块根据知识点数量与所属科目，自动生成一组"能力核查题"
  // 难度分布：基础60% 中档30% 压轴10%（数学压轴偏多）
  function buildQuestionsForModule(subject, modKey, modName, kpKeys, kpNames) {
    var items = [];
    var mod = CFG.modules[subject] && CFG.modules[subject][modKey];
    if (!mod) return items;
    var list = kpKeys && kpKeys.length ? kpKeys : Object.keys(mod.children);
    if (!list.length) return items;
    var isMath = subject === 'math';
    var perKp = isMath ? 3 : 2;
    var cap = isMath ? 6 : 4;     // 每模块最多题数（全科模式防爆炸）
    var qid = 0;
    list.forEach(function (kpKey, idx) {
      var kpName = kpNames ? kpNames[idx] : (mod.children[kpKey] ? mod.children[kpKey].name : '');
      for (var i = 0; i < perKp; i++) {
        if (items.length >= cap) return;
        var diff = i === 0 ? '基础' : (i === 1 ? '中档' : '压轴');
        if (isMath && i === 1 && Math.random() < 0.3) diff = '压轴';
        items.push({
          qid: modKey + '_' + qid++,
          subject: subject, modKey: modKey, modName: modName,
          kpKey: kpKey, kpName: kpName, diff: diff, score: 3,
          label: kpName || modName
        });
      }
    });
    return items;
  }

  /* 此处原有一次重复的 buildAllQuestions 定义，已合并为下方唯一版本。 */

  var MAX_Q = 60;   // 全科模式的题目总量上限

  function buildAllQuestions() {
    var qs = [];
    var limits = {}; // 每科目配额（仅多科目/全科模式启用，避免中考全科题目过多）
    if (STATE.subjects.length > 1) {
      var n = STATE.subjects.length;
      STATE.subjects.forEach(function (sub) { limits[sub] = Math.max(6, Math.floor(MAX_Q / n)); });
    }
    var counts = {};
    STATE.subjects.forEach(function (sub) {
      var sel = STATE.selected[sub] || [];
      counts[sub] = 0;
      sel.forEach(function (m) {
        var part = buildQuestionsForModule(sub, m.modKey, m.modName, m.kpKeys, m.kpNames);
        if (limits[sub]) {
          var room = Math.max(0, limits[sub] - counts[sub]);
          part = part.slice(0, room);
        } else {
          // 单科目：保留合理题量，数学不超过 45 题，理化不超过 30 题
          var cap2 = (sub === 'math') ? 45 : 30;
          part = part.slice(0, cap2);
        }
        counts[sub] = (counts[sub] || 0) + part.length;
        qs = qs.concat(part);
      });
    });
    // 编号 & 科目内连续题号
    var counter = {};
    qs.forEach(function (q) {
      counter[q.subject] = (counter[q.subject] || 0) + 1;
      q.no = counter[q.subject];
    });
    return qs;
  }

  /* ============================================================
     屏1：渲染预设列表
     ============================================================ */
  function renderPresets() {
    var box = $('#preset-list'); box.innerHTML = '';
    CFG.presets.forEach(function (p) {
      var item = el('div', 'preset-item');
      if (p.key === 'custom') item.className = 'preset-item custom';
      var subjName = p.subject === 'all' ? '数学+物理+化学'
        : (CFG.subjects[p.subject] ? CFG.subjects[p.subject].name : '');
      item.innerHTML =
        '<div class="p-label"><span class="ic">' + (p.key === 'custom' ? '✎' : (CFG.subjects[p.subject] ? CFG.subjects[p.subject].icon : '✚')) + '</span>'
        + p.label + ' <span style="font-weight:400;font-size:12px;color:#94a3b8">· ' + subjName + '</span></div>'
        + '<div class="p-tip">' + p.tip + '</div>';
      item.onclick = function () {
        document.querySelectorAll('.preset-item').forEach(function (n) { n.classList.remove('on'); });
        item.classList.add('on');
        if (p.key === 'custom') {
          STATE.mode = 'custom';
          STATE.presetKey = null;
          showCustom();
        } else {
          STATE.mode = 'preset';
          STATE.presetKey = p.key;
          showPresetConfirm(p);
        }
      };
      box.appendChild(item);
    });
  }

  /* ============================================================
     屏2A：预设确认
     ============================================================ */
  function showPresetConfirm(p) {
    $('#scope-title').textContent = p.label;
    $('#scope-sub').textContent = '系统已按预设匹配考查范围，确认后即可开始填分';
    $('#preset-label').textContent = p.label;
    $('#preset-tip').textContent = p.tip;

    var chips = $('#preset-modules'); chips.innerHTML = '';
    var subLabel = p.subject === 'all' ? 'all' : p.subject;
    var modKeys = p.modules;
    var subjectOf = subLabel === 'all' ? null : subLabel;

    if (subLabel === 'all') {
      Object.keys(p.modules).forEach(function (sub) {
        p.modules[sub].forEach(function (mk) {
          var mod = CFG.modules[sub] && CFG.modules[sub][mk];
          if (!mod) return;
          var c = el('span', 'chip' + (sub === 'physics' ? ' sub' : (sub === 'chem' ? ' sub2' : '')), CFG.subjects[sub].name + '·' + mod.name);
          chips.appendChild(c);
        });
      });
    } else {
      modKeys.forEach(function (mk) {
        var mod = CFG.modules[subjectOf][mk];
        if (!mod) return;
        chips.appendChild(el('span', 'chip', mod.name));
      });
    }

    $('#scope-preset').style.display = '';
    $('#scope-custom').style.display = 'none';
    show('screen-scope');
  }

  function applyPreset(p) {
    var sel = {};
    if (p.subject === 'all') {
      Object.keys(p.modules).forEach(function (sub) {
        sel[sub] = p.modules[sub].map(function (mk) {
          var mod = CFG.modules[sub][mk];
          return { modKey: mk, modName: mod.name, kpKeys: [], kpNames: [] };
        });
      });
    } else {
      sel[p.subject] = p.modules.map(function (mk) {
        var mod = CFG.modules[p.subject][mk];
        return { modKey: mk, modName: mod.name, kpKeys: [], kpNames: [] };
      });
    }
    STATE.subjects = Object.keys(sel);
    STATE.selected = sel;
    STATE.questions = buildAllQuestions();
    STATE.answers = {};
    renderForm();
    show('screen-form');
  }

  $('#btn-confirm-preset').onclick = function () {
    var p = CFG.presets.filter(function (x) { return x.key === STATE.presetKey; })[0];
    if (p) applyPreset(p);
  };

  /* ============================================================
     屏2B：自定义勾选
     ============================================================ */
  var CUSTOM = { subjects: ['math'], grades: {}, tree: {} };

  function showCustom() {
    // 默认勾数学
    CUSTOM = { subjects: ['math'], grades: {}, tree: {} };
    renderSubjects();
    renderGrades();
    renderTree();
    $('#scope-preset').style.display = 'none';
    $('#scope-custom').style.display = '';
    updateCustomHint();
    show('screen-scope');
  }

  function renderSubjects() {
    var box = $('#subject-list'); box.innerHTML = '';
    Object.keys(CFG.subjects).forEach(function (sub) {
      var s = CFG.subjects[sub];
      var chip = el('div', 'subject-chip' + (CUSTOM.subjects.indexOf(sub) >= 0 ? ' on' : ''), '<span class="ic">' + s.icon + '</span>' + s.name);
      chip.setAttribute('data-sub', sub);
      chip.onclick = function () {
        var i = CUSTOM.subjects.indexOf(sub);
        if (i >= 0) {
          if (CUSTOM.subjects.length === 1) { toast('至少保留一个科目'); return; }
          CUSTOM.subjects.splice(i, 1);
        } else {
          CUSTOM.subjects.push(sub);
        }
        renderSubjects(); renderGrades(); renderTree(); updateCustomHint();
      };
      box.appendChild(chip);
    });
  }

  function renderGrades() {
    var box = $('#grade-list'); box.innerHTML = '';
    CFG.grades.forEach(function (g) {
      var hasAny = CUSTOM.subjects.some(function (sub) { return CFG.modules[sub] && CFG.modules[sub][g.key + 'shang'] || (g.key === '9' && CFG.modules[sub]['9']); });
      // 仅显示有内容的年级
      var any = false;
      CUSTOM.subjects.forEach(function (sub) {
        var m = CFG.modules[sub]; if (!m) return;
        Object.keys(m).forEach(function (mk) { if (m[mk].grade === g.key) any = true; });
      });
      if (!any) return;
      var chip = el('div', 'grade-chip' + (CUSTOM.grades[g.key] === false ? '' : ' on'), g.name);
      chip.onclick = function () {
        CUSTOM.grades[g.key] = !(CUSTOM.grades[g.key] !== false);
        renderGrades(); renderTree(); updateCustomHint();
      };
      box.appendChild(chip);
    });
  }

  function renderTree() {
    var box = $('#module-tree'); box.innerHTML = '';
    var empty = true;
    CUSTOM.subjects.forEach(function (sub) {
      var m = CFG.modules[sub]; if (!m) return;
      Object.keys(m).forEach(function (mk) {
        var mod = m[mk];
        if (CUSTOM.grades[mod.grade] === false) return; // 未勾选的年级折叠
        empty = false;
        var grp = el('div', 'mod-group' + (CUSTOM.tree[mk] ? ' on open' : ''));
        var head = el('div', 'mod-group-head');
        head.innerHTML =
          '<span class="mch-check">' + (CUSTOM.tree[mk] ? '✓' : '') + '</span>'
          + '<span class="mch-name" style="color:' + SUB_COLOR[sub] + '">' + CFG.subjects[sub].name + ' · ' + mod.name + '</span>'
          + '<span class="mch-toggle">' + (CUSTOM.tree[mk] ? '收起知识点 ▴' : '展开知识点 ▾') + '</span>';
        head.onclick = function (ev) {
          if (ev.target.tagName === 'INPUT' || ev.target.classList.contains('kp-check')) return;
          if (CUSTOM.tree[mk]) {
            delete CUSTOM.tree[mk];
          } else {
            CUSTOM.tree[mk] = { subject: sub, modKey: mk, modName: mod.name, kps: {} };
          }
          renderTree(); updateCustomHint();
        };
        grp.appendChild(head);

        var kplist = el('div', 'kp-list');
        Object.keys(mod.children).forEach(function (ck) {
          var c = mod.children[ck];
          var row = el('div', 'kp-item' + (CUSTOM.tree[mk] && CUSTOM.tree[mk].kps[ck] ? ' on' : ''));
          row.innerHTML =
            '<span class="kp-check">' + (CUSTOM.tree[mk] && CUSTOM.tree[mk].kps[ck] ? '✓' : '') + '</span>'
            + '<span>' + c.name + '</span>';
          row.onclick = function () {
            if (!CUSTOM.tree[mk]) {
              CUSTOM.tree[mk] = { subject: sub, modKey: mk, modName: mod.name, kps: {} };
              grp.classList.add('on');
            }
            if (CUSTOM.tree[mk].kps[ck]) delete CUSTOM.tree[mk].kps[ck];
            else CUSTOM.tree[mk].kps[ck] = c.name;
            if (!Object.keys(CUSTOM.tree[mk].kps).length) delete CUSTOM.tree[mk];
            renderTree(); updateCustomHint();
          };
          kplist.appendChild(row);
        });
        grp.appendChild(kplist);
        box.appendChild(grp);
      });
    });
    if (empty) box.innerHTML = '<p class="sub">请先选择科目与年级。</p>';
  }

  function updateCustomHint() {
    var count = 0;
    Object.keys(CUSTOM.tree).forEach(function (mk) {
      var t = CUSTOM.tree[mk];
      var kps = Object.keys(t.kps);
      count += kps.length ? kps.length : 1;
    });
    var hint = $('#custom-hint');
    if (count === 0) {
      hint.textContent = '请先勾选至少一个模块（或展开模块勾选知识点）';
      $('#btn-confirm-custom').disabled = true;
    } else {
      hint.textContent = '已选 ' + count + ' 个考查单元（模块或知识点）';
      $('#btn-confirm-custom').disabled = false;
    }
  }

  $('#btn-confirm-custom').onclick = function () {
    var sel = {};
    Object.keys(CUSTOM.tree).forEach(function (mk) {
      var t = CUSTOM.tree[mk];
      var sub = t.subject;
      if (!sel[sub]) sel[sub] = [];
      var kps = Object.keys(t.kps);
      sel[sub].push({
        modKey: t.modKey,
        modName: t.modName,
        kpKeys: kps,
        kpNames: kps.map(function (k) { return t.kps[k]; })
      });
      // 若未细化知识点，则按整个模块处理
      if (!kps.length) { sel[sub][sel[sub].length - 1].kpKeys = []; sel[sub][sel[sub].length - 1].kpNames = []; }
    });
    STATE.subjects = Object.keys(sel);
    STATE.selected = sel;
    STATE.questions = buildAllQuestions();
    STATE.answers = {};
    renderForm();
    show('screen-form');
  };

  /* ============================================================
     屏3：渲染填分表单
     ============================================================ */
  function renderForm() {
    var grid = $('#grid'); grid.innerHTML = '';
    var byMod = {};
    STATE.questions.forEach(function (q) {
      var key = q.subject + '|' + q.modKey;
      (byMod[key] = byMod[key] || []).push(q);
    });

    var idx = 0;
    STATE.subjects.forEach(function (sub) {
      var subName = CFG.subjects[sub].name;
      Object.keys(byMod).filter(function (k) { return k.split('|')[0] === sub; }).forEach(function (key) {
        var modName = key.split('|')[1];
        var block = el('div', 'q-block');
        var modInfo = CFG.modules[sub][modName];
        var head = el('div', 'q-head');
        head.innerHTML =
          '<div><div class="qh-name" style="color:' + SUB_COLOR[sub] + '">' + subName + ' · ' + (modInfo ? modInfo.name : modName) + '</div>'
          + '<div class="qh-sub">' + byMod[key].length + ' 项能力核查</div></div>'
          + '<span class="qh-toggle">展开 ▾</span>';
        block.appendChild(head);

        var items = el('div', 'q-items');
        byMod[key].forEach(function (q) {
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

        head.onclick = function () { block.classList.toggle('open'); };
        grid.appendChild(block);
      });
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

    // 抬头信息
    var scopeTxt = STATE.presetKey
      ? (CFG.presets.filter(function (p) { return p.key === STATE.presetKey; })[0] || {}).label || ''
      : '自定义范围';
    $('#form-brand').textContent = scopeTxt + ' · 初中全科筛查';
    $('#form-title').textContent = '逐题得分填写';
    $('#form-sub').textContent = '场景：' + scopeTxt + '｜共 ' + STATE.questions.length + ' 项核查';
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

  $('#btn-report').onclick = function () {
    var p = updateProgress();
    if (p.done < p.total) { toast('请填写完整后再生成报告'); return; }
    renderReport();
    show('screen-report');
  };

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

    var scopeTxt = STATE.presetKey
      ? (CFG.presets.filter(function (p) { return p.key === STATE.presetKey; })[0] || {}).label || ''
      : '自定义范围';

    $('#r-title').textContent = scopeTxt + ' · 能力诊断报告';
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
          title: '初中全科能力筛查报告',
          text: '孩子这份能力筛查报告，请老师帮忙解读一下薄弱模块。'
        }).catch(function () {});
      };
    } else {
      btn.onclick = function () { toast('可截图或长按保存后发送给老师'); };
    }
  }

  /* ============================================================
     导航
     ============================================================ */
  $('#btn-back-scene').onclick = function () { renderPresets(); show('screen-scene'); };
  $('#btn-back-scope').onclick = function () {
    if (STATE.mode === 'custom') showCustom();
    else {
      var p = CFG.presets.filter(function (x) { return x.key === STATE.presetKey; })[0];
      if (p) showPresetConfirm(p);
    }
  };
  $('#btn-restart').onclick = function () {
    STATE.mode = null; STATE.presetKey = null; STATE.answers = {}; STATE.questions = [];
    renderPresets(); show('screen-scene');
  };

  /* ---------- 初始化 ---------- */
  renderPresets();
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
