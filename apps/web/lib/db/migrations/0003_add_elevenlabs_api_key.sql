-- Add elevenlabsApiKey field to customers table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'customers' AND column_name = 'elevenlabs_api_key') THEN
        ALTER TABLE "customers" ADD COLUMN "elevenlabs_api_key" varchar(200);
    END IF;
END $$;--> statement-breakpoint

-- Add agent_id field to customers table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'customers' AND column_name = 'agent_id') THEN
        ALTER TABLE "customers" ADD COLUMN "agent_id" varchar(50);
    END IF;
END $$;--> statement-breakpoint