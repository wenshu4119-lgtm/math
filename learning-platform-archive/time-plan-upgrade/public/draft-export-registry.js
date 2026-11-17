// Add these four existing backend-backed kinds to the website registry once its UI
// is integrated. This file does not change the live public/ workspace.
export const DRAFT_EXPORTS=Object.freeze({
 'draft-sources':{title:'隔离合成资料清单',roles:['teacher']},
 'draft-source':{title:'隔离合成资料与来源',roles:['teacher'],key:'id'},
 'question-drafts':{title:'隔离候选批次清单',roles:['teacher']},
 'question-draft':{title:'隔离候选题与复核记录',roles:['teacher'],key:'id'}
});
