const str={type:'string'},bool={type:'boolean'},num={type:'integer',minimum:0},nullable={type:['string','null']};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false}),arr=items=>({type:'array',items}),ref=name=>({$ref:`#/components/schemas/${name}`}),subject={type:'string',enum:['math','english']},rev={type:'integer',minimum:1};
const state={type:'string',enum:['generating','pending_human','accepted_isolated','rejected','failed','unavailable']};
const citation=object({sourceId:str,sourceVersion:{const:1},digest:str,lineStart:rev,lineEnd:rev,text:str});
const question=object({id:str,topic:str,grade:{type:'integer',enum:[7,8,9]},phase:{type:'string',enum:['diagnostic','practice','retest']},prompt:str,options:{...arr(str),minItems:4,maxItems:4},correctOption:{type:'integer',minimum:0,maximum:3},rationale:str,citations:{...arr(citation),minItems:1,maxItems:3}});
const inputQuestion=structuredClone(question);inputQuestion.required=inputQuestion.required.filter(k=>k!=='id');inputQuestion.properties.citations.items.required=inputQuestion.properties.citations.items.required.filter(k=>k!=='sourceVersion');
const check=object({questionId:str,answer:bool,rationale:bool,source:bool,ageAppropriate:bool});
const review=object({decision:{type:'string',enum:['accept','reject']},note:str,checks:arr(check),reviewerId:str,reviewedAt:str,reviewedRevision:rev,attestationOnly:{const:true},published:{const:false}});
const validation=object({kind:str,schemaValid:bool,citationsLocated:bool,questionCount:num,accuracyEvaluated:bool,humanReview:bool,notice:str},[]);
const provenance=object({kind:str,contract:nullable,providerRevision:nullable,model:nullable,transportExecuted:bool,transportAttempted:bool,modelExecution:{type:'string',enum:['not_executed','not_executed_test_fixture','provider_reported_unverified','unknown_after_failure']},usage:object({inputTokens:{type:['integer','null'],minimum:0},outputTokens:{type:['integer','null'],minimum:0}}),syntheticOnly:{const:true},gradingAllowed:{const:false}},['kind','contract','providerRevision','model','transportExecuted','modelExecution','usage','syntheticOnly','gradingAllowed']);
export const draftSchemas={
 DraftSource:object({id:str,title:str,subject,text:str,digest:str,version:{const:1},sourceLabel:str,licenseDeclaration:{type:'string',enum:['original_private','CC0-1.0']},syntheticOnly:{const:true},rightsVerified:{const:false},createdAt:str,notice:str}),
 DraftCandidate:question,
 DraftVersion:object({revision:rev,status:state,questions:arr(question),validation,review:{oneOf:[review,{type:'null'}]},actorId:str,createdAt:str}),
 QuestionDraft:object({id:str,title:str,subject,status:state,revision:rev,sources:arr(object({id:str,title:str,version:{const:1},digest:str,sourceLabel:str,licenseDeclaration:str})),provenance,questions:arr(question),validation,review:{oneOf:[review,{type:'null'}]},history:arr(ref('DraftVersion')),errorCode:nullable,createdAt:str,updatedAt:str,syntheticOnly:{const:true},published:{const:false},gradingAllowed:{const:false},notice:str}),
 DraftCapability:object({available:bool,reason:nullable,notice:str,contract:{const:'junior-candidates-v1'},provider:nullable,model:nullable,providerRevision:nullable,syntheticOnly:{const:true},ragVerified:{const:false},gradingAllowed:{const:false}}),
 DraftPrintDocument:object({kind:str,title:str,viewer:str,role:{const:'老师'},student:{type:'null'},count:num,empty:bool,blocks:arr({type:'object'})})
};
const requestId={type:'string',format:'uuid'},sourceIds={...arr(str),minItems:1,maxItems:2,uniqueItems:true};
export const draftPaths={};
function op(method,path,summary,body,response){
 const success={description:'授权保存/读取结果；生成必须另外检查data.status，不表示出题成功',headers:{'X-Actor-Id':{required:true,schema:str}},content:{'application/json':{schema:object({data:response})}}};
 const operation={summary,description:'仅当前机构的创建老师本人；管理员、学生、家长及其他老师无权读取。隔离内容从未发布到正式题库。','x-roles':['teacher'],security:[{SessionCookie:[]}],parameters:[...Array.from(path.matchAll(/\{(\w+)\}/g),m=>({in:'path',name:m[1],required:true,schema:str})),...(method==='get'?[]:[{in:'header',name:'Origin',required:true,schema:str},{in:'header',name:'X-CSRF-Token',required:true,schema:str}])],responses:{200:success,...Object.fromEntries([400,401,403,404,409,413,415,429,500,503].map(n=>[n,{description:'标准错误信封；无原始上游错误或配置值',content:{'application/json':{schema:ref('Error')}}}]))}};
 if(body)operation.requestBody={required:true,content:{'application/json':{schema:body}}};
 if(method==='post'&&['/draft-sources','/question-drafts','/question-drafts/generate'].includes(path))operation.responses[201]=success;
 if(path==='/question-drafts/generate')operation.responses[202]={...success,description:'相同意图仍生成中；不会再次发起调用'};
 draftPaths[path]??={};draftPaths[path][method]=operation;
}
op('get','/draft-provider','隔离候选生成配置可用性；不探测模型或泄露地址/密钥',null,ref('DraftCapability'));
op('get','/draft-sources','本人最近100份不可变合成资料',null,arr(ref('DraftSource')));
op('post','/draft-sources','保存原创合成资料及来源声明；requestId幂等',object({requestId,title:str,subject,text:{type:'string',minLength:1,maxLength:12000},sourceLabel:str,licenseDeclaration:{type:'string',enum:['original_private','CC0-1.0']},syntheticOnly:{const:true},rightsConfirmed:{const:true}}),ref('DraftSource'));
op('get','/draft-sources/{id}','本人单份来源、版本与SHA256',null,ref('DraftSource'));
op('get','/question-drafts','本人最近100个候选批次；history为空，详情可读保存历史',null,arr(ref('QuestionDraft')));
op('post','/question-drafts','人工录入1至3题，仅结构与引用校验，默认pending_human',object({requestId,title:str,subject,sourceIds,questions:{...arr(inputQuestion),minItems:1,maxItems:3}}),ref('QuestionDraft'));
op('get','/question-drafts/{id}','读取本人候选及所有保存版本',null,ref('QuestionDraft'));
op('patch','/question-drafts/{id}','revision并发更新；每次修改重置为待审，保留历史',object({revision:rev,title:str,questions:{...arr(inputQuestion),minItems:1,maxItems:3}}),ref('QuestionDraft'));
op('post','/question-drafts/generate','先保存幂等请求；关闭/失败状态明确，无重试和伪候选',object({requestId,title:str,subject,sourceIds,count:{type:'integer',minimum:1,maximum:3},instructions:{type:'string',minLength:1,maxLength:1000},syntheticOnly:{const:true}}),ref('QuestionDraft'));
op('post','/question-drafts/{id}/review','逐题人工核对；accept仍accepted_isolated且published=false',object({revision:rev,decision:{type:'string',enum:['accept','reject']},note:{type:'string',minLength:10,maxLength:2000},confirmed:{const:true},checks:arr(check)}),ref('QuestionDraft'));
op('get','/draft-exports','四类隔离内容授权文档/JSON/CSV；同一所有权边界',null,{oneOf:[ref('DraftPrintDocument'),object({formatVersion:{const:'1'},kind:str,records:arr({type:'object'}),notice:str})]});
draftPaths['/draft-exports'].get.parameters=[{in:'query',name:'kind',required:true,schema:{type:'string',enum:['draft-sources','draft-source','question-drafts','question-draft']}},{in:'query',name:'id',required:false,schema:str},{in:'query',name:'format',required:false,schema:{type:'string',enum:['document','json','csv'],default:'document'}}];
draftPaths['/draft-exports'].get.responses[200].content['text/csv']={schema:str};
export function extendDraftContract(contract){
 Object.assign(contract.paths,draftPaths);Object.assign(contract.components.schemas,draftSchemas);contract.info.version='1.6.0';contract.info.description+=' 隔离合成资料与候选题API已实现；教师确认仍不发布。内部候选桥接非DeepTutor官方生成API，外部调用默认关闭。网站入口单独交接。';return contract;
}
