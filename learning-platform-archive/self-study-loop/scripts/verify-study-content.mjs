import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {topics as legacyTopics} from '../src/content.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export const questionTextHash=q=>sha({id:q.id,version:q.version,prompt:q.prompt,options:q.options,correctOption:q.correctOption,rationale:q.rationale});
export const handoutTextHash=p=>sha({id:p.id,version:p.version,handout:p.handout});
const reviewManifestPath=path.join(root,'data/study-reviewed-texts.json');
// This file is owned by the independent AI reviewer. --write-audit never creates
// or refreshes it. Unknown or revised text cannot be approved by rerunning us.
let fixedReview=null;
if(fs.existsSync(reviewManifestPath)){const m=JSON.parse(fs.readFileSync(reviewManifestPath,'utf8'));if(m.schemaVersion===1&&m.reviewKind==='independent_ai_text_reading'&&m.humanReview===false&&Array.isArray(m.questions)&&Array.isArray(m.handouts))fixedReview=m;}
const reviewedQuestion=q=>fixedReview?.questions.find(r=>r.questionId===q.id&&r.version===q.version&&r.textHash===questionTextHash(q));
const reviewedHandout=p=>fixedReview?.handouts.find(r=>r.pointId===p.id&&r.version===p.version&&r.handoutHash===handoutTextHash(p));
const canonical=s=>String(s).replace(/[−–]/g,'-').replace(/\s+/g,'');
const match=(s,re)=>{const m=s.match(re);if(!m)throw Error('题干不符合本核验器的已支持形式');return m;};
const presentBe=s=>s==='I'?'am':/^(?:We|They|You|The boys|The children|her children|his friends|their friends)$/.test(s)?'are':/^(?:He|She|My aunt|their teacher|My friend|Lily|Ben|The room|The floor|The book)$/.test(s)?'is':/\b(?:bikes|meals|windows|rooms|doors)$/.test(s)?'are':null;
const pastBe=s=>['They','We','You','The children','The boys'].includes(s)?'were':['I','She','He','Lily','Ben'].includes(s)?'was':null;
const ing={read:'reading',cook:'cooking',draw:'drawing',write:'writing',play:'playing',study:'studying'};
const past={ring:'rang',arrive:'arrived',stop:'stopped'};
const participle={repair:'repaired',clean:'cleaned',serve:'served',grow:'grown',open:'opened'};
const numericKinds=new Set(['linear_equation','linear_value','linear_slope','linear_intersection','square_roots','factor_roots','discriminant','speed','speed_kmh','speed_segments','scale_ground','scale_map','scale_compare','cost_value','cost_equal','budget','log_domain_forward','log_domain_reverse','log_domain_intersection','solar_equinox','solar_given','solar_pair']);

