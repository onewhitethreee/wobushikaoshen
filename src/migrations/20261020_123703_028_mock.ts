import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_mock_papers_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__mock_papers_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "mock_papers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"no" numeric,
  	"title" varchar,
  	"l1_id" integer,
  	"l2_id" integer,
  	"l3_id" integer,
  	"l4_id" integer,
  	"r1_id" integer,
  	"r2_id" integer,
  	"r3_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_mock_papers_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_mock_papers_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_no" numeric,
  	"version_title" varchar,
  	"version_l1_id" integer,
  	"version_l2_id" integer,
  	"version_l3_id" integer,
  	"version_l4_id" integer,
  	"version_r1_id" integer,
  	"version_r2_id" integer,
  	"version_r3_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__mock_papers_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mock_papers_id" integer;
  ALTER TABLE "mock_papers" ADD CONSTRAINT "mock_papers_l1_id_units_id_fk" FOREIGN KEY ("l1_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mock_papers" ADD CONSTRAINT "mock_papers_l2_id_units_id_fk" FOREIGN KEY ("l2_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mock_papers" ADD CONSTRAINT "mock_papers_l3_id_units_id_fk" FOREIGN KEY ("l3_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mock_papers" ADD CONSTRAINT "mock_papers_l4_id_units_id_fk" FOREIGN KEY ("l4_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mock_papers" ADD CONSTRAINT "mock_papers_r1_id_units_id_fk" FOREIGN KEY ("r1_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mock_papers" ADD CONSTRAINT "mock_papers_r2_id_units_id_fk" FOREIGN KEY ("r2_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mock_papers" ADD CONSTRAINT "mock_papers_r3_id_units_id_fk" FOREIGN KEY ("r3_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_mock_papers_v" ADD CONSTRAINT "_mock_papers_v_parent_id_mock_papers_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mock_papers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_mock_papers_v" ADD CONSTRAINT "_mock_papers_v_version_l1_id_units_id_fk" FOREIGN KEY ("version_l1_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_mock_papers_v" ADD CONSTRAINT "_mock_papers_v_version_l2_id_units_id_fk" FOREIGN KEY ("version_l2_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_mock_papers_v" ADD CONSTRAINT "_mock_papers_v_version_l3_id_units_id_fk" FOREIGN KEY ("version_l3_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_mock_papers_v" ADD CONSTRAINT "_mock_papers_v_version_l4_id_units_id_fk" FOREIGN KEY ("version_l4_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_mock_papers_v" ADD CONSTRAINT "_mock_papers_v_version_r1_id_units_id_fk" FOREIGN KEY ("version_r1_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_mock_papers_v" ADD CONSTRAINT "_mock_papers_v_version_r2_id_units_id_fk" FOREIGN KEY ("version_r2_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_mock_papers_v" ADD CONSTRAINT "_mock_papers_v_version_r3_id_units_id_fk" FOREIGN KEY ("version_r3_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "mock_papers_no_idx" ON "mock_papers" USING btree ("no");
  CREATE INDEX "mock_papers_l1_idx" ON "mock_papers" USING btree ("l1_id");
  CREATE INDEX "mock_papers_l2_idx" ON "mock_papers" USING btree ("l2_id");
  CREATE INDEX "mock_papers_l3_idx" ON "mock_papers" USING btree ("l3_id");
  CREATE INDEX "mock_papers_l4_idx" ON "mock_papers" USING btree ("l4_id");
  CREATE INDEX "mock_papers_r1_idx" ON "mock_papers" USING btree ("r1_id");
  CREATE INDEX "mock_papers_r2_idx" ON "mock_papers" USING btree ("r2_id");
  CREATE INDEX "mock_papers_r3_idx" ON "mock_papers" USING btree ("r3_id");
  CREATE INDEX "mock_papers_updated_at_idx" ON "mock_papers" USING btree ("updated_at");
  CREATE INDEX "mock_papers_created_at_idx" ON "mock_papers" USING btree ("created_at");
  CREATE INDEX "mock_papers__status_idx" ON "mock_papers" USING btree ("_status");
  CREATE INDEX "_mock_papers_v_parent_idx" ON "_mock_papers_v" USING btree ("parent_id");
  CREATE INDEX "_mock_papers_v_version_version_no_idx" ON "_mock_papers_v" USING btree ("version_no");
  CREATE INDEX "_mock_papers_v_version_version_l1_idx" ON "_mock_papers_v" USING btree ("version_l1_id");
  CREATE INDEX "_mock_papers_v_version_version_l2_idx" ON "_mock_papers_v" USING btree ("version_l2_id");
  CREATE INDEX "_mock_papers_v_version_version_l3_idx" ON "_mock_papers_v" USING btree ("version_l3_id");
  CREATE INDEX "_mock_papers_v_version_version_l4_idx" ON "_mock_papers_v" USING btree ("version_l4_id");
  CREATE INDEX "_mock_papers_v_version_version_r1_idx" ON "_mock_papers_v" USING btree ("version_r1_id");
  CREATE INDEX "_mock_papers_v_version_version_r2_idx" ON "_mock_papers_v" USING btree ("version_r2_id");
  CREATE INDEX "_mock_papers_v_version_version_r3_idx" ON "_mock_papers_v" USING btree ("version_r3_id");
  CREATE INDEX "_mock_papers_v_version_version_updated_at_idx" ON "_mock_papers_v" USING btree ("version_updated_at");
  CREATE INDEX "_mock_papers_v_version_version_created_at_idx" ON "_mock_papers_v" USING btree ("version_created_at");
  CREATE INDEX "_mock_papers_v_version_version__status_idx" ON "_mock_papers_v" USING btree ("version__status");
  CREATE INDEX "_mock_papers_v_created_at_idx" ON "_mock_papers_v" USING btree ("created_at");
  CREATE INDEX "_mock_papers_v_updated_at_idx" ON "_mock_papers_v" USING btree ("updated_at");
  CREATE INDEX "_mock_papers_v_latest_idx" ON "_mock_papers_v" USING btree ("latest");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mock_papers_fk" FOREIGN KEY ("mock_papers_id") REFERENCES "public"."mock_papers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_mock_papers_id_idx" ON "payload_locked_documents_rels" USING btree ("mock_papers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "mock_papers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_mock_papers_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "mock_papers" CASCADE;
  DROP TABLE "_mock_papers_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_mock_papers_fk";
  
  DROP INDEX "payload_locked_documents_rels_mock_papers_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mock_papers_id";
  DROP TYPE "public"."enum_mock_papers_status";
  DROP TYPE "public"."enum__mock_papers_v_version_status";`)
}
