import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_credit_settings_note_mode" AS ENUM('xhs', 'other', 'off');
  ALTER TABLE "note_submissions" ADD COLUMN "platform" varchar;
  ALTER TABLE "credit_settings" ADD COLUMN "note_mode" "enum_credit_settings_note_mode" DEFAULT 'xhs' NOT NULL;
  ALTER TABLE "credit_settings" ADD COLUMN "note_platform" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "note_submissions" DROP COLUMN "platform";
  ALTER TABLE "credit_settings" DROP COLUMN "note_mode";
  ALTER TABLE "credit_settings" DROP COLUMN "note_platform";
  DROP TYPE "public"."enum_credit_settings_note_mode";`)
}
