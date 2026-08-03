-- ============================================================================
-- แก้บั๊ก: หน้าจ่ายเงินของผู้เช่า (tenant-app.js) แสดง "เลขพร้อมเพย์"/บัญชีธนาคาร
-- เป็นค่าตัวอย่าง/เดโมที่ฝังไว้ในโค้ด ไม่ใช่ค่าจริงที่แอดมินตั้งไว้ในหน้า "ตั้งค่า"
-- สาเหตุ: get_tenant_bill() เดิมส่งกลับ settings แค่ apartmentName เท่านั้น ทำให้
-- ฝั่งผู้เช่าไม่มีทางรู้ค่า promptPayId / เลขบัญชี / ชื่อบัญชีจริง เลยใช้ค่า fallback ที่ฝังในโค้ดเสมอ
--
-- รันไฟล์นี้ใน Supabase SQL Editor (แทนที่ get_tenant_bill เดิม ไม่ต้อง drop ก่อน
-- เพราะ signature และ return type เหมือนเดิม)
-- ============================================================================

create or replace function public.get_tenant_bill(p_id_card text, p_room_id text)
returns json
language plpgsql
security definer
as $$
declare
  v_tenant record;
begin
  select * into v_tenant
  from public.tenants
  where assigned_room_id = p_room_id
    and regexp_replace(id_card, '\D', '', 'g') = regexp_replace(p_id_card, '\D', '', 'g')
  limit 1;

  if not found then
    return json_build_object('status', 'error', 'message', 'ไม่พบข้อมูลผู้เช่า หรือเลขบัตรไม่ตรงกับห้องนี้');
  end if;

  return json_build_object(
    'status', 'success',
    'settings', (select json_build_object(
                  'apartmentName', apartment_name,
                  'tel', tel,
                  'promptPayId', prompt_pay_id,
                  'bankName', bank_name,
                  'bankAccountNo', bank_account_no,
                  'bankAccountName', bank_account_name
                ) from public.settings where id = 1),
    'room', (select json_build_object(
               'id', id, 'name', name, 'floor', floor, 'baseRent', base_rent,
               'status', status, 'lastElecMeter', last_elec_meter, 'lastWaterMeter', last_water_meter
             ) from public.rooms where id = p_room_id),
    'tenant', json_build_object(
               'id', v_tenant.id, 'name', v_tenant.name, 'idCard', v_tenant.id_card,
               'tel', v_tenant.tel, 'email', v_tenant.email, 'assignedRoomId', v_tenant.assigned_room_id
             ),
    'invoices', coalesce((
               select json_agg(json_build_object(
                 'id', id, 'invoiceNumber', invoice_number, 'monthKey', month_key,
                 'roomId', room_id, 'roomName', room_name, 'issueDate', issue_date, 'dueDate', due_date,
                 'waterPrev', water_prev, 'waterCurr', water_curr, 'waterAmount', water_amount,
                 'elecPrev', elec_prev, 'elecCurr', elec_curr, 'elecAmount', elec_amount,
                 'rentAmount', rent_amount, 'trashFee', trash_fee, 'fineAmount', fine_amount,
                 'internetFee', internet_fee, 'commonFee', common_fee,
                 'totalAmount', total_amount, 'paidAmount', paid_amount, 'outstandingAmount', outstanding_amount,
                 'status', status, 'slipUrl', slip_url
               ) order by month_key desc)
               from public.invoices where room_id = p_room_id
             ), '[]'::json),
    'repairs', coalesce((
               select json_agg(json_build_object(
                 'id', id, 'ticketNumber', ticket_number, 'title', title, 'description', description,
                 'status', status, 'requestDate', request_date
               ) order by request_date desc)
               from public.repairs where room_id = p_room_id
             ), '[]'::json),
    'events', '[]'::json
  );
end;
$$;

grant execute on function public.get_tenant_bill(text, text) to anon, authenticated;
