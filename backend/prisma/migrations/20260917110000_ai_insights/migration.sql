-- ai_summary: String -> Json, preserving existing text as {"summary": "..."}
ALTER TABLE "applications" ALTER COLUMN "ai_summary" TYPE JSONB
  USING CASE WHEN "ai_summary" IS NULL THEN NULL
        ELSE jsonb_build_object('summary', "ai_summary"::text) END;

ALTER TABLE "applications" ADD COLUMN "ai_questions" JSONB;
