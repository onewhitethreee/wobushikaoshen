import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_stat_attempts_exam" AS ENUM('ielts', 'cet4', 'cet6');
  CREATE TYPE "public"."enum_stat_attempts_module" AS ENUM('listening', 'reading');
  CREATE TYPE "public"."enum_stat_attempts_source" AS ENUM('live', 'backfill');
  CREATE TABLE "stat_attempts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"attempt_key" varchar NOT NULL,
  	"who" varchar NOT NULL,
  	"unit_id" varchar NOT NULL,
  	"unit_key" varchar NOT NULL,
  	"first_key" varchar NOT NULL,
  	"exam" "enum_stat_attempts_exam" NOT NULL,
  	"module" "enum_stat_attempts_module" NOT NULL,
  	"score" numeric NOT NULL,
  	"total" numeric NOT NULL,
  	"first" boolean DEFAULT false NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"source" "enum_stat_attempts_source" DEFAULT 'live',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "answer_tallies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"unit_key" varchar NOT NULL,
  	"number" numeric NOT NULL,
  	"answer" varchar NOT NULL,
  	"unknown" boolean DEFAULT false NOT NULL,
  	"q_type" varchar NOT NULL,
  	"span" numeric NOT NULL,
  	"credit" numeric NOT NULL,
  	"count" numeric NOT NULL,
  	"first_count" numeric NOT NULL,
  	"last_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "question_keys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"unit_key" varchar NOT NULL,
  	"number" numeric NOT NULL,
  	"answers" varchar,
  	"reset_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "stat_attempts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "answer_tallies_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "question_keys_id" integer;
  CREATE UNIQUE INDEX "stat_attempts_attempt_key_idx" ON "stat_attempts" USING btree ("attempt_key");
  CREATE INDEX "stat_attempts_who_idx" ON "stat_attempts" USING btree ("who");
  CREATE INDEX "stat_attempts_unit_id_idx" ON "stat_attempts" USING btree ("unit_id");
  CREATE INDEX "stat_attempts_unit_key_idx" ON "stat_attempts" USING btree ("unit_key");
  CREATE INDEX "stat_attempts_at_idx" ON "stat_attempts" USING btree ("at");
  CREATE INDEX "stat_attempts_updated_at_idx" ON "stat_attempts" USING btree ("updated_at");
  CREATE INDEX "stat_attempts_created_at_idx" ON "stat_attempts" USING btree ("created_at");
  CREATE INDEX "who_firstKey_idx" ON "stat_attempts" USING btree ("who","first_key");
  CREATE INDEX "unitId_first_idx" ON "stat_attempts" USING btree ("unit_id","first");
  CREATE INDEX "answer_tallies_updated_at_idx" ON "answer_tallies" USING btree ("updated_at");
  CREATE INDEX "answer_tallies_created_at_idx" ON "answer_tallies" USING btree ("created_at");
  CREATE UNIQUE INDEX "unitKey_number_unknown_answer_idx" ON "answer_tallies" USING btree ("unit_key","number","unknown","answer");
  CREATE INDEX "question_keys_updated_at_idx" ON "question_keys" USING btree ("updated_at");
  CREATE INDEX "question_keys_created_at_idx" ON "question_keys" USING btree ("created_at");
  CREATE UNIQUE INDEX "unitKey_number_idx" ON "question_keys" USING btree ("unit_key","number");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stat_attempts_fk" FOREIGN KEY ("stat_attempts_id") REFERENCES "public"."stat_attempts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_answer_tallies_fk" FOREIGN KEY ("answer_tallies_id") REFERENCES "public"."answer_tallies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_question_keys_fk" FOREIGN KEY ("question_keys_id") REFERENCES "public"."question_keys"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_stat_attempts_id_idx" ON "payload_locked_documents_rels" USING btree ("stat_attempts_id");
  CREATE INDEX "payload_locked_documents_rels_answer_tallies_id_idx" ON "payload_locked_documents_rels" USING btree ("answer_tallies_id");
  CREATE INDEX "payload_locked_documents_rels_question_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("question_keys_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "stat_attempts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "answer_tallies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "question_keys" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "stat_attempts" CASCADE;
  DROP TABLE "answer_tallies" CASCADE;
  DROP TABLE "question_keys" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_stat_attempts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_answer_tallies_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_question_keys_fk";
  
  DROP INDEX "payload_locked_documents_rels_stat_attempts_id_idx";
  DROP INDEX "payload_locked_documents_rels_answer_tallies_id_idx";
  DROP INDEX "payload_locked_documents_rels_question_keys_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "stat_attempts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "answer_tallies_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "question_keys_id";
  DROP TYPE "public"."enum_stat_attempts_exam";
  DROP TYPE "public"."enum_stat_attempts_module";
  DROP TYPE "public"."enum_stat_attempts_source";`)
}
