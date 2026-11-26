// 考点消灯 · 艺考生文化课靶向提分闭环可视化组件
// 挂载约定：任意 [data-xiaodeng-anim] 容器（首页 #artXiaodengAnimHost / 预览 #standaloneXiaodengAnim）自动初始化。

(() => {
  'use strict';

  const UNDERGRAD = 390;
  const LEFT_SCORE = 334;
  const START_SCORE = 318;
  const FINAL_SCORE = 514;
  const SUBJECTS = ['语文', '数学', '英语', '政治', '历史', '地理'];

  const COPY = {
    title: '同样 120 天冲刺：传统大锅饭硬熬 vs 考点精准消灯',
    sub: '集训半年文化课断层 · 距高考仅剩 4 个月 · 砍掉 30% 偏难题，家长手机实时可见每一步涨分数据',
    leftTitle: '【传统机构模式（大锅饭满堂灌）】',
    leftProcess: '集训半年断层严重 → 跟着一轮大锅饭陪跑 → 盲区未清考前红灯一片',
    leftTags: ['✕ 底子薄听天书', '✕ 刷套卷抓不住必考点', '✕ 家长盲盒式等待，进度全靠猜'],
    leftStatus: '✕ 讲完就忘 · 盲目刷题 · 漏洞越积越多 | 停滞在 334 分',
    rightTitle: '【考点消灯 · 艺考生靶向过关系统】',
    rightProcess: '摸底亮灯砍偏题 → 每日双轨背诵核验 → 逐点消灯冲刺 514 分',
    badge: '📱 家长端实时同步 · 数据全透明',
    rightTags: ['✓ 砍掉30%偏难怪', '✓ 1对1只讲红灯卡点', '✓ 家长实时查看消灯与涨分明细'],
    rightStatus: '✓ 放弃偏难怪 · 次日核验才消灯 · 家长随时查数据 | 冲刺 514 分',
    steps: [
      ['① 摸底亮灯（定位盲区）', '六科全量考点一测体检，失分盲区直接亮红灯，不靠感觉猜薄弱项。'],
      ['② 砍难留易（锁定抓分点）', '舍弃 30% 偏难怪，锁定最易拿分的基础必考点，集中火力冲高分。'],
      ['③ 按天定制（定制任务）', '倒推百日冲刺周期，每日 10.5 小时精准切片到分钟，讲练背任务清清楚楚。'],
      ['④ 靶向破坎（靶向攻克）', '只讲红灯卡点！推送前置零基础解析 + 老师 1 对 1 专项拆解 + 同型变式巩固。'],
      ['⑤ 核验消灯（消灯过关）', '次日逐条抽背与变式复测，真正做对背熟才算过关，红灯熄灭变绿灯。'],
      ['⑥ 进步有数（家长实时看）', '每灭一盏红灯实时折算预期总分涨幅，家长随时查看今日消灯明细与精准提分数据。']
    ],
    msg1: '今日新发现 18 处丢分盲区，已同步至家长端',
    msg2: '已剔除 30% 偏难怪，锁定 16 个核心抓分点',
    lock: '砍掉偏难题',
    amber: '1对1破坎+次日核验中',
    cleared: '已消灯',
    ugLine: '390分本科线',
    leftChart: '一模 318 → 二模 325 → 三模 329 → 四模 334分',
    rightChart: '318 → 382 → 452 → 514分',
    stall: '提分停滞 · 差本科线 56 分',
    win: '已超本科线 +124 分'
  };

  const LEFT_SERIES = [
    { name: '一模', score: 318 },
    { name: '二模', score: 325 },
    { name: '三模', score: 329 },
    { name: '四模', score: 334, tail: '分' }
  ];
  const RIGHT_SERIES = [318, 382, 452, 514];

  // 16 个必拿分红灯，按学科顺序逐个消灯。增量之和 = 196，318 + 196 = 514。
  // 第 5 盏落到 375，第 11 盏落到 448，第 16 盏落到 514。
  const CLEAR_SEQUENCE = [
    { subject: '语文', index: 2, topic: '文言文实词推断', gain: 11 },
    { subject: '语文', index: 3, topic: '古诗词意象与情感', gain: 12 },
    { subject: '数学', index: 0, topic: '集合与常用逻辑用语', gain: 11 },
    { subject: '数学', index: 1, topic: '函数定义域与值域', gain: 12 },
    { subject: '英语', index: 1, topic: '高频词汇与词块', gain: 11 },
    { subject: '英语', index: 2, topic: '定语从句基础', gain: 12 },
    { subject: '英语', index: 3, topic: '阅读细节定位', gain: 12 },
    { subject: '政治', index: 1, topic: '中国特色社会主义', gain: 13 },
    { subject: '政治', index: 2, topic: '经济生活基础概念', gain: 12 },
    { subject: '政治', index: 3, topic: '哲学唯物论常识', gain: 12 },
    { subject: '历史', index: 1, topic: '辛亥革命影响', gain: 12 },
    { subject: '历史', index: 2, topic: '新民主主义革命', gain: 13 },
    { subject: '历史', index: 3, topic: '改革开放时间线', gain: 13 },
    { subject: '地理', index: 1, topic: '地球运动基础', gain: 13 },
    { subject: '地理', index: 2, topic: '气候类型判读', gain: 13 },
    { subject: '地理', index: 3, topic: '中国区域地理', gain: 14 }
  ];

  const STEP_CLEARED = { 1: 0, 2: 0, 3: 5, 4: 11, 5: 16, 6: 16 };
  const STEP_RANGES = { 3: [0, 5], 4: [5, 11], 5: [11, 16] };

  function assertData() {
    const stall = `提分停滞 · 差本科线 ${UNDERGRAD - LEFT_SCORE} 分`;
    const win = `已超本科线 +${FINAL_SCORE - UNDERGRAD} 分`;
    const leftChart = LEFT_SERIES
      .map((item) => `${item.name} ${item.score}${item.tail || ''}`)
      .join(' → ');
    const rightChart = RIGHT_SERIES
      .map((score, index) => (index === RIGHT_SERIES.length - 1 ? `${score}分` : String(score)))
      .join(' → ');
    let score = START_SCORE;
    const totals = CLEAR_SEQUENCE.map((item) => {
      score += item.gain;
      return score;
    });
    const keys = new Set();
    CLEAR_SEQUENCE.forEach((item) => {
      const key = `${item.subject}:${item.index}`;
      if (keys.has(key)) throw new Error(`重复消灯考点 ${key}`);
      keys.add(key);
      if (initialTone(item.subject, item.index) !== 'red') throw new Error(`${key} 不是初始红灯`);
      if (item.subject === '数学' && item.index >= 2) throw new Error('偏难题被计入消灯序列');
    });
    const ok = stall === COPY.stall
      && win === COPY.win
      && leftChart === COPY.leftChart
      && rightChart === COPY.rightChart
      && LEFT_SERIES.every((item) => item.score < UNDERGRAD)
      && RIGHT_SERIES[1] < UNDERGRAD
      && RIGHT_SERIES[2] > UNDERGRAD
      && totals.length === 16
      && totals[4] === 375
      && totals[10] === 448
      && totals[15] === FINAL_SCORE
      && score === FINAL_SCORE
      && lampMessage(CLEAR_SEQUENCE[10]) === '刚刚消灯：历史·辛亥革命影响 | 核验通过 | 总分 +12分';
    if (!ok) throw new Error('考点消灯分数路径与文案不一致');
  }

  function initialTone(subject, index) {
    if (subject === '语文') return index < 2 ? 'green' : 'red';
    if (subject === '数学') return 'red';
    return index === 0 ? 'green' : 'red';
  }

  function scoreAfterCleared(count) {
    let score = START_SCORE;
    for (let i = 0; i < count; i += 1) score += CLEAR_SEQUENCE[i].gain;
    return score;
  }

  function lampMessage(item) {
    return `刚刚消灯：${item.subject}·${item.topic} | 核验通过 | 总分 +${item.gain}分`;
  }

  function gapLabel(score) {
    if (score >= UNDERGRAD) return `已超本科线 +${score - UNDERGRAD} 分`;
    return `距本科线还差 ${UNDERGRAD - score} 分`;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function chartSvg(scores, stroke) {
    const top = 14;
    const bottom = 114;
    const left = 16;
    const right = 284;
    const min = 300;
    const max = 540;
    const yOf = (score) => bottom - ((score - min) / (max - min)) * (bottom - top);
    const count = scores.length;
    const xOf = (index) => (count === 1 ? (left + right) / 2 : left + ((right - left) * index) / (count - 1));
    const points = scores.map((score, index) => [xOf(index), yOf(score), score]);
    const d = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(1)} ${point[1].toFixed(1)}`)
      .join(' ');
    const y390 = yOf(UNDERGRAD);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'xd-chart-svg');
    svg.setAttribute('viewBox', '0 0 300 128');
    svg.setAttribute('aria-hidden', 'true');
    const rule = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    rule.setAttribute('x1', String(left));
    rule.setAttribute('x2', String(right));
    rule.setAttribute('y1', y390.toFixed(1));
    rule.setAttribute('y2', y390.toFixed(1));
    rule.setAttribute('stroke', '#374151');
    rule.setAttribute('stroke-width', '1.6');
    rule.setAttribute('stroke-dasharray', '5 4');
    rule.dataset.ugLine = '390';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', '2.6');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-linecap', 'round');
    svg.append(rule, path);
    points.forEach((point) => {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', point[0].toFixed(1));
      dot.setAttribute('cy', point[1].toFixed(1));
      dot.setAttribute('r', point[2] > UNDERGRAD ? '4.6' : '3.6');
      dot.setAttribute('fill', point[2] > UNDERGRAD ? '#047857' : '#b91c1c');
      dot.dataset.score = String(point[2]);
      svg.appendChild(dot);
    });
    return svg;
  }

  function fillLabels(box, texts) {
    box.replaceChildren();
    box.style.gridTemplateColumns = `repeat(${Math.max(texts.length, 1)}, minmax(0, 1fr))`;
    texts.forEach((text) => box.appendChild(el('div', 'xd-chart-lab', text)));
  }

  function setFlowCaption(node, atoms) {
    node.replaceChildren();
    atoms.forEach((atom, index) => {
      if (index > 0) node.appendChild(document.createTextNode(' → '));
      node.appendChild(el('span', 'xd-chart-atom', atom));
    });
  }

  function buildChart(side) {
    const wrap = el('div', 'xd-chart');
    const legend = el('div', 'xd-legend');
    legend.append(el('span', 'xd-legend-dash'), el('span', null, COPY.ugLine));
    const plot = el('div', 'xd-chart-plot');
    plot.dataset.xdPlot = side;
    const labels = el('div', 'xd-chart-labels');
    labels.dataset.xdLabels = side;
    const caption = el('p', 'xd-chart-caption');
    caption.dataset.xdCaption = side;
    wrap.append(legend, plot, labels, caption);
    if (side === 'left') {
      plot.appendChild(chartSvg(LEFT_SERIES.map((item) => item.score), '#b91c1c'));
      const leftAtoms = LEFT_SERIES.map((item) => `${item.name} ${item.score}${item.tail || ''}`);
      fillLabels(labels, leftAtoms);
      setFlowCaption(caption, leftAtoms);
    }
    return { wrap, plot, labels, caption };
  }

  function buildLampBoard(side) {
    const board = el('div', 'xd-lamp-board');
    board.dataset.xdLamps = side;
    SUBJECTS.forEach((subject) => {
      const row = el('div', 'xd-subject-row');
      row.appendChild(el('div', 'xd-subject-name', subject));
      const line = el('div', 'xd-lamp-line');
      for (let index = 0; index < 4; index += 1) {
        const lamp = el('span', 'xd-lamp');
        lamp.dataset.subject = subject;
        lamp.dataset.index = String(index);
        lamp.appendChild(el('span', 'xd-lamp-core'));
        if (side === 'left') {
          const tone = initialTone(subject, index);
          lamp.classList.add(tone === 'green' ? 'is-green' : 'is-red');
          lamp.setAttribute('aria-label', `${subject}${tone === 'green' ? '绿灯' : '红灯'}`);
        }
        line.appendChild(lamp);
      }
      if (side === 'right' && subject === '数学') {
        const tag = el('span', 'xd-lock-tag', COPY.lock);
        tag.dataset.xdLockTag = '1';
        tag.hidden = true;
        line.appendChild(tag);
      }
      row.appendChild(line);
      board.appendChild(row);
    });
    return board;
  }

  function buildCard(side) {
    const card = el('article', `xd-card xd-card-${side}`);
    card.dataset.xdSide = side;
    const head = el('div', 'xd-card-head');
    const title = side === 'left' ? COPY.leftTitle : COPY.rightTitle;
    head.appendChild(el('h3', 'xd-card-title', title));
    const sideCol = el('div', 'xd-head-side');
    const counter = el('div', 'xd-counter');
    counter.dataset.xdCounter = side;
    counter.setAttribute('aria-live', 'polite');
    sideCol.appendChild(counter);
    if (side === 'right') sideCol.appendChild(el('div', 'xd-parent-badge', COPY.badge));
    head.appendChild(sideCol);

    const process = el('p', `xd-process ${side === 'left' ? 'xd-process-bad' : 'xd-process-good'}`, side === 'left' ? COPY.leftProcess : COPY.rightProcess);
    const main = el('div', 'xd-card-main');
    main.append(buildLampBoard(side), buildScoreboard(side));

    const tags = el('div', 'xd-tags');
    const tagList = side === 'left' ? COPY.leftTags : COPY.rightTags;
    const tagClass = side === 'left' ? 'xd-tag xd-tag-bad' : 'xd-tag xd-tag-good';
    tagList.forEach((text) => tags.appendChild(el('span', tagClass, text)));
    const status = el('p', 'xd-status', side === 'left' ? COPY.leftStatus : COPY.rightStatus);
    card.append(head, process, main);
    if (side === 'right') {
      const phase = el('p', 'xd-phase');
      phase.dataset.xdPhase = '1';
      const sync = el('p', 'xd-sync');
      sync.dataset.xdSync = '1';
      sync.setAttribute('aria-live', 'polite');
      card.append(phase, sync);
    }
    card.append(tags, status);
    return card;
  }

  function buildScoreboard(side) {
    const board = el('div', 'xd-scoreboard');
    board.appendChild(el('p', 'xd-score-kicker', side === 'left' ? '当前总分' : '预期总分'));
    const line = el('p', 'xd-score-line');
    const num = el('span', null, side === 'left' ? String(LEFT_SCORE) : String(START_SCORE));
    num.dataset.xdScore = side;
    line.append(num, document.createTextNode(' 分'));
    const gap = el('p', 'xd-gap-tag is-below', side === 'left' ? COPY.stall : gapLabel(START_SCORE));
    gap.dataset.xdGap = side;
    const chart = buildChart(side);
    board.append(line, gap, chart.wrap);
    return board;
  }

  function mountXiaodengAnimation(targetEl, options = {}) {
    if (!targetEl) return null;
    assertData();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const amberMs = reduceMotion ? 160 : 460;
    const holdMs = reduceMotion ? 220 : 620;
    const stepHoldMs = { 1: 2600, 2: 2600, 6: 3400 };

    targetEl.replaceChildren();
    const shell = el('section', 'xd-anim-shell');
    shell.setAttribute('aria-label', COPY.title);

    const top = el('div', 'xd-top');
    const copy = el('div', 'xd-top-copy');
    copy.append(el('h2', 'xd-title', COPY.title), el('p', 'xd-sub', COPY.sub));
    const playBtn = el('button', 'xd-play', '暂停');
    playBtn.type = 'button';
    playBtn.dataset.xdToggle = '1';
    top.append(copy, playBtn);

    const compare = el('div', 'xd-compare');
    compare.append(buildCard('left'), buildCard('right'));

    const steps = el('div', 'xd-steps');
    steps.setAttribute('role', 'tablist');
    steps.setAttribute('aria-label', '六步闭环');
    COPY.steps.forEach((pair, index) => {
      const btn = el('button', 'xd-step');
      btn.type = 'button';
      btn.dataset.xdStep = String(index + 1);
      btn.setAttribute('role', 'tab');
      btn.append(el('span', 'xd-step-title', pair[0]), el('span', 'xd-step-desc', pair[1]));
      steps.appendChild(btn);
    });

    shell.append(top, compare, steps);
    targetEl.appendChild(shell);

    const leftSide = shell.querySelector('[data-xd-side="left"]');
    const rightSide = shell.querySelector('[data-xd-side="right"]');
    const stepBtns = [...shell.querySelectorAll('[data-xd-step]')];
    const phaseEl = shell.querySelector('[data-xd-phase]');
    const syncEl = shell.querySelector('[data-xd-sync]');
    const rightScoreEl = shell.querySelector('[data-xd-score="right"]');
    const rightScoreLine = rightScoreEl.parentElement;
    const rightGap = shell.querySelector('[data-xd-gap="right"]');
    const rightPlot = shell.querySelector('[data-xd-plot="right"]');
    const rightLabels = shell.querySelector('[data-xd-labels="right"]');
    const rightCaption = shell.querySelector('[data-xd-caption="right"]');
    const lockTag = shell.querySelector('[data-xd-lock-tag]');
    const rightLamps = [...rightSide.querySelectorAll('.xd-lamp')];

    let playing = options.autoPlay !== false;
    let token = 0;
    let currentStep = 1;
    let shownScore = START_SCORE;
    let scoreAnim = 0;
    let chartOfficial = false;
    const waiters = [];

    function lampEl(subject, index) {
      return rightLamps.find((node) => node.dataset.subject === subject && node.dataset.index === String(index));
    }

    function syncCounters() {
      [leftSide, rightSide].forEach((side) => {
        const red = side.querySelectorAll('.xd-lamp.is-red').length;
        const green = side.querySelectorAll('.xd-lamp.is-green').length;
        const locked = side.querySelectorAll('.xd-lamp.is-locked').length;
        const parts = [`${red}红`, `${green}绿`];
        if (locked > 0) parts.push(`${locked}砍难`);
        side.querySelector('[data-xd-counter]').textContent = parts.join(' ');
      });
    }

    const lampObserver = new MutationObserver(syncCounters);
    lampObserver.observe(leftSide.querySelector('[data-xd-lamps]'), { subtree: true, attributes: true, attributeFilter: ['class'] });
    lampObserver.observe(rightSide.querySelector('[data-xd-lamps]'), { subtree: true, attributes: true, attributeFilter: ['class'] });

    function setActive(step) {
      stepBtns.forEach((btn) => {
        const on = Number(btn.dataset.xdStep) === step;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    function paintRightChart() {
      if (chartOfficial) {
        const atoms = RIGHT_SERIES.map((score, index) => (index === RIGHT_SERIES.length - 1 ? `${score}分` : String(score)));
        rightPlot.replaceChildren(chartSvg(RIGHT_SERIES, '#047857'));
        fillLabels(rightLabels, atoms);
        setFlowCaption(rightCaption, atoms);
        rightCaption.classList.add('is-above');
        return;
      }
      const series = [START_SCORE];
      let running = START_SCORE;
      CLEAR_SEQUENCE.forEach((item) => {
        running += item.gain;
        if (running < shownScore) series.push(running);
      });
      if (series[series.length - 1] !== shownScore) series.push(shownScore);
      const liveAtoms = series.length === 1 ? [String(series[0])] : [String(series[0]), String(series[series.length - 1])];
      rightPlot.replaceChildren(chartSvg(series, shownScore >= UNDERGRAD ? '#047857' : '#b45309'));
      fillLabels(rightLabels, liveAtoms);
      setFlowCaption(rightCaption, liveAtoms);
      rightCaption.classList.toggle('is-above', shownScore >= UNDERGRAD);
    }

    function paintScore() {
      rightScoreEl.textContent = String(shownScore);
      rightScoreLine.classList.toggle('is-above', shownScore >= UNDERGRAD);
      rightScoreLine.classList.toggle('is-mid', shownScore >= 375 && shownScore < UNDERGRAD);
      rightGap.textContent = gapLabel(shownScore);
      const win = chartOfficial && shownScore === FINAL_SCORE;
      rightGap.classList.toggle('is-win', win);
      rightGap.classList.toggle('is-above', shownScore >= UNDERGRAD && !win);
      rightGap.classList.toggle('is-below', shownScore < UNDERGRAD);
      paintRightChart();
    }

    function setRightScore(target, animate) {
      scoreAnim += 1;
      const id = scoreAnim;
      const from = shownScore;
      if (!animate || reduceMotion || from === target) {
        shownScore = target;
        paintScore();
        return;
      }
      const start = performance.now();
      const dur = Math.min(380, 28 * Math.abs(target - from));
      const frame = (now) => {
        if (id !== scoreAnim) return;
        const progress = Math.min(1, (now - start) / dur);
        shownScore = Math.round(from + (target - from) * progress);
        paintScore();
        if (progress < 1) requestAnimationFrame(frame);
        else {
          shownScore = target;
          paintScore();
        }
      };
      requestAnimationFrame(frame);
    }

    function paintLamps(cleared, locked, focus) {
      const done = new Set(CLEAR_SEQUENCE.slice(0, cleared).map((item) => `${item.subject}:${item.index}`));
      rightLamps.forEach((lamp) => {
        const key = `${lamp.dataset.subject}:${lamp.dataset.index}`;
        const lockedLamp = locked && lamp.dataset.subject === '数学' && Number(lamp.dataset.index) >= 2;
        lamp.classList.remove('is-red', 'is-green', 'is-amber', 'is-locked', 'is-fresh', 'is-focus');
        if (lockedLamp) {
          lamp.classList.add('is-locked');
          lamp.setAttribute('aria-label', `${lamp.dataset.subject}${COPY.lock}`);
        } else if (done.has(key)) {
          lamp.classList.add('is-green', 'is-fresh');
          lamp.setAttribute('aria-label', `${lamp.dataset.subject}${COPY.cleared}`);
        } else if (initialTone(lamp.dataset.subject, Number(lamp.dataset.index)) === 'green') {
          lamp.classList.add('is-green');
          lamp.setAttribute('aria-label', `${lamp.dataset.subject}绿灯`);
        } else {
          lamp.classList.add('is-red');
          if (focus) lamp.classList.add('is-focus');
          lamp.setAttribute('aria-label', `${lamp.dataset.subject}红灯`);
        }
      });
      if (lockTag) lockTag.hidden = !locked;
    }

    function applyEndState(step) {
      const cleared = STEP_CLEARED[step];
      const locked = step >= 2;
      chartOfficial = step === 6;
      paintLamps(cleared, locked, locked && cleared < 16);
      setRightScore(scoreAfterCleared(cleared), false);
      if (step === 1) syncEl.textContent = COPY.msg1;
      else if (step === 2) syncEl.textContent = COPY.msg2;
      else if (step === 6) syncEl.textContent = `今日消灯 16 处 · 预期总分 ${FINAL_SCORE} 分 · ${COPY.win}`;
      else syncEl.textContent = lampMessage(CLEAR_SEQUENCE[cleared - 1]);
      const showCleared = step >= 3;
      phaseEl.textContent = showCleared ? COPY.cleared : '';
      phaseEl.classList.toggle('is-green', showCleared);
    }

    function showStep(step) {
      currentStep = step;
      setActive(step);
      applyEndState(step);
    }

    function later(ms, myToken) {
      return new Promise((resolve) => {
        const rec = { resolve, myToken, timer: 0 };
        rec.timer = window.setTimeout(() => {
          const index = waiters.indexOf(rec);
          if (index >= 0) waiters.splice(index, 1);
          resolve(myToken === token);
        }, ms);
        waiters.push(rec);
      });
    }

    function cancelWaits() {
      scoreAnim += 1;
      waiters.splice(0).forEach((rec) => {
        window.clearTimeout(rec.timer);
        rec.resolve(false);
      });
    }

    async function animateOne(index, myToken) {
      const item = CLEAR_SEQUENCE[index];
      const lamp = lampEl(item.subject, item.index);
      lamp.classList.add('is-amber', 'is-focus');
      lamp.setAttribute('aria-label', `${item.subject}${COPY.amber}`);
      phaseEl.textContent = COPY.amber;
      phaseEl.classList.remove('is-green');
      if (!(await later(amberMs, myToken))) return false;
      lamp.classList.remove('is-red', 'is-amber', 'is-focus');
      lamp.classList.add('is-green', 'is-fresh');
      lamp.setAttribute('aria-label', `${item.subject}${COPY.cleared}`);
      phaseEl.textContent = COPY.cleared;
      phaseEl.classList.add('is-green');
      syncEl.textContent = lampMessage(item);
      setRightScore(scoreAfterCleared(index + 1), true);
      if (!(await later(holdMs, myToken))) return false;
      return myToken === token;
    }

    async function playStep(step, myToken) {
      if (!shell.isConnected || myToken !== token) return false;
      currentStep = step;
      setActive(step);
      if (step === 3 || step === 4 || step === 5) {
        applyEndState(step - 1);
        currentStep = step;
        setActive(step);
        const [from, to] = STEP_RANGES[step];
        for (let index = from; index < to; index += 1) {
          if (!(await animateOne(index, myToken))) return false;
        }
        if (myToken !== token) return false;
        applyEndState(step);
        currentStep = step;
        return later(700, myToken);
      }
      applyEndState(step);
      return later(stepHoldMs[step] || 2600, myToken);
    }

    async function loop(step, myToken) {
      let cursor = step;
      while (myToken === token && playing && shell.isConnected) {
        const ok = await playStep(cursor, myToken);
        if (!ok || myToken !== token || !playing) return;
        cursor = cursor === 6 ? 1 : cursor + 1;
      }
    }

    function start(step) {
      token += 1;
      cancelWaits();
      const myToken = token;
      currentStep = step;
      if (playing) loop(step, myToken);
      else showStep(step);
    }

    const abort = new AbortController();
    stepBtns.forEach((btn) => {
      btn.addEventListener('click', () => start(Number(btn.dataset.xdStep)), { signal: abort.signal });
    });
    playBtn.addEventListener('click', () => {
      playing = !playing;
      playBtn.textContent = playing ? '暂停' : '继续';
      if (playing) start(currentStep >= 6 ? 1 : currentStep + 1);
      else {
        token += 1;
        cancelWaits();
        showStep(currentStep);
      }
    }, { signal: abort.signal });

    playBtn.textContent = playing ? '暂停' : '继续';
    syncCounters();
    start(options.startStep || 1);

    return {
      destroy() {
        token += 1;
        cancelWaits();
        lampObserver.disconnect();
        abort.abort();
      },
      jumpToStage(step) {
        const next = Math.min(6, Math.max(1, Number(step) || 1));
        playing = false;
        playBtn.textContent = '继续';
        token += 1;
        cancelWaits();
        showStep(next);
      }
    };
  }

  function autoMountAll() {
    document.querySelectorAll('[data-xiaodeng-anim]').forEach((node) => {
      if (node.dataset.xdMounted) return;
      node.dataset.xdMounted = '1';
      mountXiaodengAnimation(node);
    });
  }

  window.mountXiaodengAnimation = mountXiaodengAnimation;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMountAll);
  } else {
    autoMountAll();
  }
})();
