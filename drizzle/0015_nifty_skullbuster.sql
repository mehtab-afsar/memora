CREATE TABLE "agent_init_attempts" (
	"ip_hash" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_claim_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "org_claim_tokens" ADD CONSTRAINT "org_claim_tokens_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_claim_tokens" ADD CONSTRAINT "org_claim_tokens_claimed_by_user_id_users_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_init_attempts_ip_window_idx" ON "agent_init_attempts" USING btree ("ip_hash","window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "org_claim_tokens_token_hash_idx" ON "org_claim_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "org_claim_tokens_org_id_idx" ON "org_claim_tokens" USING btree ("org_id");