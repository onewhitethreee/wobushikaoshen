import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tests_listening_parts_g_q_answer_status" AS ENUM('auto', 'pending', 'confirmed');
  CREATE TYPE "public"."enum_tests_reading_passages_g_q_answer_status" AS ENUM('auto', 'pending', 'confirmed');
  CREATE TYPE "public"."enum____tests_v_version_listening_parts_g_v_q_v_answer_status" AS ENUM('auto', 'pending', 'confirmed');
  CREATE TYPE "public"."enum____tests_v_version_reading_passages_g_v_q_v_answer_status" AS ENUM('auto', 'pending', 'confirmed');
  CREATE TYPE "public"."enum_units_g_q_answer_status" AS ENUM('auto', 'pending', 'confirmed');
  CREATE TYPE "public"."enum_units_g_type" AS ENUM('single_choice', 'multi_choice', 'tfng', 'ynng', 'matching_headings', 'matching_information', 'matching_features', 'matching_endings', 'completion', 'short_answer', 'labelling');
  CREATE TYPE "public"."enum_units_module" AS ENUM('listening', 'reading');
  CREATE TYPE "public"."enum_units_source_type" AS ENUM('original', 'ai_rewrite', 'repost', 'ai_generated');
  CREATE TYPE "public"."enum_units_source_tag" AS ENUM('9月高频', '9月中频', '10月高频', '10月中频', '全年高频', '增补');
  CREATE TYPE "public"."enum_units_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum____units_v_version_g_v_q_v_answer_status" AS ENUM('auto', 'pending', 'confirmed');
  CREATE TYPE "public"."enum___units_v_version_g_v_type" AS ENUM('single_choice', 'multi_choice', 'tfng', 'ynng', 'matching_headings', 'matching_information', 'matching_features', 'matching_endings', 'completion', 'short_answer', 'labelling');
  CREATE TYPE "public"."enum__units_v_version_module" AS ENUM('listening', 'reading');
  CREATE TYPE "public"."enum__units_v_version_source_type" AS ENUM('original', 'ai_rewrite', 'repost', 'ai_generated');
  CREATE TYPE "public"."enum__units_v_version_source_tag" AS ENUM('9月高频', '9月中频', '10月高频', '10月中频', '全年高频', '增补');
  CREATE TYPE "public"."enum__units_v_version_status" AS ENUM('draft', 'published');
  ALTER TYPE "public"."enum_tests_source_type" ADD VALUE 'repost';
  ALTER TYPE "public"."enum_tests_source_type" ADD VALUE 'ai_generated';
  ALTER TYPE "public"."enum__tests_v_version_source_type" ADD VALUE 'repost';
  ALTER TYPE "public"."enum__tests_v_version_source_type" ADD VALUE 'ai_generated';
  ALTER TYPE "public"."enum_writing_tasks_source_type" ADD VALUE 'repost';
  ALTER TYPE "public"."enum_writing_tasks_source_type" ADD VALUE 'ai_generated';
  ALTER TYPE "public"."enum__writing_tasks_v_version_source_type" ADD VALUE 'repost';
  ALTER TYPE "public"."enum__writing_tasks_v_version_source_type" ADD VALUE 'ai_generated';
  ALTER TYPE "public"."enum_speaking_questions_source_type" ADD VALUE 'repost';
  ALTER TYPE "public"."enum_speaking_questions_source_type" ADD VALUE 'ai_generated';
  ALTER TYPE "public"."enum__speaking_questions_v_version_source_type" ADD VALUE 'repost';
  ALTER TYPE "public"."enum__speaking_questions_v_version_source_type" ADD VALUE 'ai_generated';
  CREATE TABLE "units_g_o" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"text" varchar
  );
  
  CREATE TABLE "units_g_q_o" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"text" varchar
  );
  
  CREATE TABLE "units_g_q" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"span" numeric DEFAULT 1,
  	"prompt" varchar,
  	"answers" varchar,
  	"explanation" varchar,
  	"tip" varchar,
  	"quote" varchar,
  	"evidence" varchar,
  	"answer_status" "enum_units_g_q_answer_status" DEFAULT 'confirmed'
  );
  
  CREATE TABLE "units_g" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_units_g_type",
  	"instructions" varchar,
  	"content" varchar,
  	"image_id" integer,
  	"max_words" numeric,
  	"number_allowed" boolean
  );
  
  CREATE TABLE "units" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"module" "enum_units_module",
  	"part" numeric,
  	"title" varchar,
  	"audio_id" integer,
  	"transcript" jsonb,
  	"passage" jsonb,
  	"source_type" "enum_units_source_type",
  	"source_id" varchar,
  	"source_sets" varchar,
  	"source_tag" "enum_units_source_tag",
  	"pending_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_units_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "___units_v_version_g_v_o_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "____units_v_version_g_v_q_v_o_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "___units_v_version_g_v_q_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"span" numeric DEFAULT 1,
  	"prompt" varchar,
  	"answers" varchar,
  	"explanation" varchar,
  	"tip" varchar,
  	"quote" varchar,
  	"evidence" varchar,
  	"answer_status" "enum____units_v_version_g_v_q_v_answer_status" DEFAULT 'confirmed',
  	"_uuid" varchar
  );
  
  CREATE TABLE "__units_v_version_g_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum___units_v_version_g_v_type",
  	"instructions" varchar,
  	"content" varchar,
  	"image_id" integer,
  	"max_words" numeric,
  	"number_allowed" boolean,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_units_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_module" "enum__units_v_version_module",
  	"version_part" numeric,
  	"version_title" varchar,
  	"version_audio_id" integer,
  	"version_transcript" jsonb,
  	"version_passage" jsonb,
  	"version_source_type" "enum__units_v_version_source_type",
  	"version_source_id" varchar,
  	"version_source_sets" varchar,
  	"version_source_tag" "enum__units_v_version_source_tag",
  	"version_pending_count" numeric DEFAULT 0,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__units_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "tests_listening_parts_g_q" ADD COLUMN "tip" varchar;
  ALTER TABLE "tests_listening_parts_g_q" ADD COLUMN "quote" varchar;
  ALTER TABLE "tests_listening_parts_g_q" ADD COLUMN "evidence" varchar;
  ALTER TABLE "tests_listening_parts_g_q" ADD COLUMN "answer_status" "enum_tests_listening_parts_g_q_answer_status" DEFAULT 'confirmed';
  ALTER TABLE "tests_reading_passages_g_q" ADD COLUMN "tip" varchar;
  ALTER TABLE "tests_reading_passages_g_q" ADD COLUMN "quote" varchar;
  ALTER TABLE "tests_reading_passages_g_q" ADD COLUMN "evidence" varchar;
  ALTER TABLE "tests_reading_passages_g_q" ADD COLUMN "answer_status" "enum_tests_reading_passages_g_q_answer_status" DEFAULT 'confirmed';
  ALTER TABLE "___tests_v_version_listening_parts_g_v_q_v" ADD COLUMN "tip" varchar;
  ALTER TABLE "___tests_v_version_listening_parts_g_v_q_v" ADD COLUMN "quote" varchar;
  ALTER TABLE "___tests_v_version_listening_parts_g_v_q_v" ADD COLUMN "evidence" varchar;
  ALTER TABLE "___tests_v_version_listening_parts_g_v_q_v" ADD COLUMN "answer_status" "enum____tests_v_version_listening_parts_g_v_q_v_answer_status" DEFAULT 'confirmed';
  ALTER TABLE "___tests_v_version_reading_passages_g_v_q_v" ADD COLUMN "tip" varchar;
  ALTER TABLE "___tests_v_version_reading_passages_g_v_q_v" ADD COLUMN "quote" varchar;
  ALTER TABLE "___tests_v_version_reading_passages_g_v_q_v" ADD COLUMN "evidence" varchar;
  ALTER TABLE "___tests_v_version_reading_passages_g_v_q_v" ADD COLUMN "answer_status" "enum____tests_v_version_reading_passages_g_v_q_v_answer_status" DEFAULT 'confirmed';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "units_id" integer;
  ALTER TABLE "units_g_o" ADD CONSTRAINT "units_g_o_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."units_g"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "units_g_q_o" ADD CONSTRAINT "units_g_q_o_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."units_g_q"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "units_g_q" ADD CONSTRAINT "units_g_q_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."units_g"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "units_g" ADD CONSTRAINT "units_g_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "units_g" ADD CONSTRAINT "units_g_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "units" ADD CONSTRAINT "units_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "___units_v_version_g_v_o_v" ADD CONSTRAINT "___units_v_version_g_v_o_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."__units_v_version_g_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "____units_v_version_g_v_q_v_o_v" ADD CONSTRAINT "____units_v_version_g_v_q_v_o_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."___units_v_version_g_v_q_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "___units_v_version_g_v_q_v" ADD CONSTRAINT "___units_v_version_g_v_q_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."__units_v_version_g_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "__units_v_version_g_v" ADD CONSTRAINT "__units_v_version_g_v_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "__units_v_version_g_v" ADD CONSTRAINT "__units_v_version_g_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_units_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_units_v" ADD CONSTRAINT "_units_v_parent_id_units_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_units_v" ADD CONSTRAINT "_units_v_version_audio_id_media_id_fk" FOREIGN KEY ("version_audio_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "units_g_o_order_idx" ON "units_g_o" USING btree ("_order");
  CREATE INDEX "units_g_o_parent_id_idx" ON "units_g_o" USING btree ("_parent_id");
  CREATE INDEX "units_g_q_o_order_idx" ON "units_g_q_o" USING btree ("_order");
  CREATE INDEX "units_g_q_o_parent_id_idx" ON "units_g_q_o" USING btree ("_parent_id");
  CREATE INDEX "units_g_q_order_idx" ON "units_g_q" USING btree ("_order");
  CREATE INDEX "units_g_q_parent_id_idx" ON "units_g_q" USING btree ("_parent_id");
  CREATE INDEX "units_g_order_idx" ON "units_g" USING btree ("_order");
  CREATE INDEX "units_g_parent_id_idx" ON "units_g" USING btree ("_parent_id");
  CREATE INDEX "units_g_image_idx" ON "units_g" USING btree ("image_id");
  CREATE INDEX "units_audio_idx" ON "units" USING btree ("audio_id");
  CREATE UNIQUE INDEX "units_source_id_idx" ON "units" USING btree ("source_id");
  CREATE INDEX "units_source_sets_idx" ON "units" USING btree ("source_sets");
  CREATE INDEX "units_updated_at_idx" ON "units" USING btree ("updated_at");
  CREATE INDEX "units_created_at_idx" ON "units" USING btree ("created_at");
  CREATE INDEX "units__status_idx" ON "units" USING btree ("_status");
  CREATE INDEX "___units_v_version_g_v_o_v_order_idx" ON "___units_v_version_g_v_o_v" USING btree ("_order");
  CREATE INDEX "___units_v_version_g_v_o_v_parent_id_idx" ON "___units_v_version_g_v_o_v" USING btree ("_parent_id");
  CREATE INDEX "____units_v_version_g_v_q_v_o_v_order_idx" ON "____units_v_version_g_v_q_v_o_v" USING btree ("_order");
  CREATE INDEX "____units_v_version_g_v_q_v_o_v_parent_id_idx" ON "____units_v_version_g_v_q_v_o_v" USING btree ("_parent_id");
  CREATE INDEX "___units_v_version_g_v_q_v_order_idx" ON "___units_v_version_g_v_q_v" USING btree ("_order");
  CREATE INDEX "___units_v_version_g_v_q_v_parent_id_idx" ON "___units_v_version_g_v_q_v" USING btree ("_parent_id");
  CREATE INDEX "__units_v_version_g_v_order_idx" ON "__units_v_version_g_v" USING btree ("_order");
  CREATE INDEX "__units_v_version_g_v_parent_id_idx" ON "__units_v_version_g_v" USING btree ("_parent_id");
  CREATE INDEX "__units_v_version_g_v_image_idx" ON "__units_v_version_g_v" USING btree ("image_id");
  CREATE INDEX "_units_v_parent_idx" ON "_units_v" USING btree ("parent_id");
  CREATE INDEX "_units_v_version_version_audio_idx" ON "_units_v" USING btree ("version_audio_id");
  CREATE INDEX "_units_v_version_version_source_id_idx" ON "_units_v" USING btree ("version_source_id");
  CREATE INDEX "_units_v_version_version_source_sets_idx" ON "_units_v" USING btree ("version_source_sets");
  CREATE INDEX "_units_v_version_version_updated_at_idx" ON "_units_v" USING btree ("version_updated_at");
  CREATE INDEX "_units_v_version_version_created_at_idx" ON "_units_v" USING btree ("version_created_at");
  CREATE INDEX "_units_v_version_version__status_idx" ON "_units_v" USING btree ("version__status");
  CREATE INDEX "_units_v_created_at_idx" ON "_units_v" USING btree ("created_at");
  CREATE INDEX "_units_v_updated_at_idx" ON "_units_v" USING btree ("updated_at");
  CREATE INDEX "_units_v_latest_idx" ON "_units_v" USING btree ("latest");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_units_fk" FOREIGN KEY ("units_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_units_id_idx" ON "payload_locked_documents_rels" USING btree ("units_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "units_g_o" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "units_g_q_o" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "units_g_q" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "units_g" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "units" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "___units_v_version_g_v_o_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "____units_v_version_g_v_q_v_o_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "___units_v_version_g_v_q_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "__units_v_version_g_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_units_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "units_g_o" CASCADE;
  DROP TABLE "units_g_q_o" CASCADE;
  DROP TABLE "units_g_q" CASCADE;
  DROP TABLE "units_g" CASCADE;
  DROP TABLE "units" CASCADE;
  DROP TABLE "___units_v_version_g_v_o_v" CASCADE;
  DROP TABLE "____units_v_version_g_v_q_v_o_v" CASCADE;
  DROP TABLE "___units_v_version_g_v_q_v" CASCADE;
  DROP TABLE "__units_v_version_g_v" CASCADE;
  DROP TABLE "_units_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_units_fk";
  
  ALTER TABLE "tests" ALTER COLUMN "source_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_tests_source_type";
  CREATE TYPE "public"."enum_tests_source_type" AS ENUM('original', 'ai_rewrite');
  ALTER TABLE "tests" ALTER COLUMN "source_type" SET DATA TYPE "public"."enum_tests_source_type" USING "source_type"::"public"."enum_tests_source_type";
  ALTER TABLE "_tests_v" ALTER COLUMN "version_source_type" SET DATA TYPE text;
  DROP TYPE "public"."enum__tests_v_version_source_type";
  CREATE TYPE "public"."enum__tests_v_version_source_type" AS ENUM('original', 'ai_rewrite');
  ALTER TABLE "_tests_v" ALTER COLUMN "version_source_type" SET DATA TYPE "public"."enum__tests_v_version_source_type" USING "version_source_type"::"public"."enum__tests_v_version_source_type";
  ALTER TABLE "writing_tasks" ALTER COLUMN "source_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_writing_tasks_source_type";
  CREATE TYPE "public"."enum_writing_tasks_source_type" AS ENUM('original', 'ai_rewrite');
  ALTER TABLE "writing_tasks" ALTER COLUMN "source_type" SET DATA TYPE "public"."enum_writing_tasks_source_type" USING "source_type"::"public"."enum_writing_tasks_source_type";
  ALTER TABLE "_writing_tasks_v" ALTER COLUMN "version_source_type" SET DATA TYPE text;
  DROP TYPE "public"."enum__writing_tasks_v_version_source_type";
  CREATE TYPE "public"."enum__writing_tasks_v_version_source_type" AS ENUM('original', 'ai_rewrite');
  ALTER TABLE "_writing_tasks_v" ALTER COLUMN "version_source_type" SET DATA TYPE "public"."enum__writing_tasks_v_version_source_type" USING "version_source_type"::"public"."enum__writing_tasks_v_version_source_type";
  ALTER TABLE "speaking_questions" ALTER COLUMN "source_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_speaking_questions_source_type";
  CREATE TYPE "public"."enum_speaking_questions_source_type" AS ENUM('original', 'ai_rewrite');
  ALTER TABLE "speaking_questions" ALTER COLUMN "source_type" SET DATA TYPE "public"."enum_speaking_questions_source_type" USING "source_type"::"public"."enum_speaking_questions_source_type";
  ALTER TABLE "_speaking_questions_v" ALTER COLUMN "version_source_type" SET DATA TYPE text;
  DROP TYPE "public"."enum__speaking_questions_v_version_source_type";
  CREATE TYPE "public"."enum__speaking_questions_v_version_source_type" AS ENUM('original', 'ai_rewrite');
  ALTER TABLE "_speaking_questions_v" ALTER COLUMN "version_source_type" SET DATA TYPE "public"."enum__speaking_questions_v_version_source_type" USING "version_source_type"::"public"."enum__speaking_questions_v_version_source_type";
  DROP INDEX "payload_locked_documents_rels_units_id_idx";
  ALTER TABLE "tests_listening_parts_g_q" DROP COLUMN "tip";
  ALTER TABLE "tests_listening_parts_g_q" DROP COLUMN "quote";
  ALTER TABLE "tests_listening_parts_g_q" DROP COLUMN "evidence";
  ALTER TABLE "tests_listening_parts_g_q" DROP COLUMN "answer_status";
  ALTER TABLE "tests_reading_passages_g_q" DROP COLUMN "tip";
  ALTER TABLE "tests_reading_passages_g_q" DROP COLUMN "quote";
  ALTER TABLE "tests_reading_passages_g_q" DROP COLUMN "evidence";
  ALTER TABLE "tests_reading_passages_g_q" DROP COLUMN "answer_status";
  ALTER TABLE "___tests_v_version_listening_parts_g_v_q_v" DROP COLUMN "tip";
  ALTER TABLE "___tests_v_version_listening_parts_g_v_q_v" DROP COLUMN "quote";
  ALTER TABLE "___tests_v_version_listening_parts_g_v_q_v" DROP COLUMN "evidence";
  ALTER TABLE "___tests_v_version_listening_parts_g_v_q_v" DROP COLUMN "answer_status";
  ALTER TABLE "___tests_v_version_reading_passages_g_v_q_v" DROP COLUMN "tip";
  ALTER TABLE "___tests_v_version_reading_passages_g_v_q_v" DROP COLUMN "quote";
  ALTER TABLE "___tests_v_version_reading_passages_g_v_q_v" DROP COLUMN "evidence";
  ALTER TABLE "___tests_v_version_reading_passages_g_v_q_v" DROP COLUMN "answer_status";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "units_id";
  DROP TYPE "public"."enum_tests_listening_parts_g_q_answer_status";
  DROP TYPE "public"."enum_tests_reading_passages_g_q_answer_status";
  DROP TYPE "public"."enum____tests_v_version_listening_parts_g_v_q_v_answer_status";
  DROP TYPE "public"."enum____tests_v_version_reading_passages_g_v_q_v_answer_status";
  DROP TYPE "public"."enum_units_g_q_answer_status";
  DROP TYPE "public"."enum_units_g_type";
  DROP TYPE "public"."enum_units_module";
  DROP TYPE "public"."enum_units_source_type";
  DROP TYPE "public"."enum_units_source_tag";
  DROP TYPE "public"."enum_units_status";
  DROP TYPE "public"."enum____units_v_version_g_v_q_v_answer_status";
  DROP TYPE "public"."enum___units_v_version_g_v_type";
  DROP TYPE "public"."enum__units_v_version_module";
  DROP TYPE "public"."enum__units_v_version_source_type";
  DROP TYPE "public"."enum__units_v_version_source_tag";
  DROP TYPE "public"."enum__units_v_version_status";`)
}
