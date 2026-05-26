const CACHE='legacycut-meridian-v1-2';
const ASSETS=['./','./index.html','./manifest.json','./service-worker.js','./icons/icon-192.svg','./icons/icon-512.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(resp=>{const clone=resp.clone();caches.open(CACHE).then(cache=>cache.put(event.request,clone));return resp}).catch(()=>caches.match('./index.html'))))});
