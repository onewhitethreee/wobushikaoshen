import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_answer_reports_module" AS ENUM('listening', 'reading');
  CREATE TYPE "public"."enum_answer_reports_kind" AS ENUM('accept', 'wrong', 'other');
  CREATE TYPE "public"."enum_answer_reports_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "public"."enum_answer_reports_reject_preset" AS ENUM('判分正确', '超出字数限制', '拼写错误', '重复举报', '其他');
  ALTER TYPE "public"."enum_credit_entries_reason" ADD VALUE 'report' BEFORE 'spend';
  CREATE TABLE "answer_reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"unit_key" varchar NOT NULL,
  	"number" numeric NOT NULL,
  	"module" "enum_answer_reports_module",
  	"source_tag" varchar,
  	"kind" "enum_answer_reports_kind" NOT NULL,
  	"answer" varchar,
  	"answer_key" varchar,
  	"key_snapshot" varchar,
  	"q_type" varchar,
  	"max_words" numeric,
  	"number_allowed" boolean,
  	"remark" varchar,
  	"status" "enum_answer_reports_status" DEFAULT 'pending' NOT NULL,
  	"amount" numeric,
  	"reject_preset" "enum_answer_reports_reject_preset",
  	"reject_reason" varchar,
  	"reviewed_by_id" integer,
  	"reviewed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "answer_reports_id" integer;
  ALTER TABLE "credit_settings" ADD COLUMN "report_default" numeric DEFAULT 3 NOT NULL;
  ALTER TABLE "answer_reports" ADD CONSTRAINT "answer_reports_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "answer_reports" ADD CONSTRAINT "answer_reports_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "answer_reports_member_idx" ON "answer_reports" USING btree ("member_id");
  CREATE INDEX "answer_reports_unit_key_idx" ON "answer_reports" USING btree ("unit_key");
  CREATE INDEX "answer_reports_answer_key_idx" ON "answer_reports" USING btree ("answer_key");
  CREATE INDEX "answer_reports_reviewed_by_idx" ON "answer_reports" USING btree ("reviewed_by_id");
  CREATE INDEX "answer_reports_updated_at_idx" ON "answer_reports" USING btree ("updated_at");
  CREATE INDEX "answer_reports_created_at_idx" ON "answer_reports" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_answer_reports_fk" FOREIGN KEY ("answer_reports_id") REFERENCES "public"."answer_reports"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_answer_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("answer_reports_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "answer_reports" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "answer_reports" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_answer_reports_fk";
  
  ALTER TABLE "credit_entries" ALTER COLUMN "reason" SET DATA TYPE text;
  ALTER TABLE "credit_entries" ALTER COLUMN "reason" SET DEFAULT 'adjust'::text;
  DROP TYPE "public"."enum_credit_entries_reason";
  CREATE TYPE "public"."enum_credit_entries_reason" AS ENUM('signup', 'redeem', 'invite', 'invitee', 'note', 'spend', 'refund', 'adjust');
  ALTER TABLE "credit_entries" ALTER COLUMN "reason" SET DEFAULT 'adjust'::"public"."enum_credit_entries_reason";
  ALTER TABLE "credit_entries" ALTER COLUMN "reason" SET DATA TYPE "public"."enum_credit_entries_reason" USING "reason"::"public"."enum_credit_entries_reason";
  DROP INDEX "payload_locked_documents_rels_answer_reports_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "answer_reports_id";
  ALTER TABLE "credit_settings" DROP COLUMN "report_default";
  DROP TYPE "public"."enum_answer_reports_module";
  DROP TYPE "public"."enum_answer_reports_kind";
  DROP TYPE "public"."enum_answer_reports_status";
  DROP TYPE "public"."enum_answer_reports_reject_preset";`)
}
