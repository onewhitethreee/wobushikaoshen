import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "units" ADD COLUMN "paraphrases" jsonb;
  ALTER TABLE "units" ADD COLUMN "paraphrase_checked" boolean DEFAULT false;
  ALTER TABLE "_units_v" ADD COLUMN "version_paraphrases" jsonb;
  ALTER TABLE "_units_v" ADD COLUMN "version_paraphrase_checked" boolean DEFAULT false;
  CREATE INDEX "units_paraphrase_checked_idx" ON "units" USING btree ("paraphrase_checked");
  CREATE INDEX "_units_v_version_version_paraphrase_checked_idx" ON "_units_v" USING btree ("version_paraphrase_checked");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "units_paraphrase_checked_idx";
  DROP INDEX "_units_v_version_version_paraphrase_checked_idx";
  ALTER TABLE "units" DROP COLUMN "paraphrases";
  ALTER TABLE "units" DROP COLUMN "paraphrase_checked";
  ALTER TABLE "_units_v" DROP COLUMN "version_paraphrases";
  ALTER TABLE "_units_v" DROP COLUMN "version_paraphrase_checked";`)
}
