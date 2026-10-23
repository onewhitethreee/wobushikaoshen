import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_units_source_tag" ADD VALUE '每日精选';
  ALTER TYPE "public"."enum__units_v_version_source_tag" ADD VALUE '每日精选';
  CREATE TABLE "content_api_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key_hash" varchar,
  	"key_last4" varchar,
  	"key_created_at" timestamp(3) with time zone,
  	"last_used_at" timestamp(3) with time zone,
  	"daily_limit" numeric DEFAULT 20 NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "units" ADD COLUMN "source_url" varchar;
  ALTER TABLE "units" ADD COLUMN "via_api" boolean DEFAULT false;
  ALTER TABLE "_units_v" ADD COLUMN "version_source_url" varchar;
  ALTER TABLE "_units_v" ADD COLUMN "version_via_api" boolean DEFAULT false;
  CREATE INDEX "units_via_api_idx" ON "units" USING btree ("via_api");
  CREATE INDEX "_units_v_version_version_via_api_idx" ON "_units_v" USING btree ("version_via_api");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "content_api_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "content_api_settings" CASCADE;
  ALTER TABLE "units" ALTER COLUMN "source_tag" SET DATA TYPE text;
  DROP TYPE "public"."enum_units_source_tag";
  CREATE TYPE "public"."enum_units_source_tag" AS ENUM('9月高频', '9月中频', '10月高频', '10月中频', '全年高频', '增补');
  ALTER TABLE "units" ALTER COLUMN "source_tag" SET DATA TYPE "public"."enum_units_source_tag" USING "source_tag"::"public"."enum_units_source_tag";
  ALTER TABLE "_units_v" ALTER COLUMN "version_source_tag" SET DATA TYPE text;
  DROP TYPE "public"."enum__units_v_version_source_tag";
  CREATE TYPE "public"."enum__units_v_version_source_tag" AS ENUM('9月高频', '9月中频', '10月高频', '10月中频', '全年高频', '增补');
  ALTER TABLE "_units_v" ALTER COLUMN "version_source_tag" SET DATA TYPE "public"."enum__units_v_version_source_tag" USING "version_source_tag"::"public"."enum__units_v_version_source_tag";
  DROP INDEX "units_via_api_idx";
  DROP INDEX "_units_v_version_version_via_api_idx";
  ALTER TABLE "units" DROP COLUMN "source_url";
  ALTER TABLE "units" DROP COLUMN "via_api";
  ALTER TABLE "_units_v" DROP COLUMN "version_source_url";
  ALTER TABLE "_units_v" DROP COLUMN "version_via_api";`)
}
