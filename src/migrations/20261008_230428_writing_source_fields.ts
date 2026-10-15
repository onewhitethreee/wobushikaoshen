import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_writing_tasks_category" AS ENUM('data', 'map', 'process', 'diagram', 'opinion', 'discussion', 'report', 'mixed', 'comparison', 'advantage');
  CREATE TYPE "public"."enum__writing_tasks_v_version_category" AS ENUM('data', 'map', 'process', 'diagram', 'opinion', 'discussion', 'report', 'mixed', 'comparison', 'advantage');
  ALTER TABLE "writing_tasks" ADD COLUMN "category" "enum_writing_tasks_category";
  ALTER TABLE "writing_tasks" ADD COLUMN "title_zh" varchar;
  ALTER TABLE "writing_tasks" ADD COLUMN "source_id" varchar;
  ALTER TABLE "writing_tasks" ADD COLUMN "source_sets" varchar;
  ALTER TABLE "_writing_tasks_v" ADD COLUMN "version_category" "enum__writing_tasks_v_version_category";
  ALTER TABLE "_writing_tasks_v" ADD COLUMN "version_title_zh" varchar;
  ALTER TABLE "_writing_tasks_v" ADD COLUMN "version_source_id" varchar;
  ALTER TABLE "_writing_tasks_v" ADD COLUMN "version_source_sets" varchar;
  CREATE UNIQUE INDEX "writing_tasks_source_id_idx" ON "writing_tasks" USING btree ("source_id");
  CREATE INDEX "writing_tasks_source_sets_idx" ON "writing_tasks" USING btree ("source_sets");
  CREATE INDEX "_writing_tasks_v_version_version_source_id_idx" ON "_writing_tasks_v" USING btree ("version_source_id");
  CREATE INDEX "_writing_tasks_v_version_version_source_sets_idx" ON "_writing_tasks_v" USING btree ("version_source_sets");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "writing_tasks_source_id_idx";
  DROP INDEX "writing_tasks_source_sets_idx";
  DROP INDEX "_writing_tasks_v_version_version_source_id_idx";
  DROP INDEX "_writing_tasks_v_version_version_source_sets_idx";
  ALTER TABLE "writing_tasks" DROP COLUMN "category";
  ALTER TABLE "writing_tasks" DROP COLUMN "title_zh";
  ALTER TABLE "writing_tasks" DROP COLUMN "source_id";
  ALTER TABLE "writing_tasks" DROP COLUMN "source_sets";
  ALTER TABLE "_writing_tasks_v" DROP COLUMN "version_category";
  ALTER TABLE "_writing_tasks_v" DROP COLUMN "version_title_zh";
  ALTER TABLE "_writing_tasks_v" DROP COLUMN "version_source_id";
  ALTER TABLE "_writing_tasks_v" DROP COLUMN "version_source_sets";
  DROP TYPE "public"."enum_writing_tasks_category";
  DROP TYPE "public"."enum__writing_tasks_v_version_category";`)
}
