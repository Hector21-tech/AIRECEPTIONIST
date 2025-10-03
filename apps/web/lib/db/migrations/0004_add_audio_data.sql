-- Add audio_data field to call_logs table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'call_logs' AND column_name = 'audio_data') THEN
        ALTER TABLE "call_logs" ADD COLUMN "audio_data" text;
    END IF;
END $$;