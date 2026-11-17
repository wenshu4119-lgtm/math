const CACHE='zhixing-shell-public-v18';
const ASSETS=['/','/index.html','/login.html','/platform.html','/homepage.css','/public-coverage.js','/public-info.css','/public-info.js','/sources.html','/changelog.html','/licenses.html','/about.html','/styles.css','/styles/prototype-tokens.css','/styles/prototype-layout.css','/styles/prototype-components.css','/styles/integration.css','/app.js','/draft-workspace.js','/draft-export-registry.js','/parent-archive.js','/profile-workspace.js','/assessment-scope.js','/learning-state.js','/pack-workspace.js','/teacher-workspace.js','/teacher-editors.js','/paper-workspace.js','/homework-workspace.js','/ocr-workspace.js','/export-registry.js','/icon.svg','/manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('zhixing-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Whitelist only the public shell: never intercept APIs, uploads or authenticated content.
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.search||!ASSETS.includes(url.pathname))return;
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