// This finite expected-value/text calculator is one supporting layer, not a
// semantic uniqueness engine. Literal comparison misses paraphrases/equivalent
// expressions, so verifyQuestion also requires an independently sealed full-text
// review. No supplied code or correctOption is used to calculate the expected value.
export function deriveAnswer(q){
 const raw=q.prompt,s=canonical(raw);let m,answer,reason;
 switch(q.verificationKind){
 case 'linear_equation':{const eq=match(s,/求方程(.+)中x/)[1],paren=eq.match(/^(\d+)\(x([+-]\d+)\)=(\d+)$/);if(paren){const a=+paren[1],b=+paren[2],c=+paren[3];answer=c/a-b;reason=`先除非零系数再减括号常数：${c}/${a}-(${b})=${answer}`;}else{m=match(eq,/^(\d*)x([+-]\d+)=(\d+)$/);const a=Number(m[1]||1),b=+m[2],c=+m[3];answer=(c-b)/a;reason=`同解变形：(${c}-(${b}))/${a}=${answer}`;}break;}
 case 'linear_value':m=match(s,/y=(\d+)x([+-]\d+)，当x=(\d+)/);answer=+m[1]*+m[3]+ +m[2];reason='将显示的x代入显示的k与b';break;
 case 'linear_slope':m=match(s,/y=kx\+(\d+)经过点\((\d+),(\d+)\)/);answer=(+m[3]- +m[1])/+m[2];reason='由y=kx+b解出k=(y-b)/x';break;
 case 'linear_intersection':m=match(s,/y=(\d+)x\+(\d+)与y=(\d+)x\+(\d+)/);answer=(+m[4]- +m[2])/(+m[1]- +m[3]);reason='两条直线同一交点的y相等，解一次方程';break;
 case 'square_roots':{const n=+match(s,/x²=(\d+)/)[1],r=Math.sqrt(n);if(!Number.isInteger(r))throw Error('本题组仅支持完全平方数');answer=`x=-${r}或x=${r}`;reason='正负平方根均须保留；逐项核全部根集合';break;}
 case 'factor_roots':{m=match(s,/x²-(\d+)x\+(\d+)=0/);const sum=+m[1],product=+m[2],delta=sum*sum-4*product,a=(sum-Math.sqrt(delta))/2,b=(sum+Math.sqrt(delta))/2;answer=`x=${a}或x=${b}`;reason=`用判别式独立求两根${a},${b}，再校验和=${sum}、积=${product}`;break;}
 case 'discriminant':m=match(s,/x²\+(\d+)x\+m=0有两个不相等/);answer=`m<${+m[1]*+m[1]/4}`;reason='两个不相等实根要求b²-4m>0，严格不等号';break;
 case 'speed':m=match(s,/路程为(\d+)m，用时(\d+)s/);answer=+m[1]/+m[2];reason='总路程m/总用时s';break;
 case 'speed_kmh':m=match(s,/用(\d+)s通过(\d+)m/);answer=+m[2]/+m[1]*3.6;reason='先m/s，再乘3600/1000转km/h';break;
 case 'speed_segments':m=match(s,/先用(\d+)s通过(\d+)m，再用(\d+)s通过(\d+)m，中间不停留/);answer=(+m[2]+ +m[4])/(+m[1]+ +m[3]);reason='先将两段路程和两段时间分别求和，不平均速度';break;
 case 'scale_ground':m=match(s,/比例尺为1:(\d+)，图上距离([\d.]+)cm/);answer=+m[1]*+m[2]/100000;reason='图距cm×分母→实距cm，除100000得km';break;
 case 'scale_map':m=match(s,/实际距离([\d.]+)km，地图比例尺为1:(\d+)/);answer=+m[1]*100000/+m[2];reason='实距km×100000转cm，再除比例尺分母';break;
 case 'scale_compare':m=match(s,/比例尺1:(\d+)的甲图上长([\d.]+)cm，在比例尺1:(\d+)的乙图/);answer=+m[2]*+m[1]/+m[3];reason='同一实距：甲图距×甲分母=乙图距×乙分母';break;
 case 'cost_value':m=match(s,/费用C=(\d+)\+(\d+)x.*当x=(\d+)/);answer=+m[1]+ +m[2]*+m[3];reason='固定项加单价乘件数';break;
 case 'cost_equal':m=match(s,/A费用为(\d+)\+(\d+)x元，B费用为(\d+)\+(\d+)x元/);answer=(+m[1]- +m[3])/(+m[4]- +m[2]);reason='令两方案费用相等，独立解方程';break;
 case 'budget':m=match(s,/固定费(\d+)元，每件(\d+)元，总预算(\d+)元/);answer=Math.floor((+m[3]- +m[1])/+m[2]);if(+m[1]+ +m[2]*answer>+m[3]||+m[1]+ +m[2]*(answer+1)<=+m[3])throw Error('整数上限检验失败');reason='解预算不等式后向下取整，并检查n可行/n+1不可行';break;
 case 'log_domain_forward':m=match(s,/log_(\d+)\(x-(\d+)\)/);if(+m[1]<=0||+m[1]===1)throw Error('非法底数');answer=`(${m[2]},+∞)`;reason='底数合法且x-c>0，端点必须排除';break;
 case 'log_domain_reverse':m=match(s,/log_(\d+)\((\d+)-x\)/);if(+m[1]<=0||+m[1]===1)throw Error('非法底数');answer=`(-∞,${m[2]})`;reason='b-x>0给x<b，严格边界';break;
 case 'log_domain_intersection':m=match(s,/log_2\(x-(\d+)\)\+1\/\(x-(\d+)\)/);if(+m[2]<=+m[1])throw Error('本题式域不在已支持布局');answer=`(${m[1]},${m[2]})∪(${m[2]},+∞)`;reason='真数>0与分母≠0同时成立，保留两段开区间';break;
 case 'solar_equinox':m=match(s,/春秋分直射赤道.*北纬(\d+)°/);answer=90- +m[1];reason='简化模型H=90°-|当地纬度-直射纬度0°|';break;
 case 'solar_given':m=match(s,/直射(南|北)纬(\d+)°，(南|北)纬(\d+)°/);answer=90-Math.abs((m[1]==='南'?-1:1)*+m[2]-(m[3]==='南'?-1:1)*+m[4]);reason='南负北正取纬度差绝对值，不机械套赤道条件';break;
 case 'solar_pair':m=match(s,/直射北纬(\d+)°。甲在北纬(\d+)°，乙在南纬(\d+)°/);answer=`${90-Math.abs(+m[2]- +m[1])}°；${90-(+m[3]+ +m[1])}°`;reason='甲同半球取差，乙跨赤道取和，分别从90°减去';break;
 case 'present_be':m=match(raw,/一般现在时填空：(.+) ___ ready/);answer=presentBe(m[1]);reason='明确指定一般现在时，按显示的代词主语选am/is/are';break;
 case 'there_be':m=match(raw,/There ___ (one|two|three) (\w+)/);answer=m[1]==='one'?'is':'are';reason='本题单一名词短语数量明确，无复杂并列争议';break;
 case 'paired_be':m=match(raw,/现在时：(.+) ___ calm, and (.+) ___ cheerful/);{const a=presentBe(m[1]),b=presentBe(m[2]);if(!a||!b)throw Error('未知主语形式');answer=a+'; '+b;}reason='两个主语分别确定be，逐空核对';break;
 case 'past_be':m=match(raw,/过去式：(.+) ___ working/);answer=pastBe(m[1]);reason='题干指定过去进行时，仅核be过去式与主语一致';break;
 case 'past_progressive':m=match(raw,/过去进行时：(.+) ___ \((\w+)\)/);answer=pastBe(m[1])+' '+ing[m[2]];if(!pastBe(m[1])||!ing[m[2]])throw Error('不支持该动词或主语');reason='指定过去进行时：was/were + 已知-ing形式';break;
 case 'past_pair':m=match(raw,/一般过去时。(.+) ___ \((\w+)\) when .+ ___ \((\w+)\)/);if(!pastBe(m[1])||!ing[m[2]]||!past[m[3]])throw Error('未支持时态词表');answer=pastBe(m[1])+' '+ing[m[2]]+'; '+past[m[3]];reason='按题目显式指定的两个时态逐空求解，不以when猜唯一时态';break;
 case 'passive_be':m=match(raw,/被动结构：(.+) ___ checked/);answer=presentBe(m[1]);reason='一般现在时被动句的be随显示主语单复数变化';break;
 case 'present_passive':m=match(raw,/被动语态：(.+) ___ \((\w+)\)/);if(!presentBe(m[1])||!participle[m[2]])throw Error('未支持被动结构');answer=presentBe(m[1])+' '+participle[m[2]];reason='指定现在时被动：主语一致be+词表中过去分词';break;
 case 'passive_transform':{const active=match(raw,/改写：(.+)/)[1];const patterns=[[/^People grow tea here\.$/,'Tea is grown here.'],[/^Workers clean the rooms every day\.$/,'The rooms are cleaned every day.'],[/^They open the gate each morning\.$/,'The gate is opened each morning.']];answer=patterns.find(([re])=>re.test(active))?.[1];reason='固定三种主动句的受动者、时态和动作均保留；排除倒转主客体及过去式';break;}
 case 'english_reason':m=match(raw,/because ([^.]+)\./);answer=m[1][0].toUpperCase()+m[1].slice(1)+'.';reason='直接提取because明确给出的原因，不补充未给事实';break;
 case 'english_reference':m=match(raw,/The (\w+) was damaged\. Anna \w+ it carefully/);answer='The '+m[1]+'.';reason='前句唯一明确物品是it的近邻回指对象；其他选项为人物或未出现物品';break;
 case 'english_schedule':{m=match(raw,/opens at (\d{2}):(\d{2}) and closes at (\d{2}):(\d{2}).*last (\d+) minutes/);const start=+m[1]*60+ +m[2],end=+m[3]*60+ +m[4],duration=+m[5];return {matches:q.options.map((o,i)=>{const t=o.match(/^(\d{2}):(\d{2})$/);return t&&+t[1]*60+ +t[2]>=start&&+t[1]*60+ +t[2]+duration<=end?i:-1;}).filter(i=>i>=0),computed:{start,end,duration},reason:'逐个实际开始时间验证已开放且全程60分钟在关门前结束',method:'stem_time_constraints'};}
 case 'single_substance':match(raw,/只含.+一种物质，没有其他成分/);answer='纯净物';reason='题设明确物质种类为1，不借颜色或状态推断';break;
 case 'listed_substances':match(raw,/两种不同物质.*未反应/);answer='混合物';reason='题设明确两种不同物质共同存在且未反应';break;
 case 'one_molecule_kind':match(raw,/同一种(?:H₂O|CO₂|O₂)分子构成，没有其他成分/);answer='只有一种物质，属于纯净物';reason='相同已知分子对应一种物质，不以元素或分子数量误判';break;
 case 'water_and_gases':match(raw,/甲只含冰和液态水；乙只含(?:氧气和氮气|氢气和氧气|氮气和氢气).*没有发生反应/);answer='纯净物；混合物';reason='甲是同一种水的两态，乙是两种不同未反应气体';break;
 case 'material_classes':if(/甲只含氧气和氮气且未反应；乙只含冰和液态水/.test(raw)){answer='混合物；纯净物';reason='甲两物质，乙同一水的两态';}else if(/甲只含水蒸气和液态水；乙只含氧气一种物质/.test(raw)){answer='纯净物；纯净物';reason='甲同一水两态，乙明确一种氧气';}else throw Error('未覆盖的组成模型');break;
 case 'cell_nucleus':match(raw,/染色体/);answer='细胞核';reason='本题明确典型具核细胞；核内染色体的有限事实对应，非所有细胞断言';break;
 case 'cell_membrane':match(raw,/边界结构|形成边界/);match(raw,/物质交换|物质进出/);answer='细胞膜';reason='典型细胞边界与物质交换对应细胞膜；依据基础功能词表';break;
 case 'cell_mitochondria':match(raw,/能量转换|可利用能量/);answer='线粒体';reason='本题限定典型真核细胞能量转换，基础功能词表匹配';break;
 case 'cell_table_intersection':{const a=match(raw,/甲.+?(?:记录有|有)([^；]+)；/)[1].split('、'),b=match(raw,/乙.+?(?:记录有|有)([^。]+)。/)[1].split('，')[0].split('、');answer=a.filter(x=>b.includes(x)).join('、');reason='只对显示观察表求结构集合交集，不补充未观察结构';break;}
 case 'timeline':{const facts=[...raw.matchAll(/(\d{4})年(增加设备|建成厂房|启用新车间)/g)].map(x=>({year:+x[1],event:x[2]})).sort((a,b)=>a.year-b.year);if(facts.length!==3)throw Error('时间线不完整');answer=facts[0].year+'年'+facts[0].event;reason='按材料三个给定年份排序；虚构情境不当作真实史料';break;}
 case 'historical_record':m=match(raw,/某印刷厂(\d{4})年各月实际印刷册数/);answer=m[1]+'年该厂逐月印刷统计表';reason='研究对象、年份、逐月册数三条件同时对应统计表';break;
 case 'arts_historical_record':m=match(raw,/某织布厂(\d{4})年逐月实际产量/);answer=m[1]+'年该厂逐月生产登记簿';reason='同一工厂、同一年和逐月实际产量对应登记簿';break;
 case 'bounded_history_claim':m=match(raw,/只取得某纺织厂(\d{4})年产量比前一年增加的账册，尚未取得其他工厂资料/);answer=m[1]+'年该厂账册记载的产量比前一年增加';reason='保持某厂/某年/账册记载边界，排除全国、唯一原因和未来全称';break;
 case 'history_independence':if(/同一本账册.*另一独立形成的运输登记/.test(raw))answer='核对原账册并将其与独立运输登记比较';else if(/同一份会议记录.*独立形成的同期签到表/.test(raw))answer='核对会议记录并与独立签到表比较';else if(/同一份仓库账单.*独立形成的同期运输单据/.test(raw))answer='核对仓库账单并与独立运输单据比较';else throw Error('独立来源前提不全');reason='两处转引共用同一来源；增加与题设另一独立形成来源的比较';break;
 case 'history_conflict':if(/可能统计日期不同/.test(raw))answer='核对对象、统计日期与口径，再解释差异';else if(/中心城区和整个市域/.test(raw))answer='核对地域范围与统计口径，再比较可比数据';else if(/实际在岗人数.*在册人数/.test(raw))answer='核对在岗与在册的定义及统计时间，再解释差异';else throw Error('冲突口径前提不明确');reason='按材料指明的可能口径差异先核查，而非选数/指控/过度推广';break;
 case 'rule_and_condition':match(raw,/有效借阅证且无逾期记录/);answer=/持有效借阅证，且没有逾期记录/.test(raw)?'已满足材料列出的直接借阅条件':'尚不满足直接借阅的全部条件';if(!/但有逾期|没有有效借阅证，但无逾期|持有效借阅证，且没有逾期/.test(raw))throw Error('事实条件未知');reason='对给定两个必要条件做布尔且判断；不推定现实法律';break;
 case 'rule_procedure':if(/先提交事实说明，再由不同人员复核/.test(raw))answer='提交事实说明→不同人员复核';else if(/先查看公开规则，再提交具体异议，最后申请复核/.test(raw))answer='查看规则→提交具体异议→申请复核';else if(/先核对原始记录，再提交更正说明/.test(raw))answer='核对原始记录→提交更正说明';else throw Error('程序未明确');reason='依材料显式先后次序，不加入传播资料或删除事实的步骤';break;
 case 'rule_respect':match(raw,/说明事实、尊重他人，并禁止发布他人联系方式/);answer='整理安排事实并按程序提交意见，不发布他人联系方式';reason='三个给定限制同时满足；其余项分别违反事实、尊重或不得发布联系方式';break;
 case 'reading_count':m=match(raw,/本次(\d+)名受访者中，(\d+)名表示图示帮助/);answer=`${m[1]}名受访者中${m[2]}名表示图示有帮助`;reason='提取样本人数、反馈人数和自述性质，不扩张范围';break;
 case 'arts_reading_count':m=match(raw,/本轮(\d+)名参与者中，(\d+)名自述注释/);answer=`${m[1]}名参与者中${m[2]}名自述注释有帮助`;reason='保持样本人数、反馈人数及自述口径，不转换为分数保证';break;
 case 'reading_condition':m=match(raw,/在(.+)的条件下，这种方法可能有帮助/);answer=`在${m[1]}时，这种方法可能有帮助`;reason='复制完整条件集合和可能程度，排除无条件必然';break;
 case 'arts_reading_condition':m=match(raw,/仅在(.+)时观察到该方法可能有效，尚未评估其他条件/);answer=`在${m[1]}的已考察条件下，该方法可能有效`;reason='完整并列条件、已考察范围和可能程度均保留';break;
 case 'reading_causality':match(raw,/借阅次数增加.*同时开展了阅读活动.*尚未区分/);answer='记录显示借阅次数增加，但不能仅据此断定调整书架是唯一原因';reason='两个因素同时变化且尚未区分，只支持有限观察';break;
 case 'reading_causality_opening':match(raw,/延长开放时段.*使用次数增加.*举办了读书活动.*尚未区分/);answer='使用次数确有增加，但不能据此断定延长开放是唯一原因';reason='开放和活动共同改变，唯一因果无证据';break;
 case 'reading_causality_wait':match(raw,/增设提示牌.*等待时间减少.*车流量和天气.*尚未排除/);answer='记录显示等待时间减少，但不能据此断定提示牌是唯一原因';reason='保留路段观察并保留车流/天气未排除限制';break;
 case 'arts_reading_causality':match(raw,/完成量增加.*同时调整了作业时长与设备.*尚不能区分/);answer='观察到完成量增加，但不能仅据此认定新讲解方式是唯一原因';reason='多条件同时变化，报告明确未分离因素';break;
 case 'arts_reading_causality_borrow':match(raw,/借阅的次数增加.*新增服务人员且延长了开放时间.*未分离/);answer='借阅完成次数增加，但不能仅据此认定新提示是唯一原因';reason='多个条件变动不支持唯一因果';break;
 case 'arts_reading_causality_time':match(raw,/平均用时减少.*任务量也减少.*尚未分别估计/);answer='该组平均用时减少，但不能仅据此认定步骤卡是唯一原因';reason='给定任务量也变动，只允许有限观察结论';break;
 case 'politics_test':match(raw,/实际试行并记录结果，再修改原判断/);answer='实践是检验认识真理性的唯一标准';reason='固定课程原理与实际检验判断的情境相对应，不以多数/权威/愿望替代';break;
 case 'politics_guidance':match(raw,/实践形成的认识，设计下一轮操作.*直接体现/);answer='认识能够指导实践';reason='题目专问据认识设计行动，区分与实践检验认识的不同方向';break;
 case 'politics_conditions':match(raw,/只在一个试点、特定条件下.*不同条件前/);answer='分析新条件并继续实践检验，避免无条件推广';reason='保留条件范围，不将一次试点变为永久普遍保证';break;
 default:throw Error('没有独立答案求解器，保留待核验');
 }
 if(answer===null||answer===undefined||typeof answer==='number'&&!Number.isFinite(answer))throw Error('无法独立得到有限答案');
 const indexes=q.options.map((o,i)=>typeof answer==='number'?(Number.isFinite(Number(o))&&Math.abs(Number(o)-answer)<1e-9?i:-1):(canonical(o)===canonical(answer)?i:-1)).filter(i=>i>=0);
 return {matches:indexes,computed:answer,reason,method:numericKinds.has(q.verificationKind)?'stem_numeric_or_symbolic_calculation':'fixed_corpus_expected_text_replay'};
}

