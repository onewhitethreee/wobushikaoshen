import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_email_sends_kind" AS ENUM('code', 'test');
  CREATE TYPE "public"."enum_email_sends_via" AS ENUM('primary', 'backup', 'none');
  CREATE TYPE "public"."enum_mail_settings_primary_secure" AS ENUM('ssl', 'starttls', 'none');
  CREATE TYPE "public"."enum_mail_settings_backup_secure" AS ENUM('ssl', 'starttls', 'none');
  CREATE TABLE "members_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "members" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"last_login_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "email_sends" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"ip" varchar,
  	"kind" "enum_email_sends_kind" NOT NULL,
  	"via" "enum_email_sends_via",
  	"ok" boolean DEFAULT false,
  	"error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "login_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"code_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "member_data" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"rev" numeric DEFAULT 0 NOT NULL,
  	"data" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mail_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"primary_enabled" boolean DEFAULT false,
  	"primary_host" varchar,
  	"primary_port" numeric DEFAULT 465,
  	"primary_secure" "enum_mail_settings_primary_secure" DEFAULT 'ssl',
  	"primary_user" varchar,
  	"primary_password" varchar,
  	"primary_password_set" boolean,
  	"primary_from_address" varchar,
  	"primary_from_name" varchar DEFAULT '我不是考神',
  	"primary_last_error_at" timestamp(3) with time zone,
  	"primary_last_error" varchar,
  	"backup_enabled" boolean DEFAULT false,
  	"backup_host" varchar,
  	"backup_port" numeric DEFAULT 465,
  	"backup_secure" "enum_mail_settings_backup_secure" DEFAULT 'ssl',
  	"backup_user" varchar,
  	"backup_password" varchar,
  	"backup_password_set" boolean,
  	"backup_from_address" varchar,
  	"backup_from_name" varchar DEFAULT '我不是考神',
  	"backup_last_error_at" timestamp(3) with time zone,
  	"backup_last_error" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "members_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "email_sends_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "login_codes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "member_data_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "members_id" integer;
  ALTER TABLE "members_sessions" ADD CONSTRAINT "members_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "member_data" ADD CONSTRAINT "member_data_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "members_sessions_order_idx" ON "members_sessions" USING btree ("_order");
  CREATE INDEX "members_sessions_parent_id_idx" ON "members_sessions" USING btree ("_parent_id");
  CREATE INDEX "members_updated_at_idx" ON "members" USING btree ("updated_at");
  CREATE INDEX "members_created_at_idx" ON "members" USING btree ("created_at");
  CREATE UNIQUE INDEX "members_email_idx" ON "members" USING btree ("email");
  CREATE INDEX "email_sends_email_idx" ON "email_sends" USING btree ("email");
  CREATE INDEX "email_sends_ip_idx" ON "email_sends" USING btree ("ip");
  CREATE INDEX "email_sends_updated_at_idx" ON "email_sends" USING btree ("updated_at");
  CREATE INDEX "email_sends_created_at_idx" ON "email_sends" USING btree ("created_at");
  CREATE INDEX "login_codes_email_idx" ON "login_codes" USING btree ("email");
  CREATE INDEX "login_codes_updated_at_idx" ON "login_codes" USING btree ("updated_at");
  CREATE INDEX "login_codes_created_at_idx" ON "login_codes" USING btree ("created_at");
  CREATE UNIQUE INDEX "member_data_member_idx" ON "member_data" USING btree ("member_id");
  CREATE INDEX "member_data_updated_at_idx" ON "member_data" USING btree ("updated_at");
  CREATE INDEX "member_data_created_at_idx" ON "member_data" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_members_fk" FOREIGN KEY ("members_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_sends_fk" FOREIGN KEY ("email_sends_id") REFERENCES "public"."email_sends"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_login_codes_fk" FOREIGN KEY ("login_codes_id") REFERENCES "public"."login_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_data_fk" FOREIGN KEY ("member_data_id") REFERENCES "public"."member_data"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_members_fk" FOREIGN KEY ("members_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_members_id_idx" ON "payload_locked_documents_rels" USING btree ("members_id");
  CREATE INDEX "payload_locked_documents_rels_email_sends_id_idx" ON "payload_locked_documents_rels" USING btree ("email_sends_id");
  CREATE INDEX "payload_locked_documents_rels_login_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("login_codes_id");
  CREATE INDEX "payload_locked_documents_rels_member_data_id_idx" ON "payload_locked_documents_rels" USING btree ("member_data_id");
  CREATE INDEX "payload_preferences_rels_members_id_idx" ON "payload_preferences_rels" USING btree ("members_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "members_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "email_sends" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "login_codes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "member_data" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mail_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "members_sessions" CASCADE;
  DROP TABLE "members" CASCADE;
  DROP TABLE "email_sends" CASCADE;
  DROP TABLE "login_codes" CASCADE;
  DROP TABLE "member_data" CASCADE;
  DROP TABLE "mail_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_members_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_email_sends_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_login_codes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_member_data_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_members_fk";
  
  DROP INDEX "payload_locked_documents_rels_members_id_idx";
  DROP INDEX "payload_locked_documents_rels_email_sends_id_idx";
  DROP INDEX "payload_locked_documents_rels_login_codes_id_idx";
  DROP INDEX "payload_locked_documents_rels_member_data_id_idx";
  DROP INDEX "payload_preferences_rels_members_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "members_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "email_sends_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "login_codes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "member_data_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "members_id";
  DROP TYPE "public"."enum_email_sends_kind";
  DROP TYPE "public"."enum_email_sends_via";
  DROP TYPE "public"."enum_mail_settings_primary_secure";
  DROP TYPE "public"."enum_mail_settings_backup_secure";`)
}
