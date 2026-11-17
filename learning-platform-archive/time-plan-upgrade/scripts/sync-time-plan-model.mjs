// Browser and server run byte-identical pure scheduling rules.
import {copyFile} from 'node:fs/promises';
await copyFile(new URL('../public/planning/model.js',import.meta.url),new URL('../src/time-plan-model.mjs',import.meta.url));
