import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Local compatibility adapter. Cloudflare production uses env.DB directly.
export function openDatabase(path=':memory:') {
  if (path!==':memory:') mkdirSync(dirname(path),{recursive:true});
  const sqlite=new DatabaseSync(path); sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  const db={
    sqlite,
    prepare(sql) {
      return {params:[],bind(...params){this.params=params;return this;},
        first(){return sqlite.prepare(sql).get(...this.params)??null;},
        all(){return {results:sqlite.prepare(sql).all(...this.params)};},
        run(){const r=sqlite.prepare(sql).run(...this.params);return {success:true,meta:{changes:Number(r.changes)}};}
      };
    },
    async batch(statements){
      sqlite.exec('BEGIN IMMEDIATE');
      try {const results=[];for(const s of statements) results.push(s.run());sqlite.exec('COMMIT');return results;}
      catch(e){sqlite.exec('ROLLBACK');throw e;}
    }
  };
  return db;
}
export function migrate(db) {
  db.sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  for(const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()) {
    if(db.sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(name)) continue;
    db.sqlite.exec('BEGIN');
    try {db.sqlite.exec(readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8'));db.sqlite.prepare('INSERT INTO local_migrations VALUES (?)').run(name);db.sqlite.exec('COMMIT');}
    catch(e){db.sqlite.exec('ROLLBACK');throw e;}
  }
}
