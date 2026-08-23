-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'dpo', 'reviewer', 'analyst');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('compliant', 'at_risk', 'non_compliant');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('critical', 'high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "RemediationStatus" AS ENUM ('pending_approval', 'approved', 'rejected', 'applied');

-- CreateEnum
CREATE TYPE "RightsRequestType" AS ENUM ('access', 'correction', 'erasure', 'grievance');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('open', 'completed');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'contained', 'closed');

-- CreateEnum
CREATE TYPE "AuditOrigin" AS ENUM ('deterministic', 'ai', 'user');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'analyst',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "department" TEXT NOT NULL,
    "noticeDeliveredAt" TIMESTAMP(3),
    "retentionEndsAt" TIMESTAMP(3),
    "minimizationCompliant" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingPurpose" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lawfulBasis" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "ProcessingPurpose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "control" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "deduction" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRuleVersion" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "legalReference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceAssessment" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "bandStatus" "AssessmentStatus" NOT NULL,
    "finalStatus" "AssessmentStatus" NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessedById" TEXT,

    CONSTRAINT "ComplianceAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceResult" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "severity" "Severity" NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "evidenceExplanation" TEXT NOT NULL,
    "legalReference" TEXT NOT NULL,
    "deduction" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRecommendation" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "remediationType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ComplianceRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlastRadiusLink" (
    "id" TEXT NOT NULL,
    "sourceContactId" TEXT NOT NULL,
    "relatedContactId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlastRadiusLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RightsRequest" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "type" "RightsRequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'open',
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RightsRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentLog" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "affectedContactCount" INTEGER NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "boardNotifiedAt" TIMESTAMP(3),
    "affectedPersonsNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationRequest" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "RemediationStatus" NOT NULL DEFAULT 'pending_approval',
    "draftMessage" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "RemediationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationTarget" (
    "id" TEXT NOT NULL,
    "remediationRequestId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    CONSTRAINT "RemediationTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "organizationName" TEXT NOT NULL,
    "sdfMode" BOOLEAN NOT NULL DEFAULT false,
    "accessSlaHours" INTEGER NOT NULL DEFAULT 720,
    "correctionSlaHours" INTEGER NOT NULL DEFAULT 720,
    "erasureSlaHours" INTEGER NOT NULL DEFAULT 720,
    "grievanceSlaHours" INTEGER NOT NULL DEFAULT 168,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "origin" "AuditOrigin" NOT NULL DEFAULT 'user',
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_externalId_key" ON "Contact"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_department_idx" ON "Contact"("department");

-- CreateIndex
CREATE INDEX "Contact_name_idx" ON "Contact"("name");

-- CreateIndex
CREATE INDEX "Contact_retentionEndsAt_idx" ON "Contact"("retentionEndsAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_contactId_active_expiresAt_idx" ON "ConsentRecord"("contactId", "active", "expiresAt");

-- CreateIndex
CREATE INDEX "ProcessingPurpose_contactId_active_idx" ON "ProcessingPurpose"("contactId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceRule_code_key" ON "ComplianceRule"("code");

-- CreateIndex
CREATE INDEX "ComplianceRuleVersion_ruleId_effectiveFrom_idx" ON "ComplianceRuleVersion"("ruleId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceRuleVersion_ruleId_version_key" ON "ComplianceRuleVersion"("ruleId", "version");

-- CreateIndex
CREATE INDEX "ComplianceAssessment_contactId_assessedAt_idx" ON "ComplianceAssessment"("contactId", "assessedAt" DESC);

-- CreateIndex
CREATE INDEX "ComplianceAssessment_finalStatus_assessedAt_idx" ON "ComplianceAssessment"("finalStatus", "assessedAt" DESC);

-- CreateIndex
CREATE INDEX "ComplianceResult_ruleCode_passed_idx" ON "ComplianceResult"("ruleCode", "passed");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceResult_assessmentId_ruleCode_key" ON "ComplianceResult"("assessmentId", "ruleCode");

-- CreateIndex
CREATE INDEX "ComplianceRecommendation_contactId_status_idx" ON "ComplianceRecommendation"("contactId", "status");

-- CreateIndex
CREATE INDEX "ComplianceRecommendation_assessmentId_idx" ON "ComplianceRecommendation"("assessmentId");

-- CreateIndex
CREATE INDEX "BlastRadiusLink_relatedContactId_idx" ON "BlastRadiusLink"("relatedContactId");

-- CreateIndex
CREATE UNIQUE INDEX "BlastRadiusLink_sourceContactId_relatedContactId_relationsh_key" ON "BlastRadiusLink"("sourceContactId", "relatedContactId", "relationship");

-- CreateIndex
CREATE INDEX "RightsRequest_status_dueAt_idx" ON "RightsRequest"("status", "dueAt");

-- CreateIndex
CREATE INDEX "RightsRequest_contactId_idx" ON "RightsRequest"("contactId");

-- CreateIndex
CREATE INDEX "IncidentLog_status_occurredAt_idx" ON "IncidentLog"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "RemediationRequest_status_createdAt_idx" ON "RemediationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RemediationTarget_contactId_idx" ON "RemediationTarget"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "RemediationTarget_remediationRequestId_contactId_key" ON "RemediationTarget"("remediationRequestId", "contactId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_origin_createdAt_idx" ON "AuditLog"("origin", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingPurpose" ADD CONSTRAINT "ProcessingPurpose_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRuleVersion" ADD CONSTRAINT "ComplianceRuleVersion_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ComplianceRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAssessment" ADD CONSTRAINT "ComplianceAssessment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAssessment" ADD CONSTRAINT "ComplianceAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceResult" ADD CONSTRAINT "ComplianceResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ComplianceAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRecommendation" ADD CONSTRAINT "ComplianceRecommendation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlastRadiusLink" ADD CONSTRAINT "BlastRadiusLink_sourceContactId_fkey" FOREIGN KEY ("sourceContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlastRadiusLink" ADD CONSTRAINT "BlastRadiusLink_relatedContactId_fkey" FOREIGN KEY ("relatedContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RightsRequest" ADD CONSTRAINT "RightsRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationRequest" ADD CONSTRAINT "RemediationRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationRequest" ADD CONSTRAINT "RemediationRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationTarget" ADD CONSTRAINT "RemediationTarget_remediationRequestId_fkey" FOREIGN KEY ("remediationRequestId") REFERENCES "RemediationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationTarget" ADD CONSTRAINT "RemediationTarget_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
