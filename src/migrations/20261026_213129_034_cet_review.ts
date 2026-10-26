import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "writing_reviews" ADD COLUMN "score" numeric;
  ALTER TABLE "writing_reviews" ADD COLUMN "cet" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "writing_reviews" DROP COLUMN "score";
  ALTER TABLE "writing_reviews" DROP COLUMN "cet";`)
}
