import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "ai_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"base_url" varchar DEFAULT 'https://api.deepseek.com' NOT NULL,
  	"model" varchar DEFAULT 'deepseek-chat' NOT NULL,
  	"api_key" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "ai_settings" CASCADE;`)
}
