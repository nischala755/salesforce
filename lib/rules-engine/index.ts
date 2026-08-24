export const RULE_CODES = [
  "DPDP-001",
  "DPDP-002",
  "DPDP-003",
  "DPDP-004",
  "DPDP-005",
] as const;

export type RuleCode = (typeof RULE_CODES)[number];
export type RuleSeverity = "critical" | "high" | "medium" | "low";
export type AssessmentStatus = "compliant" | "at_risk" | "non_compliant";

export interface ComplianceRuleVersion {
  code: RuleCode;
  version: number;
  severity: RuleSeverity;
  deduction: number;
  legalReference: string;
}

export interface ContactEvidence {
  evaluatedAt: Date;
  consents: Array<{
    active: boolean;
    expiresAt: Date | null;
    withdrawnAt?: Date | null;
  }>;
  purposes: Array<{
    active: boolean;
    lawfulBasis: string | null;
  }>;
  retentionEndsAt: Date | null;
  noticeDeliveredAt: Date | null;
  minimizationCompliant: boolean;
}

export interface RuleResult {
  ruleCode: RuleCode;
  ruleVersion: number;
  severity: RuleSeverity;
  deduction: number;
  passed: boolean;
  reasonCode: string;
  evidenceExplanation: string;
  legalReference: string;
}

export interface Recommendation {
  ruleCode: RuleCode;
  remediationType: RemediationType;
  message: string;
}

export type RemediationType =
  | "consent_renewal"
  | "purpose_registration"
  | "retention_review"
  | "notice_delivery"
  | "data_minimization_review";

export interface RemediationDefinition {
  type: RemediationType;
  label: string;
  draftMessage: string;
  message: string;
}

export interface AssessmentResult {
  score: number;
  bandStatus: AssessmentStatus;
  finalStatus: AssessmentStatus;
  severityGated: boolean;
  results: RuleResult[];
  recommendations: Recommendation[];
}

type Evaluation = Omit<RuleResult, "ruleVersion" | "severity" | "deduction" | "legalReference">;

export const REMEDIATION_BY_RULE: Record<RuleCode, RemediationDefinition> = {
  "DPDP-001": {
    type: "consent_renewal",
    label: "Consent outreach and evidence sync",
    draftMessage: "Send the current notice and consent link to the data principal. Sync consent evidence only after the data principal records an affirmative choice in the external consent channel.",
    message: "Request consent from the data principal and sync the verified response from the consent channel.",
  },
  "DPDP-002": {
    type: "purpose_registration",
    label: "Purpose registration",
    draftMessage: "Record the processing purpose and its reviewed lawful basis before processing continues.",
    message: "Record an active processing purpose and its lawful basis.",
  },
  "DPDP-003": {
    type: "retention_review",
    label: "Retention review",
    draftMessage: "Complete the retention review and record an approved retention end date.",
    message: "Set a current retention end date or complete a retention review.",
  },
  "DPDP-004": {
    type: "notice_delivery",
    label: "Notice delivery",
    draftMessage: "Deliver the approved transparency notice and record the delivery timestamp.",
    message: "Deliver the transparency notice and record its delivery timestamp.",
  },
  "DPDP-005": {
    type: "data_minimization_review",
    label: "Data minimization review",
    draftMessage: "Complete and approve a review of collected fields against the stated processing purpose.",
    message: "Review collected fields and mark minimization compliant after approval.",
  },
};

export const RULE_BY_REMEDIATION_TYPE = Object.fromEntries(
  Object.entries(REMEDIATION_BY_RULE).map(([ruleCode, definition]) => [definition.type, ruleCode]),
) as Record<RemediationType, RuleCode>;

export function bandForScore(score: number): AssessmentStatus {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new RangeError("Score must be a finite number from 0 to 100.");
  }
  if (score >= 80) return "compliant";
  if (score >= 50) return "at_risk";
  return "non_compliant";
}

export function applySeverityGate(
  bandStatus: AssessmentStatus,
  results: Pick<RuleResult, "passed" | "severity">[],
): AssessmentStatus {
  const hasCriticalOrHighFailure = results.some(
    (result) => !result.passed && (result.severity === "critical" || result.severity === "high"),
  );
  return bandStatus === "compliant" && hasCriticalOrHighFailure ? "at_risk" : bandStatus;
}

