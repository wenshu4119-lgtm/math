
const D={};function n(id,title,desc,items){D[id]={title,desc,items};return `<button class="node" data-id="${id}"><b>${title}</b><span>${desc}</span></button>`}const row=(...x)=>'<div class="row">'+x.join('')+'</div>';const lane=(t,c)=>`<div class="lane"><div class="laneLabel">${t}</div>${c}</div>`;const ar=t=>`<div class="arrow">↓ ${t||''}</div>`;
const group=n('group','01 · 确定学生类别','毕业冲刺 / 非毕业成长',['毕业冲刺：中考、高考（普通文化生 / 艺考生）。','非毕业：初中或高中，选择超前进度、同步拔高、查漏补缺。','学生类别与服务方式是独立维度，不要混成一套会员等级。']);
const goal=n('goal','02 · 明确目标与时间','目标学校、难度、进度、可用时间',['毕业生从理想高中或大学倒推参考分数；艺考还需专业成绩。','非毕业生按进度与难度目标制定。','全脱产按全天时段；非脱产按实际可用时间。']);
const service=n('service','03 · 选择服务与权益','自学 / 答疑 / 测评 / 报课',['自学按资源库、三步闭环或组合模块购买。','答疑分平台全功能＋老师安排、单独错题答疑两条。','测评按周/双周/月；报课由管理员凭外部缴费开通。']);
const loop=n('loop','04 · 执行学习闭环','计划 → 任务 → 复盘检测',['计划任务必须绑定具体时间点、内容和完成标准。','资源库单用用户可不进入三步闭环，不适用目标红黄绿灯。','复测证据与任务打卡分开，不把完成任务等同于掌握。']);
const growth=n('growth','05 · 留下成长档案','起点、任务、检测、考试、变化',['汇总注册起点至今的学习轨迹。','家长可补录各阶段考试成绩，并保留来源。','管理员可授权代填，保留操作者和更正记录。']);
const graduate=n('graduate','毕业冲刺','中考 / 高考',['中考对应理想高中；高考对应理想大学。','高考区分普通文化生与艺考生，其他学习流程共享。']);
const middle=n('middle','冲刺中考','理想高中 → 参考目标分',['按同地区、同录取类别的近三年录取线计算参考目标。','需确认“录取线”具体口径，缺年份或不可比时提示，不编造。']);
const college=n('college','冲刺高考','理想大学 → 参考目标分',['普通文化生：文化成绩目标。','艺考生：专业成绩＋文化成绩，根据适用综合分公式倒推文化需求。','必须识别省份、年度、专业/批次和选科等条件；另校验文化与专业最低门槛。']);
const full=n('full','全脱产','全天学习安排',['设置全天可学习时段、休息与固定占用。','排学习任务、复盘与过关检测，以日为主要节奏。']);
const part=n('part','非脱产','选择可用时间',['根据校内安排外的空闲时间排程。','日/周节奏按学生实际方案配置，不默认每位非脱产学生均周计划。']);
const advance=n('advance','超前进度','当前位置 → 超前量 → 达标要求',['填写当前学期与进度；设置超前一个学期或自定义时长。','难度：基础 / 中等 / 标准考试难度。','达标等级：合格 / 良好 / 优秀；分数阈值待定。','匹配目标范围内内容，生成计划表、任务与复测。']);
const enhance=n('enhance','同步拔高','当前进度 → 提升难度',['填写当前学习进度与想拔高的难度等级。','匹配题目生成学习任务；完成后复盘检测并出报告。']);
const remedy=n('remedy','查漏补缺','检测薄弱 → 针对任务',['通过检测找出薄弱知识点与证据。','匹配对应讲义、练习和复测；再次生成报告。']);
const self=n('self','自学','独立使用 · 按模块付费',['注册会员后购买：①题库/知识库资源 ②计划—任务—复盘检测报告 ③综合使用。','仅购买资源库时不要求进入闭环，不展示目标达成灯。','模块价格待定，本图不触发购买。']);
const tutor=n('tutor','答疑 A · 带计划','平台全功能＋老师安排',['默认含自学的全部功能。','老师设定计划与任务量 → 学生下载作答 → 提交 → 老师评改。','只讲错题；收费＝功能使用费＋按年级、时长计算的答疑费。']);
const wrong=n('wrong','答疑 B · 单独错题','学生主动提交 → 老师讲解',['不强制购买平台全部功能。','按年级、答疑时长计费。','这条独立路径不强制先有检测报告或学习计划。']);
const evaluate=n('evaluate','测评找薄弱','每周 / 每两周 / 每月',['按选定周期测评分析，生成评估报告。','每次服务包含一次规划分析课。','是否包含长期闭环权益、计划执行支持，需与定价规则确认。']);
const course=n('course','报课','外部缴费 → 管理员开通',['家长选课程，线下或第三方平台完成收费。','管理员核验缴费后开通课程。','按“除答疑外”理解为含自学全部功能＋测评分析及规划分析课，排除两种答疑。','原文“上面三种全部功能”与排除答疑存在表述重叠，此处需你确认权益边界。']);
const fee=n('fee','费用与积分账本','线上能力不足时走外部缴费',['线下/第三方（例如企业微信相关渠道）缴费 → 管理员核验 → 充值积分/开通权益 → 消费扣积分 → 留账。','积分兑换比例、有效期、退费、扣费时点和计时规则待确定。','扣费要防重复、可追溯；积分只是记录方式，不等于已经接通支付。']);
const baseline=n('baseline','建立起点','注册资料＋基础检测',['记录年级、学期、学习进度、基础成绩与来源。','检测只对覆盖内容得出结论，不把未测内容判为薄弱。']);
const targets=n('targets','设定目标','学校分数 / 进度难度',['毕业：目标学校参考线、艺考文化倒推。','非毕业：超前量/提升难度/薄弱改善。','结合全脱产或可用时间；内容或时间不足时明确显示缺口。']);
const plan=n('plan','生成计划和任务','绑定内容、时间、完成标准',['从知识库、题库匹配讲义及分层题。','每条任务绑定具体日期/时段、预计时长、检测标准。','答疑 A 由老师设定计划和任务量；其他按服务权限生成。']);
const study=n('study','学习与提交','在线学习 / 下载作答',['资源阅读、练习和学习记录。','答疑 A 的下载作答提交给老师评改，只讲错题。','上传作业不等于自动识别批改，具体技术方案另行确认。']);
const review=n('review','复盘检测 → 报告','看证据，不只看打卡',['检测是否过关，输出问题、掌握变化与下一步。','需要巩固的返回任务；已达标的进入下一阶段。','答疑、测评服务按各自流程加入教师评改和规划分析课。']);
const lights=n('lights','红黄绿灯与提醒','日计划每日 / 周计划每周',['使用闭环的学员按日/周计划提醒该做什么、是否完成。','任务完成后依据检测证据显示过关等级；分开显示完成状态和掌握状态。','建议绿＝本阶段达标；黄＝待巩固/偏离；红＝未过关需调整；阈值待确认。','未检测显示灰色待测，不强行判红；非闭环用户不显示目标灯。','提醒更新不等于已实现自动推送，通知渠道与时间需另定。']);
const archive=n('archive','学员进步档案','一人一份长期学习轨迹',['起步基础 → 做过的任务 → 复盘报告 → 阶段考试 → 可比变化。','建议三视图：阶段时间轴、同口径成绩曲线、知识点掌握地图。','示意图不使用真实学生数据，不计算没有依据的提分百分比。']);
const parent=n('parent','家长成绩窗口','补录不同阶段考试分数',['填写考试名称、日期、科目、分数、满分、考试范围与来源。','不同试卷/满分/赋分口径分组显示，不画成一条误导曲线。','允许更正并留历史，授权范围内查看孩子数据。']);
const admin=n('admin','管理员镜像工作台','所有功能都能授权代填',['代学生/家长/老师录入对应信息，但保留操作者、代填对象和时间。','管理注册资料、目标计划、作业报告、成长档案、资源导入、课程开通与积分。','管理权限并不等于所有人可看所有孩子，按角色和关系隔离。']);
const input=n('input','管理员提交资源','单题 / Word / PDF 套卷',['上传时选择年级、科目；选择知识进入知识库、选择题目进入题库。','多题套卷需拆题及核对；文档含题目和知识时可分流整理。']);
const parse=n('parse','解析与核对','建议增加质量闸门',['检查题号、公式、图示、答案解析、重复与来源授权。','Word/PDF 解析失败或信息不足进入待处理，不把上传成功当作入库完成。','保留原文件与版本；这一步是建议的实现保障。']);
const kb=n('kb','知识库','基础必掌握 / 总结归纳',['年级＋科目＋知识点索引。','知识类型：基础必掌握类、总结归纳类。','用于学习讲义、针对薄弱讲解及自学资源。']);
const qb=n('qb','题目库','基础 / 中等 / 压轴',['年级＋科目＋知识点＋难度。','难度与用途分开：同一难度可以用于检测、练习或复测。','保留答案、解析、审核状态及版本，支持老师纠错。']);
const match=n('match','统一匹配引擎','供检测、计划、练习、复测使用',['按学生目标、当前水平、知识点、难度和可用时间选内容。','没有匹配内容时提示缺口，不以无关内容凑数。','资源库单用学员可直接检索使用，不必经过计划。']);
const pages=[
{title:'平台总览',sub:'五个主环节，一条学习主线；点击任意节点看规则。',html:row(group)+ar()+row(goal)+ar()+row(service)+ar()+row(loop)+ar()+row(growth)+lane('贯穿全程的支撑',row(admin,input,fee))},
{title:'学生与目标',sub:'先选学习目标，再独立选择时间安排与服务方式。',html:lane('A · 毕业冲刺',row(graduate)+ar('目标学校倒推')+row(middle,college)+ar('选择时间方式')+row(full,part))+lane('B · 非毕业的初中 / 高中学生',row(advance,enhance,remedy))+`<div class="back">两大类均可选择四种服务；全脱产/可用时间是排程维度</div>`},
{title:'服务与计费',sub:'四种服务可跨学生类别选择；答疑单列两条路径。',html:lane('① 自学',row(self))+lane('② 答疑',row(tutor,wrong))+lane('③ 测评找薄弱',row(evaluate))+lane('④ 报课',row(course))+ar('权益与账本贯穿服务')+row(fee)},
{title:'学习闭环',sub:'按日或按周，持续从目标走到有证据的变化。',html:[baseline,targets,plan,study,review,lights,archive].map((x,i)=>`<div class="step"><i>${i+1}</i>${x}</div>${i<6?ar():''}`).join('')+`<div class="back">↺ 未过关 / 新问题 → 调整任务与计划 → 再学再测</div>`},
{title:'档案与管理',sub:'让家长看见起点、过程与变化，而不仅是一张成绩单。',html:row(archive)+ar('汇入长期轨迹')+row(parent,admin)+lane('视觉方案 · 以下仅为示意，不是真实成绩',`<svg class="miniChart" viewBox="0 0 440 100" role="img" aria-label="同口径成绩趋势示意"><path d="M20 80H420M20 10V80" fill="none" stroke="#bbccbd"/><path d="M20 70L100 57L180 62L260 38L340 32L420 15" fill="none" stroke="#277459" stroke-width="3"/><g fill="#277459"><circle cx="20" cy="70" r="4"/><circle cx="100" cy="57" r="4"/><circle cx="180" cy="62" r="4"/><circle cx="260" cy="38" r="4"/><circle cx="340" cy="32" r="4"/><circle cx="420" cy="15" r="4"/></g></svg><p class="muted">① 阶段时间轴　② 同口径成绩曲线　③ 知识点掌握地图<br>保留波动，不把不同考试直接当作同尺度进步。</p>`)},
{title:'题库与知识库',sub:'从“持续造题”转向“管理员提交 → 核对分类 → 统一匹配”。',html:row(input)+ar('选择年级 / 科目 / 资源类型')+row(parse)+ar('分类入库')+row(kb,qb)+ar('按知识点与难度连接')+row(match)+ar()+row(plan,review,self)},
{title:'路径模拟',sub:'选择一个场景，查看它怎样穿过平台。仅演示业务逻辑。',html:''}
];
let current=0,timer=null,idx=0;const $=s=>document.querySelector(s);$('#nav').innerHTML=pages.map((p,i)=>`<button data-page="${i}">${p.title}</button>`).join('');
function showDetail(id){const d=D[id];if(!d)return;document.querySelectorAll('.node').forEach(x=>x.classList.toggle('selected',x.dataset.id===id));$('#detailTitle').textContent=d.title;$('#detailDesc').textContent=d.desc;$('#detailList').innerHTML=d.items.map(x=>`<li>${x}</li>`).join('')}
function stop(){clearInterval(timer);timer=null;$('#play').textContent='▶ 自动走读'}
function render(i){stop();current=i;$('#heading').textContent=pages[i].title;$('#sub').textContent=pages[i].sub;document.querySelectorAll('nav button').forEach((b,j)=>b.classList.toggle('active',j===i));$('#filters').classList.toggle('hidden',i!==6);$('#canvas').innerHTML=pages[i].html;$('#path').innerHTML='';$('#progress').style.width='0';if(i===6)simulate();else showDetail($('#canvas .node').dataset.id)}
$('#nav').onclick=e=>{if(e.target.dataset.page)render(+e.target.dataset.page)};$('#canvas').onclick=e=>{const n=e.target.closest('.node');if(n)showDetail(n.dataset.id)};
$('#filters').innerHTML=`<label>学生方向<select id="type"><option>冲刺中考</option><option>冲刺高考·文化生</option><option>冲刺高考·艺考生</option><option>非毕业·超前进度</option><option>非毕业·同步拔高</option><option>非毕业·查漏补缺</option></select></label><label>服务方式<select id="mode"><option>自学·资源库单用</option><option>自学·三步闭环</option><option>自学·全部功能</option><option>答疑 A·老师带计划</option><option>答疑 B·单独错题</option><option>周期测评</option><option>报课</option></select></label><label>学习时间<select id="time"><option>非脱产·可用时间</option><option>全脱产·全天安排</option></select></label><label>计划节奏<select id="cadence"><option>按周</option><option>按天</option></select></label><label>测评周期<select id="cycle"><option>每周一次</option><option>每两周一次</option><option>每月一次</option></select></label>`;
function simulate(){const t=$('#type').value,m=$('#mode').selectedIndex,c=$('#cadence').value;let ids=m===0?['group','service','fee','match']:m===4?['wrong','fee']:m===5?['baseline','evaluate','archive']:['baseline','targets','plan','study','review','lights','archive'];$('#canvas').innerHTML=`<span class="pill">${t} · ${$('#mode').value}</span>`+ids.map((id,i)=>`<div class="step"><i>${i+1}</i><button class="node" data-id="${id}"><b>${D[id].title}</b><span>${D[id].desc}</span></button></div>${i<ids.length-1?ar():''}`).join('');let txt=m===0?'资源库单用：不强制生成计划，不启用闭环红黄绿灯。':m===4?'单独错题答疑：提交错题 → 老师讲解 → 按年级和时长计费；无需先购买全功能。':m===5?`${$('#cycle').value}：测评 → 评估报告 → 一次规划分析课；具体闭环权益待确认。`:`${$('#time').value}；${c==='按天'?'每日':'每周'}提醒任务，完成后按检测证据更新学习过关灯。${m===6?'报课：管理员核验外部缴费后开通，排除答疑。':''}`;if(t.includes('艺考'))txt+=' 艺考目标须输入专业成绩，核实公式后倒推文化参考分。';$('#path').innerHTML=`<div class="path">${txt}</div>`;showDetail(ids[0])}
$('#filters').onchange=()=>{stop();simulate()};$('#play').onclick=()=>{if(timer){stop();return}const nodes=[...$('#canvas').querySelectorAll('.node')];idx=0;$('#play').textContent='Ⅱ 暂停走读';const tick=()=>{showDetail(nodes[idx].dataset.id);$('#progress').style.width=((idx+1)/nodes.length*100)+'%';idx++;if(idx>=nodes.length)stop()};tick();if(idx<nodes.length)timer=setInterval(tick,2200)};
$('#printAll').innerHTML=pages.slice(0,6).map(p=>`<h2>${p.title}</h2>${p.html}`).join('<hr>')+'<h2>节点规则清单</h2>'+Object.values(D).map(d=>`<h3>${d.title}</h3><ul>${d.items.map(x=>'<li>'+x+'</li>').join('')}</ul>`).join('');render(0);
