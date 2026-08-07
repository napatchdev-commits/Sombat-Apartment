-- SQL Migration: Add invoice_id to ledger table
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS invoice_id TEXT;
