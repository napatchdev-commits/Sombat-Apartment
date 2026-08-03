-- Migration: Add witness1 and witness2 columns to tenants table
alter table public.tenants add column if not exists witness1 text;
alter table public.tenants add column if not exists witness2 text;
