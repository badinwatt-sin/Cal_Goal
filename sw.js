// Service worker: เปิดแอปได้เร็วและใช้ออฟไลน์ได้ (เฉพาะหน้าแอป) ไม่แคช API / Supabase
const VER = 'calgoal-v15';
const SHELL = ['./', 'index.html', 'app.css', 'foods-th.js', 'foods-more.js', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'privacy.html', 'terms.html', 'assets/beep_wave_base.png', 'assets/beep_wave_hand.png', 'assets/beep_head.png', 'beep-3d.js', 'assets/vendor/three/three.module.min.js', 'assets/vendor/three/three.core.min.js', 'health-import.mjs', 'health-import-worker.js', 'assets/vendor/fflate/fflate.mjs'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VER).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VER).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;           // supabase, cdn ฯลฯ ไม่ยุ่ง
  if (sameOrigin && url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {                 // หน้าเว็บ: ออนไลน์ก่อน ถ้าไม่มีเน็ตใช้ของที่แคชไว้
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(VER).then((c) => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then((m) => m || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then((m) => {   // ไฟล์อื่น: ใช้ของแคชก่อน แล้วอัปเดตเบื้องหลัง
    const net = fetch(req).then((r) => { if (r && r.ok) { const cp = r.clone(); caches.open(VER).then((c) => c.put(req, cp)); } return r; }).catch(() => m);
    return m || net;
  }));
});

// แจ้งเตือนฟาสต์ครบ (ส่งมาจาก /api/fast-push ผ่าน Web Push)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Cal Goal', {
    body: d.body || '', tag: d.tag || 'calgoal', icon: 'icon-192.png', badge: 'icon-192.png',
    data: { url: d.url || '/' }, renotify: true, vibrate: [120, 60, 120]
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ('focus' in c) { c.navigate && c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
