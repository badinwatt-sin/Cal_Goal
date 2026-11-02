// ตั้งค่าการล็อกอิน (Supabase) — ถ้าเว้นว่าง แอปจะทำงานแบบไม่ล็อกอิน (เก็บข้อมูลในเครื่อง)
// ค่า publishable (anon) key เป็นกุญแจสาธารณะ ปลอดภัยที่จะวางไว้ที่นี่ เพราะข้อมูลถูกป้องกันด้วย Row Level Security
window.KAELPODI_CONFIG = {
  supabaseUrl: 'https://ytkdlehpdhtymakyioxc.supabase.co',
  supabaseAnonKey: 'sb_publishable_Y7hvkFjOte___fwe9IeWEg_i_C1uEtG',
  google: false  // ตั้งเป็น true เมื่อเปิด Google provider ใน Supabase แล้ว
};
