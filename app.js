/* ============================================================
   武汉中考数学能力筛查系统 · 核心逻辑
   数据来源：武汉中考数学能力筛查系统.xlsx ①题号筛查矩阵 / ②模块能力画像 / ③等级判定
   ============================================================ */

// ---------- 1. 24 道题的数据字典 ----------
const QUESTIONS = [
  {n:1,  type:"选择", score:3, topic:"轴对称图形识别",         module:"图形与几何",   level:"基础"},
  {n:2,  type:"选择", score:3, topic:"随机事件分类（不可能事件）", module:"统计与概率",   level:"基础"},
  {n:3,  type:"选择", score:3, topic:"三视图（球+长方体组合体）",  module:"图形与几何", level:"基础"},
  {n:4,  type:"选择", score:3, topic:"科学记数法（大数）",         module:"数与式",     level:"基础"},
  {n:5,  type:"选择", score:3, topic:"幂运算（同底数/积的乘方）",  module:"数与式",     level:"基础"},
  {n:6,  type:"选择", score:3, topic:"旋转角度计算",             module:"图形与几何", level:"基础"},
  {n:7,  type:"选择", score:3, topic:"两步概率（树状图/列表）",    module:"统计与概率", level:"基础"},
  {n:8,  type:"选择", score:3, topic:"函数图象信息读取（实际应用）", module:"函数",       level:"基础"},
  {n:9,  type:"选择", score:3, topic:"圆综合（垂径/圆周角/三角函数值）", module:"图形与几何", level:"中档"},
  {n:10, type:"选择", score:3, topic:"一元二次方程几何解法（新定义）", module:"综合与实践", level:"难题"},
  {n:11, type:"填空", score:3, topic:"正负数意义",              module:"数与式",     level:"基础"},
  {n:12, type:"填空", score:3, topic:"反比例函数基础性质",        module:"函数",       level:"基础"},
  {n:13, type:"填空", score:3, topic:"代数式求值（整体代入）",     module:"数与式",     level:"基础"},
  {n:14, type:"填空", score:3, topic:"解直角三角形实际应用",      module:"图形与几何", level:"中档"},
  {n:15, type:"填空", score:3, topic:"相似三角形+折叠综合",      module:"图形与几何", level:"难题"},
  {n:16, type:"填空", score:3, topic:"二次函数多结论判断题",      module:"函数",       level:"难题"},
  {n:17, type:"解答", score:8, topic:"一元一次不等式组计算",      module:"方程与不等式", level:"基础"},
  {n:18, type:"解答", score:8, topic:"全等三角形+菱形判定",      module:"图形与几何", level:"基础"},
  {n:19, type:"解答", score:8, topic:"统计综合（图表+样本估计）",  module:"统计与概率", level:"基础"},
  {n:20, type:"解答", score:8, topic:"圆综合（垂径/切线/求线段）", module:"图形与几何", level:"中档"},
  {n:21, type:"解答", score:8, topic:"无刻度直尺作图（网格）",    module:"图形与几何", level:"中档"},
  {n:22, type:"解答", score:10, topic:"二次函数实际应用（利润/最值）", module:"函数",       level:"中档"},
  {n:23, type:"解答", score:10, topic:"几何综合（折叠/相似/旋转）", module:"综合与实践", level:"难题"},
  {n:24, type:"解答", score:12, topic:"二次函数压轴（含参/存在性/定点）", module:"函数",       level:"难题"},
];

// 难度分层定义（卷面满分合计 120）
const LEVEL_GROUPS = [
  {key:"基础", label:"基础题", full:57,  desc:"1-8、11-13、17-19题 · 课本变式"},
  {key:"中档", label:"中档题", full:32,  desc:"9、14、20-22题 · 综合应用"},
  {key:"难题", label:"压轴题", full:31,  desc:"10、15、16、23-24题 · 探究创新"},
];

