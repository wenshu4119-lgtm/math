const CACHE='zhixing-shell-v11';
const ASSETS=['/','/index.html','/styles.css','/styles/prototype-tokens.css','/styles/prototype-layout.css','/styles/prototype-components.css','/styles/integration.css','/app.js','/assessment-scope.js','/learning-state.js','/pack-workspace.js','/teacher-workspace.js','/teacher-editors.js','/paper-workspace.js','/homework-workspace.js','/ocr-workspace.js','/export-registry.js','/icon.svg','/manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('zhixing-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Whitelist only the public shell: never intercept APIs, uploads or authenticated content.
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.search||!ASSETS.includes(url.pathname))return;
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