export function verifyQuestion(q,p){const issues=[],checks=[];if(!q.id||!Number.isSafeInteger(q.version)||q.version<1||q.type!=='single_choice'||q.maxScore!==1)issues.push('INVALID_QUESTION_ID_VERSION_OR_TYPE');if(!Array.isArray(q.options)||q.options.length!==4||q.options.some(x=>typeof x!=='string'||!x.trim()))issues.push('INVALID_OPTIONS');if(q.options&&new Set(q.options.map(canonical)).size!==4)issues.push('DUPLICATE_OPTIONS');if(!Number.isInteger(q.correctOption)||q.correctOption<0||q.correctOption>3)issues.push('INVALID_ANSWER_INDEX');if(!q.source?.license||q.source.kind!=='original'||!q.source.title)issues.push('SOURCE_MISSING');if(q.requiresImage||q.image)issues.push('FIGURE_NEEDS_SEPARATE_REVIEW');if(!q.rationale||q.rationale.length<15)issues.push('RATIONALE_MISSING');if(q.humanReview?.status!=='pending'||q.humanReview.reviewedBy!==null)issues.push('FALSE_HUMAN_REVIEW');if(!q.knowledgeIds?.includes(p.id))issues.push('POINT_LINK_MISSING');if(q.purposes?.length!==1||!['diagnostic','practice','retest'].includes(q.purposes[0])||!['very_low','low','medium'].includes(q.difficulty))issues.push('BLUEPRINT_FIELD_INVALID');if(issues.length)return {status:'quarantined',issues,checks,method:'structural_rejection'};
 checks.push('source_and_version','four_distinct_literal_options','complete_text_no_required_figure','purpose_separate_from_difficulty','no_human_review_claim');
 if(!reviewedQuestion(q))return {status:'draft',issues:['FIXED_TEXT_REVIEW_REQUIRED'],checks,method:'unreviewed_text_or_version',proof:{textHash:questionTextHash(q),humanReview:false,reason:'题干、四选项、答案或解析不在独立AI全文复核白名单；有限计算器不能自行放行未知同义改写或等价表达。'}};
 checks.push('exact_independent_ai_review_text_hash');let proof;try{proof=deriveAnswer(q);}catch(e){return {status:'draft',issues:['ANSWER_ORACLE_NOT_SUPPORTED'],checks,method:'bounded_oracle_unavailable',proof:{reason:e.message}};}
 if(proof.matches.length!==1)issues.push('EXPECTED_LITERAL_MATCH_NOT_SINGLE');else if(proof.matches[0]!==q.correctOption)issues.push('ANSWER_CONFLICT');else checks.push('expected_value_or_text_recalculated','one_matching_literal_in_reviewed_choices');
 return {status:issues.length?'quarantined':'passed',issues,checks,method:'independent_ai_fixed_text_review_plus_'+proof.method,proof:{...proof,textHash:questionTextHash(q),reviewKind:fixedReview.reviewKind,humanReview:false,scope:'Only the independently read exact fixed text/options/key/rationale. Literal matching is not semantic uniqueness proof; unknown changes remain draft. No curriculum certification or formal grading.'}};
}

