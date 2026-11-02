// Service worker: เปิดแอปได้เร็วและใช้ออฟไลน์ได้ (เฉพาะหน้าแอป) ไม่แคช API / Supabase
const VER = 'chompy-v1';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'privacy.html', 'terms.html'];

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
