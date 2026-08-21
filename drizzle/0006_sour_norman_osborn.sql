ALTER TABLE "memories" ADD COLUMN "agent_id" text;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "session_id" text;--> statement-breakpoint
CREATE INDEX "memories_agent_idx" ON "memories" USING btree ("project_id","environment_id","agent_id");--> statement-breakpoint
CREATE INDEX "memories_session_idx" ON "memories" USING btree ("project_id","environment_id","session_id");