-- Adds `admin` and `member` to membership_role, by recreating the type rather
-- than using ALTER TYPE ... ADD VALUE.
--
-- Postgres refuses to *use* a new enum value in the transaction that added it
-- ("unsafe use of new value ... New enum values must be committed before they
-- can be used"), and drizzle applies every pending migration inside one
-- transaction — so ADD VALUE followed by a column defaulting to 'member' can
-- never work here, not even split across two migration files.
--
-- A type created in the current transaction has no such restriction, so the
-- type is rebuilt and renamed into place instead. The USING cast goes via text
-- because there is no implicit cast between two enum types.
CREATE TYPE "public"."membership_role_new" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "role" TYPE "public"."membership_role_new" USING "role"::text::"public"."membership_role_new";--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "role" SET DEFAULT 'owner';--> statement-breakpoint
DROP TYPE "public"."membership_role";--> statement-breakpoint
ALTER TYPE "public"."membership_role_new" RENAME TO "membership_role";--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" uuid,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"sent_count" integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_idx" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitations_org_status_idx" ON "invitations" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "invitations_org_email_idx" ON "invitations" USING btree ("org_id","email");
