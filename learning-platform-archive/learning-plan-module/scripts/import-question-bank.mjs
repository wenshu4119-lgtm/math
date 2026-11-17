import {openDatabase,migrate} from './local-db.mjs';
import {importBank} from '../src/question-bank-import.mjs';
const args=process.argv.slice(2),arg=n=>args[args.indexOf(n)+1];
if(!args.includes('--database'))throw Error('Required --database explicit path');
const db=openDatabase(arg('--database'));try{migrate(db);let org=arg('--org');if(!args.includes('--org')){const all=db.sqlite.prepare('SELECT id FROM organizations').all();if(all.length!==1)throw Error('Specify --org when database does not have exactly one organization');org=all[0].id;}
if(!db.sqlite.prepare('SELECT id FROM organizations WHERE id=?').get(org))throw Error('Organization missing');
const result=await importBank(db,org,{batchId:args.includes('--batch')?arg('--batch'):undefined});console.log(JSON.stringify({success:true,...result,counts:db.sqlite.prepare('SELECT state,COUNT(*) AS count FROM bank_heads h JOIN bank_versions v ON v.org_id=h.org_id AND v.question_id=h.id AND v.revision=h.revision WHERE h.org_id=? GROUP BY state').all(org)}));}finally{db.sqlite.close();}
