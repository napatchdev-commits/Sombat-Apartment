-- รันชุดนี้ก่อน แล้วค่อยรัน 1_schema.sql ใหม่อีกครั้ง
-- (แก้ error 42P13: cannot change return type of existing function)
drop function if exists public.get_room_list();
drop function if exists public.get_tenant_bill(text, text);
drop function if exists public.submit_tenant_payment(text, text, text, text, text);
drop function if exists public.submit_tenant_repair(text, text, text, text, text);

-- ถ้าเคยรัน 5_generate_room_invoice_rpc.sql หรือ 6_invoice_extra_fees_and_rpc_v2.sql ไปแล้วด้วย
-- ให้ drop อันนี้ก่อนด้วย ป้องกัน error เดียวกันตอนรัน 1_schema.sql ทับ
drop function if exists public.generate_room_invoice(text, text, numeric, numeric, date, date, numeric, boolean);
drop function if exists public.generate_room_invoice(text, text, numeric, numeric, date, date, numeric, boolean, numeric, numeric);
