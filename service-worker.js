const CACHE='legacycut-meridian-v49-15-lc3';
const ASSETS=[
  './',
  './index.html?v=49.15-lc3',
  './index.html',
  './manifest.json',
  './style-v49_15.css?v=49.15-lc3',
  './app-v49_15.js?v=49.15-lc3',
  './icon-192.png',
  './icon-512.png'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{
      const copy=res.clone();
      caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
      return res;
    }).catch(()=>caches.match('./index.html?v=49.15-lc3').then(r=>r||caches.match('./index.html'))));
    return;
  }
  if(url.origin===location.origin){
    event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{
      const copy=res.clone();
      caches.open(CACHE).then(cache=>cache.put(req,copy));
      return res;
    }).catch(()=>cached)));
  }
});