// 六大知识模块（满分依据 ②模块能力画像）
const MODULES = [
  {key:"数与式",     full:12, desc:"实数运算、整式/分式化简求值、幂运算、科学记数法"},
  {key:"方程与不等式", full:8,  desc:"一元一次方程、方程组、一元一次不等式组"},
  {key:"函数",       full:31, desc:"一次函数、反比例函数、二次函数图象与性质"},
  {key:"图形与几何",   full:42, desc:"全等/相似、特殊四边形、圆、三视图、轴对称、尺规作图"},
  {key:"统计与概率",   full:14, desc:"统计图表综合分析、平均数/中位数/众数、概率"},
  {key:"综合与实践",   full:13, desc:"几何综合（23题）、函数综合（24题）、新定义"},
];

// 等级判定（依据 ③等级判定）
// 等级分界点：107 / 95 / 83 / 71（依据 2026 武汉卷难度梯度校准，卷面分档后对应排位）
const GRADES = [
  {min:108, max:120, name:"顶尖层",  tag:"冲刺顶尖高中",
   desc:"基础零失误，压轴能自主推导，具备分类讨论与多解意识。",
   plan:"稳基础+冲压轴第3问。每天1道压轴题（30分钟），重点训练存在性问题的分类标准，保证基础题100%正确率。"},
  {min:96,  max:107, name:"拔高层",  tag:"冲击省示范",
   desc:"中档题偶有失分，压轴第1-2问可拿，第3问易卡壳。",
   plan:"中档题专项+压轴前两问固化。重点攻：圆综合、二次函数实际应用、几何变换（旋转/翻折）。"},
  {min:84,  max:95,  name:"中上层",  tag:"稳住普高线",
   desc:"基础题基本稳定，中档题失分集中，压轴只能拿第一问。",
   plan:"先补中档再碰压轴。集中突破：分式方程检验、反比例函数综合、统计推断表述规范。"},
  {min:72,  max:83,  name:"基础层",  tag:"先过基础关",
   desc:"基础题有失误，中档题大面积空白，知识链断裂。",
   plan:"回归课本抓基础。优先级：计算零失误（分式化简/解不等式）→ 全等与相似模型 → 统计图表规范。"},
  {min:0,   max:71,  name:"补漏层",  tag:"拉通知识链",
   desc:"多个知识模块存在遗留漏洞，计算与概念双重薄弱。",
   plan:"拉通七八年级漏洞清单。先补齐：整式乘法与因式分解、分式运算、一次函数与反比例函数、全等判定。"},
];

// 常见失分归因（供下拉选择 + 报告解读）
const REASONS = ["计算失误","概念不清","审题不清","模型不熟","步骤丢分","时间不够","完全不会"];

// ---------- 2. 状态 ----------
const state = {
  student: { name:"", grade:"", school:"" },
  scores: {},     // { 题号: 0|1|2|3 }
  reasons: {},    // { 题号: 归因 }
};

const SCORE_OPTIONS = [
  {v:null, t:"未填"},
  {v:0, t:"0分"},
  {v:1, t:"部分"},
  {v:2, t:"大部分"},
  {v:3, t:"满分"},
];

// ---------- 3. 渲染 ----------
function render() {
  renderStudent();
  renderGrid();
  updateProgress();
}

function renderStudent() {
  const s = state.student;
  document.getElementById("st-name").value = s.name;
  document.getElementById("st-grade").value = s.grade;
  document.getElementById("st-school").value = s.school;
}

