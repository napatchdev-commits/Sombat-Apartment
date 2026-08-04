-- ============================================================================
-- 16) ตั้งค่า Storage bucket "slips" สำหรับเก็บรูปสลิปโอนเงินของผู้เช่า
--     แก้ปัญหา: อัปโหลดสลิปไม่สำเร็จ 403 Unauthorized
--     "new row violates row-level security policy" (AccessDenied)
--
--     สาเหตุ: bucket "slips" ไม่เคยถูกสร้าง policy ให้ insert/select ได้
--     (ต่างจาก bucket "tenant-documents" ที่มี policy ในไฟล์ 4_ อยู่แล้ว)
--     รันไฟล์นี้ใน Supabase SQL Editor ครั้งเดียว
-- ============================================================================

-- 1) สร้าง bucket "slips" แบบ public (ถ้ายังไม่มี)
insert into storage.buckets (id, name, public)
values ('slips', 'slips', true)
on conflict (id) do nothing;

-- 2) เปิดสิทธิ์ให้ anon key (ผู้เช่า/แอดมิน) อัปโหลด/อ่าน/ลบไฟล์ใน bucket นี้ได้
--    (โมเดล "allow all" แบบเดียวกับ tenant-documents - ยังไม่มี RLS ตาม role จริง)
--    หมายเหตุ: Postgres ไม่มี "create policy if not exists" จึง drop ก่อนแล้วค่อย create
drop policy if exists "slips allow all select" on storage.objects;
create policy "slips allow all select"
  on storage.objects for select
  using (bucket_id = 'slips');

drop policy if exists "slips allow all insert" on storage.objects;
create policy "slips allow all insert"
  on storage.objects for insert
  with check (bucket_id = 'slips');

drop policy if exists "slips allow all update" on storage.objects;
create policy "slips allow all update"
  on storage.objects for update
  using (bucket_id = 'slips');

drop policy if exists "slips allow all delete" on storage.objects;
create policy "slips allow all delete"
  on storage.objects for delete
  using (bucket_id = 'slips');

-- หมายเหตุ: ถ้าใน Supabase Dashboard คุณสร้าง bucket "slips" ด้วยมือไว้แล้ว
-- (public หรือ private ก็ตาม) สคริปต์นี้จะไม่สร้างซ้ำ (on conflict do nothing)
-- แต่จะเพิ่ม policy การเข้าถึงให้ครบ 4 อย่าง (select/insert/update/delete) ให้เอง
