// Finite, source-bound independent mathematics recheck. These are transparent
// authored derivations, NOT a general proof engine, a model accuracy certificate,
// or a teacher review. Original answer keys are used only after deriving results.
import {arithmetic,sha} from './question-bank-validation.mjs';
import blindSource from '../data/question-bank/rechecks/math-blind-source-v2.json' with {type:'json'};
import rationaleSource from '../data/question-bank/rechecks/math-rationale-review-v2.json' with {type:'json'};
const frozen=new Map(blindSource.records.map(r=>[r.id,r]));
const rationales=new Map(rationaleSource.records.map(r=>[r.id,r]));
const cases=new Map();
const key=id=>'draft-math-'+id;
const add=(id,kind,derive,reason,extra={})=>cases.set(key(id),{kind,derive,reason,...extra});
const N=(id,derive,reason,label)=>add(id,'number',derive,reason,{label});
const T=(id,answer,reason)=>add(id,'text',()=>answer,reason);
const P=(id,derive,reason)=>add(id,'pair',derive,reason);
const Q=(id,derive,reason,issue,repair)=>add(id,'number_set',derive,reason,{issue,repair});
const norm=x=>String(x).replace(/\s+/g,'').replace(/[−–]/g,'-').replace(/[（]/g,'(').replace(/[）]/g,')').replace(/[，]/g,',').replace(/≥/g,'>=').replace(/≤/g,'<=');
const sum=a=>a.reduce((x,y)=>x+y,0);
const mean=a=>sum(a)/a.length;
const variance=a=>mean(a.map(x=>(x-mean(a))**2));
const orderedPairs=(a,replacement=true)=>a.flatMap((x,i)=>a.flatMap((y,j)=>replacement||i!==j?[[x,y]]:[]));
const rad=d=>d*Math.PI/180;
// ----- Grade 7: 52 original pending questions. -----
T('g7-monomial-missing-term-diag','系数 -2π / 3，次数 5','数字因数包括常数π，所以系数为-2π/3；字母x,y的指数为3,2，次数3+2=5。其余三组分别漏π或把次数写为6。');
N('g7-monomial-missing-term-prac',()=>2,'一次项系数为(-m)+2，不含一次项当且仅当2-m=0，故m=2。');
N('g7-monomial-missing-term-retest',()=>3+3,'三次项系数m-3必须为0，故m=3；剩余x²-x+1恰有3个非零项，m+n=6。');
T('g7-irrational-estimation-diag','π / 2','22/7为有理分数，√9=3，循环小数0.333…=1/3；π为无理数，除以非零有理数2仍无理，只有π/2符合。');
N('g7-irrational-estimation-prac',()=>2*Math.floor(Math.sqrt(13))-Math.sqrt(13),'3²<13<4²，a=3且b=√13-3，所以a-b=6-√13。','6 - √13');
T('g7-irrational-estimation-retest','(√11 - 1) / 2 > 1','11>9，故√11>3；同减1后除以正数2得(√11-1)/2>1。');
T('g7-ineq-apps-region-diag','a ≤ 2','公共解集合为开区间(2,a)，当a>2时非空；a=2和a<2均为空，必要且充分条件a≤2。');
N('g7-ineq-apps-region-prac',()=>Math.floor((550-5*50)/(15-5)),'设笔记本x本，中性笔50-x支；15x+5(50-x)≤550且x为0到50整数，所以最大x=30。');
T('g7-ineq-apps-region-retest','1 < m ≤ 2','要恰包含-1,0,1而不包含2，严格上界x<m要求m>1且m≤2；两个边界分别检验。');
N('g7-rational-prac',()=>2*(-3),'绝对值和平方均非负，其和为0时各项为0；a=2,b=-3，乘积-6。');
N('g7-rational-retest',()=>[-4+7,-4-7].find(x=>x>0),'距离方程|B-(-4)|=7给出3和-11；原点右侧排除负数，唯一是3。');
T('g7-linear-ineq-diag','x > 4','2x-3>5等价于2x>8，即x>4；x=4不满足严格大于。');
N('g7-linear-ineq-prac',()=>Math.ceil((3+1)/(5-3)),'展开3x+3≤5x-1得x≥2；整数解无下方其他数，最小为2。');
N('g7-linear-ineq-retest',()=>5,'x>1的前三个整数为2,3,4；要4<a且5≥a，整数a只能为5。');
N('g7-polynomials-diag',()=>3+2,'同类项的各字母指数分别相等，a=3,b=2，不比较系数3与-5。');
N('g7-polynomials-prac',()=>2*(3*2-(-1))-3*(2-2*(-1)),'直接按题干x=2,y=-1分别计算两个括号，得到14-12=2；独立展开也为3x+4y。');
N('g7-polynomials-retest',()=>2*((-1)**2-2*(-1)+1)-(2*(-1)**2+(-1)-3),'在x=-1处A=4、B=-2，所以2A-B=8-(-2)=10。');
T('g7-linear-eq-app-diag','3(x + 1) - 6 = 2(x - 1)','把原式每个加减项均乘6：6(x+1)/2-6=6(x-1)/3，得到3(x+1)-6=2(x-1)。常数-1也必须乘6。');
N('g7-linear-eq-app-prac',()=>12-6-2,'乘6得到3x+6-2x+2=12，故x=4；代回(4+2)/2-(4-1)/3=3-1=2。');
N('g7-linear-eq-app-retest',()=>(1-5/10)/(1/10+1/15),'完成量取1；甲先做5/10，剩余1/2；合作效率1/10+1/15=1/6，所需3天。');
N('g7-parallel-lines-diag',()=>180-65,'题干明确同旁内角，平行线同旁内角和180°，另一角115°。');
Q('g7-parallel-lines-prac',()=>[35,55],'取F=(0,0),D=(1,0),E=(cos70°,sin70°)。当射线EB向右时，内角平分线与y=0交于F右侧，∠EGF=55°；当EB向左时交于F左侧，∠EGF=35°。两配置都满足已写条件，AB∥CD未固定射线EB与FD方向。','GEOMETRY_POSITION_AMBIGUOUS','补充“射线EB与FD同向”，或明确A,E,B及C,F,G,D的顺序后重新核验。');
Q('g7-parallel-lines-retest',()=>[83,167],'令P=(0,0)，l1:y=1,l2:y=-1。A=(-cot35°,1)，C=(-cot48°,-1)时角为83°；改C=(cot48°,-1)时角为167°。所谓“折点P朝向截线AC同一侧”未定义明确位置关系，不能据此排除后一配置。','GEOMETRY_POSITION_UNCLEAR','明确“A、C位于过P且垂直于两平行线的直线同侧”，则∠APC=35°+48°；或给出可核验的必要图示。');
N('g7-linear-sys-diag',()=>(7+3)/2,'两式相加消去y，2x=10，x=5；由x+y=7得y=2，代回另一式成立。');
N('g7-linear-sys-prac',()=>8-7,'两式相减：(2x+y)-(x+2y)=8-7，所以x-y=1。');
N('g7-linear-sys-retest',()=>(5*4-2)/2,'两式相加为5(x+y)=2k+2，x+y=4给出20=2k+2，k=9。');
add('g7-sci-notation-diag','scientific',()=>36000000,'先要求表示值等于36000000，再要求有效系数绝对值在[1,10)，只有3.6×10^7同时满足；36×10^6和0.36×10^8虽等值但不是规范科学记数法。');
add('g7-sci-notation-retest','scientific',()=>Math.round(24580000/1e6)*1e6,'按百万单位四舍五入24.58得到25，即25000000；规范科学记数法的系数在[1,10)，所以2.5×10^7。');
N('g7-angles-segments-diag',()=>(3*90-180)/(3-1),'设锐角x，补角180-x等于3(90-x)，解得x=45，处于(0,90)内。');
N('g7-angles-segments-prac',()=>6/2+4/2,'C位于线段AB且M,N分别为AC,CB中点，点序A-M-C-N-B，MN=MC+CN=3+2=5cm。');
N('g7-angles-segments-retest',()=>(90*60-(24*60+35))/60,'统一到角分：5400-1475=3925分，除以60为65度余25分；65°25′。','65°25′');
N('g7-real-roots-diag',()=>Math.sqrt(Math.sqrt(16)),'所问对象是√16=4的算术平方根，因此取非负值√4=2，不是±2，也不是4。');
N('g7-real-roots-prac',()=>{const m=(4+11)/(2+3);return (2*m-4)**2;},'同一正数的两个平方根互为相反数，5m-15=0得m=3；两根2和-2，对应正数4。');
N('g7-real-roots-retest',()=>1+(-2)**3+Math.floor(Math.sqrt(19)),'x-1=(-2)^3=-8，x=-7；16<19<25故y=4，和为-3。');
P('g7-coord-plane-diag',()=>{const m=(6-2)/2;return [m+2,2*m-6];},'第四象限使纵坐标为-2而非+2；2m-6=-2得m=2，所以P=(4,-2)，横坐标为正。');
P('g7-coord-plane-prac',()=>[-2+6,5],'平行x轴要求n=5；|m+2|=6给出m=4或-8，第一象限只允许m=4。');
P('g7-coord-plane-retest',()=>[1+(3-(-2)),-1+(5-3)],'A到A′的平移向量为(5,2)，对B同加得到(6,1)。');
N('g7-profit-billing-diag',()=>(180*.8-120)/120,'利润率以进价为分母，售价144、利润24，24/120=0.20。','20%');
N('g7-profit-billing-prac',()=>15+(65-15*3)/5,'前15吨花45元，剩余20元按5元/吨买4吨，总19吨。');
T('g7-profit-billing-retest','亏损 5 元','两件进价分别60/1.2=50和60/0.8=75；总成本125、收入120，因此亏损5元。');
N('g7-data-sampling-diag',()=>360*.25,'完整圆360°，该部分占1/4，圆心角90°。');
N('g7-data-sampling-prac',()=>80*(1-.20-.35-.30),'所有频率合计1，第四组频率0.15；频数80×0.15=12。');
N('g7-data-sampling-retest',()=>1200*45/100,'抽样估计的比例为45/100，应用到总体1200得540；这是估计值，不是声称逐人调查。');
N('g7-numberline-sym-diag',()=>(-3+5)/2,'折叠点须到-3与5等距，其坐标为两端点均值1。');
N('g7-numberline-sym-prac',()=>(10-2)/(3+1),'t≥0时P=3t,Q=-2-t，所以距离4t+2=10，t=2。');
N('g7-numberline-sym-retest',()=>(2-5)+4,'|x-2|=5给出7和-3，原点左侧取-3；-4的相反数为4，两者和1。');
N('g7-ray-clock-bisector-diag',()=>5*4/2,'每条线段由两个不同端点无序确定，5选2=10，点的先后给定且互异。');
N('g7-ray-clock-bisector-prac',()=>Math.abs(20*6-(3*30+20*.5)),'分针每分钟6°、时针每分钟0.5°；3:20分别120°与100°，较小差20°。');
N('g7-ray-clock-bisector-retest',()=>80/2,'设∠AOC=u、∠COB=v，u+v=80；两内角平分线所成角u/2+v/2=40。');
N('g7-system-word-apps-diag',()=>18*28/(2*12+18),'若x人做螺栓，28-x人做螺母；配套要求2×12x=18(28-x)，解得x=12。');
N('g7-system-word-apps-prac',()=>(48/2+48/3)/2,'顺水24、逆水16分别等于静水速度加/减水速，半和为20千米/时。');
T('g7-system-word-apps-retest','少 10 个','由A+B=30与70A+90B=2500，B=(2500-2100)/20=20，A=10，所以A比B少10个。');
// ----- Grade 8: 53 original pending questions. -----
N('g8-triangle-altitudes-medians-diag',()=>24/2/2,'中线AD使ABD占ABC一半；E是AD中点，ABE和ABD共从B到底AD的高，底AE为AD一半，再减半得6。');
T('g8-triangle-altitudes-medians-prac','50° 或 130°','BD所在直线垂直AC，与AB的锐夹角40°，故AB与AC两条直线的锐夹角50°；三角形内角A可为50°或其补角130°，两种等腰三角形都存在。');
N('g8-triangle-altitudes-medians-retest',()=>42+33+25,'D在三角形内部，设B,C总角；三角形BDC的B角=B-33，C角=C-25，故D角=180-(B+C)+58=A+58=100。');
add('g8-pythagoras-converse-3d-diag','right_triangle',()=>null,'逐组选最长边，检查严格三角形不等式和a²+b²=c²；仅7²+24²=25²。其余平方差分别5,-3,-23，均非0。');
N('g8-pythagoras-converse-3d-prac',()=>(4**2+8**2)/(2*8),'取A=(0,0),C=(4,8),E=(0,e)。折痕上的E到A,C等距，所以e²=4²+(8-e)²，e=5且在AD内部。');
N('g8-pythagoras-converse-3d-retest',()=>Math.min(Math.hypot(3+2,12),Math.hypot(3+12,2),Math.hypot(2+12,3)),'相对顶点表面路径的三种展开候选长度为√169、√229、√205；三者均对应可行展开，最小13。');
T('g8-varignon-trapezoid-square-diag','24 cm²，5 cm','菱形对角线垂直平分，面积6×8/2=24，边长√[(6/2)²+(8/2)²]=5。');
T('g8-varignon-trapezoid-square-prac','菱形','中点四边形的四边分别为两条对角线的一半，因对角线等长而四边相等；对角线不必互相垂直，故不能保证四角直角。');
N('g8-varignon-trapezoid-square-retest',()=>Math.hypot(4,3)*Math.sqrt(2),'AE=√(4²+3²)=5，90°旋转给AF=5且AE⊥AF，故EF²=25+25=50。','5√2');
T('g8-congruence-diag','AC = DF','SAS的角A,D分别夹AB/AC和DE/DF；已知第一对边与夹角，缺的邻边只能AC=DF，其他边/角条件不是该SAS三要素。');
T('g8-congruence-prac','SSS','AB=AC，BD=CD，AD是公共边，三对对应边相等；题干指定直接使用三边关系。');
N('g8-congruence-retest',()=>180-50-65,'按全等记号对应顺序B对应E，所以B=65°，C=180-50-65=65°。');
P('g8-linear-func-diag',()=>[0,-2*0+6],'纵轴点必须x=0，代入一次函数y=6，交点(0,6)。');
N('g8-linear-func-prac',()=>(-2-4)/2,'点(2,-2)代入-2=2k+4，k=-3。');
N('g8-linear-func-retest',()=>-(-1+4)/3,'向上4只改变常数项，y=3x+3；横轴令y=0得x=-1。');
N('g8-isosceles-diag',()=>180-2*50,'等腰三角形两底角均50°，顶角180-100=80°。');
N('g8-isosceles-prac',()=>3+7+7,'两种边组仅(3,3,7)与(3,7,7)；前者3+3<7不成三角形，后者成立，周长17。');
P('g8-isosceles-retest',()=>[-(-3),4],'y轴反射映射(x,y)到(-x,y)，因此(-3,4)变(3,4)。');
N('g8-fractions-eq-diag',()=>2,'分式为0需要分子x-2=0且分母x+3非0；x=2时分母5有效。');
N('g8-fractions-eq-prac',()=>-1/(3-1),'限定x≠0,1；乘x(x-1)得3x=x-1，x=-1/2不违反定义域，代回两边均-2。');
N('g8-fractions-eq-retest',()=>3-2*(3-3),'分母只在x=3为0；清分母后x-2(x-3)=m，令可能增根x=3得m=3。此时清分母方程唯一根正是被排除的3。');
N('g8-pythagoras-diag',()=>Math.sqrt(13**2-5**2),'斜边13、一直角边5，另一边平方169-25=144，长度取正12。');
N('g8-pythagoras-prac',()=>Math.hypot(3-(-3),10-2),'坐标差(6,8)，距离√(36+64)=10。');
N('g8-pythagoras-retest',()=>{const ac=Math.hypot(6,8),fc=ac-6;return (8**2-fc**2)/(2*8);},'对角线AC=10，折叠保持AF=AB=6且EF=BE=e、AF⊥EF，故FC=4，EC=8-e；e²+16=(8-e)²，e=3在边BC内。');
N('g8-parallelogram-diag',()=>180-140/2,'对角A=C故各70°；相邻角B与A互补，B=110°。');
N('g8-parallelogram-prac',()=>4*Math.hypot(6/2,8/2),'菱形半对角线3,4构成直角三角形，边长5，周长20。');
N('g8-parallelogram-retest',()=>2*4,'矩形对角线相等且平分，所以OA=OB；夹角60°使AOB为等边三角形，OA=AB=4，AC=8。');
N('g8-polygon-angles-diag',()=>{const a=Array.from({length:13},(_,i)=>i).filter(x=>x>9-4&&x<9+4&&x%2===1);return Math.min(...a)+Math.max(...a);},'第三边严格在(5,13)内，奇数为7,9,11，最小与最大和18。');
N('g8-polygon-angles-prac',()=>180-70-(180-40-70)/2,'A=70°，内角平分线使CAD=35°；在三角形ACD中D=180-70-35=75°。');
N('g8-polygon-angles-retest',()=>360/((180-108)/2),'设外角e，则内角e+108；相邻内外角和180得e=36，边数360/36=10。');
N('g8-factoring-formulas-diag',()=>3**2/5,'a>0保证实数幂运算有效，a^(2m-n)=(a^m)²/a^n=9/5。','9/5');
N('g8-factoring-formulas-prac',()=>6**2-3*7,'x²+y²-xy=(x+y)²-3xy=36-21=15；x+y,xy约束也有实数解，判别式36-28>0。');
add('g8-factoring-formulas-retest','ambiguous_factorization',()=>['2x(x+3)(x-3)','x(2x+6)(x-3)'],'2x(x+3)(x-3)和x(2x+6)(x-3)展开均为2x³-18x，且两者的非单项因子都为一次。若要排除后者，需要明确多项式因子系数互质/数字公因式先提出的规范，不能仅用“正确因式分解”排除等价式。',{issue:'FACTORIZATION_FORM_CONVENTION_AMBIGUOUS',repair:'将D改为一个展开不等于原式的干扰项，或在题干明确“各一次多项式因式须为整系数本原多项式”。'});
T('g8-radicals-diag','x ≥ -2 且 x ≠ 1','平方根要求x+2≥0，分母要求x-1≠0，两条件交集为x≥-2且x≠1；x=-2合法。');
N('g8-radicals-retest',()=>3,'1<a<4使√((a-1)²)=a-1，|a-4|=4-a，相加恒3。');
P('g8-statistics-variance-diag',()=>{const a=[6,9,4,9,7,5].sort((a,b)=>a-b);return [(a[2]+a[3])/2,9];},'排序4,5,6,7,9,9，中位数(6+7)/2=6.5；只有9出现两次，为唯一众数。');
T('g8-statistics-variance-prac','s₁² = 1.2，乙组','独立计算甲均值4，偏差平方和4+0+1+0+1=6，按五项总体方差除5得1.2；乙方差0.8更小，因此乙更稳定。');
N('g8-statistics-variance-retest',()=>(90*5+80*3+85*2)/(5+3+2),'按给定权重归一化加权，总权重10，分子860，结果86。');
T('g8-fraction-apps-diag','a + 2','共同分母合并为(a²-4)/(a-2)；分子=(a-2)(a+2)，题干a≠2允许约分，结果a+2。');
N('g8-fraction-apps-prac',()=>3**2+2,'把m-1/m=3平方得m²-2+1/m²=9，故所求11；m≠0已明确。');
T('g8-fraction-apps-retest','480 / x - 480 / (x + 20) = 2','原用时480/x，实际效率x+20所以实际用时480/(x+20)；提前2天意味着原用时减实际用时=2。');
N('g8-midsegment-square-diag',()=>24/2,'三条中位线各为对应原边一半，求和得到周长24/2=12。');
N('g8-midsegment-square-prac',()=>Math.hypot(6,8)/2,'直角三角形斜边10，斜边中点到三个顶点距离相等，因此CD=AB/2=5。');
N('g8-midsegment-square-retest',()=>Math.hypot(4,2),'取A(0,0),B(4,0),C(4,4),D(0,4),E(4,2)。关于BD反射C到A，PE+PC=PE+PA≥AE。AE与BD交于(8/3,4/3)，在线段BD内，故下界可达到，值√20。','2√5');
N('g8-bisector-hl-diag',()=>10*3/2,'D在角A的内部平分线上，到AC与AB距离相等。因BC⊥AC，距离AC为CD=3，故以AB=10为底的ABD面积为15。');
T('g8-bisector-hl-prac','AB = DE','已知直角C,F及一条对应直角边BC=EF；HL的另一项是对应斜边AB=DE。添加另一条直角边虽可用SAS，不是题目要求的直接HL。');
N('g8-bisector-hl-retest',()=>12+(13-5),'角平分线使D到AC与AB距离相等，所以DE=DC；直角三角形ACD与AED共斜边AD且角A相等，AE=AC=5。BE=13-5=8，BD+DE=BC=12，周长20。');
N('g8-perp-bisector-equilateral-diag',()=>14+2*3,'D在线段BC且在AC垂直平分线上，DA=DC；AB+BD+DA=AB+BC=14，另加AC=2AE=6得到20。');
N('g8-perp-bisector-equilateral-prac',()=>12/2,'30°角B的对边AC等于斜边AB的一半，值6。');
N('g8-perp-bisector-equilateral-retest',()=>4+2*4,'等腰三角形底角B,C=30°；D在AB垂直平分线上，DA=DB=4，三角形ABD的A角30°。剩余DAC角90°，在DAC中30°所对AD=4所以DC=8，BC=12。');
T('g8-linear-ineq-cost-diag','m < 2','严格递减要求斜率m-2<0；截距3>0时负斜率线在x<0有y>0，确实不进入第三象限。m=2不是一次函数且不递减。');
T('g8-linear-ineq-cost-prac','x > 2','2x-1>-x+5等价于3x>6，即x>2；等号处只相交不满足严格大于。');
N('g8-linear-ineq-cost-retest',()=>50*(40-15)+80*15,'A比B便宜30元，总数40、B至少15使A最多25；费用随A增加下降，边界A25/B15给2450。');
// ----- Grade 9: 53 original pending questions. -----
N('g9-frequency-tree-prob-diag',()=>Math.round(.801*100)/100,'仅作频率估计：最大样本5000次的频率0.801，近千次结果0.804、0.799也围绕0.80，四选项中0.80最接近该稳定位置。不是概率真值或置信区间声明。','0.80');
N('g9-frequency-tree-prob-prac',()=>{const balls=['R1','R2','W1','W2'],pairs=orderedPairs(balls,false);return pairs.filter(([a,b])=>a[0]===b[0]).length/pairs.length;},'把四个球按个体标号，12个等可能有序无放回结果中同色4个，概率4/12=1/3。','1/3');
N('g9-frequency-tree-prob-retest',()=>{const pairs=orderedPairs([-1,0,1,2]);return pairs.filter(([x,y])=>x!==0&&x*y===2).length/pairs.length;},'独立枚举16个有放回有序坐标，排除x=0；只有(1,2),(2,1)使xy=2，概率2/16=1/8。','1/8');
P('g9-inverse-linear-combine-diag',()=>[-2,-4],'A给k=2×4=8；交点满足2x²=8，x=±2，另一点(-2,-4)，不是任意反射。');
T('g9-inverse-linear-combine-prac','-3 < x < 0 或 x > 1','差值x+2-3/x=(x+3)(x-1)/x，临界点-3,0,1。四区间符号依次负、正、负、正，严格正区间(-3,0)和(1,+∞)。');
N('g9-inverse-linear-combine-retest',()=>Math.abs(1*(-1)-4*(-4))/2,'两向量OA=(1,4),OB=(-4,-1)，面积为绝对行列式|1×(-1)-4×(-4)|/2=15/2。');
N('g9-similarity-homothety-diag',()=>6*2/4,'同三条平行线在任意截线上的对应截距同比，AB/BC=DE/EF，所以EF=6×2/4=3。');
N('g9-similarity-homothety-prac',()=>4*9/3,'以C为原点、AB为横轴，D=(-4,3),E=(9,h)，同侧使h>0；CD⊥CE要求内积-4×9+3h=0，h=12。');
P('g9-similarity-homothety-retest',()=>[-4*(-.5),6*(-.5)],'以O为中心、缩小一半可用系数±1/2；第四象限只能负系数，A′=(2,-3)。');
N('g9-quadratic-eq-diag',()=>2+3,'x²-5x+6=(x-2)(x-3)，两个根确实2,3，和5；代回可验证。');
N('g9-quadratic-eq-prac',()=>4**2/(4*1),'重实根要求判别式(-4)²-4k=0，故k=4；原式变(x-2)²。');
N('g9-quadratic-eq-retest',()=>6/2-3/2,'判别式36-24>0；根和=6/2，根积=3/2，所求3-1.5=1.5。','3/2');
N('g9-trig-diag',()=>4/Math.hypot(3,4),'直角C，斜边AB=5；角A的对边为BC=4，所以sinA=4/5。','4/5');
N('g9-trig-retest',()=>Math.atan(1/Math.sqrt(3))*180/Math.PI,'坡比是铅直/水平，即正切；坡角取0到90°内，tanα=1/√3的唯一角30°。');
P('g9-quadratic-func-diag',()=>[3,5],'二次项2(x-3)²最小在x=3，y=5，顶点(3,5)。');
N('g9-quadratic-func-prac',()=>-(-4)/(2*1),'配方x²-4x+7=(x-2)²+3，关于x=2对称。');
N('g9-quadratic-func-retest',()=>4,'配方为-(x-1)²+4，平方非负所以函数≤4，并在x=1取等。');
N('g9-circle-diag',()=>100/2,'C在优弧AB，所以C所对不含C的弧是100°劣弧AB；圆周角等于该圆心角一半，50°。');
N('g9-circle-prac',()=>Math.sqrt(5**2-(8/2)**2),'垂径平分弦，半弦4；圆心至弦距离d满足d²+4²=5²，取正3。');
N('g9-circle-retest',()=>120/360*Math.PI*6**2,'扇形占整圆120/360，面积(1/3)π×36=12π。','12π');
T('g9-inverse-prop-diag','第二、四象限','k=2×(-3)=-6，所以xy恒负，x与y异号，只在第二和第四象限。');
T('g9-inverse-prop-prac','y₁ > y₂','逐点代入y1=6/(-2)=-3，y2=6/(-1)=-6，-3>-6。');
N('g9-inverse-prop-retest',()=>-2*4,'直角三角形面积|x|×|y|/2=|k|/2=4，|k|=8；第二象限xy<0故k=-8。');
N('g9-similarity-diag',()=>2/3,'三对边统一按2/3比例，边长和之比也2/3；不是面积比4/9。','2 : 3');
N('g9-similarity-prac',()=>3*(2+4)/2,'平行中截线给DE/BC=AD/AB=2/6，故BC=3×6/2=9。');
N('g9-similarity-retest',()=>2*(1+2)**2-2,'AD:AB=1:3，面积ADE:ABC=1:9，总面积18，去掉ADE的2得四边形16。');
N('g9-probability-diag',()=>3/(3+5),'8个球个体等可能，其中3个红球，概率3/8。','3/8');
N('g9-probability-prac',()=>{const p=orderedPairs([1,2,3,4,5,6]);return p.filter(([x,y])=>x+y>9).length/p.length;},'枚举36个等可能有序骰子结果，和10有3个、11有2个、12有1个，共6/36=1/6。','1/6');
N('g9-probability-retest',()=>{const p=orderedPairs([1,2,3,4],false);return p.filter(([x,y])=>(x*y)%2===0).length/p.length;},'无放回12个有序结果，仅(1,3),(3,1)的乘积是奇数，余10个偶数，概率10/12=5/6。','5/6');
N('g9-rotation-symmetry-diag',()=> (3+1)+(2-4),'原点对称要求a-1=3且b-2=-4，得a=4,b=-2，和2。');
N('g9-rotation-symmetry-prac',()=> (180-50)/2,'旋转保持AB′=AB且夹角BAB′=50，等腰三角形两个底角各65，目标正是B′底角。');
N('g9-rotation-symmetry-retest',()=>60/360*Math.PI*5**2,'扫过的是以A为心半径5、角60°的扇形，面积π×25/6。','25π / 6');
N('g9-quadratic-apps-diag',()=>Math.sqrt(7.2/5)-1,'增长因子1+x为正，两年乘两次；5(1+x)²=7.2，1+x=1.2，x=.2。','20%');
N('g9-quadratic-apps-prac',()=> (1+Math.sqrt(1+8*28))/2,'n支球队每对只赛一场，n(n-1)/2=28；二次方程根8,-7，仅正整数8符合队数。');
N('g9-quadratic-apps-retest',()=>[10,14].find(y=>y<=11),'设垂直墙边x，2x+y=24且xy=70，得y²-24y+140=(y-10)(y-14)=0；墙长11排除14，所以y=10。');
N('g9-quadratic-intersections-diag',()=>Math.abs(3-1),'x²-4x+3=(x-1)(x-3)，交点同在横轴，距离|3-1|=2。');
T('g9-quadratic-intersections-prac','y = 2(x - 3)² - 1','右移4用x替换为x-4，原括号变x-4+1=x-3；上移2使常数-3+2=-1，二次项系数不变。');
T('g9-quadratic-intersections-retest','k ≤ 3 且 k ≠ 0','“二次函数”先要求k≠0；与横轴有公共点当且仅当判别式36-12k≥0，即k≤3。');
N('g9-circle-tangent-diag',()=>180-68,'圆内接四边形的对角和180°，所以C=112°。');
N('g9-circle-tangent-prac',()=>3/Math.tan(rad(60/2)),'两切线长相等使OP平分P角为30°；OA⊥PA，在直角三角形中tan30=OA/PA，PA=3√3。','3√3');
N('g9-circle-tangent-retest',()=> (9+12-Math.hypot(9,12))/2,'直角三角形斜边15，内切圆半径由面积r×半周长可得r=(9+12-15)/2=3。');
N('g9-projections-views-diag',()=>Math.PI*4*4,'圆柱正、侧投影的宽是直径4，高为4；侧面积圆周长πd乘高h=16π。','16π cm²');
N('g9-projections-views-prac',()=>360*3/9,'展开扇形半径为母线9，其弧长等于底面圆周2π×3；角度n满足n/360×2π×9=2π×3，n=120。');
N('g9-projections-views-retest',()=>1.5/2.5*20,'同一平行太阳光、通常平地垂直物体模型下，两个高度/影长比例相同，h=20×1.5/2.5=12；不宣称适用于坡地或倾斜物体。');
N('g9-quadratic-methods-diag',()=>-3+(4+3**2),'方程移常数后两边加9，得(x-3)²=13，所以a=-3,b=13，和10。');
T('g9-quadratic-methods-prac','x₁ = 2，x₂ = 3','移到一边提取共同因式：(x-3)(x-2)=0，所以解集{2,3}；不能先除x-3而丢根。');
N('g9-quadratic-methods-retest',()=>3,'令t=x²+2x=(x+1)²-1≥-1；t²-t-6=(t-3)(t+2)=0，只保留t=3，t=-2不可能来自实数x。');
N('g9-circle-pos-arc-diag',()=>2,'圆心到直线距离3严格小于半径5，直线割圆，恰有两个交点。');
N('g9-circle-pos-arc-prac',()=>150/360*2*Math.PI*12,'弧长是完整圆周的150/360，结果10π米。','10π 米');
N('g9-circle-pos-arc-retest',()=> (180-45)-45,'正多边形每个外角等于中心角45，内角135；二者之差90。');
T('g9-trig-bearing-apps-diag','30°，6√3 米','坡比高/水平宽=1/√3=tan30°；高为6，所以水平宽为6√3，两个量必须同时满足。');
Q('g9-trig-bearing-apps-prac',()=>[20*Math.sqrt(3),10*Math.sqrt(3)],'设塔高h，AD=√3h且BD=h/√3。若B在A,D之间，AD-BD=40给h=20√3；若前进40米越过塔底D，则AD+BD=40给h=10√3。题干只说共线与朝D方向前进，未排除第二种位置，解析直接使用相减额外假设了点序。','GEOMETRY_ORDER_REQUIRED','补充“B位于线段AD上（未经过灯塔底部D）”，再按AD-BD=40核验。');
N('g9-trig-bearing-apps-retest',()=>60*Math.cos(rad(30)),'OA向南偏西30°，B在正南轴，AB水平向东，故OB是OA在正南方向的投影，60cos30=30√3。','30√3 海里');

