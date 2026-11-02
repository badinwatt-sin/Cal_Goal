# Chompy (Cal_Goal)

เว็บแอปนับแคลอรี่ ติดตามอาหาร พลังงาน และเป้าหมายน้ำหนัก ภาษาไทย ไม่ต้องล็อกอิน

- คำนวณ BMR / TDEE (Mifflin–St Jeor) และงบแคลต่อวัน
- ฐานข้อมูลอาหารไทยและนานาชาติ 230+ รายการ (ค่าประมาณเฉลี่ย)
- บันทึกออกกำลังกาย (MET) และก้าวเดิน ตั้งเป้าน้ำหนักรายสัปดาห์/เดือน/ปี
- อวตารการ์ตูนปรับแต่งได้ มีท่าทางตามสถานะของวัน
- ข้อมูลเก็บในเบราว์เซอร์ (localStorage) พร้อมสำรอง/นำเข้าไฟล์ JSON

## ใช้งาน
เปิด `index.html` ในเบราว์เซอร์ได้เลย ไม่ต้อง build

## เปิดใช้การล็อกอินและซิงก์ข้อมูล (Supabase, ไม่บังคับ)
ถ้าไม่ตั้งค่า แอปทำงานแบบไม่ล็อกอิน (เก็บข้อมูลในเครื่อง) ถ้าตั้งค่า ผู้ใช้จะเห็นหน้าเข้าสู่ระบบก่อน (หรือเลือกใช้โดยไม่ล็อกอินได้) และข้อมูลซิงก์ข้ามเครื่อง
1. สร้างโปรเจกต์ที่ https://supabase.com แล้วรัน `supabase/schema.sql` ใน SQL Editor (สร้างตาราง `user_data` พร้อม Row Level Security ให้แต่ละคนเข้าถึงได้เฉพาะแถวของตัวเอง)
2. Authentication → Providers: เปิด **Email** (magic link) และ/หรือ **Google** (ต้องสร้าง OAuth Client ใน Google Cloud Console แล้วใส่ redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`)
3. Authentication → URL Configuration: ตั้ง **Site URL** เป็นลิงก์แอปบน Vercel และเพิ่มลิงก์เดียวกันใน **Redirect URLs**
4. แก้ `config.js` ใส่ `supabaseUrl` และ `supabaseAnonKey` (Project Settings → API → anon public) แล้ว push
5. (ทางเลือก) อีเมลเริ่มต้นของ Supabase ส่งได้จำกัดจำนวนต่อชั่วโมง ถ้าเปิดสาธารณะควรตั้ง SMTP ของตัวเอง (Authentication → SMTP Settings)

ข้อมูลที่ซิงก์: โปรไฟล์ เป้าหมาย บันทึกอาหาร/ออกกำลังกาย น้ำหนัก (ไม่ซิงก์รูปอาหาร) เมื่อขัดแย้งกัน ฝั่งที่แก้ไขล่าสุดชนะ

## ตั้งค่า AI ประเมินแคลจากรูป (Vercel + Gemini)
1. สร้าง API key ที่ https://aistudio.google.com/apikey
2. Vercel → Project → Settings → Environment Variables เพิ่ม `GEMINI_API_KEY` (ไม่บังคับ: `GEMINI_MODEL` ค่าเริ่มต้น `gemini-3.5-flash-lite`, `DAILY_LIMIT` ค่าเริ่มต้น 10 รูป/IP/วัน)
3. Redeploy

ฟังก์ชันอยู่ที่ `api/estimate.js` ตัวนับต่อ IP เก็บในหน่วยความจำ เป็นเพียงด่านกันใช้เกินแบบหยาบ ถ้าเปิดสาธารณะจริงควรเพิ่มที่เก็บภายนอก (เช่น Upstash Redis) และตั้งเพดานงบในบัญชี Google

## หมายเหตุ
- ถ่ายรูปให้ AI: เมื่อเปิดใน Claude ใช้ Claude ของผู้ดู เมื่อเปิดบนเว็บทั่วไปจะเรียก `/api/estimate` (Gemini)
- เว็บแอปอ่านข้อมูล Apple Health / Health Connect โดยตรงไม่ได้ ต้องพิมพ์ก้าวเดินเอง
- ข้อมูลโภชนาการเป็นค่าประมาณ ไม่ใช่คำแนะนำทางการแพทย์
