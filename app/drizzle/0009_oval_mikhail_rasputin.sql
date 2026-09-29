CREATE INDEX IF NOT EXISTS "notification_user_id_id_idx" ON "notification" USING btree ("user_id","id");
