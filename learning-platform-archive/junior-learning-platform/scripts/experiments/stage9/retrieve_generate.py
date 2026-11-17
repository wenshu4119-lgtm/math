import os,asyncio,json,pathlib,time,hashlib,math
os.chdir('/var/lib/deeptutor/runtime')
NAME='stage9-synthetic-20261114'
async def main():
 from deeptutor.services.rag.pipelines.llamaindex.pipeline import LlamaIndexPipeline
 from deeptutor.services.llm import complete
 matches=[p for p in pathlib.Path('/var/lib/deeptutor/runtime').glob('**/'+NAME) if p.is_dir() and p.parent.name=='knowledge_bases']
 assert len(matches)==1,'Unique synthetic knowledge base required'
 kb=matches[0];pipeline=LlamaIndexPipeline(kb_base_dir=str(kb.parent))
 source_files={p.name:p for p in kb.rglob('*.txt') if p.name in ['stage9_math.txt','stage9_english.txt']}
 assert len(source_files)==2
 queries=[('等式两边应当如何变化，才能继续保持相等？','stage9_math.txt'),('How can I check a solution to an equation?','stage9_math.txt'),('She 后面在一般现在时应该选择什么be动词？','stage9_english.txt'),('What is the negative form of is?','stage9_english.txt'),('月球距离地球有多远？',None)]
 records=[];contexts={}
 for query,expected in queries:
  start=time.monotonic();result=await pipeline.search(query,NAME,top_k=2)
  assert not result.get('error_type') and not result.get('needs_reindex') and result.get('sources')
  citations=[]
  for source in result['sources']:
   filename=pathlib.Path(source['source']).name;assert filename in source_files
   text=source_files[filename].read_text();excerpt=source.get('evidence_text') or source['content'];assert excerpt in text,'Retrieved quote must occur in original synthetic file'
   citations.append({'file':filename,'sha256':hashlib.sha256(source_files[filename].read_bytes()).hexdigest(),'chunkId':source['chunk_id'],'score':source['score'],'quote':excerpt,'nativePageCitation':False})
  record={'query':query,'expected':expected,'top1':citations[0]['file'],'top1Hit':citations[0]['file']==expected if expected else None,'seconds':round(time.monotonic()-start,3),'citations':citations,'retrievalOnly':True}
  records.append(record)
  if expected:contexts[expected]=source_files[expected].read_text()
  print(json.dumps({'stage':'retrieval','query':query,'top1':record['top1'],'expected':expected,'top1Hit':record['top1Hit']}),flush=True)
 fields={'prompt':{'type':'string'},'options':{'type':'array','items':{'type':'string'},'minItems':4,'maxItems':4},'correctOption':{'type':'integer','minimum':0,'maximum':3},'rationale':{'type':'string'}}
 schema={'type':'object','properties':fields,'required':list(fields),'additionalProperties':False}
 candidates=[]
 for subject,filename,instruction in [('math','stage9_math.txt','用中文生成一道选择题，题目为解 x + 2 = 5。四个选项是四个不同的整数。'),('english','stage9_english.txt','Generate one multiple-choice question: She ___ a student. Specify present simple. Options must be am, is, are, be in any order.')]:
  prompt='Only use the following synthetic source. Generate exactly one MCQ candidate. Return JSON only with prompt, options (4 strings), correctOption (0-based integer), rationale. Do not include review claims.\nSOURCE:\n'+contexts[filename]+'\nTASK:\n'+instruction+'\n/no_think'
  start=time.monotonic()
  raw=await complete(prompt,system_prompt='You draft questions for a teacher to review. Never claim human approval. Return one JSON object. /no_think',max_tokens=420,temperature=0.1,max_retries=0,timeout=180,response_format={'type':'json_schema','json_schema':{'name':'candidate','strict':True,'schema':schema}})
  report={'subject':subject,'sourceFile':filename,'sourceSha256':hashlib.sha256(source_files[filename].read_bytes()).hexdigest(),'rawOutput':raw,'seconds':round(time.monotonic()-start,3),'reviewStatus':'pending_human','published':False,'provider':'DeepTutor.complete -> local llama.cpp Qwen3-0.6B','model':'stage9-qwen3-0.6b','modelCalls':1}
  try:
   q=json.loads(raw);assert set(q)==set(fields) and len(q['options'])==4 and len(set(q['options']))==4 and 0<=q['correctOption']<4
   chosen=q['options'][q['correctOption']].strip()
   correct=(chosen=='3' if subject=='math' else chosen.lower()=='is')
   report.update({'candidate':q,'schemaValid':True,'simpleAnswerCheck':correct,'humanReviewVerified':False})
  except Exception:report.update({'schemaValid':False,'simpleAnswerCheck':False,'humanReviewVerified':False})
  candidates.append(report);print(json.dumps({'stage':'candidate','subject':subject,'schemaValid':report['schemaValid'],'simpleAnswerCheck':report['simpleAnswerCheck'],'seconds':report['seconds']}),flush=True)
 index_files=[{'name':str(p.relative_to(kb)),'bytes':p.stat().st_size} for p in kb.rglob('*') if p.is_file() and ('storage' in str(p) or p.suffix in ['.faiss','.npy'])]
 output={'kbName':NAME,'queries':records,'candidates':candidates,'indexFiles':index_files,'notice':'Actual DeepTutor pipeline and real local embedding/LLM. TXT source hashes/quote checks are external validation, not native page citations. Off-topic retrieval is not safe abstention. All candidates pending human review.'}
 pathlib.Path('/var/lib/deeptutor/local-models/retrieval-generation.json').write_text(json.dumps(output,ensure_ascii=False,indent=2))
 print(json.dumps({'completed':True,'top1Hits':sum(r['top1Hit'] is True for r in records),'relevantQueries':4,'offTopicReturnedSources':len(records[-1]['citations']),'candidates':len(candidates),'schemaValid':sum(c['schemaValid'] for c in candidates),'simpleAnswerCheckPassed':sum(c['simpleAnswerCheck'] for c in candidates),'externalPaidCalls':0,'indexFiles':len(index_files)}),flush=True)
asyncio.run(main())
