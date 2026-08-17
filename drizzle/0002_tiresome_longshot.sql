CREATE TYPE "public"."experience_outcome" AS ENUM('success', 'failure');--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"task" text NOT NULL,
	"action" text NOT NULL,
	"context" text,
	"outcome" "experience_outcome" NOT NULL,
	"cause" text,
	"resolution" text,
	"lesson" text NOT NULL,
	"embedding" vector(1024),
	"source_type" text NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experiences_scope_idx" ON "experiences" USING btree ("project_id","environment_id");--> statement-breakpoint
CREATE INDEX "experiences_embedding_idx" ON "experiences" USING hnsw ("embedding" vector_cosine_ops);