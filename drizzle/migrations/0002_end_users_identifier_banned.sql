-- Replace installation_id, short_id, status with identifier + banned.

ALTER TABLE "end_users" ADD COLUMN IF NOT EXISTS "identifier" varchar(255);--> statement-breakpoint

ALTER TABLE "end_users" ADD COLUMN IF NOT EXISTS "banned" boolean;--> statement-breakpoint

DO $idfill$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'end_users' AND column_name = 'installation_id'
  ) THEN
    UPDATE "end_users" SET "identifier" = "installation_id"
    WHERE "identifier" IS NULL AND "installation_id" IS NOT NULL;
  END IF;
END $idfill$;--> statement-breakpoint

DO $banfill$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'end_users' AND column_name = 'status'
  ) THEN
    UPDATE "end_users" SET "banned" = true WHERE "status" = 'suspended'::"public"."enduser_status";
  END IF;
END $banfill$;--> statement-breakpoint

UPDATE "end_users" SET "banned" = coalesce("banned", false);--> statement-breakpoint

ALTER TABLE "end_users" ALTER COLUMN "banned" SET DEFAULT false;--> statement-breakpoint

ALTER TABLE "end_users" ALTER COLUMN "banned" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "end_users" DROP CONSTRAINT IF EXISTS "end_users_short_id_unique";--> statement-breakpoint

ALTER TABLE "end_users" DROP CONSTRAINT IF EXISTS "end_users_installation_id_unique";--> statement-breakpoint

ALTER TABLE "end_users" DROP COLUMN IF EXISTS "short_id";--> statement-breakpoint

ALTER TABLE "end_users" DROP COLUMN IF EXISTS "installation_id";--> statement-breakpoint

ALTER TABLE "end_users" DROP COLUMN IF EXISTS "status";--> statement-breakpoint

DO $iq$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'end_users'
      AND c.conname = 'end_users_identifier_unique'
  ) THEN
    ALTER TABLE "end_users" ADD CONSTRAINT "end_users_identifier_unique" UNIQUE ("identifier");
  END IF;
END $iq$;--> statement-breakpoint

DROP TYPE IF EXISTS "public"."enduser_status";
