# ลบการเชื่อมต่อ Google Sheets ทั้งหมด → ใช้ Supabase อย่างเดียว

สรุปสิ่งที่แก้ไขในรอบนี้:

## 1. ข้อมูลหลัก (rooms/tenants/invoices/repairs/ledger ฯลฯ)
ระบบใช้ Supabase (`/rest/v1/apartment_state`) เป็นฐานข้อมูลหลักอยู่แล้ว — จุดนี้ไม่มีการเชื่อมต่อ
Google Sheets เหลืออยู่ แต่ในโค้ดเดิมยังมีชื่อฟังก์ชัน/ตัวแปร/ข้อความหน้าเว็บที่ค้างเป็นชื่อ "Sheet"
จากยุคก่อนย้ายมา Supabase อยู่มาก จึงได้:
- ลบฟังก์ชัน alias เดิม `getSavedSheetUrl()`, `pullFromGoogleSheets()`, `syncToGoogleSheets()` ออก
  แล้วเปลี่ยนไปเรียก `getSavedSupabaseUrl()`, `pullFromSupabase()`, `syncToSupabase()` ตรง ๆ
- แก้บั๊กจริงที่พบ: ช่องกรอก "Supabase Project URL" ในหน้าตั้งค่า มี id ไม่ตรงกับโค้ดปุ่มบันทึก
  (`sheets-url-input` vs ที่โค้ดค้นหา `supabase-url-input`) ทำให้กดบันทึก URL ไม่เคยทำงานจริง — แก้ไขแล้ว
- เปลี่ยนพารามิเตอร์ลิงก์ผู้เช่าจาก `?sheetUrl=` เป็น `?supabaseUrl=` (ฝั่ง tenant-app.js ยังรับพารามิเตอร์
  ชื่อเก่า `sheetUrl` ได้ด้วยเพื่อไม่ให้ลิงก์เก่าที่เคยส่งไปแล้วพัง)
- อัปเดตข้อความในหน้าเว็บ (ตั้งค่า, ออกบิลกลุ่ม, สำรองบิล, แจ้งเตือน ฯลฯ) ที่เคยพูดถึง
  "Google Sheets" / "ชีต" / "Google Drive" ให้ตรงกับความจริงว่าใช้ Supabase (Database + Storage)
- แก้ไฟล์ `app.js` ที่มีข้อมูลเสียหายอยู่เดิม (ไบต์ขาดหายบางจุดทำให้ JS พังทั้งไฟล์) ให้กลับมารันได้ปกติ

## 2. LINE Bot (จุดเดียวที่ยังพึ่ง Google Apps Script จริง ๆ)
ปุ่ม "ส่ง LINE Bot แจ้งเตือน" ในหน้าแอดมิน เดิมยิง POST ตรงไปยัง Google Apps Script Web App
(`Code.gs` → `doPost` → action `linePushNotify`) เพื่อยิงข้อความ Broadcast ผ่าน LINE Messaging API
และ Google Apps Script ตัวเดิมก็เป็นตัวรับ Webhook ขาเข้าจาก LINE (ตอบแชทอัตโนมัติ) ด้วย

จุดนี้ย้ายมาเป็น **Supabase Edge Function** แล้ว:
- ไฟล์ใหม่: `supabase/functions/line-notify/index.ts`
- ทำหน้าที่แทน `Code.gs` ทั้งสองอย่าง: (1) รับคำสั่งจากปุ่มในแอดมิน แล้ว broadcast เข้า LINE
  (2) รับ Webhook ขาเข้าจาก LINE แล้วตอบข้อความอัตโนมัติแบบเดิมทุกประการ (เช็คเลขห้อง/คำสั่งช่วยเหลือ/ข้อความต้อนรับ)
- `app.js` แก้ไขให้ปุ่ม "ส่ง LINE Bot" เรียก `${supabaseUrl}/functions/v1/line-notify` แทนลิงก์ Apps Script เดิม

### วิธี Deploy Edge Function (ต้องทำเองครั้งเดียว)
```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy line-notify --no-verify-jwt
```

### ตั้งค่า Secret (ถ้ายังไม่ได้บันทึก LINE Token ไว้ในหน้า "ตั้งค่า" ของแอป)
```bash
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN="xxxxxxxx"
# ถ้าต้องการให้ตรวจสอบลายเซ็น Webhook จาก LINE ด้วย (แนะนำ)
supabase secrets set LINE_CHANNEL_SECRET="xxxxxxxx"
```

### ตั้งค่า Webhook URL ฝั่ง LINE Developers Console
ไปที่ Messaging API > Webhook settings แล้วใส่:
```
https://<your-project-ref>.functions.supabase.co/line-notify
```

## 3. ไฟล์ที่ลบออก
- `Code.gs` (Google Apps Script backend เดิม) — ลบทิ้งทั้งหมด ไม่ใช้แล้ว

## 4. โฟลเดอร์ `js/` และ `src/`
โฟลเดอร์เหล่านี้ (คอมโพเนนต์ JS แยกไฟล์ และ TypeScript version) ไม่ได้ถูกโหลดใช้งานจริงโดย
`index.html` หรือ `tenant.html` เลย (ทั้งสองหน้าโหลดเฉพาะ `app.js` และ `tenant-app.js` ที่ root)
เป็นโครงสร้างเก่าที่เลิกใช้ไปแล้ว — **ลบออกแล้ว** ในรอบนี้
