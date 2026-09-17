-- CreateEnum
CREATE TYPE "ParsedStatus" AS ENUM ('PENDING', 'PARSED', 'FAILED');

-- DropIndex
DROP INDEX "jobs_description_trgm";

-- DropIndex
DROP INDEX "jobs_title_trgm";

-- AlterTable
ALTER TABLE "resumes" ADD COLUMN     "parsed_status" "ParsedStatus" NOT NULL DEFAULT 'PENDING';


-- Restore trigram indexes (migrate diff drops what the schema can't express).
CREATE INDEX "jobs_title_trgm" ON "jobs" USING gin ("title" gin_trgm_ops);
CREATE INDEX "jobs_description_trgm" ON "jobs" USING gin ("description" gin_trgm_ops);
