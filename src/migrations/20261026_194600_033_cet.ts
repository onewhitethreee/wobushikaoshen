import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_units_exam" AS ENUM('ielts', 'cet4', 'cet6');
  CREATE TYPE "public"."enum__units_v_version_exam" AS ENUM('ielts', 'cet4', 'cet6');
  CREATE TYPE "public"."enum_writing_tasks_exam" AS ENUM('ielts', 'cet4', 'cet6');
  CREATE TYPE "public"."enum__writing_tasks_v_version_exam" AS ENUM('ielts', 'cet4', 'cet6');
  ALTER TYPE "public"."enum_writing_tasks_task_type" ADD VALUE 'cet_writing';
  ALTER TYPE "public"."enum_writing_tasks_task_type" ADD VALUE 'cet_translation';
  ALTER TYPE "public"."enum__writing_tasks_v_version_task_type" ADD VALUE 'cet_writing';
  ALTER TYPE "public"."enum__writing_tasks_v_version_task_type" ADD VALUE 'cet_translation';
  ALTER TABLE "units" ADD COLUMN "exam" "enum_units_exam" DEFAULT 'ielts';
  ALTER TABLE "units" ADD COLUMN "paper" varchar;
  ALTER TABLE "units" ADD COLUMN "transcript_translations" jsonb;
  ALTER TABLE "_units_v" ADD COLUMN "version_exam" "enum__units_v_version_exam" DEFAULT 'ielts';
  ALTER TABLE "_units_v" ADD COLUMN "version_paper" varchar;
  ALTER TABLE "_units_v" ADD COLUMN "version_transcript_translations" jsonb;
  ALTER TABLE "writing_tasks" ADD COLUMN "exam" "enum_writing_tasks_exam" DEFAULT 'ielts';
  ALTER TABLE "writing_tasks" ADD COLUMN "paper" varchar;
  ALTER TABLE "writing_tasks" ADD COLUMN "max_words" numeric;
  ALTER TABLE "writing_tasks" ADD COLUMN "model_answer_zh" varchar;
  ALTER TABLE "writing_tasks" ADD COLUMN "analysis" varchar;
  ALTER TABLE "_writing_tasks_v" ADD COLUMN "version_exam" "enum__writing_tasks_v_version_exam" DEFAULT 'ielts';
  ALTER TABLE "_writing_tasks_v" ADD COLUMN "version_paper" varchar;
  ALTER TABLE "_writing_tasks_v" ADD COLUMN "version_max_words" numeric;
  ALTER TABLE "_writing_tasks_v" ADD COLUMN "version_model_answer_zh" varchar;
  ALTER TABLE "_writing_tasks_v" ADD COLUMN "version_analysis" varchar;
  CREATE INDEX "units_exam_idx" ON "units" USING btree ("exam");
  CREATE INDEX "units_paper_idx" ON "units" USING btree ("paper");
  CREATE INDEX "_units_v_version_version_exam_idx" ON "_units_v" USING btree ("version_exam");
  CREATE INDEX "_units_v_version_version_paper_idx" ON "_units_v" USING btree ("version_paper");
  CREATE INDEX "writing_tasks_exam_idx" ON "writing_tasks" USING btree ("exam");
  CREATE INDEX "writing_tasks_paper_idx" ON "writing_tasks" USING btree ("paper");
  CREATE INDEX "_writing_tasks_v_version_version_exam_idx" ON "_writing_tasks_v" USING btree ("version_exam");
  CREATE INDEX "_writing_tasks_v_version_version_paper_idx" ON "_writing_tasks_v" USING btree ("version_paper");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "writing_tasks" ALTER COLUMN "task_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_writing_tasks_task_type";
  CREATE TYPE "public"."enum_writing_tasks_task_type" AS ENUM('task1', 'task2');
  ALTER TABLE "writing_tasks" ALTER COLUMN "task_type" SET DATA TYPE "public"."enum_writing_tasks_task_type" USING "task_type"::"public"."enum_writing_tasks_task_type";
  ALTER TABLE "_writing_tasks_v" ALTER COLUMN "version_task_type" SET DATA TYPE text;
  DROP TYPE "public"."enum__writing_tasks_v_version_task_type";
  CREATE TYPE "public"."enum__writing_tasks_v_version_task_type" AS ENUM('task1', 'task2');
  ALTER TABLE "_writing_tasks_v" ALTER COLUMN "version_task_type" SET DATA TYPE "public"."enum__writing_tasks_v_version_task_type" USING "version_task_type"::"public"."enum__writing_tasks_v_version_task_type";
  DROP INDEX "units_exam_idx";
  DROP INDEX "units_paper_idx";
  DROP INDEX "_units_v_version_version_exam_idx";
  DROP INDEX "_units_v_version_version_paper_idx";
  DROP INDEX "writing_tasks_exam_idx";
  DROP INDEX "writing_tasks_paper_idx";
  DROP INDEX "_writing_tasks_v_version_version_exam_idx";
  DROP INDEX "_writing_tasks_v_version_version_paper_idx";
  ALTER TABLE "units" DROP COLUMN "exam";
  ALTER TABLE "units" DROP COLUMN "paper";
  ALTER TABLE "units" DROP COLUMN "transcript_translations";
  ALTER TABLE "_units_v" DROP COLUMN "version_exam";
  ALTER TABLE "_units_v" DROP COLUMN "version_paper";
  ALTER TABLE "_units_v" DROP COLUMN "version_transcript_translations";
  ALTER TABLE "writing_tasks" DROP COLUMN "exam";
  ALTER TABLE "writing_tasks" DROP COLUMN "paper";
  ALTER TABLE "writing_tasks" DROP COLUMN "max_words";
  ALTER TABLE "writing_tasks" DROP COLUMN "model_answer_zh";
  ALTER TABLE "writing_tasks" DROP COLUMN "analysis";
  ALTER TABLE "_writing_tasks_v" DROP COLUMN "version_exam";
  ALTER TABLE "_writing_tasks_v" DROP COLUMN "version_paper";
  ALTER TABLE "_writing_tasks_v" DROP COLUMN "version_max_words";
  ALTER TABLE "_writing_tasks_v" DROP COLUMN "version_model_answer_zh";
  ALTER TABLE "_writing_tasks_v" DROP COLUMN "version_analysis";
  DROP TYPE "public"."enum_units_exam";
  DROP TYPE "public"."enum__units_v_version_exam";
  DROP TYPE "public"."enum_writing_tasks_exam";
  DROP TYPE "public"."enum__writing_tasks_v_version_exam";`)
}
