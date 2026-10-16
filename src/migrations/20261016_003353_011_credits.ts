import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_credit_entries_reason" AS ENUM('invite', 'invitee', 'note', 'spend', 'refund', 'adjust');
  CREATE TYPE "public"."enum_note_submissions_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "public"."enum_note_submissions_reject_preset" AS ENUM('链接打不开', '笔记里没提到本站', '截图和链接对不上', '重复提交', '其他');
  CREATE TABLE "credit_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"amount" numeric NOT NULL,
  	"reason" "enum_credit_entries_reason" DEFAULT 'adjust' NOT NULL,
  	"ref_key" varchar,
  	"related_member_id" integer,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "note_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"url" varchar NOT NULL,
  	"note_key" varchar,
  	"screenshot_id" integer NOT NULL,
  	"remark" varchar,
  	"status" "enum_note_submissions_status" DEFAULT 'pending' NOT NULL,
  	"amount" numeric,
  	"reject_preset" "enum_note_submissions_reject_preset",
  	"reject_reason" varchar,
  	"reviewed_by_id" integer,
  	"reviewed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "note_screenshots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "credit_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"inviter_reward" numeric DEFAULT 3 NOT NULL,
  	"invitee_reward" numeric DEFAULT 3 NOT NULL,
  	"inviter_cap" numeric DEFAULT 10 NOT NULL,
  	"note_default" numeric DEFAULT 10 NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "members" ADD COLUMN "invite_code" varchar;
  ALTER TABLE "members" ADD COLUMN "invited_by_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "credit_entries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "note_submissions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "note_screenshots_id" integer;
  ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_related_member_id_members_id_fk" FOREIGN KEY ("related_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "note_submissions" ADD CONSTRAINT "note_submissions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "note_submissions" ADD CONSTRAINT "note_submissions_screenshot_id_note_screenshots_id_fk" FOREIGN KEY ("screenshot_id") REFERENCES "public"."note_screenshots"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "note_submissions" ADD CONSTRAINT "note_submissions_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "note_screenshots" ADD CONSTRAINT "note_screenshots_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "credit_entries_member_idx" ON "credit_entries" USING btree ("member_id");
  CREATE UNIQUE INDEX "credit_entries_ref_key_idx" ON "credit_entries" USING btree ("ref_key");
  CREATE INDEX "credit_entries_related_member_idx" ON "credit_entries" USING btree ("related_member_id");
  CREATE INDEX "credit_entries_updated_at_idx" ON "credit_entries" USING btree ("updated_at");
  CREATE INDEX "credit_entries_created_at_idx" ON "credit_entries" USING btree ("created_at");
  CREATE INDEX "note_submissions_member_idx" ON "note_submissions" USING btree ("member_id");
  CREATE INDEX "note_submissions_note_key_idx" ON "note_submissions" USING btree ("note_key");
  CREATE INDEX "note_submissions_screenshot_idx" ON "note_submissions" USING btree ("screenshot_id");
  CREATE INDEX "note_submissions_reviewed_by_idx" ON "note_submissions" USING btree ("reviewed_by_id");
  CREATE INDEX "note_submissions_updated_at_idx" ON "note_submissions" USING btree ("updated_at");
  CREATE INDEX "note_submissions_created_at_idx" ON "note_submissions" USING btree ("created_at");
  CREATE INDEX "note_screenshots_member_idx" ON "note_screenshots" USING btree ("member_id");
  CREATE INDEX "note_screenshots_updated_at_idx" ON "note_screenshots" USING btree ("updated_at");
  CREATE INDEX "note_screenshots_created_at_idx" ON "note_screenshots" USING btree ("created_at");
  CREATE UNIQUE INDEX "note_screenshots_filename_idx" ON "note_screenshots" USING btree ("filename");
  ALTER TABLE "members" ADD CONSTRAINT "members_invited_by_id_members_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_credit_entries_fk" FOREIGN KEY ("credit_entries_id") REFERENCES "public"."credit_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_note_submissions_fk" FOREIGN KEY ("note_submissions_id") REFERENCES "public"."note_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_note_screenshots_fk" FOREIGN KEY ("note_screenshots_id") REFERENCES "public"."note_screenshots"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "members_invite_code_idx" ON "members" USING btree ("invite_code");
  CREATE INDEX "members_invited_by_idx" ON "members" USING btree ("invited_by_id");
  CREATE INDEX "payload_locked_documents_rels_credit_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("credit_entries_id");
  CREATE INDEX "payload_locked_documents_rels_note_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("note_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_note_screenshots_id_idx" ON "payload_locked_documents_rels" USING btree ("note_screenshots_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "credit_entries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "note_submissions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "note_screenshots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "credit_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "credit_entries" CASCADE;
  DROP TABLE "note_submissions" CASCADE;
  DROP TABLE "note_screenshots" CASCADE;
  DROP TABLE "credit_settings" CASCADE;
  ALTER TABLE "members" DROP CONSTRAINT "members_invited_by_id_members_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_credit_entries_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_note_submissions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_note_screenshots_fk";
  
  DROP INDEX "members_invite_code_idx";
  DROP INDEX "members_invited_by_idx";
  DROP INDEX "payload_locked_documents_rels_credit_entries_id_idx";
  DROP INDEX "payload_locked_documents_rels_note_submissions_id_idx";
  DROP INDEX "payload_locked_documents_rels_note_screenshots_id_idx";
  ALTER TABLE "members" DROP COLUMN "invite_code";
  ALTER TABLE "members" DROP COLUMN "invited_by_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "credit_entries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "note_submissions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "note_screenshots_id";
  DROP TYPE "public"."enum_credit_entries_reason";
  DROP TYPE "public"."enum_note_submissions_status";
  DROP TYPE "public"."enum_note_submissions_reject_preset";`)
}
