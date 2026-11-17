import { writeFileSync } from 'node:fs';
const string={type:'string'},integer={type:'integer'},boolean={type:'boolean'},subject={type:'string',enum:['math','english']};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const array=items=>({type:'array',items});
const responses={
  User:object({id:string,username:string,displayName:string,role:{type:'string',enum:['admin','teacher','student','parent']}}),
  Session:object({user:{$ref:'#/components/schemas/User'},csrfToken:string}),
  Question:object({id:string,knowledgeId:string,prompt:string,options:array(string),isExample:boolean,selectedOption:integer,correctOption:integer,isCorrect:boolean,rationale:string},['id','knowledgeId','prompt','options','isExample']),
  Attempt:{type:'object',required:['id','studentId','subject','phase','status','questions'],properties:{id:string,studentId:string,subject,phase:{type:'string',enum:['diagnostic','practice','retest']},packId:{type:['string','null']},status:{type:'string',enum:['open','submitted']},source:{type:['string','null'],enum:['student_self','teacher_recorded',null]},submittedAt:{type:['string','null']},result:{oneOf:[object({correct:integer,total:integer}),{type:'null'}]},questions:array({$ref:'#/components/schemas/Question'})}},
  Pack:{type:'object',required:['id','studentId','status','revision','knowledgeIds','materials'],properties:{id:string,studentId:string,diagnosticId:string,subject,status:{type:'string',enum:['draft','approved','in_progress','completed']},revision:integer,knowledgeIds:array(string),weakKnowledgeIds:array(string),materials:array(object({id:string,title:string,explanation:string,memoryCard:string,version:integer,isExample:boolean})),teacherNote:string,reviewedBy:{type:['string','null']},reviewedAt:{type:['string','null']},algorithm:string,isExample:boolean}},
  Upload:object({id:string,studentId:string,status:{type:'string',enum:['needs_review','confirmed']},ocrStatus:{type:'string',enum:['unavailable','ready','running','needs_review','teacher_confirmed','failed']},ocrRunId:{type:['string','null']},correctedText:{type:['string','null']},revision:integer,expiresAt:integer,notice:string}),
  Growth:object({studentId:string,evidence:array(object({id:string,phase:string,subject,packId:{type:['string','null']},correct:integer,total:integer,source:string,submittedAt:string})),topicEvidence:array(object({knowledgeId:string,title:string,phase:string,answered:integer,correct:integer})),comparisons:array(object({packId:string,diagnosticCorrect:integer,diagnosticTotal:integer,retestCorrect:integer,retestTotal:integer})),notice:string}),
  Error:object({error:object({code:string,message:string,requestId:string})})
};
const paths={};
responses.AssessmentScope=object({mode:{type:'string',enum:['subject_examples','selected_topics','pack_topics','legacy']},topics:array(object({id:string,title:{type:['string','null']},version:{type:['integer','null']}}))});
responses.Attempt.properties.scope={$ref:'#/components/schemas/AssessmentScope'};responses.Attempt.required.push('scope');
responses.AttemptSummary=object({id:string,subject,phase:{type:'string',enum:['diagnostic','practice','retest']},packId:{type:['string','null']},status:{type:'string',enum:['open','submitted']},createdAt:string,scope:{$ref:'#/components/schemas/AssessmentScope'}});
responses.Growth.properties.evidence.items.properties.scope={$ref:'#/components/schemas/AssessmentScope'};responses.Growth.properties.evidence.items.required.push('scope');
responses.AttemptProgress=object({id:string,subject,phase:{type:'string',enum:['diagnostic','practice','retest']},packId:{type:['string','null']},status:{type:'string',enum:['open','submitted']},source:{type:['string','null']},submittedAt:{type:['string','null']},result:{oneOf:[object({correct:integer,total:integer}),{type:'null'}]},scope:{$ref:'#/components/schemas/AssessmentScope'}});
const progressOrNull={oneOf:[{$ref:'#/components/schemas/AttemptProgress'},{type:'null'}]};
responses.PackActivity=object({pack:{$ref:'#/components/schemas/Pack'},practice:progressOrNull,retest:progressOrNull});
responses.LearningCycle=object({diagnostic:progressOrNull,pack:{oneOf:[{$ref:'#/components/schemas/Pack'},{type:'null'}]},practice:progressOrNull,retest:progressOrNull});
const nullableNumber={type:['number','null'],minimum:0,maximum:1000,multipleOf:0.01};
const paperItem=object({questionNo:string,parentNo:{type:['string','null']},prompt:string,qtype:{type:'string',enum:['choice','fill','solution','observation']},mappingLevel:{type:'string',enum:['knowledge','chapter','unresolved']},scopeText:string,knowledgeId:{type:['string','null']},maxScore:nullableNumber,earnedScore:nullableNumber,observationLevel:{type:['integer','null'],minimum:0,maximum:3},note:string,reviewed:boolean},['questionNo','prompt','qtype','mappingLevel','reviewed']);
responses.PaperItem={...paperItem,properties:{...paperItem.properties,knowledgeVersion:{type:['integer','null']},reviewedBy:{type:['string','null']}}};
const paperKind={type:'string',enum:['scored_paper','ability_observation']};
responses.Paper={type:'object',required:['id','studentId','title','subject','kind','status','revision','contentOrigin','source','items','report'],properties:{id:string,studentId:string,title:string,subject,kind:paperKind,status:{type:'string',enum:['draft','confirmed']},revision:integer,contentOrigin:{type:'string',enum:['manual_entry','teacher_reviewed_ocr_text']},ocrRunId:{type:['string','null']},ocrProvenance:{type:['object','null']},source:{type:'string',enum:['teacher_marked','teacher_observation']},createdAt:string,updatedAt:string,confirmedAt:{type:['string','null']},confirmedBy:{type:['string','null']},attachment:{type:['object','null']},items:array({$ref:'#/components/schemas/PaperItem'}),report:{type:['object','null']},notice:string},additionalProperties:false};
responses.OcrRun=object({id:string,uploadId:string,studentId:string,language:{type:'string',enum:['eng','chi_sim+eng']},status:{type:'string',enum:['running','needs_review','teacher_confirmed','failed']},revision:integer,provider:{type:'object'},imageDigest:string,text:{type:['string','null']},confidence:{type:['number','null']},elapsedMs:{type:['integer','null']},errorCode:{type:['string','null']},reviewedText:{type:['string','null']},reviewedBy:{type:['string','null']},reviewedAt:{type:['string','null']},createdAt:string,completedAt:{type:['string','null']},expiresAt:integer,needsReview:boolean,notice:string});
responses.PaperSummary=object({id:string,title:string,subject,kind:paperKind,confirmedAt:string,source:string,itemCount:integer,score:{type:['object','null']},observationCounts:array(object({level:integer,count:integer})),unresolvedCount:integer,chapterOnlyCount:integer,algorithmVersion:string,notice:string});
responses.Growth.properties.paperEvidence=array({$ref:'#/components/schemas/PaperSummary'});
responses.Growth.required.push('paperEvidence');
responses.HomeworkQuestion=object({id:string,knowledgeId:string,knowledgeTitle:string,version:integer,prompt:string,options:array(string),maxScore:{type:'number'},isExample:boolean,correctOption:integer,rationale:string,selectedOption:integer,workText:string,earnedScore:{type:'number'},teacherNote:string},['id','knowledgeId','knowledgeTitle','version','prompt','options','maxScore','isExample']);
responses.Homework=object({id:string,studentId:string,teacherId:string,subject,title:string,instructions:string,dueAt:{type:['string','null']},status:{type:'string',enum:['draft','published','submitted','graded']},revision:integer,sourcePackId:{type:['string','null']},sourcePackRevision:{type:['integer','null']},createdAt:string,publishedAt:{type:['string','null']},submittedAt:{type:['string','null']},gradedAt:{type:['string','null']},acceptingSubmissions:boolean,late:boolean,source:{type:['string','null']},feedback:{type:['string','null']},familySummary:{type:['string','null']},paperReference:{type:['object','null']},result:{type:['object','null']},questions:array({$ref:'#/components/schemas/HomeworkQuestion'}),sheet:boolean,notice:string});
responses.HomeworkSheet={...responses.Homework,properties:{...responses.Homework.properties,questions:array(object({id:string,knowledgeId:string,knowledgeTitle:string,version:integer,prompt:string,options:array(string),maxScore:{type:'number'},isExample:boolean})),source:{type:'null'},feedback:{type:'null'},familySummary:{type:'null'},result:{type:'null'},paperReference:{type:'null'},submittedAt:{type:'null'},gradedAt:{type:'null'},sheet:{const:true}}};
responses.HomeworkSummary=object({id:string,title:string,subject,status:{type:'string',enum:['published','submitted','graded']},dueAt:{type:['string','null']},submittedAt:{type:['string','null']},gradedAt:{type:['string','null']},score:{type:['object','null']},familySummary:{type:['string','null']},source:{type:['string','null']},gradingSource:{type:['string','null']},notice:string});
responses.Growth.properties.homeworkEvidence=array({$ref:'#/components/schemas/HomeworkSummary'});responses.Growth.required.push('homeworkEvidence');
const homeworkItems={type:'array',minItems:1,maxItems:20,items:object({questionId:string,maxScore:{type:'number',minimum:0.01,maximum:1000,multipleOf:0.01}})};
function op(method,path,summary,roles,body,response={type:'object'},query=[]){
  const operation={summary,description:`允许角色：${roles.join('、')}。资源仍逐条检查组织与绑定关系。`,'x-roles':roles,security:roles.includes('public')?[]:[{SessionCookie:[]}],parameters:[...Array.from(path.matchAll(/\{(\w+)\}/g),m=>({in:'path',name:m[1],required:true,schema:string})),...query.map(name=>({in:'query',name,required:true,schema:name==='subject'?subject:string})),...(!['get'].includes(method)?[{in:'header',name:'Origin',required:true,schema:string},...(roles.includes('public')?[]:[{in:'header',name:'X-CSRF-Token',required:true,schema:string}])]:[])],responses:{'200':{description:'成功；实际状态码详见说明',content:{'application/json':{schema:object({data:response})}}},...Object.fromEntries([400,401,403,404,409,413,415,429,503].map(n=>[n,{description:{400:'输入无效',401:'未认证/会话失效',403:'角色/Origin/CSRF不允许',404:'资源不存在或无访问权',409:'未审核/状态冲突/重复记录',413:'请求超过限制',415:'类型不支持',429:'限流',503:'服务未配置/不可用'}[n],content:{'application/json':{schema:{$ref:'#/components/schemas/Error'}}}}]))}};
  if(body)operation.requestBody={required:true,content:{'application/json':{schema:body}}};
  if(method==='post'&&['/attempts','/packs','/uploads','/admin/users','/admin/relationships'].includes(path))operation.responses['201']={...operation.responses['200'],description:'创建成功；学习包重复匹配返回已有记录与200'};
  paths[path]??={};paths[path][method]=operation;return operation;
}
const all=['admin','teacher','student','parent'],learn=['teacher','student'];
op('get','/health','服务状态；本机OCR是否可用取决于绑定，RAG/AI生成未接通',['public']);
op('get','/capabilities','认证用户查询真实OCR/RAG/生成可用性；不含配置路径或密钥',all);
op('post','/auth/login','登录；HttpOnly Cookie；旧会话失效',['public'],object({username:string,password:string}),{$ref:'#/components/schemas/Session'});
op('get','/auth/session','会话与CSRF令牌',all,null,{$ref:'#/components/schemas/Session'});
op('post','/auth/logout','退出并撤销会话',all,null,object({loggedOut:boolean}));
op('post','/auth/password','修改密码并撤销全部会话',all,object({currentPassword:string,newPassword:{type:'string',minLength:12,maxLength:128}}),object({loginRequired:boolean}));
op('get','/students','当前账号可访问学生；管理员为空列表',all,null,array(object({id:string,displayName:string})));
op('get','/knowledge','示例知识点与本机构审核状态',all,null,array({type:'object'}),['subject']);
op('get','/content/review-queue','教师审核完整材料、三阶段题目及推导',['teacher'],null,array({type:'object'}));
op('post','/content/{id}/review','教师确认人工审核；测试中的模拟审批不是真人审核',['teacher'],object({version:integer,confirmed:{const:true}}));
op('get','/attempts','最近100个测评，含保存的范围模式与知识点',learn,null,array({$ref:'#/components/schemas/AttemptSummary'}),['studentId']);
op('post','/attempts','创建测评；diagnostic可选knowledgeIds，仅限同科目已审核范围；省略则沿用本科目全部示例。练习/复测不能另选范围。',learn,object({studentId:string,subject,phase:{type:'string',enum:['diagnostic','practice','retest']},packId:string,knowledgeIds:{type:'array',minItems:1,maxItems:20,uniqueItems:true,items:string}},['studentId','subject','phase']),{$ref:'#/components/schemas/Attempt'});
op('get','/attempts/{id}','读取测评；提交前不返回答案解析',learn,null,{$ref:'#/components/schemas/Attempt'});
op('get','/packs/{id}/activity','指定学习包的实际练习/复测摘要；不受最近100条清单截断，不含题目答案',learn,null,{$ref:'#/components/schemas/PackActivity'});
op('get','/students/{id}/learning-cycle','当前科目最近一轮筛查及对应学习包活动；无筛查返回null，不制造进步',learn,null,{$ref:'#/components/schemas/LearningCycle'},['subject']);
op('post','/attempts/{id}/submit','单次原子提交；客户端不能提供分数',learn,object({answers:array(object({questionId:string,selectedOption:{type:'integer',minimum:0,maximum:3}}))}),{$ref:'#/components/schemas/Attempt'});
op('get','/packs','最近100个学习包',learn,null,array({$ref:'#/components/schemas/Pack'}),['studentId']);
op('post','/packs','依据已提交筛查匹配；同一筛查重复请求返回已有包',learn,object({diagnosticId:string}),{$ref:'#/components/schemas/Pack'});
op('get','/packs/{id}','学习包详情',learn,null,{$ref:'#/components/schemas/Pack'});
op('patch','/packs/{id}','关联老师调整并审核；学习开始后不可改写',['teacher'],object({revision:integer,knowledgeIds:array(string),teacherNote:{type:'string',maxLength:500},approve:boolean}),{$ref:'#/components/schemas/Pack'});
op('get','/packs/{id}/worksheet','已批准通关包的打印作业单；不含答案，不创建作答',learn,null,object({packId:string,studentId:string,subject,revision:integer,teacherNote:string,isExample:boolean,questions:array(object({id:string,knowledgeId:string,prompt:string,options:array(string)}))}));
op('get','/students/{id}/growth','成长摘要；家长仅可读已关联孩子',['student','teacher','parent'],null,{$ref:'#/components/schemas/Growth'});
op('get','/uploads','最近30个未过期试卷图片',learn,null,array({$ref:'#/components/schemas/Upload'}),['studentId']);
const upload=op('post','/uploads','原始PNG/JPEG字节流；2MiB；签名/维度/结构校验；24小时TTL',learn,null,{$ref:'#/components/schemas/Upload'},['studentId']);upload.requestBody={required:true,content:{'image/png':{schema:{type:'string',format:'binary'}},'image/jpeg':{schema:{type:'string',format:'binary'}}}};
op('get','/uploads/{id}','读取核对状态',learn,null,{$ref:'#/components/schemas/Upload'});
const image=op('get','/uploads/{id}/image','私有原图；每次鉴权；no-store',learn);image.responses['200']={description:'私有图片字节流；到期404',content:{'image/png':{schema:{type:'string',format:'binary'}},'image/jpeg':{schema:{type:'string',format:'binary'}}}};
const recognize=op('post','/uploads/{id}/recognize','本机OCR：成功仅产生待教师核对文字；未绑定503；无网络图片服务',learn,object({requestId:{type:'string',format:'uuid'},language:{type:'string',enum:['eng','chi_sim+eng']}}),{$ref:'#/components/schemas/OcrRun'});recognize.responses['201']={...recognize.responses['200'],description:'真实识别完成、状态needs_review；相同请求重试返回200现有记录'};
op('get','/uploads/{id}/ocr-runs','本图最近20条OCR记录，不包含原文大字段',learn,null,array({type:'object'}));
op('get','/ocr-runs/{id}','识别原文、来源与教师核对结果；与原图共用权限和TTL',learn,null,{$ref:'#/components/schemas/OcrRun'});
op('patch','/ocr-runs/{id}/review','仅关联老师可确认文字；不生成题目答案或分数',['teacher'],object({revision:integer,text:{type:'string',minLength:1,maxLength:20000},confirmed:{const:true}}),{$ref:'#/components/schemas/OcrRun'});
op('patch','/uploads/{id}/review','人工核对文本；不生成成绩或已验证题目',learn,object({text:{type:'string',minLength:1,maxLength:10000},confirmed:{const:true},revision:integer}),{$ref:'#/components/schemas/Upload'});
op('delete','/uploads/{id}','删除本人/关联学生图片与核对文本',learn,null,object({deleted:boolean}));
op('get','/admin/users','本机构最多200个账号；不返回密码哈希',['admin'],null,array({type:'object'}));
op('post','/admin/users','生成随机初始密码，仅一次返回；不能创建管理员',['admin'],object({username:string,displayName:string,role:{type:'string',enum:['student','teacher','parent']}}));
op('patch','/admin/users/{id}','启用/停用非管理员账号并撤销会话',['admin'],object({active:boolean}));
op('get','/admin/relationships','本机构最多200条授权关系',['admin'],null,array({type:'object'}));
op('post','/admin/relationships','绑定有效的本机构老师/家长与学生',['admin'],object({adultId:string,studentId:string}));
op('delete','/admin/relationships/{id}','撤销关系；后续读取立即受限',['admin']);
op('get','/admin/audit','最近100条脱敏审计事件',['admin'],null,array({type:'object'}));
op('get','/papers','阅卷清单；老师可看关联学生草稿，学生仅已确认记录',learn,null,array({type:'object'}),['studentId']);
const paperCreate=op('post','/papers','建立人工阅卷草稿；OCR来源须老师已核对；不自动产生题目或分值',['teacher'],object({studentId:string,title:string,subject,kind:paperKind,requestId:{type:'string',format:'uuid'},uploadId:{type:['string','null']},ocrRunId:{type:['string','null']}},['studentId','title','subject','kind','requestId']),{$ref:'#/components/schemas/Paper'});paperCreate.responses['201']={...paperCreate.responses['200'],description:'新建成功；同内容requestId重试返回200已有草稿'};
op('get','/papers/{id}','读取逐题/小题明细，家长与管理员不能读取',learn,null,{$ref:'#/components/schemas/Paper'});
op('patch','/papers/{id}','版本锁保存完整题目列表；仅草稿可修改，60条/64KiB上限',['teacher'],object({revision:integer,title:string,items:{type:'array',items:paperItem,maxItems:60}}),{$ref:'#/components/schemas/Paper'});
op('post','/papers/{id}/confirm','全部逐题核对后确认冻结；缺失满分或实际分不能确认，禁止重复计入',['teacher'],object({revision:integer,confirmed:{const:true}}),{$ref:'#/components/schemas/Paper'});
op('get','/papers/{id}/report','仅已确认的独立口径报告，未确认409',learn,null,{$ref:'#/components/schemas/Paper'});
op('get','/students/{id}/paper-summaries','已确认线下摘要；家长只读，不含逐题和原图',['teacher','student','parent'],null,array({$ref:'#/components/schemas/PaperSummary'}));
op('get','/homework-catalog','老师选取本机构已审核的practice题；含参考答案，仅教师可读',['teacher'],null,array({type:'object'}),['subject']);
op('get','/homeworks','独立作业清单：老师仅自己负责且仍绑定的作业，学生不见草稿',learn,null,array({type:'object'}),['studentId']);
const homeworkCreate=op('post','/homeworks','创建单学生独立作业草稿，题目与答案由服务器从已审核内容快照',['teacher'],object({studentId:string,subject,title:string,instructions:{type:'string',maxLength:1000},dueAt:{type:['string','null'],format:'date-time'},sourcePackId:{type:['string','null']},items:homeworkItems,requestId:{type:'string',format:'uuid'}},['studentId','subject','title','items','requestId']),{$ref:'#/components/schemas/Homework'});homeworkCreate.responses['201']={...homeworkCreate.responses['200'],description:'创建成功；同requestId同内容重试200，不新增作业'};
op('get','/homeworks/{id}','作业保存记录；负责老师可见参考答案，学生须graded后才可见',learn,null,{$ref:'#/components/schemas/Homework'});
op('patch','/homeworks/{id}','仅负责人且仍绑定时可改草稿；版本锁；发布后冻结',['teacher'],object({revision:integer,title:string,instructions:{type:'string',maxLength:1000},dueAt:{type:['string','null'],format:'date-time'},sourcePackId:{type:['string','null']},items:homeworkItems},['revision','title','items']),{$ref:'#/components/schemas/Homework'});
op('post','/homeworks/{id}/publish','负责人确认发布；重新核查审核版本和来源包，并在事务内守住包版本',['teacher'],object({revision:integer,confirmed:{const:true}}),{$ref:'#/components/schemas/Homework'});
op('post','/homeworks/{id}/submit','只有学生本人可提交；全题选择和可选过程；不自动评分，确认提交后不可覆盖',['student'],object({revision:integer,requestId:{type:'string',format:'uuid'},answers:{type:'array',minItems:1,maxItems:20,items:object({questionId:string,selectedOption:{type:'integer',minimum:0,maximum:7},workText:{type:'string',maxLength:2000}},['questionId','selectedOption'])}}),{$ref:'#/components/schemas/Homework'});
op('post','/homeworks/{id}/grade','仅负责人人工批改已提交作业；可引用同学生同科目确认卷面，不自动换算',['teacher'],object({revision:integer,requestId:{type:'string',format:'uuid'},marks:{type:'array',minItems:1,maxItems:20,items:object({questionId:string,earnedScore:{type:'number',minimum:0,maximum:1000,multipleOf:0.01},note:{type:'string',maxLength:500}},['questionId','earnedScore'])},feedback:{type:'string',minLength:1,maxLength:2000},familySummary:{type:'string',maxLength:300},paperId:{type:['string','null']},confirmed:{const:true}},['revision','requestId','marks','feedback','confirmed']),{$ref:'#/components/schemas/Homework'});
op('get','/homeworks/{id}/sheet','服务端无答案作业单；教师也不返回答案、学生提交或成绩',learn,null,{$ref:'#/components/schemas/HomeworkSheet'});
op('get','/homeworks/{id}/feedback','已人工批改的逐题反馈；未批改409，家长不可读',learn,null,{$ref:'#/components/schemas/Homework'});
op('get','/students/{id}/homework-summaries','授权摘要；教师仅自己负责，家长仅明确公开摘要，无逐题数据',['teacher','student','parent'],null,array({$ref:'#/components/schemas/HomeworkSummary'}));
for(const methods of Object.values(paths))for(const operation of Object.values(methods))if(operation.security.length)for(const [status,response]of Object.entries(operation.responses))if(status.startsWith('2'))response.headers={...response.headers,'X-Actor-Id':{required:true,description:'服务端当前认证用户ID；前端/导出须与本次会话身份一致。不是认证凭据。',schema:string}};
const contract={openapi:'3.1.0',info:{title:'智学方舟初中学习平台本地 MVP',version:'1.5.1',description:'教师方案/课后作业反馈工作页复用既有接口；学习包更新在SQL写入时再次核对授课关系及账号状态。接口路径和结构保持，认证响应带X-Actor-Id。完整DeepTutor RAG/AI生成未接入，不参与评分。'},servers:[{url:'/api/v1'}],paths,components:{securitySchemes:{SessionCookie:{type:'apiKey',in:'cookie',name:'lp_session',description:'仅本地名；正式环境必须 __Host-lp_session + Secure。原生客户端认证尚未实现。'}},schemas:responses}};
writeFileSync(new URL('../docs/openapi.json',import.meta.url),JSON.stringify(contract,null,2)+'\n');
console.log(`已生成 ${Object.keys(paths).length} 个路径的 OpenAPI 3.1 契约。`);
