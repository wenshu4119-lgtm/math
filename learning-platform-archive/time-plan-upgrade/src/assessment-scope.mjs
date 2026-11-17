// Only server-written question snapshots define historical scope; never today's catalog.
const modes=new Set(['subject_examples','selected_topics','pack_topics']);
export function scopeFromItems(items){
  const topics=new Map(),seen=new Set();
  for(const item of items){const q=JSON.parse(item.snapshot_json);seen.add(q.scopeMode);if(!topics.has(item.knowledge_id))topics.set(item.knowledge_id,{id:item.knowledge_id,title:typeof q.knowledgeTitle==='string'?q.knowledgeTitle:null,version:Number.isInteger(q.version)?q.version:null});}
  const [candidate]=seen;
  return {mode:seen.size===1&&modes.has(candidate)?candidate:'legacy',topics:[...topics.values()]};
}
export async function scopesForAttempts(db,attempts){
  if(!attempts.length)return new Map();
  const items=(await db.prepare('SELECT attempt_id,knowledge_id,snapshot_json FROM attempt_items WHERE attempt_id IN (SELECT value FROM json_each(?)) ORDER BY attempt_id,position').bind(JSON.stringify(attempts.map(a=>a.id))).all()).results;
  const grouped=new Map();for(const item of items){if(!grouped.has(item.attempt_id))grouped.set(item.attempt_id,[]);grouped.get(item.attempt_id).push(item);}
  return new Map(attempts.map(a=>[a.id,scopeFromItems(grouped.get(a.id)||[])]));
}
