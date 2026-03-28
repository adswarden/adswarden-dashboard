ALTER TABLE "end_users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "end_users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "end_users" ADD COLUMN "installation_id" varchar(255);--> statement-breakpoint
ALTER TABLE "end_users" ADD COLUMN "short_id" varchar(12);--> statement-breakpoint
CREATE UNIQUE INDEX "end_users_installation_id_unique" ON "end_users" USING btree ("installation_id");--> statement-breakpoint
UPDATE "end_users" SET "short_id" = substr(replace(gen_random_uuid()::text, '-', ''), 1, 8) WHERE "short_id" IS NULL;--> statement-breakpoint
ALTER TABLE "end_users" ALTER COLUMN "short_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "end_users_short_id_unique" ON "end_users" USING btree ("short_id");--> statement-breakpoint
ALTER TABLE "end_users" ADD CONSTRAINT "end_users_identity_check" CHECK ("email" IS NOT NULL OR "installation_id" IS NOT NULL);
