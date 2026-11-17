// Original small candidate batch. Facts are referenced, never copied exam questions.
import {mkdirSync,writeFileSync} from 'node:fs';
import {sha} from '../src/question-bank-validation.mjs';
import {checkPilotQuestion} from '../src/subject-pilot-validation.mjs';
const checkedAt='2026-11-14',sources={
 units:{title:'BIPM — SI base units',url:'https://www.bipm.org/en/measurement-units/si-base-units',checkedAt,use:'仅单位定义事实；题目情境、数值、选项与中文解析为本平台原创'},
 scale:{title:'USGS — Map Scale',url:'https://ngmdb.usgs.gov/ngmdb/ngmdb_help_comp.html',checkedAt,use:'比例尺同单位长度比定义；未复制地图或习题'},
 latitude:{title:'NOAA — What is latitude?',url:'https://oceanservice.noaa.gov/facts/latitude.html',checkedAt,use:'赤道、纬度与南北半球的公开事实；未复制图片或习题'},
 physicsScope:{title:'教育部2024年义务教育国家课程教学用书目录',url:'https://www.moe.gov.cn/srcsite/a26/s8001/202408/W020240805496325238752.pdf',checkedAt,use:'核对物理八至九年级学段，不作具体教材章节授权或适配认证'},
 geographyScope:{title:'人教版义务教育地理（七～八年级）新教材介绍',url:'https://www.pep.com.cn/xw/zt/hd/12/xjcjs/cz/202409/t20240918_1995544.html',checkedAt,use:'核对地理七至八年级学段，不复制教材内容'}
};
const topics=[
 {id:'pilot-physics-units',subject:'physics',grade:8,title:'常用单位与十进制换算',explanation:'写出数值前先核对单位。1 km = 1000 m，1 min = 60 s，1 kg = 1000 g。换算只改变数值与单位的组合，不改变所表示的实际量。',memoryCard:'千米到米乘1000；分钟到秒乘60；克到千克除1000。',sourceKeys:['units','physicsScope']},
 {id:'pilot-physics-speed',subject:'physics',grade:8,title:'平均速度：总路程除以总时间',explanation:'一段行程的平均速度等于这段总路程除以总时间。先统一单位，再把不同路段的路程与时间分别相加。不同路段的速度不能随意直接取算术平均。',memoryCard:'全程平均速度 = 总路程 ÷ 总时间；先加路程、再加时间。',sourceKeys:['units','physicsScope']},
 {id:'pilot-geography-scale',subject:'geography',grade:7,title:'比例尺与图上、实际距离',explanation:'数字比例尺1:n表示图上1个长度单位对应实际n个相同长度单位。先保持长度单位一致，再根据需要换算成米或千米。题目中的路线长度按给定图上长度计算，不另猜测地形或地图变形。',memoryCard:'实际距离 = 图上距离 × n；图上距离 = 实际距离 ÷ n。',sourceKeys:['scale','geographyScope']},
 {id:'pilot-geography-latitude',subject:'geography',grade:7,title:'纬度、赤道与南北半球',explanation:'赤道纬度为0°。N表示北纬，S表示南纬；北纬地点在北半球，南纬地点在南半球。纬度数值最大到90°，南北极分别为90°S与90°N。这里只判断南北半球，不由纬度判断东西半球。',memoryCard:'赤道0°；N北、S南；南北极纬度90°。',sourceKeys:['latitude','geographyScope']}
];
const inputs=[
 ['pilot-physics-units','diagnostic','very_low','将0.72 km换算为m，结果是（ ）。',['7.2 m','72 m','720 m','7200 m'],2,'1 km = 1000 m，所以0.72 × 1000 = 720 m。'],
 ['pilot-physics-units','practice','low','将2.5 min换算为s，结果是（ ）。',['25 s','150 s','250 s','600 s'],1,'1 min = 60 s，所以2.5 × 60 = 150 s。'],
 ['pilot-physics-units','retest','low','将360 g换算为kg，结果是（ ）。',['0.036 kg','0.36 kg','3.6 kg','36 kg'],1,'1 kg = 1000 g，所以360 ÷ 1000 = 0.36 kg。'],
 ['pilot-physics-speed','diagnostic','low','一名跑步者用20 s跑过120 m，这段路程的平均速度为（ ）。',['4 m/s','5 m/s','6 m/s','8 m/s'],2,'平均速度 = 120 ÷ 20 = 6 m/s。'],
 ['pilot-physics-speed','practice','low','一辆小车用150 s走过1800 m，这段路程的平均速度为（ ）。',['10 m/s','12 m/s','15 m/s','18 m/s'],1,'平均速度 = 总路程 ÷ 总时间 = 1800 ÷ 150 = 12 m/s。'],
 ['pilot-physics-speed','retest','medium','一名同学先用60 s走过300 m，再用20 s走过200 m。两段之间不停留，全程平均速度为（ ）。',['5 m/s','6.25 m/s','7.5 m/s','10 m/s'],1,'总路程500 m，总时间80 s，全程平均速度500 ÷ 80 = 6.25 m/s，不能直接把两段速度5与10取平均。'],
 ['pilot-geography-scale','diagnostic','low','在比例尺1:50000的地图上，两点间图上距离为3 cm，按该比例尺计算实际距离为（ ）。',['0.15 km','1.5 km','15 km','150 km'],1,'实际距离 = 3 × 50000 = 150000 cm = 1.5 km。'],
 ['pilot-geography-scale','practice','low','在比例尺1:200000的地图上，两点间图上距离为1.5 cm，按该比例尺计算实际距离为（ ）。',['0.3 km','1.5 km','3 km','30 km'],2,'实际距离 = 1.5 × 200000 = 300000 cm = 3 km。'],
 ['pilot-geography-scale','retest','medium','在比例尺1:25000的地图上，一段实际长度为2 km的路线对应图上长度为（ ）。',['0.8 cm','2 cm','4 cm','8 cm'],3,'2 km = 200000 cm，图上长度200000 ÷ 25000 = 8 cm。'],
 ['pilot-geography-latitude','diagnostic','very_low','赤道的纬度是（ ）。',['0°','23.5°N','66.5°S','90°N'],0,'赤道是0°纬线，划分南北半球。'],
 ['pilot-geography-latitude','practice','low','某地纬度为30°N。仅根据纬度可以确定，该地位于（ ）。',['北半球','南半球','赤道上','南极点'],0,'N表示北纬，30°N在赤道以北，因此位于北半球；纬度不能用来判定东西半球。'],
 ['pilot-geography-latitude','retest','low','某地纬度为25°S。仅根据纬度可以确定，该地位于（ ）。',['北半球','南半球','赤道上','北极点'],1,'S表示南纬，25°S在赤道以南，因此位于南半球。']
];
const records=inputs.map(([topicId,purpose,difficulty,prompt,options,correctOption,rationale])=>{
 const t=topics.find(x=>x.id===topicId),q={id:topicId+'-'+purpose,subject:t.subject,grade:t.grade,semester:'编排待本机构核定',chapter:t.title,knowledgeIds:[t.id],knowledgeTitle:t.title,knowledgeDifficulty:null,knowledgeDifficultyBasis:'原创知识条目尚待教师定级',explanation:t.explanation,memoryCard:t.memoryCard,prompt,options,correctOption,rationale,difficulty,difficultyBasis:'原创初标：按单步读取、换算或多步合成区分；未做测量校准，待教师核定',purposes:[purpose],source:'original_platform_authored',license:'platform-internal-use',sourceVersion:1,sourceLabel:'本平台原创学科补充；仅参考定义事实，未复制教材或外部题目',sourceDigest:null,sourceReferences:t.sourceKeys.map(k=>sources[k]),textbookScope:t.subject==='physics'?'适用初中八至九年级物理基础；候选编排八年级，具体教材册次和地区待本机构教师核定':'适用初中七至八年级地理基础；候选编排七年级，具体教材册次和地区待本机构教师核定',region:'未指定地区；不声称对应某地区中考',reviewStatus:'pending_human',origin:'codex_original_subject_pilot',image:null};
 const check=checkPilotQuestion(q);if(check.status!=='passed')throw Error('Original question did not pass independent check '+q.id);
 return {question:q,validation:{validator:'subject-pilot-v1',status:'needs_review',issues:[],warnings:['TEACHER_PEDAGOGY_AND_LOCAL_SCOPE_REVIEW_REQUIRED'],proof:check,humanReview:false,sourceRights:'original_platform_use_no_public_license_grant',checkedAt},independentAnswer:check};
});
const batches=['physics','geography'].map(subject=>{const selected=records.filter(r=>r.question.subject===subject),digest=sha(selected);return {id:'pilot-'+subject+'-20261114-v1',filename:'original-'+subject+'-pilot.json',sha256:digest,questionCount:selected.length,topicCount:new Set(selected.flatMap(r=>r.question.knowledgeIds)).size,sourceDeclaration:'本平台原创；未复制教材、真题、第三方图片',licenseDeclaration:'仅本平台教学使用；不向全项目或外部素材授予统一许可证',requiresTeacherReview:true,questionIds:selected.map(r=>r.question.id)};});
for(const record of records)record.batchId=batches.find(b=>b.questionIds.includes(record.question.id)).id;
mkdirSync('data/question-bank/expansion',{recursive:true});writeFileSync('data/question-bank/expansion/subject-pilot.json',JSON.stringify({schemaVersion:1,createdAt:checkedAt,batches,records,sources},null,2));console.log({questions:records.length,knowledgePoints:topics.length,subjects:batches.map(b=>b.id),teacherReviewed:0,studentPracticeAvailable:0});
