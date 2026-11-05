// Vercel Serverless Function: แจ้งเตือนเมื่อฟาสต์ครบ (Web Push) แม้ปิดแอปอยู่
// ตั้งค่าใน Vercel → Settings → Environment Variables:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   (สร้างด้วย: npx web-push generate-vapid-keys)
//   QSTASH_TOKEN                          (จาก console.upstash.com → QStash ใช้ตั้งเวลาส่ง)
//   ไม่บังคับ: QSTASH_URL (ถ้า Upstash ให้ URL เฉพาะภูมิภาค), VAPID_SUBJECT (mailto:you@example.com)
// flow: แอปกดเริ่มฟาสต์ → POST {action:'schedule'} → QStash ถือข้อความไว้จนถึงเวลาครบ
//       → QStash เรียก POST {action:'notify'} กลับมา → ส่ง Web Push ไปที่เครื่อง
//       Break fast ก่อนครบ → POST {action:'cancel'} ลบข้อความที่ตั้งไว้

const crypto = require('crypto');
const webpush = require('web-push');

const PUB = process.env.VAPID_PUBLIC_KEY || '';
const PRIV = process.env.VAPID_PRIVATE_KEY || '';
const QTOKEN = process.env.QSTASH_TOKEN || '';
const QURL = (process.env.QSTASH_URL || 'https://qstash.upstash.io').replace(/\/$/, '');
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@calgoal.app';
const DAILY_LIMIT = 40;

const hits = new Map();
function overLimit(ip) {
  const day = new Date().toISOString().slice(0, 10);
  const rec = hits.get(ip);
  if (!rec || rec.day !== day) { hits.set(ip, { day, n: 1 }); return false; }
  rec.n += 1;
  return rec.n > DAILY_LIMIT;
}
function send(res, code, body) { res.status(code).setHeader('Cache-Control', 'no-store').json(body); }
const sign = (s) => crypto.createHmac('sha256', PRIV).update(s).digest('hex');
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const configured = () => !!(PUB && PRIV && QTOKEN);

function validSub(s) {
  try {
    const u = new URL(s.endpoint);
    return u.protocol === 'https:' && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string' && s.endpoint.length < 1000;
  } catch { return false; }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') return send(res, 200, { ok: true, configured: configured(), publicKey: PUB || null });
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  // ---- เรียกจาก QStash ตอนครบเวลา (ตรวจลายเซ็นที่เราสร้างไว้ตอน schedule) ----
  if (b.action === 'notify') {
    if (!configured()) return send(res, 503, { error: 'not_configured' });
    const payload = JSON.stringify(b.p || {});
    if (!b.sig || !safeEq(sign(payload), b.sig)) return send(res, 403, { error: 'bad_signature' });
    const p = b.p;
    webpush.setVapidDetails(SUBJECT, PUB, PRIV);
    try {
      await webpush.sendNotification(p.sub, JSON.stringify({
        title: '⏱️ ฟาสต์ครบ ' + p.h + ' ชม. แล้ว!',
        body: 'เก่งมาก 🎉 Break fast ได้เลย เริ่มด้วยโปรตีน + ผัก แล้วอย่าลืมบันทึกมื้อแรกนะ',
        tag: 'fast-done-' + p.start, url: '/?fast=1'
      }), { TTL: 6 * 3600, urgency: 'high' });
      return send(res, 200, { ok: true });
    } catch (e) {
      // 404/410 = ผู้ใช้ยกเลิกสิทธิ์แจ้งเตือนแล้ว ไม่ต้องให้ QStash ส่งซ้ำ
      if (e.statusCode === 404 || e.statusCode === 410) return send(res, 200, { ok: false, gone: true });
      return send(res, 502, { error: 'push_failed', status: e.statusCode || 0 });
    }
  }

  // ---- เรียกจากแอป ----
  const origin = req.headers.origin;
  if (origin) {
    try { if (new URL(origin).host !== req.headers.host) return send(res, 403, { error: 'forbidden' }); }
    catch { return send(res, 403, { error: 'forbidden' }); }
  }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (overLimit(ip)) return send(res, 429, { error: 'daily_limit' });
  if (!configured()) return send(res, 503, { error: 'not_configured' });

  if (b.action === 'cancel') {
    if (!/^[\w-]{1,100}$/.test(String(b.id || ''))) return send(res, 400, { error: 'bad_id' });
    const r = await fetch(QURL + '/v2/messages/' + encodeURIComponent(b.id), { method: 'DELETE', headers: { Authorization: 'Bearer ' + QTOKEN } });
    return send(res, 200, { ok: r.ok || r.status === 404 });
  }

  if (b.action === 'schedule') {
    const at = Number(b.at), start = Number(b.start), h = Number(b.h);
    const now = Date.now();
    if (!validSub(b.sub || {}) || !(at > now) || at - now > 26 * 3600e3 || !(h > 0 && h <= 24)) return send(res, 400, { error: 'bad_request' });
    const p = { sub: { endpoint: b.sub.endpoint, keys: { p256dh: b.sub.keys.p256dh, auth: b.sub.keys.auth } }, h, start };
    const payload = JSON.stringify(p);
    const dest = 'https://' + req.headers.host + '/api/fast-push';
    const r = await fetch(QURL + '/v2/publish/' + dest, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + QTOKEN, 'Content-Type': 'application/json',
        'Upstash-Not-Before': String(Math.floor(at / 1000)), 'Upstash-Retries': '2'
      },
      body: JSON.stringify({ action: 'notify', p, sig: sign(payload) })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.messageId) return send(res, 502, { error: 'schedule_failed', status: r.status, detail: String(j.error || '').slice(0, 200) });
    return send(res, 200, { ok: true, id: j.messageId });
  }
  return send(res, 400, { error: 'bad_action' });
};
