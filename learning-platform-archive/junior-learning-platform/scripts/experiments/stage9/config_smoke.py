import asyncio,os,json,math,time,pathlib
os.chdir('/var/lib/deeptutor/runtime')
async def main():
 from deeptutor.services.llm import complete,get_llm_config
 from deeptutor.services.embedding import get_embedding_client,get_embedding_config
 cfg=get_llm_config();embcfg=get_embedding_config()
 assert cfg.model=='stage9-qwen3-0.6b' and cfg.base_url.startswith('http://127.0.0.1:18081')
 assert embcfg.model=='stage9-qwen3-embedding-0.6b' and embcfg.base_url.startswith('http://127.0.0.1:18082')
 start=time.monotonic();client=get_embedding_client();vectors=await client.embed(['分数加法先通分。','She is a student.'])
 assert len(vectors)==2 and all(len(v)==1024 and all(math.isfinite(x) for x in v) for v in vectors)
 report={'provider':'local_official_qwen','embeddingModel':embcfg.model,'vectorCount':len(vectors),'dimension':len(vectors[0]),'embeddingSeconds':round(time.monotonic()-start,3),'norms':[round(math.sqrt(sum(x*x for x in v)),5) for v in vectors]}
 print(json.dumps({'stage':'embedding_ready',**report}),flush=True)
 start=time.monotonic();reply=await complete('Reply with the word READY only.',system_prompt='Follow the user instruction. /no_think',max_tokens=12,temperature=0,max_retries=0,timeout=180)
 report.update({'llmModel':cfg.model,'llmReply':reply,'llmSeconds':round(time.monotonic()-start,3),'externalPaidCalls':0})
 target=pathlib.Path('/var/lib/deeptutor/local-models/config-smoke.json');target.write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False),flush=True)
asyncio.run(main())
