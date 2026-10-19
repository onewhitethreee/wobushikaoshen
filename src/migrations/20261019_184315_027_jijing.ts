import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_posts_subjects" AS ENUM('listening', 'reading', 'writing', 'speaking');
  CREATE TYPE "public"."enum_posts_column" AS ENUM('article', 'jijing');
  CREATE TYPE "public"."enum__posts_v_version_subjects" AS ENUM('listening', 'reading', 'writing', 'speaking');
  CREATE TYPE "public"."enum__posts_v_version_column" AS ENUM('article', 'jijing');
  CREATE TABLE "posts_subjects" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_posts_subjects",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_posts_v_version_subjects" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__posts_v_version_subjects",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "posts" ADD COLUMN "column" "enum_posts_column" DEFAULT 'article';
  ALTER TABLE "posts" ADD COLUMN "season" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_column" "enum__posts_v_version_column" DEFAULT 'article';
  ALTER TABLE "_posts_v" ADD COLUMN "version_season" varchar;
  ALTER TABLE "posts_subjects" ADD CONSTRAINT "posts_subjects_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_version_subjects" ADD CONSTRAINT "_posts_v_version_subjects_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_subjects_order_idx" ON "posts_subjects" USING btree ("order");
  CREATE INDEX "posts_subjects_parent_idx" ON "posts_subjects" USING btree ("parent_id");
  CREATE INDEX "_posts_v_version_subjects_order_idx" ON "_posts_v_version_subjects" USING btree ("order");
  CREATE INDEX "_posts_v_version_subjects_parent_idx" ON "_posts_v_version_subjects" USING btree ("parent_id");
  CREATE INDEX "posts_column_idx" ON "posts" USING btree ("column");
  CREATE INDEX "_posts_v_version_version_column_idx" ON "_posts_v" USING btree ("version_column");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts_subjects" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_version_subjects" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "posts_subjects" CASCADE;
  DROP TABLE "_posts_v_version_subjects" CASCADE;
  DROP INDEX "posts_column_idx";
  DROP INDEX "_posts_v_version_version_column_idx";
  ALTER TABLE "posts" DROP COLUMN "column";
  ALTER TABLE "posts" DROP COLUMN "season";
  ALTER TABLE "_posts_v" DROP COLUMN "version_column";
  ALTER TABLE "_posts_v" DROP COLUMN "version_season";
  DROP TYPE "public"."enum_posts_subjects";
  DROP TYPE "public"."enum_posts_column";
  DROP TYPE "public"."enum__posts_v_version_subjects";
  DROP TYPE "public"."enum__posts_v_version_column";`)
}
