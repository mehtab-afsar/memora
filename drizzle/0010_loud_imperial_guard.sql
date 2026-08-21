CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"end_user_id" text NOT NULL,
	"content" text NOT NULL,
	"source_memory_ids" jsonb NOT NULL,
	"memory_count" integer NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_scope_idx" ON "user_profiles" USING btree ("project_id","environment_id","end_user_id");