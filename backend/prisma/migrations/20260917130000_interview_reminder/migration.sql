-- DropIndex
DROP INDEX "jobs_description_trgm";

-- DropIndex
DROP INDEX "jobs_title_trgm";

-- AlterTable
ALTER TABLE "interviews" ADD COLUMN     "reminder_sent_at" TIMESTAMP(3);


-- Restore trigram indexes (migrate diff drops what the schema can't express).
CREATE INDEX "jobs_title_trgm" ON "jobs" USING gin ("title" gin_trgm_ops);
CREATE INDEX "jobs_description_trgm" ON "jobs" USING gin ("description" gin_trgm_ops);
