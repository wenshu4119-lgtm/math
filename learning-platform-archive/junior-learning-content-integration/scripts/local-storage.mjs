import { mkdir,writeFile,readFile,unlink } from 'node:fs/promises';
import { join } from 'node:path';
export function localStorage(root) {
  const file=key=>{if(!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(key))throw new Error('Invalid object key');return join(root,key.replace('/','_'));};
  return {
    async put(key,bytes){await mkdir(root,{recursive:true});await writeFile(file(key),bytes,{flag:'wx'});},
    async get(key){try{return {body:await readFile(file(key))};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
    async delete(key){try{await unlink(file(key));}catch(e){if(e.code!=='ENOENT')throw e;}}
  };
}