function renderGrid() {
  const box = document.getElementById("grid");
  box.innerHTML = "";

  // 分组渲染
  const groups = [
    {title:"选择题（1-10题，每题3分）", filter: q => q.type==="选择"},
    {title:"填空题（11-16题，每题3分）", filter: q => q.type==="填空"},
    {title:"解答题（17-24题，8-12分）", filter: q => q.type==="解答"},
  ];

  groups.forEach(g => {
    const qs = QUESTIONS.filter(g.filter);
    const head = document.createElement("div");
    head.className = "group-title";
    head.innerHTML = `<span>${g.title}</span><span class="group-tip">按每题实际得分选，不确定就选"部分"</span>`;
    box.appendChild(head);

    qs.forEach(q => {
      const val = state.scores[q.n];
      const cards = SCORE_OPTIONS.map(o => {
        const cls = o.v === null ? "" : `sc-${o.v}` + (val === o.v ? " on" : "");
        const dis = o.v === null ? "未填" : (q.score === 3 ? ["","1分","2分","3分"][o.v] : ["","得1-2分","得3-5分","满分"][o.v]);
        return `<button class="sc ${cls}" data-n="${q.n}" data-v="${o.v===null?"":o.v}">${o.t}<i>${dis}</i></button>`;
      }).join("");

      const row = document.createElement("div");
      row.className = "qrow";
      row.innerHTML = `
        <div class="qhead">
          <span class="qno">第${q.n}题</span>
          <span class="qtopic">${q.topic}</span>
          <span class="qbadges">
            <i class="m">${q.module}</i>
            <i class="l ${q.level==="基础"?"lv-base":q.level==="中档"?"lv-mid":"lv-hard"}">${q.level}</i>
            <i class="pts">${q.score}分</i>
          </span>
        </div>
        <div class="scards">${cards}</div>
        <div class="reason-row" id="rr-${q.n}" style="${val===null?"display:none":""}">
          <span class="rlabel">这题主要卡在哪：</span>
          <select class="rsel" data-n="${q.n}">
            <option value="">-- 选择失分原因（可选）--</option>
            ${REASONS.map(r=>`<option value="${r}" ${state.reasons[q.n]===r?"selected":""}>${r}</option>`).join("")}
          </select>
        </div>
      `;
      box.appendChild(row);
    });
  });

  // 绑定得分按钮
  box.querySelectorAll(".sc").forEach(btn => {
    btn.addEventListener("click", () => {
      const n = +btn.dataset.n;
      const v = btn.dataset.v === "" ? null : +btn.dataset.v;
      if (v === null) { delete state.scores[n]; delete state.reasons[n]; }
      else state.scores[n] = v;
      render();
      updateProgress();
    });
  });
  // 绑定归因下拉
  box.querySelectorAll(".rsel").forEach(sel => {
    sel.addEventListener("change", () => {
      const n = +sel.dataset.n;
      if (sel.value) state.reasons[n] = sel.value;
      else delete state.reasons[n];
    });
  });
}

function updateProgress() {
  const filled = QUESTIONS.filter(q => state.scores[q.n] !== undefined).length;
  const pct = Math.round(filled / QUESTIONS.length * 100);
  document.getElementById("prog-bar").style.width = pct + "%";
  document.getElementById("prog-text").textContent = `${filled} / ${QUESTIONS.length} 题已填`;
  document.getElementById("btn-report").disabled = filled < QUESTIONS.length;
  document.getElementById("btn-report").textContent = filled < QUESTIONS.length
    ? `还需填写 ${QUESTIONS.length - filled} 题`
    : "生成能力诊断报告";
}

// ---------- 4. 计算 ----------
function compute() {
  let total = 0, gotBase=0, fullBase=0, gotMid=0, fullMid=0, gotHard=0, fullHard=0;
  const modGot={}, modFull={};
  MODULES.forEach(m=>{ modGot[m.key]=0; modFull[m.key]=0; });

  // 档位折算：0/1/2/3 → 0% / 33% / 67% / 100%，24 题统一，避免折算口径混乱
  const STEP = {3:[0,1,2,3], 8:[0,3,5,8], 10:[0,3,7,10], 12:[0,4,8,12]};
  const perQ = QUESTIONS.map(q => {
    const raw = state.scores[q.n];
    const scale = STEP[q.score] || [0,0,0,q.score];
    const got = raw === undefined ? 0 : scale[raw];
    total += got;
    modGot[q.module] += got;
    modFull[q.module] += q.score;
    if (q.level==="基础") { gotBase+=got; fullBase+=q.score; }
    if (q.level==="中档") { gotMid+=got; fullMid+=q.score; }
    if (q.level==="难题") { gotHard+=got; fullHard+=q.score; }
    return {...q, got, lost: q.score-got};
  });

  const rate = a => full => full<=0 ? 0 : +(a/full).toFixed(2);
  const baseRate = rate(gotBase)(fullBase), midRate = rate(gotMid)(fullMid), hardRate = rate(gotHard)(fullHard);
  const totalRate = +(total/120).toFixed(2);

  const moduleRows = MODULES.map(m => ({
    ...m, got: modGot[m.key], rate: rate(modGot[m.key])(modFull[m.key])
  }));

  // 最高档未达标（107 及以下）时按得分区间判定；满分 120 必属顶尖层
  // 满分必属顶尖层；其余按 [min,max] 区间判定
  const grade = total >= GRADES[0].min ? GRADES[0]
              : GRADES.slice(1).reverse().find(g => total >= g.min && total <= g.max)
              || GRADES[GRADES.length-1];

  return {total, totalRate, baseRate, midRate, hardRate, fullBase, fullMid, fullHard,
          moduleRows, grade, perQ};
}

