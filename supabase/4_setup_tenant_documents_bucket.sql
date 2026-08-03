-- ตั้งค่า Storage bucket ใหม่สำหรับเอกสารผู้เช่า (สำเนาบัตร ปชช. / ทะเบียนบ้าน / อื่นๆ)
-- รันไฟล์นี้ใน Supabase SQL Editor ครั้งเดียว หลังจากที่แก้ app.js ให้อัปโหลดไฟล์ขึ้น Storage แล้ว
-- (ทำแบบเดียวกับ bucket "slips" ที่ใช้อยู่แล้วสำหรับสลิปโอนเงินฝั่งผู้เช่า)

-- 1) สร้าง bucket แบบ public (ถ้ายังไม่มี)
insert into storage.buckets (id, name, public)
values ('tenant-documents', 'tenant-documents', true)
on conflict (id) do nothing;

-- 2) เปิดสิทธิ์ให้ anon key (แอดมิน) อัปโหลด/อ่าน/ลบไฟล์ใน bucket นี้ได้
--    (ตรงกับโมเดล "allow all" แบบเดียวกับตารางอื่นๆ ในโปรเจกต์นี้ - ยังไม่มี RLS ตาม role จริง)
--    หมายเหตุ: Postgres ไม่มี "create policy if not exists" จึง drop ก่อนแล้วค่อย create
drop policy if exists "tenant-documents allow all select" on storage.objects;
create policy "tenant-documents allow all select"
  on storage.objects for select
  using (bucket_id = 'tenant-documents');

drop policy if exists "tenant-documents allow all insert" on storage.objects;
create policy "tenant-documents allow all insert"
  on storage.objects for insert
  with check (bucket_id = 'tenant-documents');

drop policy if exists "tenant-documents allow all update" on storage.objects;
create policy "tenant-documents allow all update"
  on storage.objects for update
  using (bucket_id = 'tenant-documents');

drop policy if exists "tenant-documents allow all delete" on storage.objects;
create policy "tenant-documents allow all delete"
  on storage.objects for delete
  using (bucket_id = 'tenant-documents');

-- หมายเหตุ: ถ้าใน Supabase Dashboard คุณสร้าง bucket "slips" ด้วยมือ (ไม่ใช่ผ่าน SQL)
-- และมันมีนโยบายลักษณะเดียวกันอยู่แล้ว สามารถข้ามไฟล์นี้แล้วสร้าง bucket "tenant-documents"
-- ผ่านหน้า Dashboard → Storage → New bucket (ตั้งชื่อ "tenant-documents" และติ๊ก Public) แทนก็ได้
