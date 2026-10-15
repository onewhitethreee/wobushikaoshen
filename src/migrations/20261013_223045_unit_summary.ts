import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "units" ADD COLUMN "summary" jsonb;
  ALTER TABLE "_units_v" ADD COLUMN "version_summary" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "units" DROP COLUMN "summary";
  ALTER TABLE "_units_v" DROP COLUMN "version_summary";`)
}
