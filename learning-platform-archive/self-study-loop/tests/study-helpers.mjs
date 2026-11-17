import assert from 'node:assert/strict';
import native from '../data/study-content.json' with {type:'json'};
import {fixture,PNG} from './helpers.mjs';
export {native};
export async function studyFixture(){const f=await fixture(),student=await f.login('student'),teacher=await f.login('teacher');return {...f,student,teacher};}
export const point=id=>native.points.find(p=>p.id===id);
export const scope=p=>({stage:p.stage,grade:p.grade,examYear:p.examYear,subject:p.subject});
export const snap=(f,aid)=>JSON.parse(f.DB.sqlite.prepare('SELECT snapshot_json FROM study_attempts WHERE id=?').get(aid).snapshot_json);
export async function start(f,p=point('study-jr-m7-equation'),{mode='online',client=f.student,requestId=crypto.randomUUID(),pointIds=[p.id],studentId=f.student.id}={}){return f.request('/study/cycles',{client,method:'POST',body:{requestId,studentId,...scope(p),pointIds,mode}});}
export async function create(f,p,options){const r=await start(f,p,options);assert.equal(r.status,201,JSON.stringify(r.error));return r.data;}
export function answers(f,a,pattern='correct'){return snap(f,a.id).questions.map((q,index)=>({questionId:q.id,selectedOption:typeof pattern==='function'?pattern(q,index):pattern==='skip'?null:pattern==='wrong'?(q.correctOption+1)%q.options.length:q.correctOption}));}
export async function submit(f,a,{pattern='correct',client=f.student,confirmed=a.mode==='paper'}={}){return f.request(`/study/attempts/${a.id}/submit`,{client,method:'POST',body:{expectedVersion:a.version,answers:answers(f,a,pattern),...(confirmed?{confirmed:true}:{})}});}
export async function phase(f,task,phase,mode){const r=await f.request(`/study/tasks/${task.id}/${phase}`,{client:f.student,method:'POST',body:{expectedVersion:task.version,...(mode?{mode}:{})}});assert.equal(r.status,201,JSON.stringify(r.error));return r.data;}
export async function complete(f,p,pattern='correct'){let d=await create(f,p);let r=await submit(f,d.attempt,{pattern});assert.equal(r.status,200,JSON.stringify(r.error));d=await phase(f,r.data.task,'practice');r=await submit(f,d.attempt);assert.equal(r.status,200,JSON.stringify(r.error));d=await phase(f,r.data.task,'retest');r=await submit(f,d.attempt);assert.equal(r.status,200,JSON.stringify(r.error));return r.data;}
export async function upload(f,client=f.student,studentId=f.student.id){const r=await f.request('/uploads?studentId='+studentId,{client,method:'POST',raw:true,body:PNG,headers:{'Content-Type':'image/png'}});assert.equal(r.status,201,JSON.stringify(r.error));return r.data;}
export async function attach(f,a,uploads,{client=f.student}={}){return f.request(`/study/attempts/${a.id}/evidence`,{client,method:'POST',body:{expectedVersion:a.version,uploadIds:uploads.map(u=>u.id),reason:'合成纸笔证据，逐页关联但不识别或批改'}});}
