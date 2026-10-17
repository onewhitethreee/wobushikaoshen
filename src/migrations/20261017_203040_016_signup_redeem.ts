import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_credit_entries_reason" ADD VALUE 'signup' BEFORE 'invite';
  ALTER TYPE "public"."enum_credit_entries_reason" ADD VALUE 'redeem' BEFORE 'invite';
  CREATE TABLE "redeem_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"amount" numeric NOT NULL,
  	"max_uses" numeric DEFAULT 1 NOT NULL,
  	"expires_at" timestamp(3) with time zone,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "redeem_codes_id" integer;
  ALTER TABLE "credit_settings" ADD COLUMN "signup_reward" numeric DEFAULT 10 NOT NULL;
  CREATE UNIQUE INDEX "redeem_codes_code_idx" ON "redeem_codes" USING btree ("code");
  CREATE INDEX "redeem_codes_updated_at_idx" ON "redeem_codes" USING btree ("updated_at");
  CREATE INDEX "redeem_codes_created_at_idx" ON "redeem_codes" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redeem_codes_fk" FOREIGN KEY ("redeem_codes_id") REFERENCES "public"."redeem_codes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_redeem_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("redeem_codes_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "redeem_codes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "redeem_codes" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_redeem_codes_fk";
  
  ALTER TABLE "credit_entries" ALTER COLUMN "reason" SET DATA TYPE text;
  ALTER TABLE "credit_entries" ALTER COLUMN "reason" SET DEFAULT 'adjust'::text;
  DROP TYPE "public"."enum_credit_entries_reason";
  CREATE TYPE "public"."enum_credit_entries_reason" AS ENUM('invite', 'invitee', 'note', 'spend', 'refund', 'adjust');
  ALTER TABLE "credit_entries" ALTER COLUMN "reason" SET DEFAULT 'adjust'::"public"."enum_credit_entries_reason";
  ALTER TABLE "credit_entries" ALTER COLUMN "reason" SET DATA TYPE "public"."enum_credit_entries_reason" USING "reason"::"public"."enum_credit_entries_reason";
  DROP INDEX "payload_locked_documents_rels_redeem_codes_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "redeem_codes_id";
  ALTER TABLE "credit_settings" DROP COLUMN "signup_reward";`)
}
