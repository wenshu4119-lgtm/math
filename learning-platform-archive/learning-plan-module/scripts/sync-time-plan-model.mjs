// Browser and server run byte-identical pure scheduling rules.
import {copyFile,readFile,writeFile} from 'node:fs/promises';
await copyFile(new URL('../public/planning/model.js',import.meta.url),new URL('../src/time-plan-model.mjs',import.meta.url));

const custom=await readFile(new URL('../public/planning/custom.js',import.meta.url),'utf8');await writeFile(new URL('../src/time-plan-custom.mjs',import.meta.url),custom.replace("'./model.js'","'./time-plan-model.mjs'"));
