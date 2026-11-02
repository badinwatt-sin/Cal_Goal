// ตั้งค่าการล็อกอิน (Supabase) — ถ้าเว้นว่าง แอปจะทำงานแบบไม่ล็อกอิน (เก็บข้อมูลในเครื่อง)
// ค่า anon key เป็นกุญแจสาธารณะ ปลอดภัยที่จะวางไว้ที่นี่ เพราะข้อมูลถูกป้องกันด้วย Row Level Security
window.KAELPODI_CONFIG = {
  supabaseUrl: '',      // เช่น https://xxxxxxxx.supabase.co
  supabaseAnonKey: '',  // Project Settings → API → anon public
  google: true          // ตั้งเป็น false ถ้าไม่เปิด Google login
};
