CREATE INDEX "campaigns_ad_id_idx" ON "campaigns" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX "campaigns_notification_id_idx" ON "campaigns" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "campaigns_redirect_id_idx" ON "campaigns" USING btree ("redirect_id");