export function verifyStudyContent(data){const questions=[],points=[],globalIssues=[],ids=new Set(),stems=new Map();for(const p of data.points||[]){const pi=[];if(!p.id||ids.has(p.id))pi.push('DUPLICATE_POINT_ID');ids.add(p.id);if(p.stage==='junior'?![7,8,9].includes(p.grade)||p.examYear!==null:p.stage!=='senior_arts'||p.grade!==null||p.examYear!==2027)pi.push('STAGE_SCOPE_INVALID');if(p.humanReview?.status!=='pending')pi.push('FALSE_POINT_HUMAN_REVIEW');const h=p.handout||{};for(const field of ['focus','audience','retestGuide','errorReplay'])if(!h[field]||h[field].length<10)pi.push('HANDOUT_'+field+'_MISSING');for(const field of ['prerequisites','steps','pitfalls'])if(!Array.isArray(h[field])||h[field].length<2)pi.push('HANDOUT_'+field+'_MISSING');if(!h.workedExample?.prompt||!h.workedExample?.answer||!h.workedExample?.explanation)pi.push('WORKED_EXAMPLE_INCOMPLETE');if(!Array.isArray(h.exercises)||h.exercises.length<2||h.exercises.some(x=>!x.prompt||!x.answer||!x.explanation))pi.push('LAYERED_EXERCISES_INCOMPLETE');if(!h.memoryCard?.front||!h.memoryCard?.back||!p.coverage?.length||!p.uncovered?.length||!p.source?.license)pi.push('TRACEABLE_HANDOUT_INCOMPLETE');
 const blueprint={};for(const q of p.questions||[]){if(ids.has(q.id))pi.push('DUPLICATE_QUESTION_ID');ids.add(q.id);const normalized=canonical(q.prompt);if(stems.has(normalized))pi.push('DUPLICATE_STEM:'+stems.get(normalized));stems.set(normalized,q.id);const v=verifyQuestion(q,p);questions.push({questionId:q.id,pointId:p.id,questionHash:sha(q),...v});const phase=q.purposes?.[0];blueprint[phase]??={};blueprint[phase][q.difficulty]=(blueprint[phase][q.difficulty]||0)+1;}
 for(const phase of ['diagnostic','practice','retest'])if(JSON.stringify(blueprint[phase])!==JSON.stringify({very_low:1,low:1,medium:1}))pi.push('INCOMPARABLE_BLUEPRINT:'+phase);const child=questions.filter(q=>q.pointId===p.id),handoutReviewed=Boolean(reviewedHandout(p)),structuralFailure=pi.length>0;if(!handoutReviewed)pi.push('FIXED_HANDOUT_REVIEW_REQUIRED');points.push({pointId:p.id,pointHash:sha(p),status:structuralFailure||child.some(q=>q.status==='quarantined')?'quarantined':!handoutReviewed||child.some(q=>q.status!=='passed')?'draft':'passed',issues:pi,checks:['complete_eight_part_handout_structure','explicit_scope_and_uncovered','exact_nine_question_blueprint','stage_year_grade_fields','separate_human_review_state',...(handoutReviewed?['exact_independent_ai_handout_review_hash']:[])],method:'fixed_independent_ai_handout_text_review_plus_structure_and_finite_question_calculation; not_teacher_review',handoutHash:handoutTextHash(p),blueprint});}
 if(!data.points?.length)globalIssues.push('EMPTY_CATALOG');const known=new Set((data.points||[]).map(p=>p.id));for(const p of data.points||[])for(const k of p.knowledgeIds||[])if(!known.has(k))globalIssues.push('UNKNOWN_NATIVE_KNOWLEDGE_LINK:'+k);
 const legacy=[...legacyTopics.flatMap(t=>t.questions.map(q=>q[1]))];for(const file of ['data/question-bank/catalog.json','data/question-bank/expansion/subject-pilot.json'])if(fs.existsSync(path.join(root,file)))legacy.push(...JSON.parse(fs.readFileSync(path.join(root,file))).records.map(r=>r.question.prompt));if(fs.existsSync(path.join(root,'data/arts-content.json')))legacy.push(...JSON.parse(fs.readFileSync(path.join(root,'data/arts-content.json'))).points.flatMap(p=>p.questions.map(q=>q.prompt)));const legacySet=new Set(legacy.map(canonical));for(const p of data.points||[])for(const q of p.questions)if(legacySet.has(canonical(q.prompt))){globalIssues.push('COPIED_LEGACY_STEM:'+q.id);const question=questions.find(x=>x.questionId===q.id),point=points.find(x=>x.pointId===p.id);question.status='quarantined';question.issues.push('COPIED_LEGACY_STEM');point.status='quarantined';point.issues.push('COPIED_LEGACY_STEM');}
 return {points,questions,globalIssues,counts:{handouts:points.length,questions:questions.length,passed:questions.filter(q=>q.status==='passed').length,draft:questions.filter(q=>q.status==='draft').length,quarantined:questions.filter(q=>q.status==='quarantined').length,humanReviewed:0}};
}

