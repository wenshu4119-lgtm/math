import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../integrations/learning-qa/',import.meta.url);
const definitions=[['math-equality.txt','math','等式性质与一元一次方程的方法'],['math-arithmetic.txt','math','有理数的基础四则运算'],['english-present-be.txt','english','一般现在时的 be 动词']];
const sources=definitions.map(([id,subject,title])=>{const bytes=readFileSync(new URL('sources/'+id,root));return {id,subject,title,digest:createHash('sha256').update(bytes).digest('hex'),text:bytes.toString('utf8'),source:'original_authored',license:'platform-internal-use',rightsNotice:'仅本平台教学使用；未额外授予公开再许可',teacherReviewed:false};});
writeFileSync(new URL('sources.json',root),JSON.stringify({version:1,sources},null,2)+'\n');console.log(JSON.stringify({originalSources:sources.length,subjects:['math','english']}));
