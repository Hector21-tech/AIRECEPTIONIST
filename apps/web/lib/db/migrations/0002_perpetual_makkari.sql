ALTER TABLE "call_logs" ALTER COLUMN "duration" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "call_logs" ALTER COLUMN "cost" SET DATA TYPE numeric(10, 4);--> statement-breakpoint
ALTER TABLE "usage" ALTER COLUMN "cost" SET DATA TYPE numeric(10, 4);--> statement-breakpoint
ALTER TABLE "usage" ALTER COLUMN "cost" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "call_sid" varchar(100);--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "from_number" varchar(20);--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "to_number" varchar(20);--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "elevenlabs_cost" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "call_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;