import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_writing_tasks_chart_source" AS ENUM('vision', 'manual');
  CREATE TYPE "public"."enum__writing_tasks_v_version_chart_source" AS ENUM('vision', 'manual');
  CREATE TYPE "public"."enum_writing_reviews_status" AS ENUM('pending', 'done', 'failed');
  CREATE TABLE "writing_reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"task_id" integer NOT NULL,
  	"status" "enum_writing_reviews_status" DEFAULT 'pending' NOT NULL,
  	"overall" numeric,
  	"essay" varchar NOT NULL,
  	"essay_hash" varchar,
  	"words" numeric,
  	"criteria" jsonb,
  	"paragraphs" jsonb,
  	"rewrites" jsonb,
  	"length_note" varchar,
  	"fail_reason" varchar,
  	"spend_entry_id" integer,
  	"refund_entry_id" integer,
  	"usage" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "answer_explanations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"cache_key" varchar NOT NULL,
  	"unit_id" varchar,
  	"number" numeric,
  	"answer" varchar,
  	"body" varchar NOT NULL,
  	"usage" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "explanation_unlocks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"cache_key" varchar NOT NULL,
  	"key" varchar NOT NULL,
  	"spend_entry_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "writing_tasks" ADD COLUMN "chart_data" varchar;
  ALTER TABLE "writing_tasks" ADD COLUMN "chart_checked" boolean;
  ALTER TABLE "writing_tasks" ADD COLUMN "chart_source" "enum_writing_tasks_chart_source";
  ALTER TABLE "_writing_tasks_v" ADD COLUMN "version_chart_data" varchar;
  ALTER TABLE "_writing_tasks_v" ADD COLUMN "version_chart_checked" boolean;
  ALTER TABLE "_writing_tasks_v" ADD COLUMN "version_chart_source" "enum__writing_tasks_v_version_chart_source";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "writing_reviews_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "answer_explanations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "explanation_unlocks_id" integer;
  ALTER TABLE "ai_settings" ADD COLUMN "vision_model" varchar DEFAULT 'deepseek-flash';
  ALTER TABLE "writing_reviews" ADD CONSTRAINT "writing_reviews_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "writing_reviews" ADD CONSTRAINT "writing_reviews_task_id_writing_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."writing_tasks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "writing_reviews" ADD CONSTRAINT "writing_reviews_spend_entry_id_credit_entries_id_fk" FOREIGN KEY ("spend_entry_id") REFERENCES "public"."credit_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "writing_reviews" ADD CONSTRAINT "writing_reviews_refund_entry_id_credit_entries_id_fk" FOREIGN KEY ("refund_entry_id") REFERENCES "public"."credit_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "explanation_unlocks" ADD CONSTRAINT "explanation_unlocks_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "explanation_unlocks" ADD CONSTRAINT "explanation_unlocks_spend_entry_id_credit_entries_id_fk" FOREIGN KEY ("spend_entry_id") REFERENCES "public"."credit_entries"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "writing_reviews_member_idx" ON "writing_reviews" USING btree ("member_id");
  CREATE INDEX "writing_reviews_task_idx" ON "writing_reviews" USING btree ("task_id");
  CREATE INDEX "writing_reviews_status_idx" ON "writing_reviews" USING btree ("status");
  CREATE INDEX "writing_reviews_essay_hash_idx" ON "writing_reviews" USING btree ("essay_hash");
  CREATE INDEX "writing_reviews_spend_entry_idx" ON "writing_reviews" USING btree ("spend_entry_id");
  CREATE INDEX "writing_reviews_refund_entry_idx" ON "writing_reviews" USING btree ("refund_entry_id");
  CREATE INDEX "writing_reviews_updated_at_idx" ON "writing_reviews" USING btree ("updated_at");
  CREATE INDEX "writing_reviews_created_at_idx" ON "writing_reviews" USING btree ("created_at");
  CREATE UNIQUE INDEX "answer_explanations_cache_key_idx" ON "answer_explanations" USING btree ("cache_key");
  CREATE INDEX "answer_explanations_unit_id_idx" ON "answer_explanations" USING btree ("unit_id");
  CREATE INDEX "answer_explanations_updated_at_idx" ON "answer_explanations" USING btree ("updated_at");
  CREATE INDEX "answer_explanations_created_at_idx" ON "answer_explanations" USING btree ("created_at");
  CREATE INDEX "explanation_unlocks_member_idx" ON "explanation_unlocks" USING btree ("member_id");
  CREATE UNIQUE INDEX "explanation_unlocks_key_idx" ON "explanation_unlocks" USING btree ("key");
  CREATE INDEX "explanation_unlocks_spend_entry_idx" ON "explanation_unlocks" USING btree ("spend_entry_id");
  CREATE INDEX "explanation_unlocks_updated_at_idx" ON "explanation_unlocks" USING btree ("updated_at");
  CREATE INDEX "explanation_unlocks_created_at_idx" ON "explanation_unlocks" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_writing_reviews_fk" FOREIGN KEY ("writing_reviews_id") REFERENCES "public"."writing_reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_answer_explanations_fk" FOREIGN KEY ("answer_explanations_id") REFERENCES "public"."answer_explanations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_explanation_unlocks_fk" FOREIGN KEY ("explanation_unlocks_id") REFERENCES "public"."explanation_unlocks"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_writing_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("writing_reviews_id");
  CREATE INDEX "payload_locked_documents_rels_answer_explanations_id_idx" ON "payload_locked_documents_rels" USING btree ("answer_explanations_id");
  CREATE INDEX "payload_locked_documents_rels_explanation_unlocks_id_idx" ON "payload_locked_documents_rels" USING btree ("explanation_unlocks_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "writing_reviews" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "answer_explanations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "explanation_unlocks" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "writing_reviews" CASCADE;
  DROP TABLE "answer_explanations" CASCADE;
  DROP TABLE "explanation_unlocks" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_writing_reviews_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_answer_explanations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_explanation_unlocks_fk";
  
  DROP INDEX "payload_locked_documents_rels_writing_reviews_id_idx";
  DROP INDEX "payload_locked_documents_rels_answer_explanations_id_idx";
  DROP INDEX "payload_locked_documents_rels_explanation_unlocks_id_idx";
  ALTER TABLE "writing_tasks" DROP COLUMN "chart_data";
  ALTER TABLE "writing_tasks" DROP COLUMN "chart_checked";
  ALTER TABLE "writing_tasks" DROP COLUMN "chart_source";
  ALTER TABLE "_writing_tasks_v" DROP COLUMN "version_chart_data";
  ALTER TABLE "_writing_tasks_v" DROP COLUMN "version_chart_checked";
  ALTER TABLE "_writing_tasks_v" DROP COLUMN "version_chart_source";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "writing_reviews_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "answer_explanations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "explanation_unlocks_id";
  ALTER TABLE "ai_settings" DROP COLUMN "vision_model";
  DROP TYPE "public"."enum_writing_tasks_chart_source";
  DROP TYPE "public"."enum__writing_tasks_v_version_chart_source";
  DROP TYPE "public"."enum_writing_reviews_status";`)
}
