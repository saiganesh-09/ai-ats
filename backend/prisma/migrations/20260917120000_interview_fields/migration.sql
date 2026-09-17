-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('ONLINE', 'PHONE', 'ONSITE');

-- DropIndex
DROP INDEX "jobs_description_trgm";

-- DropIndex
DROP INDEX "jobs_title_trgm";

-- AlterTable
ALTER TABLE "interviews" ADD COLUMN     "ends_at" TIMESTAMP(3),
ADD COLUMN     "interviewer_id" INTEGER,
ADD COLUMN     "type" "InterviewType" NOT NULL DEFAULT 'ONLINE';

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Restore trigram indexes (migrate diff drops what the schema can't express).
CREATE INDEX "jobs_title_trgm" ON "jobs" USING gin ("title" gin_trgm_ops);
CREATE INDEX "jobs_description_trgm" ON "jobs" USING gin ("description" gin_trgm_ops);