export function inventory(){const bank=JSON.parse(fs.readFileSync(path.join(root,'data/question-bank/catalog.json'))),pilot=JSON.parse(fs.readFileSync(path.join(root,'data/question-bank/expansion/subject-pilot.json'))),arts=JSON.parse(fs.readFileSync(path.join(root,'data/arts-content.json'))),release=JSON.parse(fs.readFileSync(path.join(root,'release/content-round2.json')));const records=[...bank.records,...pilot.records],knowledge=new Map();for(const r of records)for(const id of r.question.knowledgeIds)knowledge.set(id,r.question);const complete=h=>Boolean(h?.focus&&h?.steps?.length&&h?.pitfalls?.length&&h?.workedExample?.explanation&&h?.exercises?.length&&h?.memoryCard&&h?.retestGuide&&h?.errorReplay);return {recordedRelease:release.version,liveQuery:false,recordedCoverage:release.coverage,sourceCounts:{bankQuestions:bank.records.length,bankKnowledge:new Set(bank.records.flatMap(r=>r.question.knowledgeIds)).size,pilotQuestions:pilot.records.length,pilotKnowledge:new Set(pilot.records.flatMap(r=>r.question.knowledgeIds)).size,legacyQuestions:legacyTopics.reduce((n,t)=>n+t.questions.length,0),legacyKnowledge:legacyTopics.length,artsPoints:arts.points.length,artsQuestions:arts.points.reduce((n,p)=>n+p.questions.length,0)},completeJuniorHandouts:[...[...knowledge.values()],...legacyTopics].filter(q=>complete(q.handout||q.lecture)).length,completeArtsHandouts:arts.points.filter(p=>complete(p.handout)).length,shortExplanations:{count:knowledge.size,minCharacters:Math.min(...[...knowledge.values()].map(q=>q.explanation.length)),maxCharacters:Math.max(...[...knowledge.values()].map(q=>q.explanation.length))},finding:'Existing junior fields are short explanation/memoryCard/rationale, not eight-part handouts; arts has six structured handouts. Live review/availability can change and was not requeried by this script.'};}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const file=path.join(root,'data/study-content.json'),data=JSON.parse(fs.readFileSync(file,'utf8'));let audit=verifyStudyContent(data);if(process.argv.includes('--write-audit')){for(const p of data.points)for(const q of p.questions){const v=audit.questions.find(v=>v.questionId===q.id);q.automatedCheck={status:v.status,checker:'study-fixed-corpus-v2',checkedAt:'2026-11-15',checks:v.checks,method:v.method,humanReview:false,formalGradingAllowed:false};}fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');audit=verifyStudyContent(data);const output={schemaVersion:1,contentPackageVersion:data.version,checker:'study-fixed-corpus-v2',checkerSourceHash:sha(fs.readFileSync(fileURLToPath(import.meta.url))),independentReviewManifest:{path:'data/study-reviewed-texts.json',fileHash:fs.existsSync(reviewManifestPath)?sha(fs.readFileSync(reviewManifestPath)):null,reviewKind:fixedReview?.reviewKind??null,humanReview:false},checkedAt:'2026-11-15',contentFileHash:sha(fs.readFileSync(file)),...audit,inventory:inventory(),limitations:['Exact full text/options/key/rationale and handout must match a separately owned independent-AI review manifest. --write-audit never updates that whitelist.','Finite numeric/symbolic calculation and expected-text replay are supporting checks, not general semantic uniqueness proof.','Unknown paraphrases, equivalent expressions, option order or prose changes remain draft until independently reread and separately sealed.','Difficulty, grade, textbook and provincial/city scope are author suggestions, not psychometric or teacher certification.','No human review was created. Use is self-study only and does not change legacy formal scores.','Each exact point and question hash is mandatory; teacher edits invalidate original audit and remain draft.']};fs.writeFileSync(path.join(root,'data/study-content-audit.json'),JSON.stringify(output,null,2)+'\n');}
 console.log(JSON.stringify({counts:audit.counts,globalIssues:audit.globalIssues,pointIssues:audit.points.filter(p=>p.status!=='passed'),questionIssues:audit.questions.filter(q=>q.status!=='passed').map(q=>({id:q.questionId,status:q.status,issues:q.issues,proof:q.proof}))},null,2));if(audit.globalIssues.length||audit.points.some(p=>p.status!=='passed'))process.exitCode=1;
}
