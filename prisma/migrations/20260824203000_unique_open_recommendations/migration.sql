-- Preserve recommendation history while allowing only one active recommendation
-- for the same contact and deterministic control.
WITH ranked_open AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "contactId", "ruleCode"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS duplicate_rank
  FROM "ComplianceRecommendation"
  WHERE "status" = 'open'
)
UPDATE "ComplianceRecommendation" AS recommendation
SET
  "status" = 'resolved',
  "resolvedAt" = COALESCE(recommendation."resolvedAt", CURRENT_TIMESTAMP)
FROM ranked_open
WHERE recommendation."id" = ranked_open."id"
  AND ranked_open.duplicate_rank > 1;

CREATE UNIQUE INDEX "ComplianceRecommendation_one_open_per_rule"
  ON "ComplianceRecommendation" ("contactId", "ruleCode")
  WHERE "status" = 'open';
