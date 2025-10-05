-- Add auto-update fields to customers table
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "update_frequency" varchar(20) DEFAULT 'none';
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "has_daily_special" varchar(5) DEFAULT 'false';
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "daily_update_time" varchar(5);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "last_daily_hash" varchar(64);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "last_update_date" timestamp;
