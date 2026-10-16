import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "dict_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"word" varchar NOT NULL,
  	"phonetic" varchar,
  	"translation" varchar,
  	"exchange" varchar,
  	"lemma" varchar
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "dict_entries_id" integer;
  CREATE UNIQUE INDEX "dict_entries_word_idx" ON "dict_entries" USING btree ("word");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_dict_entries_fk" FOREIGN KEY ("dict_entries_id") REFERENCES "public"."dict_entries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_dict_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("dict_entries_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "dict_entries" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "dict_entries" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_dict_entries_fk";
  
  DROP INDEX "payload_locked_documents_rels_dict_entries_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "dict_entries_id";`)
}
