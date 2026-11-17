import { join } from 'node:path';
import { root } from './environment.mjs';
import { openDatabase } from './local-db.mjs';
import { localStorage } from './local-storage.mjs';
const db=openDatabase(join(root,'.local','learning.sqlite')),store=localStorage(join(root,'.local','papers')),now=Date.now();
const expired=(await db.prepare('SELECT id,object_key FROM uploads WHERE expires_at<=?').bind(now).all()).results;
for(const row of expired){await store.delete(row.object_key);await db.prepare('DELETE FROM uploads WHERE id=?').bind(row.id).run();}
await db.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now).run();await db.prepare('DELETE FROM rate_limits WHERE expires_at<=?').bind(now).run();
db.sqlite.close();console.log(`已清理本机 ${expired.length} 条过期图片和过期会话/限流键；未访问远程存储。`);
