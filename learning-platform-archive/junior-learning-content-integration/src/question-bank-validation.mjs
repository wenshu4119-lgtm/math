import {createHash} from 'node:crypto';
export const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export const SUBJECTS=[['chinese','语文'],['math','数学'],['english','英语'],['physics','物理'],['chemistry','化学'],['biology','生物'],['history','历史'],['geography','地理'],['civics','道德与法治']];
export const DIFFICULTIES={1:'low',2:'medium',3:'high'};
// Restricted arithmetic grammar. Never execute source-file expressions or supplied JavaScript.
export function arithmetic(raw){
 let s=String(raw).replace(/[−–]/g,'-').replace(/×/g,'*').replace(/÷/g,'/').replace(/[（]/g,'(').replace(/[）]/g,')').replace(/²/g,'^2').replace(/³/g,'^3').replace(/⁴/g,'^4').replace(/√\s*(\d+(?:\.\d+)?)/g,'sqrt($1)').replace(/\|([^|]+)\|/g,'abs($1)').replace(/\s+/g,'');
 s=s.replace(/sin30°/g,'(1/2)').replace(/tan45°/g,'1').replace(/(\d)(?=sqrt|abs|\()/g,'$1*');
 const tokens=s.match(/sqrt|abs|\d+(?:\.\d+)?|[()+*/^\-]/g)||[];
 if(tokens.join('')!==s||tokens.length>120)throw Error('unsupported arithmetic');let i=0;
 function primary(){const t=tokens[i++];if(t==='('){const v=sum();if(tokens[i++]!==')')throw Error('parentheses');return v;}if(t==='sqrt'||t==='abs'){if(tokens[i++]!=='(')throw Error('function');const v=sum();if(tokens[i++]!==')')throw Error('function');return t==='sqrt'?Math.sqrt(v):Math.abs(v);}if(!/^\d/.test(t||''))throw Error('number');return Number(t);}
 function power(){const v=primary();return tokens[i]==='^'?(i++,v**unary()):v;}
 function unary(){if(tokens[i]==='+'){i++;return unary();}if(tokens[i]==='-'){i++;return -unary();}return power();}
 function product(){let v=unary();while(['*','/'].includes(tokens[i])){const op=tokens[i++],w=unary();v=op==='*'?v*w:v/w;}return v;}
 function sum(){let v=product();while(['+','-'].includes(tokens[i])){const op=tokens[i++],w=product();v=op==='+'?v+w:v-w;}return v;}
 const v=sum();if(i!==tokens.length||!Number.isFinite(v))throw Error('not finite');return v;
}
function expectedFromPrompt(q){
 const m=q.prompt.match(/^计算\s*(.+?)(?:的值为|的结果是|。|，)/);if(m)return {number:arithmetic(m[1]),method:'independent_prompt_arithmetic_v1'};
 return null;
}
export function validateQuestion(q,{topic,duplicate=false}={}){
 const issues=[],warnings=[];let proof=null;
 if(!q.id||!q.prompt||!q.rationale||!Array.isArray(q.options)||q.options.length!==4||!Number.isInteger(q.correctOption)||q.correctOption<0||q.correctOption>3)issues.push('INVALID_FIELDS');
 if(q.options&&new Set(q.options.map(x=>String(x).trim())).size!==q.options.length)issues.push('DUPLICATE_OPTIONS');
 if(duplicate)issues.push('DUPLICATE_PROMPT');
 if(q.source!=='original_authored_cc0'||q.license!=='CC0-1.0')issues.push('RIGHTS_UNCLEAR');
 if(![7,8,9].includes(q.grade)||!SUBJECTS.some(([s])=>s===q.subject))issues.push('SCOPE_UNCLEAR');
 if(/如图|见图|下图|图中所示|根据图/.test(q.prompt)&&!q.image)issues.push('REQUIRED_IMAGE_MISSING');
 if(topic?.codexDraftSource&&sha(topic.codexDraftSource.text)!==topic.codexDraftSource.digest)issues.push('SOURCE_DIGEST_MISMATCH');
 if(q.codexCitation&&topic?.codexDraftSource&&q.codexCitation.digest!==topic.codexDraftSource.digest)issues.push('CITATION_DIGEST_MISMATCH');
 if(/[<>]\/?(?:script|img|iframe)|javascript:/i.test(q.prompt+' '+q.rationale))issues.push('UNSAFE_MARKUP');
 if(/△|∠|⊙|平行|垂直|折叠|旋转|图象|图像|几何|三角形|四边形|圆锥|圆柱/.test(q.prompt))warnings.push('GEOMETRY_OR_GRAPH_REQUIRES_TEACHER');
 if(q.subject==='english')warnings.push('ENGLISH_CONTEXT_REQUIRES_TEACHER');
 if(q.subject==='english'&&((/Did you find ____ in today's science newspaper\?/.test(q.prompt)&&q.options?.includes('something interesting')&&q.options?.includes('anything interesting'))||(/Have you packed your raincoat/.test(q.prompt)&&q.options?.includes('already')&&q.options?.includes('yet'))||(/he ____ to Beijing/.test(q.prompt)&&q.options?.includes('has gone')&&q.options?.includes('went'))))issues.push('MULTIPLE_ENGLISH_READINGS_REQUIRE_CONTEXT');
 if(q.subject==='english'&&/She\s+_{3,}\s+a student\./i.test(q.prompt)&&q.options?.includes('is')&&q.options[q.correctOption]!=='is')issues.push('ANSWER_MISMATCH_BE_AGREEMENT');
 if(!issues.length&&q.subject==='math')try{proof=expectedFromPrompt(q);if(proof){const values=q.options.map(o=>{try{return arithmetic(o);}catch{return null;}}),matches=values.map((v,i)=>v!==null&&Math.abs(v-proof.number)<1e-9?i:-1).filter(i=>i>=0);if(matches.length!==1)issues.push('NO_UNIQUE_CORRECT_OPTION');else if(matches[0]!==q.correctOption)issues.push('ANSWER_MISMATCH');else if(!q.rationale.includes(String(proof.number))&& !q.rationale.includes(q.options[q.correctOption]))warnings.push('RATIONALE_NEEDS_TEACHER');}}catch{proof=null;}
 if(!proof)warnings.push('SEMANTIC_ANSWER_NOT_INDEPENDENTLY_PROVEN');
 // Original file's automatedCheck/independentVerified claims are deliberately not trusted.
 return {validator:'independent-bank-v1',status:issues.length?'quarantined':proof&&!warnings.length?'passed':'needs_review',issues,warnings,proof,humanReview:false,sourceRights:'author_declared_CC0_not_external_clearance',checkedAt:new Date().toISOString()};
}
export function normalizeQuestion(q,t){
 return {id:q.id,subject:q.subject,grade:q.grade,semester:q.semester||t.semester||'',chapter:q.chapter||t.chapter||'',knowledgeIds:[q.knowledgeId],knowledgeTitle:t.title,knowledgeDifficulty:null,knowledgeDifficultyBasis:'原稿知识点没有独立难度；待教师定级',explanation:t.explanation,memoryCard:t.memoryCard,prompt:q.prompt,options:q.options,correctOption:q.correctOption,rationale:q.rationale,difficulty:DIFFICULTIES[q.difficulty]||null,difficultyBasis:'原稿数值1/2/3映射低/中等/高，仅初标，待教师核定',purposes:[q.phase],source:q.source,license:q.license,sourceVersion:1,sourceDigest:t.codexDraftSource?.digest||null,sourceLabel:t.codexDraftSource?.sourceLabel||q.source,textbookScope:'原稿章节顺序供参考；教材版本和地区未核定',region:'未指定地区',reviewStatus:'pending_human',originalAutomatedClaim:q.automatedCheckResult||null,origin:'antigravity_original_draft',image:q.image||null};
}
