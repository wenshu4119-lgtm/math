import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const root=fileURLToPath(new URL('../',import.meta.url));
export function readEnvironment() {
  const env={};
  for(const line of readFileSync(new URL('../.dev.vars',import.meta.url),'utf8').split(/\r?\n/)) {
    const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=m[2];
  }
  return env;
}
