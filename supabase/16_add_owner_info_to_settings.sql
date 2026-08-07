-- SQL Migration: Add owner info and apartment info fields to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS owner_id_card TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS owner_address TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS owner_tel TEXT;