// ---------- 5. 报告渲染 ----------
function statusOf(rate) {
  if (rate >= 0.8) return ["稳固","ok"];
  if (rate >= 0.6) return ["关注","warn"];
  return ["预警","bad"];
}

function showReport() {
  const c = compute();
  document.getElementById("screen-form").classList.remove("active");
  document.getElementById("screen-report").classList.add("active");

  // 顶部成绩卡
  document.getElementById("r-total").textContent = c.total;
  document.getElementById("r-rate").textContent = (c.totalRate*100).toFixed(0) + "%";
  const gradeBadge = document.getElementById("r-grade");
  gradeBadge.textContent = c.grade.name + " · " + c.grade.tag;
  gradeBadge.className = "grade-badge g" + (GRADES.length - 1 - GRADES.indexOf(c.grade));

  document.getElementById("r-desc").textContent = c.grade.desc;
  document.getElementById("r-plan").textContent = c.grade.plan;

  // 分层得分率
  const lvRows = [
    {label:"基础题", got:c.baseRate, full:c.fullBase, rate:c.baseRate, cls:"lv-base"},
    {label:"中档题", got:c.midRate, full:c.fullMid, rate:c.midRate, cls:"lv-mid"},
    {label:"压轴题", got:c.hardRate, full:c.fullHard, rate:c.hardRate, cls:"lv-hard"},
  ];
  document.getElementById("lv-rows").innerHTML = lvRows.map(r=>{
    const [st,stc]=statusOf(r.rate);
    return `<div class="lv-row">
      <div class="lv-l"><span class="dot ${r.cls}"></span><b>${r.label}</b><i>${r.full}分满分</i></div>
      <div class="lv-bar"><i style="width:${(r.rate*100).toFixed(0)}%"></i></div>
      <div class="lv-rate">${(r.rate*100).toFixed(0)}%</div>
      <div class="lv-st ${stc}">${st}</div>
    </div>`;
  }).join("");

  // 模块画像表 + 雷达图数据
  let weak = [];
  document.getElementById("mod-rows").innerHTML = c.moduleRows.map(m=>{
    const [st,stc]=statusOf(m.rate);
    if (m.rate < 0.8) weak.push(m);
    return `<tr>
      <td><b>${m.key}</b><br><small>${m.desc}</small></td>
      <td class="num">${m.got}</td>
      <td class="num">${m.full}</td>
      <td class="num rate-cell">${(m.rate*100).toFixed(0)}%</td>
      <td class="st ${stc}">${st}</td>
    </tr>`;
  }).join("");

  renderRadar(c.moduleRows.map(m=>m.rate*100));
  renderReasonChart(c);

  // 薄弱模块
  const weakBox = document.getElementById("weak-box");
  if (weak.length === 0) {
    weakBox.innerHTML = `<div class="okcard">🎉 六大模块得分率均在 80% 以上，整体结构健康。继续保持基础题零失误，重点冲击中档与压轴。</div>`;
  } else {
    weak.sort((a,b)=>a.rate-b.rate);
    weakBox.innerHTML = weak.map(m=>{
      const gap = (80 - m.rate*100).toFixed(0);
      return `<div class="weak-item">
        <div class="weak-top"><b>${m.key}</b><span>缺口约 ${gap} 个百分点</span></div>
        <p>${m.desc}</p>
        <p class="weak-act">▶ 建议：回归课本重新梳理该模块核心模型，配套练习 15-20 题巩固。</p>
      </div>`;
    }).join("");
  }

  // 失分归因排行
  const reasonBox = document.getElementById("reason-box");
  const rc = {};
  Object.entries(state.reasons).forEach(([n,r])=>{ rc[r]=(rc[r]||0)+QUESTIONS.find(q=>q.n==n).score; });
  const rcArr = Object.entries(rc).sort((a,b)=>b[1]-a[1]);
  if (rcArr.length === 0) {
    reasonBox.innerHTML = `<div class="okcard">未填写失分归因，报告的解读深度受限。可返回补充，报告会同步更新。</div>`;
  } else {
    reasonBox.innerHTML = rcArr.map(([r,s])=>`<div class="reason-item"><span>${r}</span><b>累计丢分 ${s} 分</b></div>`).join("");
  }

  // 报告头信息
  document.getElementById("r-student").textContent = state.student.name || "这位同学";
  document.getElementById("r-meta").textContent = [state.student.grade, state.student.school].filter(Boolean).join(" · ") || "武汉中考数学";

  window.scrollTo({top:0, behavior:"smooth"});
  document.getElementById("btn-share").style.display = "block";
}

