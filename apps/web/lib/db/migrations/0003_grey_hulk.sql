CREATE TABLE "automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"trigger_type" varchar(50) NOT NULL,
	"trigger_config" text,
	"actions" text,
	"runs" integer DEFAULT 0 NOT NULL,
	"last_run" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "audio_data" text;--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "audio_file_name" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "agent_id" varchar(50);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "elevenlabs_api_key" varchar(200);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "webhook_twilio_status" varchar(20) DEFAULT 'inactive';--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "webhook_elevenlabs_status" varchar(20) DEFAULT 'inactive';--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "webhook_twilio_url" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "webhook_elevenlabs_url" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "restaurant_slug" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "knowledge_base_id" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "update_frequency" varchar(20) DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "has_daily_special" varchar(5) DEFAULT 'false';--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "daily_update_time" varchar(5);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "last_daily_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "last_update_date" timestamp;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN "voice_id";