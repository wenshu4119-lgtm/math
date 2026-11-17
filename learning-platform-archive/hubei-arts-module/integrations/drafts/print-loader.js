import {DRAFT_EXPORTS} from './export-registry.js';
// Use in print-data.loadDocument before the existing registry branch. readApi is
// the existing X-Actor-Id-aware fetch helper; printed records are freshly authorized.
export async function loadDraftDocument(kind,params,readApi){
 if(!Object.hasOwn(DRAFT_EXPORTS,kind))throw new Error('未登记的候选题导出类型。');
 const session=await readApi('/auth/session');if(session.user.role!=='teacher')throw new Error('当前账号没有此导出权限。');
 const query=new URLSearchParams({kind});if(DRAFT_EXPORTS[kind].key){const id=params.get('id');if(!id)throw new Error('缺少导出对象。');query.set('id',id);}
 const document=await readApi('/draft-exports?'+query,session.user.id);
 // A response authorized before logout may arrive after an account switch.
 // Recheck the current cookie identity before exposing its contents.
 await readApi('/auth/session',session.user.id);
 return document;
}
