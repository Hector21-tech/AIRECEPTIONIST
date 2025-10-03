CREATE TABLE "call_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"datetime" timestamp DEFAULT now() NOT NULL,
	"transcript" text,
	"outcome" varchar(50) NOT NULL,
	"duration" numeric(10, 2),
	"cost" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"contact_name" varchar(100),
	"contact_phone" varchar(20),
	"contact_email" varchar(255),
	"twilio_number" varchar(20),
	"voice_id" varchar(50),
	"plan_type" varchar(50) DEFAULT 'Standard' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"method" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"config" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"date" date NOT NULL,
	"minutes_used" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"revenue" numeric(10, 2) DEFAULT '0' NOT NULL,
	"margin" numeric(10, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;