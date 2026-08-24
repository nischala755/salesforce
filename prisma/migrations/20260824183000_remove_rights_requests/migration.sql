-- Rights-request fulfilment belongs in the customer's existing privacy portal or
-- case-management system. ComplyLens remains focused on evidence, deterministic
-- assessment, governed remediation, and audit proof.
DROP TABLE IF EXISTS "RightsRequest";

DROP TYPE IF EXISTS "RightsRequestType";
DROP TYPE IF EXISTS "RequestStatus";

ALTER TABLE "OrganizationSettings"
  DROP COLUMN IF EXISTS "accessSlaHours",
  DROP COLUMN IF EXISTS "correctionSlaHours",
  DROP COLUMN IF EXISTS "erasureSlaHours",
  DROP COLUMN IF EXISTS "grievanceSlaHours";
