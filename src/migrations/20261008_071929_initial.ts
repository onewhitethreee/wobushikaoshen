import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

import { listeningDefaults, readingDefaults } from '../exam/bandScaleDefaults'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_hero_links_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_pages_hero_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum_pages_blocks_cta_links_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_pages_blocks_cta_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum_pages_blocks_content_columns_size" AS ENUM('oneThird', 'half', 'twoThirds', 'full');
  CREATE TYPE "public"."enum_pages_blocks_content_columns_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_pages_blocks_content_columns_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum_pages_blocks_archive_populate_by" AS ENUM('collection', 'selection');
  CREATE TYPE "public"."enum_pages_blocks_archive_relation_to" AS ENUM('posts');
  CREATE TYPE "public"."enum_pages_hero_type" AS ENUM('none', 'highImpact', 'mediumImpact', 'lowImpact');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_version_hero_links_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum__pages_v_version_hero_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum__pages_v_blocks_cta_links_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum__pages_v_blocks_cta_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum__pages_v_blocks_content_columns_size" AS ENUM('oneThird', 'half', 'twoThirds', 'full');
  CREATE TYPE "public"."enum__pages_v_blocks_content_columns_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum__pages_v_blocks_content_columns_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum__pages_v_blocks_archive_populate_by" AS ENUM('collection', 'selection');
  CREATE TYPE "public"."enum__pages_v_blocks_archive_relation_to" AS ENUM('posts');
  CREATE TYPE "public"."enum__pages_v_version_hero_type" AS ENUM('none', 'highImpact', 'mediumImpact', 'lowImpact');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_tests_listening_parts_g_type" AS ENUM('single_choice', 'multi_choice', 'tfng', 'ynng', 'matching_headings', 'matching_information', 'matching_features', 'matching_endings', 'completion', 'short_answer', 'labelling');
  CREATE TYPE "public"."enum_tests_reading_passages_g_type" AS ENUM('single_choice', 'multi_choice', 'tfng', 'ynng', 'matching_headings', 'matching_information', 'matching_features', 'matching_endings', 'completion', 'short_answer', 'labelling');
  CREATE TYPE "public"."enum_tests_source_type" AS ENUM('original', 'ai_rewrite');
  CREATE TYPE "public"."enum_tests_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum___tests_v_version_listening_parts_g_v_type" AS ENUM('single_choice', 'multi_choice', 'tfng', 'ynng', 'matching_headings', 'matching_information', 'matching_features', 'matching_endings', 'completion', 'short_answer', 'labelling');
  CREATE TYPE "public"."enum___tests_v_version_reading_passages_g_v_type" AS ENUM('single_choice', 'multi_choice', 'tfng', 'ynng', 'matching_headings', 'matching_information', 'matching_features', 'matching_endings', 'completion', 'short_answer', 'labelling');
  CREATE TYPE "public"."enum__tests_v_version_source_type" AS ENUM('original', 'ai_rewrite');
  CREATE TYPE "public"."enum__tests_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_writing_tasks_task_type" AS ENUM('task1', 'task2');
  CREATE TYPE "public"."enum_writing_tasks_source_type" AS ENUM('original', 'ai_rewrite');
  CREATE TYPE "public"."enum_writing_tasks_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__writing_tasks_v_version_task_type" AS ENUM('task1', 'task2');
  CREATE TYPE "public"."enum__writing_tasks_v_version_source_type" AS ENUM('original', 'ai_rewrite');
  CREATE TYPE "public"."enum__writing_tasks_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_speaking_questions_part" AS ENUM('1', '2', '3');
  CREATE TYPE "public"."enum_speaking_questions_source_type" AS ENUM('original', 'ai_rewrite');
  CREATE TYPE "public"."enum_speaking_questions_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__speaking_questions_v_version_part" AS ENUM('1', '2', '3');
  CREATE TYPE "public"."enum__speaking_questions_v_version_source_type" AS ENUM('original', 'ai_rewrite');
  CREATE TYPE "public"."enum__speaking_questions_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_redirects_to_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "public"."enum_payload_folders_folder_type" AS ENUM('media');
  CREATE TYPE "public"."enum_header_nav_items_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_footer_nav_items_link_type" AS ENUM('reference', 'custom');
  CREATE TABLE "pages_hero_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_pages_hero_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum_pages_hero_links_link_appearance" DEFAULT 'default'
  );
  
  CREATE TABLE "pages_blocks_cta_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_pages_blocks_cta_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum_pages_blocks_cta_links_link_appearance" DEFAULT 'default'
  );
  
  CREATE TABLE "pages_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"rich_text" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_content_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"size" "enum_pages_blocks_content_columns_size" DEFAULT 'oneThird',
  	"rich_text" jsonb,
  	"enable_link" boolean,
  	"link_type" "enum_pages_blocks_content_columns_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum_pages_blocks_content_columns_link_appearance" DEFAULT 'default'
  );
  
  CREATE TABLE "pages_blocks_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_media_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"media_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_archive" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"intro_content" jsonb,
  	"populate_by" "enum_pages_blocks_archive_populate_by" DEFAULT 'collection',
  	"relation_to" "enum_pages_blocks_archive_relation_to" DEFAULT 'posts',
  	"limit" numeric DEFAULT 10,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"hero_type" "enum_pages_hero_type" DEFAULT 'lowImpact',
  	"hero_rich_text" jsonb,
  	"hero_media_id" integer,
  	"meta_title" varchar,
  	"meta_image_id" integer,
  	"meta_description" varchar,
  	"published_at" timestamp(3) with time zone,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "pages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"posts_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "_pages_v_version_hero_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__pages_v_version_hero_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum__pages_v_version_hero_links_link_appearance" DEFAULT 'default',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_cta_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__pages_v_blocks_cta_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum__pages_v_blocks_cta_links_link_appearance" DEFAULT 'default',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"rich_text" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_content_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"size" "enum__pages_v_blocks_content_columns_size" DEFAULT 'oneThird',
  	"rich_text" jsonb,
  	"enable_link" boolean,
  	"link_type" "enum__pages_v_blocks_content_columns_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum__pages_v_blocks_content_columns_link_appearance" DEFAULT 'default',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_media_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"media_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_archive" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"intro_content" jsonb,
  	"populate_by" "enum__pages_v_blocks_archive_populate_by" DEFAULT 'collection',
  	"relation_to" "enum__pages_v_blocks_archive_relation_to" DEFAULT 'posts',
  	"limit" numeric DEFAULT 10,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_hero_type" "enum__pages_v_version_hero_type" DEFAULT 'lowImpact',
  	"version_hero_rich_text" jsonb,
  	"version_hero_media_id" integer,
  	"version_meta_title" varchar,
  	"version_meta_image_id" integer,
  	"version_meta_description" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_pages_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"posts_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "posts_populated_authors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"hero_image_id" integer,
  	"content" jsonb,
  	"meta_title" varchar,
  	"meta_image_id" integer,
  	"meta_description" varchar,
  	"published_at" timestamp(3) with time zone,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"posts_id" integer,
  	"categories_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "_posts_v_version_populated_authors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"name" varchar
  );
  
  CREATE TABLE "_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_hero_image_id" integer,
  	"version_content" jsonb,
  	"version_meta_title" varchar,
  	"version_meta_image_id" integer,
  	"version_meta_description" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_posts_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"posts_id" integer,
  	"categories_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"caption" jsonb,
  	"folder_id" integer,
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
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_square_url" varchar,
  	"sizes_square_width" numeric,
  	"sizes_square_height" numeric,
  	"sizes_square_mime_type" varchar,
  	"sizes_square_filesize" numeric,
  	"sizes_square_filename" varchar,
  	"sizes_small_url" varchar,
  	"sizes_small_width" numeric,
  	"sizes_small_height" numeric,
  	"sizes_small_mime_type" varchar,
  	"sizes_small_filesize" numeric,
  	"sizes_small_filename" varchar,
  	"sizes_medium_url" varchar,
  	"sizes_medium_width" numeric,
  	"sizes_medium_height" numeric,
  	"sizes_medium_mime_type" varchar,
  	"sizes_medium_filesize" numeric,
  	"sizes_medium_filename" varchar,
  	"sizes_large_url" varchar,
  	"sizes_large_width" numeric,
  	"sizes_large_height" numeric,
  	"sizes_large_mime_type" varchar,
  	"sizes_large_filesize" numeric,
  	"sizes_large_filename" varchar,
  	"sizes_xlarge_url" varchar,
  	"sizes_xlarge_width" numeric,
  	"sizes_xlarge_height" numeric,
  	"sizes_xlarge_mime_type" varchar,
  	"sizes_xlarge_filesize" numeric,
  	"sizes_xlarge_filename" varchar,
  	"sizes_og_url" varchar,
  	"sizes_og_width" numeric,
  	"sizes_og_height" numeric,
  	"sizes_og_mime_type" varchar,
  	"sizes_og_filesize" numeric,
  	"sizes_og_filename" varchar
  );
  
  CREATE TABLE "categories_breadcrumbs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"doc_id" integer,
  	"url" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar NOT NULL,
  	"parent_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
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
  
  CREATE TABLE "tests_listening_parts_g_o" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"text" varchar
  );
  
  CREATE TABLE "tests_listening_parts_g_q_o" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"text" varchar
  );
  
  CREATE TABLE "tests_listening_parts_g_q" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"span" numeric DEFAULT 1,
  	"prompt" varchar,
  	"answers" varchar,
  	"explanation" varchar
  );
  
  CREATE TABLE "tests_listening_parts_g" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_tests_listening_parts_g_type",
  	"instructions" varchar,
  	"content" varchar,
  	"image_id" integer,
  	"max_words" numeric,
  	"number_allowed" boolean
  );
  
  CREATE TABLE "tests_listening_parts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"audio_id" integer,
  	"transcript" varchar
  );
  
  CREATE TABLE "tests_reading_passages_paragraphs" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"text" varchar
  );
  
  CREATE TABLE "tests_reading_passages_g_o" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"text" varchar
  );
  
  CREATE TABLE "tests_reading_passages_g_q_o" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"text" varchar
  );
  
  CREATE TABLE "tests_reading_passages_g_q" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"span" numeric DEFAULT 1,
  	"prompt" varchar,
  	"answers" varchar,
  	"explanation" varchar
  );
  
  CREATE TABLE "tests_reading_passages_g" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_tests_reading_passages_g_type",
  	"instructions" varchar,
  	"content" varchar,
  	"image_id" integer,
  	"max_words" numeric,
  	"number_allowed" boolean
  );
  
  CREATE TABLE "tests_reading_passages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"image_id" integer
  );
  
  CREATE TABLE "tests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"code" varchar,
  	"writing_task1_id" integer,
  	"writing_task2_id" integer,
  	"speaking_part2_id" integer,
  	"source_type" "enum_tests_source_type",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_tests_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "tests_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"speaking_questions_id" integer
  );
  
  CREATE TABLE "___tests_v_version_listening_parts_g_v_o_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "____tests_v_version_listening_parts_g_v_q_v_o_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "___tests_v_version_listening_parts_g_v_q_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"span" numeric DEFAULT 1,
  	"prompt" varchar,
  	"answers" varchar,
  	"explanation" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "__tests_v_version_listening_parts_g_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum___tests_v_version_listening_parts_g_v_type",
  	"instructions" varchar,
  	"content" varchar,
  	"image_id" integer,
  	"max_words" numeric,
  	"number_allowed" boolean,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_tests_v_version_listening_parts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"audio_id" integer,
  	"transcript" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_tests_v_version_reading_passages_paragraphs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "___tests_v_version_reading_passages_g_v_o_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "____tests_v_version_reading_passages_g_v_q_v_o_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "___tests_v_version_reading_passages_g_v_q_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"span" numeric DEFAULT 1,
  	"prompt" varchar,
  	"answers" varchar,
  	"explanation" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "__tests_v_version_reading_passages_g_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum___tests_v_version_reading_passages_g_v_type",
  	"instructions" varchar,
  	"content" varchar,
  	"image_id" integer,
  	"max_words" numeric,
  	"number_allowed" boolean,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_tests_v_version_reading_passages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"image_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_tests_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_code" varchar,
  	"version_writing_task1_id" integer,
  	"version_writing_task2_id" integer,
  	"version_speaking_part2_id" integer,
  	"version_source_type" "enum__tests_v_version_source_type",
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__tests_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_tests_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"speaking_questions_id" integer
  );
  
  CREATE TABLE "writing_tasks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"task_type" "enum_writing_tasks_task_type",
  	"title" varchar,
  	"prompt" varchar,
  	"image_id" integer,
  	"min_words" numeric,
  	"suggested_minutes" numeric,
  	"sample_answer" varchar,
  	"source_type" "enum_writing_tasks_source_type",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_writing_tasks_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_writing_tasks_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_task_type" "enum__writing_tasks_v_version_task_type",
  	"version_title" varchar,
  	"version_prompt" varchar,
  	"version_image_id" integer,
  	"version_min_words" numeric,
  	"version_suggested_minutes" numeric,
  	"version_sample_answer" varchar,
  	"version_source_type" "enum__writing_tasks_v_version_source_type",
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__writing_tasks_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "speaking_questions_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "speaking_questions_cue_points" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "speaking_questions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"part" "enum_speaking_questions_part",
  	"topic" varchar,
  	"cue_card" varchar,
  	"season" varchar,
  	"sample_answer" varchar,
  	"source_type" "enum_speaking_questions_source_type",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_speaking_questions_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "speaking_questions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"speaking_questions_id" integer
  );
  
  CREATE TABLE "_speaking_questions_v_version_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_speaking_questions_v_version_cue_points" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_speaking_questions_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_part" "enum__speaking_questions_v_version_part",
  	"version_topic" varchar,
  	"version_cue_card" varchar,
  	"version_season" varchar,
  	"version_sample_answer" varchar,
  	"version_source_type" "enum__speaking_questions_v_version_source_type",
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__speaking_questions_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_speaking_questions_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"speaking_questions_id" integer
  );
  
  CREATE TABLE "redirects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"from" varchar NOT NULL,
  	"to_type" "enum_redirects_to_type" DEFAULT 'reference',
  	"to_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "redirects_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"posts_id" integer
  );
  
  CREATE TABLE "search_categories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"relation_to" varchar,
  	"category_i_d" varchar,
  	"title" varchar
  );
  
  CREATE TABLE "search" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"priority" numeric,
  	"slug" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "search_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"posts_id" integer
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_folders_folder_type" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_payload_folders_folder_type",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload_folders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"posts_id" integer,
  	"media_id" integer,
  	"categories_id" integer,
  	"users_id" integer,
  	"tests_id" integer,
  	"writing_tasks_id" integer,
  	"speaking_questions_id" integer,
  	"redirects_id" integer,
  	"search_id" integer,
  	"payload_folders_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "header_nav_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_header_nav_items_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar NOT NULL
  );
  
  CREATE TABLE "header" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "header_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"posts_id" integer
  );
  
  CREATE TABLE "footer_nav_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_footer_nav_items_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar NOT NULL
  );
  
  CREATE TABLE "footer" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "footer_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"posts_id" integer
  );
  
  CREATE TABLE "band_scales_listening" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"min" numeric NOT NULL,
  	"max" numeric NOT NULL,
  	"band" numeric NOT NULL
  );
  
  CREATE TABLE "band_scales_reading" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"min" numeric NOT NULL,
  	"max" numeric NOT NULL,
  	"band" numeric NOT NULL
  );
  
  CREATE TABLE "band_scales" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "pages_hero_links" ADD CONSTRAINT "pages_hero_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_cta_links" ADD CONSTRAINT "pages_blocks_cta_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_cta"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_cta" ADD CONSTRAINT "pages_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_content_columns" ADD CONSTRAINT "pages_blocks_content_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_content" ADD CONSTRAINT "pages_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_media_block" ADD CONSTRAINT "pages_blocks_media_block_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_media_block" ADD CONSTRAINT "pages_blocks_media_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_archive" ADD CONSTRAINT "pages_blocks_archive_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_version_hero_links" ADD CONSTRAINT "_pages_v_version_hero_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_cta_links" ADD CONSTRAINT "_pages_v_blocks_cta_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_cta"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_cta" ADD CONSTRAINT "_pages_v_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_content_columns" ADD CONSTRAINT "_pages_v_blocks_content_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_content" ADD CONSTRAINT "_pages_v_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_media_block" ADD CONSTRAINT "_pages_v_blocks_media_block_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_media_block" ADD CONSTRAINT "_pages_v_blocks_media_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_archive" ADD CONSTRAINT "_pages_v_blocks_archive_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_hero_media_id_media_id_fk" FOREIGN KEY ("version_hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_populated_authors" ADD CONSTRAINT "posts_populated_authors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_version_populated_authors" ADD CONSTRAINT "_posts_v_version_populated_authors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_parent_id_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_breadcrumbs" ADD CONSTRAINT "categories_breadcrumbs_doc_id_categories_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_breadcrumbs" ADD CONSTRAINT "categories_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tests_listening_parts_g_o" ADD CONSTRAINT "tests_listening_parts_g_o_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tests_listening_parts_g"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tests_listening_parts_g_q_o" ADD CONSTRAINT "tests_listening_parts_g_q_o_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tests_listening_parts_g_q"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tests_listening_parts_g_q" ADD CONSTRAINT "tests_listening_parts_g_q_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tests_listening_parts_g"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tests_listening_parts_g" ADD CONSTRAINT "tests_listening_parts_g_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tests_listening_parts_g" ADD CONSTRAINT "tests_listening_parts_g_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tests_listening_parts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tests_listening_parts" ADD CONSTRAINT "tests_listening_parts_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tests_listening_parts" ADD CONSTRAINT "tests_listening_parts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tests_reading_passages_paragraphs" ADD CONSTRAINT "tests_reading_passages_paragraphs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tests_reading_passages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tests_reading_passages_g_o" ADD CONSTRAINT "tests_reading_passages_g_o_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tests_reading_passages_g"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tests_reading_passages_g_q_o" ADD CONSTRAINT "tests_reading_passages_g_q_o_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tests_reading_passages_g_q"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tests_reading_passages_g_q" ADD CONSTRAINT "tests_reading_passages_g_q_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tests_reading_passages_g"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tests_reading_passages_g" ADD CONSTRAINT "tests_reading_passages_g_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tests_reading_passages_g" ADD CONSTRAINT "tests_reading_passages_g_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tests_reading_passages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tests_reading_passages" ADD CONSTRAINT "tests_reading_passages_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tests_reading_passages" ADD CONSTRAINT "tests_reading_passages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tests" ADD CONSTRAINT "tests_writing_task1_id_writing_tasks_id_fk" FOREIGN KEY ("writing_task1_id") REFERENCES "public"."writing_tasks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tests" ADD CONSTRAINT "tests_writing_task2_id_writing_tasks_id_fk" FOREIGN KEY ("writing_task2_id") REFERENCES "public"."writing_tasks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tests" ADD CONSTRAINT "tests_speaking_part2_id_speaking_questions_id_fk" FOREIGN KEY ("speaking_part2_id") REFERENCES "public"."speaking_questions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tests_rels" ADD CONSTRAINT "tests_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tests_rels" ADD CONSTRAINT "tests_rels_speaking_questions_fk" FOREIGN KEY ("speaking_questions_id") REFERENCES "public"."speaking_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "___tests_v_version_listening_parts_g_v_o_v" ADD CONSTRAINT "___tests_v_version_listening_parts_g_v_o_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."__tests_v_version_listening_parts_g_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "____tests_v_version_listening_parts_g_v_q_v_o_v" ADD CONSTRAINT "____tests_v_version_listening_parts_g_v_q_v_o_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."___tests_v_version_listening_parts_g_v_q_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "___tests_v_version_listening_parts_g_v_q_v" ADD CONSTRAINT "___tests_v_version_listening_parts_g_v_q_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."__tests_v_version_listening_parts_g_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "__tests_v_version_listening_parts_g_v" ADD CONSTRAINT "__tests_v_version_listening_parts_g_v_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "__tests_v_version_listening_parts_g_v" ADD CONSTRAINT "__tests_v_version_listening_parts_g_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_tests_v_version_listening_parts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tests_v_version_listening_parts" ADD CONSTRAINT "_tests_v_version_listening_parts_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tests_v_version_listening_parts" ADD CONSTRAINT "_tests_v_version_listening_parts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_tests_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tests_v_version_reading_passages_paragraphs" ADD CONSTRAINT "_tests_v_version_reading_passages_paragraphs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_tests_v_version_reading_passages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "___tests_v_version_reading_passages_g_v_o_v" ADD CONSTRAINT "___tests_v_version_reading_passages_g_v_o_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."__tests_v_version_reading_passages_g_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "____tests_v_version_reading_passages_g_v_q_v_o_v" ADD CONSTRAINT "____tests_v_version_reading_passages_g_v_q_v_o_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."___tests_v_version_reading_passages_g_v_q_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "___tests_v_version_reading_passages_g_v_q_v" ADD CONSTRAINT "___tests_v_version_reading_passages_g_v_q_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."__tests_v_version_reading_passages_g_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "__tests_v_version_reading_passages_g_v" ADD CONSTRAINT "__tests_v_version_reading_passages_g_v_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "__tests_v_version_reading_passages_g_v" ADD CONSTRAINT "__tests_v_version_reading_passages_g_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_tests_v_version_reading_passages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tests_v_version_reading_passages" ADD CONSTRAINT "_tests_v_version_reading_passages_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tests_v_version_reading_passages" ADD CONSTRAINT "_tests_v_version_reading_passages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_tests_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tests_v" ADD CONSTRAINT "_tests_v_parent_id_tests_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tests"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tests_v" ADD CONSTRAINT "_tests_v_version_writing_task1_id_writing_tasks_id_fk" FOREIGN KEY ("version_writing_task1_id") REFERENCES "public"."writing_tasks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tests_v" ADD CONSTRAINT "_tests_v_version_writing_task2_id_writing_tasks_id_fk" FOREIGN KEY ("version_writing_task2_id") REFERENCES "public"."writing_tasks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tests_v" ADD CONSTRAINT "_tests_v_version_speaking_part2_id_speaking_questions_id_fk" FOREIGN KEY ("version_speaking_part2_id") REFERENCES "public"."speaking_questions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tests_v_rels" ADD CONSTRAINT "_tests_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_tests_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tests_v_rels" ADD CONSTRAINT "_tests_v_rels_speaking_questions_fk" FOREIGN KEY ("speaking_questions_id") REFERENCES "public"."speaking_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "writing_tasks" ADD CONSTRAINT "writing_tasks_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_writing_tasks_v" ADD CONSTRAINT "_writing_tasks_v_parent_id_writing_tasks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."writing_tasks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_writing_tasks_v" ADD CONSTRAINT "_writing_tasks_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "speaking_questions_questions" ADD CONSTRAINT "speaking_questions_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."speaking_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "speaking_questions_cue_points" ADD CONSTRAINT "speaking_questions_cue_points_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."speaking_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "speaking_questions_rels" ADD CONSTRAINT "speaking_questions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."speaking_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "speaking_questions_rels" ADD CONSTRAINT "speaking_questions_rels_speaking_questions_fk" FOREIGN KEY ("speaking_questions_id") REFERENCES "public"."speaking_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_speaking_questions_v_version_questions" ADD CONSTRAINT "_speaking_questions_v_version_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_speaking_questions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_speaking_questions_v_version_cue_points" ADD CONSTRAINT "_speaking_questions_v_version_cue_points_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_speaking_questions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_speaking_questions_v" ADD CONSTRAINT "_speaking_questions_v_parent_id_speaking_questions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."speaking_questions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_speaking_questions_v_rels" ADD CONSTRAINT "_speaking_questions_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_speaking_questions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_speaking_questions_v_rels" ADD CONSTRAINT "_speaking_questions_v_rels_speaking_questions_fk" FOREIGN KEY ("speaking_questions_id") REFERENCES "public"."speaking_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_categories" ADD CONSTRAINT "search_categories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search" ADD CONSTRAINT "search_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_folders_folder_type" ADD CONSTRAINT "payload_folders_folder_type_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_folders" ADD CONSTRAINT "payload_folders_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tests_fk" FOREIGN KEY ("tests_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_writing_tasks_fk" FOREIGN KEY ("writing_tasks_id") REFERENCES "public"."writing_tasks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_speaking_questions_fk" FOREIGN KEY ("speaking_questions_id") REFERENCES "public"."speaking_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_search_fk" FOREIGN KEY ("search_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_folders_fk" FOREIGN KEY ("payload_folders_id") REFERENCES "public"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "header_nav_items" ADD CONSTRAINT "header_nav_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."header"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "header_rels" ADD CONSTRAINT "header_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."header"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "header_rels" ADD CONSTRAINT "header_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "header_rels" ADD CONSTRAINT "header_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_nav_items" ADD CONSTRAINT "footer_nav_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "band_scales_listening" ADD CONSTRAINT "band_scales_listening_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."band_scales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "band_scales_reading" ADD CONSTRAINT "band_scales_reading_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."band_scales"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_hero_links_order_idx" ON "pages_hero_links" USING btree ("_order");
  CREATE INDEX "pages_hero_links_parent_id_idx" ON "pages_hero_links" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cta_links_order_idx" ON "pages_blocks_cta_links" USING btree ("_order");
  CREATE INDEX "pages_blocks_cta_links_parent_id_idx" ON "pages_blocks_cta_links" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cta_order_idx" ON "pages_blocks_cta" USING btree ("_order");
  CREATE INDEX "pages_blocks_cta_parent_id_idx" ON "pages_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cta_path_idx" ON "pages_blocks_cta" USING btree ("_path");
  CREATE INDEX "pages_blocks_content_columns_order_idx" ON "pages_blocks_content_columns" USING btree ("_order");
  CREATE INDEX "pages_blocks_content_columns_parent_id_idx" ON "pages_blocks_content_columns" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_content_order_idx" ON "pages_blocks_content" USING btree ("_order");
  CREATE INDEX "pages_blocks_content_parent_id_idx" ON "pages_blocks_content" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_content_path_idx" ON "pages_blocks_content" USING btree ("_path");
  CREATE INDEX "pages_blocks_media_block_order_idx" ON "pages_blocks_media_block" USING btree ("_order");
  CREATE INDEX "pages_blocks_media_block_parent_id_idx" ON "pages_blocks_media_block" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_media_block_path_idx" ON "pages_blocks_media_block" USING btree ("_path");
  CREATE INDEX "pages_blocks_media_block_media_idx" ON "pages_blocks_media_block" USING btree ("media_id");
  CREATE INDEX "pages_blocks_archive_order_idx" ON "pages_blocks_archive" USING btree ("_order");
  CREATE INDEX "pages_blocks_archive_parent_id_idx" ON "pages_blocks_archive" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_archive_path_idx" ON "pages_blocks_archive" USING btree ("_path");
  CREATE INDEX "pages_hero_hero_media_idx" ON "pages" USING btree ("hero_media_id");
  CREATE INDEX "pages_meta_meta_image_idx" ON "pages" USING btree ("meta_image_id");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "pages_rels_order_idx" ON "pages_rels" USING btree ("order");
  CREATE INDEX "pages_rels_parent_idx" ON "pages_rels" USING btree ("parent_id");
  CREATE INDEX "pages_rels_path_idx" ON "pages_rels" USING btree ("path");
  CREATE INDEX "pages_rels_pages_id_idx" ON "pages_rels" USING btree ("pages_id");
  CREATE INDEX "pages_rels_posts_id_idx" ON "pages_rels" USING btree ("posts_id");
  CREATE INDEX "pages_rels_categories_id_idx" ON "pages_rels" USING btree ("categories_id");
  CREATE INDEX "_pages_v_version_hero_links_order_idx" ON "_pages_v_version_hero_links" USING btree ("_order");
  CREATE INDEX "_pages_v_version_hero_links_parent_id_idx" ON "_pages_v_version_hero_links" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_cta_links_order_idx" ON "_pages_v_blocks_cta_links" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_cta_links_parent_id_idx" ON "_pages_v_blocks_cta_links" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_cta_order_idx" ON "_pages_v_blocks_cta" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_cta_parent_id_idx" ON "_pages_v_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_cta_path_idx" ON "_pages_v_blocks_cta" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_content_columns_order_idx" ON "_pages_v_blocks_content_columns" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_content_columns_parent_id_idx" ON "_pages_v_blocks_content_columns" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_content_order_idx" ON "_pages_v_blocks_content" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_content_parent_id_idx" ON "_pages_v_blocks_content" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_content_path_idx" ON "_pages_v_blocks_content" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_media_block_order_idx" ON "_pages_v_blocks_media_block" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_media_block_parent_id_idx" ON "_pages_v_blocks_media_block" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_media_block_path_idx" ON "_pages_v_blocks_media_block" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_media_block_media_idx" ON "_pages_v_blocks_media_block" USING btree ("media_id");
  CREATE INDEX "_pages_v_blocks_archive_order_idx" ON "_pages_v_blocks_archive" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_archive_parent_id_idx" ON "_pages_v_blocks_archive" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_archive_path_idx" ON "_pages_v_blocks_archive" USING btree ("_path");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_hero_version_hero_media_idx" ON "_pages_v" USING btree ("version_hero_media_id");
  CREATE INDEX "_pages_v_version_meta_version_meta_image_idx" ON "_pages_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX "_pages_v_autosave_idx" ON "_pages_v" USING btree ("autosave");
  CREATE INDEX "_pages_v_rels_order_idx" ON "_pages_v_rels" USING btree ("order");
  CREATE INDEX "_pages_v_rels_parent_idx" ON "_pages_v_rels" USING btree ("parent_id");
  CREATE INDEX "_pages_v_rels_path_idx" ON "_pages_v_rels" USING btree ("path");
  CREATE INDEX "_pages_v_rels_pages_id_idx" ON "_pages_v_rels" USING btree ("pages_id");
  CREATE INDEX "_pages_v_rels_posts_id_idx" ON "_pages_v_rels" USING btree ("posts_id");
  CREATE INDEX "_pages_v_rels_categories_id_idx" ON "_pages_v_rels" USING btree ("categories_id");
  CREATE INDEX "posts_populated_authors_order_idx" ON "posts_populated_authors" USING btree ("_order");
  CREATE INDEX "posts_populated_authors_parent_id_idx" ON "posts_populated_authors" USING btree ("_parent_id");
  CREATE INDEX "posts_hero_image_idx" ON "posts" USING btree ("hero_image_id");
  CREATE INDEX "posts_meta_meta_image_idx" ON "posts" USING btree ("meta_image_id");
  CREATE UNIQUE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");
  CREATE INDEX "posts_updated_at_idx" ON "posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");
  CREATE INDEX "posts__status_idx" ON "posts" USING btree ("_status");
  CREATE INDEX "posts_rels_order_idx" ON "posts_rels" USING btree ("order");
  CREATE INDEX "posts_rels_parent_idx" ON "posts_rels" USING btree ("parent_id");
  CREATE INDEX "posts_rels_path_idx" ON "posts_rels" USING btree ("path");
  CREATE INDEX "posts_rels_posts_id_idx" ON "posts_rels" USING btree ("posts_id");
  CREATE INDEX "posts_rels_categories_id_idx" ON "posts_rels" USING btree ("categories_id");
  CREATE INDEX "posts_rels_users_id_idx" ON "posts_rels" USING btree ("users_id");
  CREATE INDEX "_posts_v_version_populated_authors_order_idx" ON "_posts_v_version_populated_authors" USING btree ("_order");
  CREATE INDEX "_posts_v_version_populated_authors_parent_id_idx" ON "_posts_v_version_populated_authors" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_parent_idx" ON "_posts_v" USING btree ("parent_id");
  CREATE INDEX "_posts_v_version_version_hero_image_idx" ON "_posts_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_posts_v_version_meta_version_meta_image_idx" ON "_posts_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_posts_v_version_version_slug_idx" ON "_posts_v" USING btree ("version_slug");
  CREATE INDEX "_posts_v_version_version_updated_at_idx" ON "_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_posts_v_version_version_created_at_idx" ON "_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "_posts_v" USING btree ("version__status");
  CREATE INDEX "_posts_v_created_at_idx" ON "_posts_v" USING btree ("created_at");
  CREATE INDEX "_posts_v_updated_at_idx" ON "_posts_v" USING btree ("updated_at");
  CREATE INDEX "_posts_v_latest_idx" ON "_posts_v" USING btree ("latest");
  CREATE INDEX "_posts_v_autosave_idx" ON "_posts_v" USING btree ("autosave");
  CREATE INDEX "_posts_v_rels_order_idx" ON "_posts_v_rels" USING btree ("order");
  CREATE INDEX "_posts_v_rels_parent_idx" ON "_posts_v_rels" USING btree ("parent_id");
  CREATE INDEX "_posts_v_rels_path_idx" ON "_posts_v_rels" USING btree ("path");
  CREATE INDEX "_posts_v_rels_posts_id_idx" ON "_posts_v_rels" USING btree ("posts_id");
  CREATE INDEX "_posts_v_rels_categories_id_idx" ON "_posts_v_rels" USING btree ("categories_id");
  CREATE INDEX "_posts_v_rels_users_id_idx" ON "_posts_v_rels" USING btree ("users_id");
  CREATE INDEX "media_folder_idx" ON "media" USING btree ("folder_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_square_sizes_square_filename_idx" ON "media" USING btree ("sizes_square_filename");
  CREATE INDEX "media_sizes_small_sizes_small_filename_idx" ON "media" USING btree ("sizes_small_filename");
  CREATE INDEX "media_sizes_medium_sizes_medium_filename_idx" ON "media" USING btree ("sizes_medium_filename");
  CREATE INDEX "media_sizes_large_sizes_large_filename_idx" ON "media" USING btree ("sizes_large_filename");
  CREATE INDEX "media_sizes_xlarge_sizes_xlarge_filename_idx" ON "media" USING btree ("sizes_xlarge_filename");
  CREATE INDEX "media_sizes_og_sizes_og_filename_idx" ON "media" USING btree ("sizes_og_filename");
  CREATE INDEX "categories_breadcrumbs_order_idx" ON "categories_breadcrumbs" USING btree ("_order");
  CREATE INDEX "categories_breadcrumbs_parent_id_idx" ON "categories_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX "categories_breadcrumbs_doc_idx" ON "categories_breadcrumbs" USING btree ("doc_id");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "tests_listening_parts_g_o_order_idx" ON "tests_listening_parts_g_o" USING btree ("_order");
  CREATE INDEX "tests_listening_parts_g_o_parent_id_idx" ON "tests_listening_parts_g_o" USING btree ("_parent_id");
  CREATE INDEX "tests_listening_parts_g_q_o_order_idx" ON "tests_listening_parts_g_q_o" USING btree ("_order");
  CREATE INDEX "tests_listening_parts_g_q_o_parent_id_idx" ON "tests_listening_parts_g_q_o" USING btree ("_parent_id");
  CREATE INDEX "tests_listening_parts_g_q_order_idx" ON "tests_listening_parts_g_q" USING btree ("_order");
  CREATE INDEX "tests_listening_parts_g_q_parent_id_idx" ON "tests_listening_parts_g_q" USING btree ("_parent_id");
  CREATE INDEX "tests_listening_parts_g_order_idx" ON "tests_listening_parts_g" USING btree ("_order");
  CREATE INDEX "tests_listening_parts_g_parent_id_idx" ON "tests_listening_parts_g" USING btree ("_parent_id");
  CREATE INDEX "tests_listening_parts_g_image_idx" ON "tests_listening_parts_g" USING btree ("image_id");
  CREATE INDEX "tests_listening_parts_order_idx" ON "tests_listening_parts" USING btree ("_order");
  CREATE INDEX "tests_listening_parts_parent_id_idx" ON "tests_listening_parts" USING btree ("_parent_id");
  CREATE INDEX "tests_listening_parts_audio_idx" ON "tests_listening_parts" USING btree ("audio_id");
  CREATE INDEX "tests_reading_passages_paragraphs_order_idx" ON "tests_reading_passages_paragraphs" USING btree ("_order");
  CREATE INDEX "tests_reading_passages_paragraphs_parent_id_idx" ON "tests_reading_passages_paragraphs" USING btree ("_parent_id");
  CREATE INDEX "tests_reading_passages_g_o_order_idx" ON "tests_reading_passages_g_o" USING btree ("_order");
  CREATE INDEX "tests_reading_passages_g_o_parent_id_idx" ON "tests_reading_passages_g_o" USING btree ("_parent_id");
  CREATE INDEX "tests_reading_passages_g_q_o_order_idx" ON "tests_reading_passages_g_q_o" USING btree ("_order");
  CREATE INDEX "tests_reading_passages_g_q_o_parent_id_idx" ON "tests_reading_passages_g_q_o" USING btree ("_parent_id");
  CREATE INDEX "tests_reading_passages_g_q_order_idx" ON "tests_reading_passages_g_q" USING btree ("_order");
  CREATE INDEX "tests_reading_passages_g_q_parent_id_idx" ON "tests_reading_passages_g_q" USING btree ("_parent_id");
  CREATE INDEX "tests_reading_passages_g_order_idx" ON "tests_reading_passages_g" USING btree ("_order");
  CREATE INDEX "tests_reading_passages_g_parent_id_idx" ON "tests_reading_passages_g" USING btree ("_parent_id");
  CREATE INDEX "tests_reading_passages_g_image_idx" ON "tests_reading_passages_g" USING btree ("image_id");
  CREATE INDEX "tests_reading_passages_order_idx" ON "tests_reading_passages" USING btree ("_order");
  CREATE INDEX "tests_reading_passages_parent_id_idx" ON "tests_reading_passages" USING btree ("_parent_id");
  CREATE INDEX "tests_reading_passages_image_idx" ON "tests_reading_passages" USING btree ("image_id");
  CREATE UNIQUE INDEX "tests_code_idx" ON "tests" USING btree ("code");
  CREATE INDEX "tests_writing_writing_task1_idx" ON "tests" USING btree ("writing_task1_id");
  CREATE INDEX "tests_writing_writing_task2_idx" ON "tests" USING btree ("writing_task2_id");
  CREATE INDEX "tests_speaking_speaking_part2_idx" ON "tests" USING btree ("speaking_part2_id");
  CREATE INDEX "tests_updated_at_idx" ON "tests" USING btree ("updated_at");
  CREATE INDEX "tests_created_at_idx" ON "tests" USING btree ("created_at");
  CREATE INDEX "tests__status_idx" ON "tests" USING btree ("_status");
  CREATE INDEX "tests_rels_order_idx" ON "tests_rels" USING btree ("order");
  CREATE INDEX "tests_rels_parent_idx" ON "tests_rels" USING btree ("parent_id");
  CREATE INDEX "tests_rels_path_idx" ON "tests_rels" USING btree ("path");
  CREATE INDEX "tests_rels_speaking_questions_id_idx" ON "tests_rels" USING btree ("speaking_questions_id");
  CREATE INDEX "___tests_v_version_listening_parts_g_v_o_v_order_idx" ON "___tests_v_version_listening_parts_g_v_o_v" USING btree ("_order");
  CREATE INDEX "___tests_v_version_listening_parts_g_v_o_v_parent_id_idx" ON "___tests_v_version_listening_parts_g_v_o_v" USING btree ("_parent_id");
  CREATE INDEX "____tests_v_version_listening_parts_g_v_q_v_o_v_order_idx" ON "____tests_v_version_listening_parts_g_v_q_v_o_v" USING btree ("_order");
  CREATE INDEX "____tests_v_version_listening_parts_g_v_q_v_o_v_parent_id_idx" ON "____tests_v_version_listening_parts_g_v_q_v_o_v" USING btree ("_parent_id");
  CREATE INDEX "___tests_v_version_listening_parts_g_v_q_v_order_idx" ON "___tests_v_version_listening_parts_g_v_q_v" USING btree ("_order");
  CREATE INDEX "___tests_v_version_listening_parts_g_v_q_v_parent_id_idx" ON "___tests_v_version_listening_parts_g_v_q_v" USING btree ("_parent_id");
  CREATE INDEX "__tests_v_version_listening_parts_g_v_order_idx" ON "__tests_v_version_listening_parts_g_v" USING btree ("_order");
  CREATE INDEX "__tests_v_version_listening_parts_g_v_parent_id_idx" ON "__tests_v_version_listening_parts_g_v" USING btree ("_parent_id");
  CREATE INDEX "__tests_v_version_listening_parts_g_v_image_idx" ON "__tests_v_version_listening_parts_g_v" USING btree ("image_id");
  CREATE INDEX "_tests_v_version_listening_parts_order_idx" ON "_tests_v_version_listening_parts" USING btree ("_order");
  CREATE INDEX "_tests_v_version_listening_parts_parent_id_idx" ON "_tests_v_version_listening_parts" USING btree ("_parent_id");
  CREATE INDEX "_tests_v_version_listening_parts_audio_idx" ON "_tests_v_version_listening_parts" USING btree ("audio_id");
  CREATE INDEX "_tests_v_version_reading_passages_paragraphs_order_idx" ON "_tests_v_version_reading_passages_paragraphs" USING btree ("_order");
  CREATE INDEX "_tests_v_version_reading_passages_paragraphs_parent_id_idx" ON "_tests_v_version_reading_passages_paragraphs" USING btree ("_parent_id");
  CREATE INDEX "___tests_v_version_reading_passages_g_v_o_v_order_idx" ON "___tests_v_version_reading_passages_g_v_o_v" USING btree ("_order");
  CREATE INDEX "___tests_v_version_reading_passages_g_v_o_v_parent_id_idx" ON "___tests_v_version_reading_passages_g_v_o_v" USING btree ("_parent_id");
  CREATE INDEX "____tests_v_version_reading_passages_g_v_q_v_o_v_order_idx" ON "____tests_v_version_reading_passages_g_v_q_v_o_v" USING btree ("_order");
  CREATE INDEX "____tests_v_version_reading_passages_g_v_q_v_o_v_parent_id_idx" ON "____tests_v_version_reading_passages_g_v_q_v_o_v" USING btree ("_parent_id");
  CREATE INDEX "___tests_v_version_reading_passages_g_v_q_v_order_idx" ON "___tests_v_version_reading_passages_g_v_q_v" USING btree ("_order");
  CREATE INDEX "___tests_v_version_reading_passages_g_v_q_v_parent_id_idx" ON "___tests_v_version_reading_passages_g_v_q_v" USING btree ("_parent_id");
  CREATE INDEX "__tests_v_version_reading_passages_g_v_order_idx" ON "__tests_v_version_reading_passages_g_v" USING btree ("_order");
  CREATE INDEX "__tests_v_version_reading_passages_g_v_parent_id_idx" ON "__tests_v_version_reading_passages_g_v" USING btree ("_parent_id");
  CREATE INDEX "__tests_v_version_reading_passages_g_v_image_idx" ON "__tests_v_version_reading_passages_g_v" USING btree ("image_id");
  CREATE INDEX "_tests_v_version_reading_passages_order_idx" ON "_tests_v_version_reading_passages" USING btree ("_order");
  CREATE INDEX "_tests_v_version_reading_passages_parent_id_idx" ON "_tests_v_version_reading_passages" USING btree ("_parent_id");
  CREATE INDEX "_tests_v_version_reading_passages_image_idx" ON "_tests_v_version_reading_passages" USING btree ("image_id");
  CREATE INDEX "_tests_v_parent_idx" ON "_tests_v" USING btree ("parent_id");
  CREATE INDEX "_tests_v_version_version_code_idx" ON "_tests_v" USING btree ("version_code");
  CREATE INDEX "_tests_v_version_writing_version_writing_task1_idx" ON "_tests_v" USING btree ("version_writing_task1_id");
  CREATE INDEX "_tests_v_version_writing_version_writing_task2_idx" ON "_tests_v" USING btree ("version_writing_task2_id");
  CREATE INDEX "_tests_v_version_speaking_version_speaking_part2_idx" ON "_tests_v" USING btree ("version_speaking_part2_id");
  CREATE INDEX "_tests_v_version_version_updated_at_idx" ON "_tests_v" USING btree ("version_updated_at");
  CREATE INDEX "_tests_v_version_version_created_at_idx" ON "_tests_v" USING btree ("version_created_at");
  CREATE INDEX "_tests_v_version_version__status_idx" ON "_tests_v" USING btree ("version__status");
  CREATE INDEX "_tests_v_created_at_idx" ON "_tests_v" USING btree ("created_at");
  CREATE INDEX "_tests_v_updated_at_idx" ON "_tests_v" USING btree ("updated_at");
  CREATE INDEX "_tests_v_latest_idx" ON "_tests_v" USING btree ("latest");
  CREATE INDEX "_tests_v_rels_order_idx" ON "_tests_v_rels" USING btree ("order");
  CREATE INDEX "_tests_v_rels_parent_idx" ON "_tests_v_rels" USING btree ("parent_id");
  CREATE INDEX "_tests_v_rels_path_idx" ON "_tests_v_rels" USING btree ("path");
  CREATE INDEX "_tests_v_rels_speaking_questions_id_idx" ON "_tests_v_rels" USING btree ("speaking_questions_id");
  CREATE INDEX "writing_tasks_image_idx" ON "writing_tasks" USING btree ("image_id");
  CREATE INDEX "writing_tasks_updated_at_idx" ON "writing_tasks" USING btree ("updated_at");
  CREATE INDEX "writing_tasks_created_at_idx" ON "writing_tasks" USING btree ("created_at");
  CREATE INDEX "writing_tasks__status_idx" ON "writing_tasks" USING btree ("_status");
  CREATE INDEX "_writing_tasks_v_parent_idx" ON "_writing_tasks_v" USING btree ("parent_id");
  CREATE INDEX "_writing_tasks_v_version_version_image_idx" ON "_writing_tasks_v" USING btree ("version_image_id");
  CREATE INDEX "_writing_tasks_v_version_version_updated_at_idx" ON "_writing_tasks_v" USING btree ("version_updated_at");
  CREATE INDEX "_writing_tasks_v_version_version_created_at_idx" ON "_writing_tasks_v" USING btree ("version_created_at");
  CREATE INDEX "_writing_tasks_v_version_version__status_idx" ON "_writing_tasks_v" USING btree ("version__status");
  CREATE INDEX "_writing_tasks_v_created_at_idx" ON "_writing_tasks_v" USING btree ("created_at");
  CREATE INDEX "_writing_tasks_v_updated_at_idx" ON "_writing_tasks_v" USING btree ("updated_at");
  CREATE INDEX "_writing_tasks_v_latest_idx" ON "_writing_tasks_v" USING btree ("latest");
  CREATE INDEX "speaking_questions_questions_order_idx" ON "speaking_questions_questions" USING btree ("_order");
  CREATE INDEX "speaking_questions_questions_parent_id_idx" ON "speaking_questions_questions" USING btree ("_parent_id");
  CREATE INDEX "speaking_questions_cue_points_order_idx" ON "speaking_questions_cue_points" USING btree ("_order");
  CREATE INDEX "speaking_questions_cue_points_parent_id_idx" ON "speaking_questions_cue_points" USING btree ("_parent_id");
  CREATE INDEX "speaking_questions_updated_at_idx" ON "speaking_questions" USING btree ("updated_at");
  CREATE INDEX "speaking_questions_created_at_idx" ON "speaking_questions" USING btree ("created_at");
  CREATE INDEX "speaking_questions__status_idx" ON "speaking_questions" USING btree ("_status");
  CREATE INDEX "speaking_questions_rels_order_idx" ON "speaking_questions_rels" USING btree ("order");
  CREATE INDEX "speaking_questions_rels_parent_idx" ON "speaking_questions_rels" USING btree ("parent_id");
  CREATE INDEX "speaking_questions_rels_path_idx" ON "speaking_questions_rels" USING btree ("path");
  CREATE INDEX "speaking_questions_rels_speaking_questions_id_idx" ON "speaking_questions_rels" USING btree ("speaking_questions_id");
  CREATE INDEX "_speaking_questions_v_version_questions_order_idx" ON "_speaking_questions_v_version_questions" USING btree ("_order");
  CREATE INDEX "_speaking_questions_v_version_questions_parent_id_idx" ON "_speaking_questions_v_version_questions" USING btree ("_parent_id");
  CREATE INDEX "_speaking_questions_v_version_cue_points_order_idx" ON "_speaking_questions_v_version_cue_points" USING btree ("_order");
  CREATE INDEX "_speaking_questions_v_version_cue_points_parent_id_idx" ON "_speaking_questions_v_version_cue_points" USING btree ("_parent_id");
  CREATE INDEX "_speaking_questions_v_parent_idx" ON "_speaking_questions_v" USING btree ("parent_id");
  CREATE INDEX "_speaking_questions_v_version_version_updated_at_idx" ON "_speaking_questions_v" USING btree ("version_updated_at");
  CREATE INDEX "_speaking_questions_v_version_version_created_at_idx" ON "_speaking_questions_v" USING btree ("version_created_at");
  CREATE INDEX "_speaking_questions_v_version_version__status_idx" ON "_speaking_questions_v" USING btree ("version__status");
  CREATE INDEX "_speaking_questions_v_created_at_idx" ON "_speaking_questions_v" USING btree ("created_at");
  CREATE INDEX "_speaking_questions_v_updated_at_idx" ON "_speaking_questions_v" USING btree ("updated_at");
  CREATE INDEX "_speaking_questions_v_latest_idx" ON "_speaking_questions_v" USING btree ("latest");
  CREATE INDEX "_speaking_questions_v_rels_order_idx" ON "_speaking_questions_v_rels" USING btree ("order");
  CREATE INDEX "_speaking_questions_v_rels_parent_idx" ON "_speaking_questions_v_rels" USING btree ("parent_id");
  CREATE INDEX "_speaking_questions_v_rels_path_idx" ON "_speaking_questions_v_rels" USING btree ("path");
  CREATE INDEX "_speaking_questions_v_rels_speaking_questions_id_idx" ON "_speaking_questions_v_rels" USING btree ("speaking_questions_id");
  CREATE UNIQUE INDEX "redirects_from_idx" ON "redirects" USING btree ("from");
  CREATE INDEX "redirects_updated_at_idx" ON "redirects" USING btree ("updated_at");
  CREATE INDEX "redirects_created_at_idx" ON "redirects" USING btree ("created_at");
  CREATE INDEX "redirects_rels_order_idx" ON "redirects_rels" USING btree ("order");
  CREATE INDEX "redirects_rels_parent_idx" ON "redirects_rels" USING btree ("parent_id");
  CREATE INDEX "redirects_rels_path_idx" ON "redirects_rels" USING btree ("path");
  CREATE INDEX "redirects_rels_pages_id_idx" ON "redirects_rels" USING btree ("pages_id");
  CREATE INDEX "redirects_rels_posts_id_idx" ON "redirects_rels" USING btree ("posts_id");
  CREATE INDEX "search_categories_order_idx" ON "search_categories" USING btree ("_order");
  CREATE INDEX "search_categories_parent_id_idx" ON "search_categories" USING btree ("_parent_id");
  CREATE INDEX "search_slug_idx" ON "search" USING btree ("slug");
  CREATE INDEX "search_meta_meta_image_idx" ON "search" USING btree ("meta_image_id");
  CREATE INDEX "search_updated_at_idx" ON "search" USING btree ("updated_at");
  CREATE INDEX "search_created_at_idx" ON "search" USING btree ("created_at");
  CREATE INDEX "search_rels_order_idx" ON "search_rels" USING btree ("order");
  CREATE INDEX "search_rels_parent_idx" ON "search_rels" USING btree ("parent_id");
  CREATE INDEX "search_rels_path_idx" ON "search_rels" USING btree ("path");
  CREATE INDEX "search_rels_posts_id_idx" ON "search_rels" USING btree ("posts_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_folders_folder_type_order_idx" ON "payload_folders_folder_type" USING btree ("order");
  CREATE INDEX "payload_folders_folder_type_parent_idx" ON "payload_folders_folder_type" USING btree ("parent_id");
  CREATE INDEX "payload_folders_name_idx" ON "payload_folders" USING btree ("name");
  CREATE INDEX "payload_folders_folder_idx" ON "payload_folders" USING btree ("folder_id");
  CREATE INDEX "payload_folders_updated_at_idx" ON "payload_folders" USING btree ("updated_at");
  CREATE INDEX "payload_folders_created_at_idx" ON "payload_folders" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_tests_id_idx" ON "payload_locked_documents_rels" USING btree ("tests_id");
  CREATE INDEX "payload_locked_documents_rels_writing_tasks_id_idx" ON "payload_locked_documents_rels" USING btree ("writing_tasks_id");
  CREATE INDEX "payload_locked_documents_rels_speaking_questions_id_idx" ON "payload_locked_documents_rels" USING btree ("speaking_questions_id");
  CREATE INDEX "payload_locked_documents_rels_redirects_id_idx" ON "payload_locked_documents_rels" USING btree ("redirects_id");
  CREATE INDEX "payload_locked_documents_rels_search_id_idx" ON "payload_locked_documents_rels" USING btree ("search_id");
  CREATE INDEX "payload_locked_documents_rels_payload_folders_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_folders_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "header_nav_items_order_idx" ON "header_nav_items" USING btree ("_order");
  CREATE INDEX "header_nav_items_parent_id_idx" ON "header_nav_items" USING btree ("_parent_id");
  CREATE INDEX "header_rels_order_idx" ON "header_rels" USING btree ("order");
  CREATE INDEX "header_rels_parent_idx" ON "header_rels" USING btree ("parent_id");
  CREATE INDEX "header_rels_path_idx" ON "header_rels" USING btree ("path");
  CREATE INDEX "header_rels_pages_id_idx" ON "header_rels" USING btree ("pages_id");
  CREATE INDEX "header_rels_posts_id_idx" ON "header_rels" USING btree ("posts_id");
  CREATE INDEX "footer_nav_items_order_idx" ON "footer_nav_items" USING btree ("_order");
  CREATE INDEX "footer_nav_items_parent_id_idx" ON "footer_nav_items" USING btree ("_parent_id");
  CREATE INDEX "footer_rels_order_idx" ON "footer_rels" USING btree ("order");
  CREATE INDEX "footer_rels_parent_idx" ON "footer_rels" USING btree ("parent_id");
  CREATE INDEX "footer_rels_path_idx" ON "footer_rels" USING btree ("path");
  CREATE INDEX "footer_rels_pages_id_idx" ON "footer_rels" USING btree ("pages_id");
  CREATE INDEX "footer_rels_posts_id_idx" ON "footer_rels" USING btree ("posts_id");
  CREATE INDEX "band_scales_listening_order_idx" ON "band_scales_listening" USING btree ("_order");
  CREATE INDEX "band_scales_listening_parent_id_idx" ON "band_scales_listening" USING btree ("_parent_id");
  CREATE INDEX "band_scales_reading_order_idx" ON "band_scales_reading" USING btree ("_order");
  CREATE INDEX "band_scales_reading_parent_id_idx" ON "band_scales_reading" USING btree ("_parent_id");`)

  // 初始数据：导航 6 项、分数换算表（research.md R7）
  const nav = [
    ['首页', '/'],
    ['听力', '/listening'],
    ['阅读', '/reading'],
    ['写作', '/writing'],
    ['口语', '/speaking'],
    ['模考', '/mock'],
  ].map(([label, url]) => ({ link: { type: 'custom' as const, label, url } }))
  await payload.updateGlobal({ slug: 'header', data: { navItems: nav }, req, context: { disableRevalidate: true } })
  await payload.updateGlobal({
    slug: 'band-scales',
    data: { listening: listeningDefaults, reading: readingDefaults },
    req,
  })
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "pages_hero_links" CASCADE;
  DROP TABLE "pages_blocks_cta_links" CASCADE;
  DROP TABLE "pages_blocks_cta" CASCADE;
  DROP TABLE "pages_blocks_content_columns" CASCADE;
  DROP TABLE "pages_blocks_content" CASCADE;
  DROP TABLE "pages_blocks_media_block" CASCADE;
  DROP TABLE "pages_blocks_archive" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "pages_rels" CASCADE;
  DROP TABLE "_pages_v_version_hero_links" CASCADE;
  DROP TABLE "_pages_v_blocks_cta_links" CASCADE;
  DROP TABLE "_pages_v_blocks_cta" CASCADE;
  DROP TABLE "_pages_v_blocks_content_columns" CASCADE;
  DROP TABLE "_pages_v_blocks_content" CASCADE;
  DROP TABLE "_pages_v_blocks_media_block" CASCADE;
  DROP TABLE "_pages_v_blocks_archive" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "_pages_v_rels" CASCADE;
  DROP TABLE "posts_populated_authors" CASCADE;
  DROP TABLE "posts" CASCADE;
  DROP TABLE "posts_rels" CASCADE;
  DROP TABLE "_posts_v_version_populated_authors" CASCADE;
  DROP TABLE "_posts_v" CASCADE;
  DROP TABLE "_posts_v_rels" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "categories_breadcrumbs" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "tests_listening_parts_g_o" CASCADE;
  DROP TABLE "tests_listening_parts_g_q_o" CASCADE;
  DROP TABLE "tests_listening_parts_g_q" CASCADE;
  DROP TABLE "tests_listening_parts_g" CASCADE;
  DROP TABLE "tests_listening_parts" CASCADE;
  DROP TABLE "tests_reading_passages_paragraphs" CASCADE;
  DROP TABLE "tests_reading_passages_g_o" CASCADE;
  DROP TABLE "tests_reading_passages_g_q_o" CASCADE;
  DROP TABLE "tests_reading_passages_g_q" CASCADE;
  DROP TABLE "tests_reading_passages_g" CASCADE;
  DROP TABLE "tests_reading_passages" CASCADE;
  DROP TABLE "tests" CASCADE;
  DROP TABLE "tests_rels" CASCADE;
  DROP TABLE "___tests_v_version_listening_parts_g_v_o_v" CASCADE;
  DROP TABLE "____tests_v_version_listening_parts_g_v_q_v_o_v" CASCADE;
  DROP TABLE "___tests_v_version_listening_parts_g_v_q_v" CASCADE;
  DROP TABLE "__tests_v_version_listening_parts_g_v" CASCADE;
  DROP TABLE "_tests_v_version_listening_parts" CASCADE;
  DROP TABLE "_tests_v_version_reading_passages_paragraphs" CASCADE;
  DROP TABLE "___tests_v_version_reading_passages_g_v_o_v" CASCADE;
  DROP TABLE "____tests_v_version_reading_passages_g_v_q_v_o_v" CASCADE;
  DROP TABLE "___tests_v_version_reading_passages_g_v_q_v" CASCADE;
  DROP TABLE "__tests_v_version_reading_passages_g_v" CASCADE;
  DROP TABLE "_tests_v_version_reading_passages" CASCADE;
  DROP TABLE "_tests_v" CASCADE;
  DROP TABLE "_tests_v_rels" CASCADE;
  DROP TABLE "writing_tasks" CASCADE;
  DROP TABLE "_writing_tasks_v" CASCADE;
  DROP TABLE "speaking_questions_questions" CASCADE;
  DROP TABLE "speaking_questions_cue_points" CASCADE;
  DROP TABLE "speaking_questions" CASCADE;
  DROP TABLE "speaking_questions_rels" CASCADE;
  DROP TABLE "_speaking_questions_v_version_questions" CASCADE;
  DROP TABLE "_speaking_questions_v_version_cue_points" CASCADE;
  DROP TABLE "_speaking_questions_v" CASCADE;
  DROP TABLE "_speaking_questions_v_rels" CASCADE;
  DROP TABLE "redirects" CASCADE;
  DROP TABLE "redirects_rels" CASCADE;
  DROP TABLE "search_categories" CASCADE;
  DROP TABLE "search" CASCADE;
  DROP TABLE "search_rels" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_folders_folder_type" CASCADE;
  DROP TABLE "payload_folders" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "header_nav_items" CASCADE;
  DROP TABLE "header" CASCADE;
  DROP TABLE "header_rels" CASCADE;
  DROP TABLE "footer_nav_items" CASCADE;
  DROP TABLE "footer" CASCADE;
  DROP TABLE "footer_rels" CASCADE;
  DROP TABLE "band_scales_listening" CASCADE;
  DROP TABLE "band_scales_reading" CASCADE;
  DROP TABLE "band_scales" CASCADE;
  DROP TYPE "public"."enum_pages_hero_links_link_type";
  DROP TYPE "public"."enum_pages_hero_links_link_appearance";
  DROP TYPE "public"."enum_pages_blocks_cta_links_link_type";
  DROP TYPE "public"."enum_pages_blocks_cta_links_link_appearance";
  DROP TYPE "public"."enum_pages_blocks_content_columns_size";
  DROP TYPE "public"."enum_pages_blocks_content_columns_link_type";
  DROP TYPE "public"."enum_pages_blocks_content_columns_link_appearance";
  DROP TYPE "public"."enum_pages_blocks_archive_populate_by";
  DROP TYPE "public"."enum_pages_blocks_archive_relation_to";
  DROP TYPE "public"."enum_pages_hero_type";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_version_hero_links_link_type";
  DROP TYPE "public"."enum__pages_v_version_hero_links_link_appearance";
  DROP TYPE "public"."enum__pages_v_blocks_cta_links_link_type";
  DROP TYPE "public"."enum__pages_v_blocks_cta_links_link_appearance";
  DROP TYPE "public"."enum__pages_v_blocks_content_columns_size";
  DROP TYPE "public"."enum__pages_v_blocks_content_columns_link_type";
  DROP TYPE "public"."enum__pages_v_blocks_content_columns_link_appearance";
  DROP TYPE "public"."enum__pages_v_blocks_archive_populate_by";
  DROP TYPE "public"."enum__pages_v_blocks_archive_relation_to";
  DROP TYPE "public"."enum__pages_v_version_hero_type";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_posts_status";
  DROP TYPE "public"."enum__posts_v_version_status";
  DROP TYPE "public"."enum_tests_listening_parts_g_type";
  DROP TYPE "public"."enum_tests_reading_passages_g_type";
  DROP TYPE "public"."enum_tests_source_type";
  DROP TYPE "public"."enum_tests_status";
  DROP TYPE "public"."enum___tests_v_version_listening_parts_g_v_type";
  DROP TYPE "public"."enum___tests_v_version_reading_passages_g_v_type";
  DROP TYPE "public"."enum__tests_v_version_source_type";
  DROP TYPE "public"."enum__tests_v_version_status";
  DROP TYPE "public"."enum_writing_tasks_task_type";
  DROP TYPE "public"."enum_writing_tasks_source_type";
  DROP TYPE "public"."enum_writing_tasks_status";
  DROP TYPE "public"."enum__writing_tasks_v_version_task_type";
  DROP TYPE "public"."enum__writing_tasks_v_version_source_type";
  DROP TYPE "public"."enum__writing_tasks_v_version_status";
  DROP TYPE "public"."enum_speaking_questions_part";
  DROP TYPE "public"."enum_speaking_questions_source_type";
  DROP TYPE "public"."enum_speaking_questions_status";
  DROP TYPE "public"."enum__speaking_questions_v_version_part";
  DROP TYPE "public"."enum__speaking_questions_v_version_source_type";
  DROP TYPE "public"."enum__speaking_questions_v_version_status";
  DROP TYPE "public"."enum_redirects_to_type";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  DROP TYPE "public"."enum_payload_folders_folder_type";
  DROP TYPE "public"."enum_header_nav_items_link_type";
  DROP TYPE "public"."enum_footer_nav_items_link_type";`)
}
