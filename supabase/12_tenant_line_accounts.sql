-- Migration: Create tenant_line_accounts table for LINE Account Linking
create table if not exists public.tenant_line_accounts (
  id uuid default gen_random_uuid() primary key,
  tenant_id text not null unique references public.tenants(id) on delete cascade,
  room_id text not null references public.rooms(id) on delete cascade,
  line_user_id text not null unique,
  display_name text,
  picture_url text,
  linked_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.tenant_line_accounts enable row level security;

-- Drop existing policies if any
drop policy if exists "Allow admins full access to tenant_line_accounts" on public.tenant_line_accounts;
drop policy if exists "Allow select for anon to tenant_line_accounts" on public.tenant_line_accounts;
drop policy if exists "Allow delete for anon to tenant_line_accounts" on public.tenant_line_accounts;

-- 1) Admin policy (allows all access)
create policy "Allow admins full access to tenant_line_accounts"
  on public.tenant_line_accounts
  for all
  using (true)
  with check (true);

-- 2) Select policy (allows anon users to fetch linking details)
create policy "Allow select for anon to tenant_line_accounts"
  on public.tenant_line_accounts
  for select
  using (true);

-- 3) Delete policy (allows anon users to delete linking details)
create policy "Allow delete for anon to tenant_line_accounts"
  on public.tenant_line_accounts
  for delete
  using (true);

-- RPC function to unlink LINE account safely using security definer
create or replace function public.unlink_tenant_line_account(p_tenant_id text)
returns json
language plpgsql
security definer
as $$
begin
  delete from public.tenant_line_accounts where tenant_id = p_tenant_id;
  return json_build_object('status', 'success', 'message', 'ยกเลิกการเชื่อมต่อ LINE สำเร็จ');
end;
$$;

-- Grant execute permissions to anon and authenticated users
grant execute on function public.unlink_tenant_line_account(text) to anon, authenticated;
