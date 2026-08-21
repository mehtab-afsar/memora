CREATE TYPE "public"."erasure_via" AS ENUM('api', 'dashboard');--> statement-breakpoint
CREATE TABLE "erasure_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"subject_hash" text NOT NULL,
	"memories_erased" integer NOT NULL,
	"profiles_erased" integer NOT NULL,
	"requested_via" "erasure_via" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erasure_records" ADD CONSTRAINT "erasure_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erasure_records" ADD CONSTRAINT "erasure_records_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "erasure_records_scope_idx" ON "erasure_records" USING btree ("project_id","environment_id","created_at");--> statement-breakpoint
CREATE INDEX "erasure_records_subject_idx" ON "erasure_records" USING btree ("subject_hash");