// 雷达图
let radarChart = null;
function renderRadar(values) {
  const ctx = document.getElementById("radar");
  if (radarChart) radarChart.destroy();
  const labels = MODULES.map(m=>m.key);
  radarChart = new Chart(ctx, {
    type:"radar",
    data:{ labels, datasets:[
      { label:"模块得分率(%)", data:values,
        backgroundColor:"rgba(37,99,235,0.18)",
        borderColor:"rgba(37,99,235,1)",
        pointBackgroundColor:"rgba(37,99,235,1)",
        borderWidth:2 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      scales:{ r:{ min:0, max:100, ticks:{stepSize:20, backdropColor:"transparent", color:"#94a3b8"},
        grid:{color:"#e2e8f0"}, angleLines:{color:"#e2e8f0"}, pointLabels:{font:{size:13}} } },
      plugins:{ legend:{display:false} }
    }
  });
}

// 归因条形图
function renderReasonChart(c) {
  const ctx = document.getElementById("reasonBar");
  const lost = c.perQ.filter(q=>q.lost>0).sort((a,b)=>b.lost-a.lost).slice(0,8);
  if (window._rc) window._rc.destroy();
  window._rc = new Chart(ctx, {
    type:"bar",
    data:{ labels:lost.map(q=>"第"+q.n+"题"),
      datasets:[{ data:lost.map(q=>q.lost),
        backgroundColor: lost.map(q=> q.level==="难题"?"#ef4444":q.level==="中档"?"#f59e0b":"#94a3b8"),
        borderRadius:4 }] },
    options:{ indexAxis:"y", responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>c.parsed.x+" 分"}} },
      scales:{ x:{max:12, grid:{color:"#f1f5f9"}, ticks:{color:"#64748b"}},
               y:{grid:{display:false}, ticks:{color:"#334155", font:{size:12}}} } }
  });
}

// ---------- 6. 交互绑定 ----------
document.addEventListener("DOMContentLoaded", ()=>{
  render();

  document.getElementById("st-name").addEventListener("input", e=>state.student.name=e.target.value);
  document.getElementById("st-grade").addEventListener("input", e=>state.student.grade=e.target.value);
  document.getElementById("st-school").addEventListener("input", e=>state.student.school=e.target.value);

  document.getElementById("btn-reset").addEventListener("click", ()=>{
    if (!confirm("清空所有已填分数，重新填写？")) return;
    state.scores={}; state.reasons={};
    render(); updateProgress();
    document.getElementById("screen-report").classList.remove("active");
    document.getElementById("screen-form").classList.add("active");
  });

  document.getElementById("btn-report").addEventListener("click", showReport);
  document.getElementById("btn-back").addEventListener("click", ()=>{
    document.getElementById("screen-report").classList.remove("active");
    document.getElementById("screen-form").classList.add("active");
  });

  document.getElementById("btn-share").addEventListener("click", ()=>{
    const url = location.href;
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(
      ()=>alert("报告链接已复制，可分享给家长"), ()=>alert("请手动复制地址栏链接")
    ); else alert("请手动复制地址栏链接分享给家长");
  });
});