function evaluateEvidence(evidence: ContactEvidence): Record<RuleCode, Evaluation> {
  const activeConsent = evidence.consents.some(
    (consent) =>
      consent.active &&
      !consent.withdrawnAt &&
      (!consent.expiresAt || consent.expiresAt.getTime() >= evidence.evaluatedAt.getTime()),
  );
  const activePurpose = evidence.purposes.some(
    (purpose) => purpose.active && Boolean(purpose.lawfulBasis?.trim()),
  );
  const retentionCurrent = Boolean(
    evidence.retentionEndsAt && evidence.retentionEndsAt.getTime() >= evidence.evaluatedAt.getTime(),
  );
  const noticeRecorded = Boolean(evidence.noticeDeliveredAt);

  return {
    "DPDP-001": activeConsent
      ? { ruleCode: "DPDP-001", passed: true, reasonCode: "ACTIVE_CONSENT_FOUND", evidenceExplanation: "An active, non-expired consent record exists." }
      : { ruleCode: "DPDP-001", passed: false, reasonCode: "NO_ACTIVE_CONSENT", evidenceExplanation: "No active, non-expired consent record was found." },
    "DPDP-002": activePurpose
      ? { ruleCode: "DPDP-002", passed: true, reasonCode: "LAWFUL_PURPOSE_FOUND", evidenceExplanation: "An active processing purpose has a recorded lawful basis." }
      : { ruleCode: "DPDP-002", passed: false, reasonCode: "NO_LAWFUL_PURPOSE", evidenceExplanation: "No active processing purpose with a lawful basis was found." },
    "DPDP-003": retentionCurrent
      ? { ruleCode: "DPDP-003", passed: true, reasonCode: "RETENTION_CURRENT", evidenceExplanation: "The retention end date exists and has not passed." }
      : { ruleCode: "DPDP-003", passed: false, reasonCode: evidence.retentionEndsAt ? "RETENTION_EXPIRED" : "RETENTION_DATE_MISSING", evidenceExplanation: evidence.retentionEndsAt ? "The recorded retention end date has passed." : "No retention end date is recorded." },
    "DPDP-004": noticeRecorded
      ? { ruleCode: "DPDP-004", passed: true, reasonCode: "NOTICE_RECORDED", evidenceExplanation: "Transparency notice delivery is recorded." }
      : { ruleCode: "DPDP-004", passed: false, reasonCode: "NOTICE_NOT_RECORDED", evidenceExplanation: "Transparency notice delivery is not recorded." },
    "DPDP-005": evidence.minimizationCompliant
      ? { ruleCode: "DPDP-005", passed: true, reasonCode: "MINIMIZATION_COMPLIANT", evidenceExplanation: "Internal data minimization status is compliant." }
      : { ruleCode: "DPDP-005", passed: false, reasonCode: "MINIMIZATION_REVIEW_REQUIRED", evidenceExplanation: "Internal data minimization status is not compliant." },
  };
}

export function assessContact(
  evidence: ContactEvidence,
  ruleVersions: ComplianceRuleVersion[],
): AssessmentResult {
  const versionByCode = new Map(ruleVersions.map((rule) => [rule.code, rule]));
  const missing = RULE_CODES.filter((code) => !versionByCode.has(code));
  if (missing.length > 0 || versionByCode.size !== RULE_CODES.length) {
    throw new Error(`Exactly one active version is required for every rule. Missing: ${missing.join(", ") || "none"}.`);
  }

  const evaluations = evaluateEvidence(evidence);
  const results = RULE_CODES.map((code): RuleResult => {
    const rule = versionByCode.get(code)!;
    if (!Number.isInteger(rule.version) || rule.version < 1 || rule.deduction < 0) {
      throw new Error(`Invalid rule configuration for ${code}.`);
    }
    return { ...evaluations[code], ruleVersion: rule.version, severity: rule.severity, deduction: rule.deduction, legalReference: rule.legalReference };
  });

  const score = Math.max(
    0,
    100 - results.reduce((total, result) => total + (result.passed ? 0 : result.deduction), 0),
  );
  const bandStatus = bandForScore(score);
  const finalStatus = applySeverityGate(bandStatus, results);
  const recommendations = results
    .filter((result) => !result.passed)
    .map((result) => ({
      ruleCode: result.ruleCode,
      remediationType: REMEDIATION_BY_RULE[result.ruleCode].type,
      message: REMEDIATION_BY_RULE[result.ruleCode].message,
    }));

  return { score, bandStatus, finalStatus, severityGated: finalStatus !== bandStatus, results, recommendations };
}
