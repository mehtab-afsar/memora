ALTER TABLE "memories" ADD COLUMN "recall_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "last_recalled_at" timestamp with time zone;