function numericOption(raw){
 let s=String(raw).trim();const angle=s.match(/^(-?\d+(?:\.\d+)?)°(?:(\d+(?:\.\d+)?)′)?$/);if(angle)return Number(angle[1])+Number(angle[2]||0)/60;
 if(/^[xy]\s*=/.test(s))s=s.replace(/^[xy]\s*=\s*/,'');
 s=s.replace(/\s*(?:cm[²³]?|千米\/时|海里|立方米|米|元|分|吨|人|支|本|个|m[²³]?)$/,'');
 if(s.endsWith('%'))return arithmetic(s.slice(0,-1))/100;
 s=s.replace(/π/g,'('+Math.PI+')').replace(/:/g,'/');
 return arithmetic(s);
}
function pairOption(raw){const p=String(raw).replace(/[()（）]/g,'').split(/[,，]/);if(p.length!==2)throw Error('not a pair');return p.map(numericOption);}
function scientificOption(raw){const m=String(raw).replace(/\s/g,'').match(/^(-?\d+(?:\.\d+)?)×10([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);if(!m)return null;const power=Number([...m[2]].map(c=>'⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join(''));return {coefficient:Number(m[1]),power,value:Number(m[1])*10**power};}
const nearly=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b));
export function deriveMathAnswer(question){
 const binding=frozen.get(question.id),rule=cases.get(question.id);
 if(!binding||!rule)return {decision:'needs_review',issues:[],warnings:['NO_INDEPENDENT_RULE'],independentAnswer:{optionIndexes:[],answerText:null,method:'manual_required',reason:'未找到本轮已冻结题干的独立推导。'}};
 if(sha({prompt:question.prompt,options:question.options})!==binding.stemOptionsSha256)return {decision:'needs_review',issues:[],warnings:['STEM_OR_OPTIONS_CHANGED_RECHECK_REQUIRED'],independentAnswer:{optionIndexes:[],answerText:null,method:'manual_required',reason:'题干或选项已改变，旧推导不可套用。'}};
 const expected=rule.derive(),choices=question.options.map((option,index)=>{let parsed=null,consistent=false;try{
  if(rule.kind==='number'||rule.kind==='number_set'){parsed=numericOption(option);consistent=(rule.kind==='number'?[expected]:expected).some(x=>nearly(parsed,x));}
  else if(rule.kind==='pair'){parsed=pairOption(option);consistent=parsed.length===expected.length&&parsed.every((x,i)=>nearly(x,expected[i]));}
  else if(rule.kind==='text'){parsed=norm(option);consistent=parsed===norm(expected);}
  else if(rule.kind==='scientific'){parsed=scientificOption(option);consistent=!!parsed&&Math.abs(parsed.coefficient)>=1&&Math.abs(parsed.coefficient)<10&&nearly(parsed.value,expected);}
  else if(rule.kind==='right_triangle'){parsed=String(option).split(/[,，]/).map(Number).sort((a,b)=>a-b);consistent=parsed.length===3&&parsed[0]>0&&parsed[0]+parsed[1]>parsed[2]&&parsed[0]**2+parsed[1]**2===parsed[2]**2;}
  else if(rule.kind==='ambiguous_factorization'){parsed=norm(option);consistent=expected.some(x=>parsed===norm(x));}
 }catch{}return {index,parsed,consistent};});
 const indexes=choices.filter(x=>x.consistent).map(x=>x.index),issues=[];
 if(rule.issue)issues.push(rule.issue);
 if(indexes.length!==1&&!rule.issue)issues.push('NO_UNIQUE_OPTION');
 // Answer-key comparison happens only after the independent solution and all choices.
 if(indexes.length===1&&indexes[0]!==question.correctOption)issues.push('ANSWER_KEY_CONFLICT');
 return {decision:issues.length?'quarantined':'passed',issues,warnings:[],independentAnswer:{optionIndexes:indexes,answerText:rule.label||String(Array.isArray(expected)?JSON.stringify(expected):expected??'唯一满足勾股等式的三元组'),method:'frozen_stem_independent_derivation_v2',reason:rule.reason,computed:expected,optionChecks:choices},suggestedRepair:rule.repair||null};
}
export function recheckMathQuestion(question,{checkedAt=new Date().toISOString()}={}){
 const answer=deriveMathAnswer(question),binding=frozen.get(question.id),reviewed=rationales.get(question.id),issues=[...answer.issues],warnings=[...answer.warnings,'CURRICULUM_AND_LOCAL_TEXTBOOK_NOT_TEACHER_VERIFIED','SOURCE_RIGHTS_ARE_AUTHOR_DECLARATION_ONLY'];
 const rationaleUnchanged=reviewed&&sha(question.rationale)===reviewed.rationaleSha256;
 if(!rationaleUnchanged)warnings.push('RATIONALE_CHANGED_OR_NOT_RECHECKED');
 if(question.source!=='original_authored_cc0'||question.license!=='CC0-1.0')issues.push('RIGHTS_DECLARATION_CHANGED');
 if(binding&&(question.subject!=='math'||question.grade!==binding.grade))issues.push('SUBJECT_OR_GRADE_METADATA_CHANGED');
 if(/如图|见图|下图|图中所示/.test(question.prompt)&&!question.image)issues.push('REQUIRED_IMAGE_MISSING');
 const decision=issues.length?'quarantined':answer.decision==='passed'&&rationaleUnchanged?'passed':'needs_review';
 const geometry=/△|∠|⊙|平行|垂直|折叠|旋转|三角形|四边形|圆锥|圆柱|仰角/.test(question.prompt);
 const checks={answer:{status:answer.decision,method:answer.independentAnswer.method},uniqueness:{status:issues.some(x=>/AMBIGUOUS|UNCLEAR|ORDER_REQUIRED|NO_UNIQUE/.test(x))?'not_established':answer.independentAnswer.optionIndexes.length===1?'unique_in_frozen_options':'manual_required',optionIndexes:answer.independentAnswer.optionIndexes},rationale:{status:rationaleUnchanged?(answer.decision==='passed'?'consistent_with_independent_derivation':'requires_premise_correction'):'manual_required',sha256:sha(question.rationale),note:rationaleUnchanged?'本轮逐条对照独立推导核对原解析；这是自动辅助核验，不是真实教师审核。':'本轮未核对该解析版本。'},figures:{status:issues.some(x=>x.startsWith('GEOMETRY_'))?'necessary_position_condition_missing':geometry?'text_conditions_sufficient_for_this_derivation':'not_required',imagePresent:!!question.image,note:geometry?'按题干明确条件与标准图形定义推导；未伪造配图。':'题目可由文字与公式完整表达。'},scope:{status:'source_grade_retained_local_alignment_pending',grade:question.grade,textbookScope:question.textbookScope,region:question.region},rights:{status:'author_declared_not_external_clearance',source:question.source,license:question.license,sourceDigest:question.sourceDigest},difficulty:{question:question.difficulty,knowledge:question.knowledgeDifficulty,changed:false}};
 return {decision,independentAnswer:answer.independentAnswer,issues,warnings,checks,suggestedRepair:answer.suggestedRepair||null,humanReview:false,validation:{validator:'independent-bank-math-v2',status:decision,issues,warnings,proof:answer.independentAnswer,checks,humanReview:false,teacherReviewed:false,formalGradingAllowed:false,sourceRights:'author_declared_CC0_not_external_clearance',checkedAt}};
}
export const mathRecheckScope={checker:'independent-bank-math-v2',sourceCatalogSha256:blindSource.sourceCatalogSha256,questionIds:[...frozen.keys()],ruleCount:cases.size};
