import { describe, expect, it } from "vitest";
import {
  applySeverityGate,
  assessContact,
  bandForScore,
  REMEDIATION_BY_RULE,
  RULE_BY_REMEDIATION_TYPE,
  RULE_CODES,
  type ComplianceRuleVersion,
  type ContactEvidence,
  type RuleCode,
} from "@/lib/rules-engine";

const now = new Date("2026-08-23T00:00:00.000Z");
const rules: ComplianceRuleVersion[] = [
  { code: "DPDP-001", version: 1, severity: "critical", deduction: 30, legalReference: "DPDP Act, section 6" },
  { code: "DPDP-002", version: 1, severity: "high", deduction: 20, legalReference: "DPDP Act, sections 4-7" },
  { code: "DPDP-003", version: 1, severity: "high", deduction: 20, legalReference: "DPDP Act, section 8(7)" },
  { code: "DPDP-004", version: 1, severity: "medium", deduction: 15, legalReference: "DPDP Act, section 5" },
  { code: "DPDP-005", version: 1, severity: "medium", deduction: 15, legalReference: "DPDP Act, section 8" },
];

function passingEvidence(): ContactEvidence {
  return {
    evaluatedAt: now,
    consents: [{ active: true, expiresAt: new Date("2027-08-23T00:00:00.000Z") }],
    purposes: [{ active: true, lawfulBasis: "consent" }],
    retentionEndsAt: new Date("2027-08-23T00:00:00.000Z"),
    noticeDeliveredAt: new Date("2026-01-01T00:00:00.000Z"),
    minimizationCompliant: true,
  };
}

function failRule(code: RuleCode): ContactEvidence {
  const evidence = passingEvidence();
  if (code === "DPDP-001") evidence.consents = [];
  if (code === "DPDP-002") evidence.purposes = [];
  if (code === "DPDP-003") evidence.retentionEndsAt = new Date("2025-01-01T00:00:00.000Z");
  if (code === "DPDP-004") evidence.noticeDeliveredAt = null;
  if (code === "DPDP-005") evidence.minimizationCompliant = false;
  return evidence;
}

describe("assessContact", () => {
  it("returns 100 and compliant when every rule passes", () => {
    const result = assessContact(passingEvidence(), rules);
    expect(result).toMatchObject({ score: 100, bandStatus: "compliant", finalStatus: "compliant", severityGated: false });
    expect(result.results.every((item) => item.passed)).toBe(true);
    expect(result.recommendations).toEqual([]);
  });

  it("floors the all-fail score at zero and creates five deterministic recommendations", () => {
    const evidence: ContactEvidence = { evaluatedAt: now, consents: [], purposes: [], retentionEndsAt: null, noticeDeliveredAt: null, minimizationCompliant: false };
    const result = assessContact(evidence, rules);
    expect(result).toMatchObject({ score: 0, bandStatus: "non_compliant", finalStatus: "non_compliant" });
    expect(result.results.every((item) => !item.passed)).toBe(true);
    expect(result.recommendations).toHaveLength(5);
  });

  it.each([
    ["DPDP-001", 70, "at_risk"],
    ["DPDP-002", 80, "at_risk"],
    ["DPDP-003", 80, "at_risk"],
    ["DPDP-004", 85, "compliant"],
    ["DPDP-005", 85, "compliant"],
  ] as const)("deducts correctly for the single failure %s", (code, score, status) => {
    const result = assessContact(failRule(code), rules);
    expect(result.score).toBe(score);
    expect(result.finalStatus).toBe(status);
    expect(result.results.filter((item) => !item.passed).map((item) => item.ruleCode)).toEqual([code]);
    expect(result.recommendations.map((item) => item.ruleCode)).toEqual([code]);
  });

  it("keeps a medium-only 85 score compliant but gates a high-failure 80 score", () => {
    const medium = assessContact(failRule("DPDP-004"), rules);
    const high = assessContact(failRule("DPDP-002"), rules);
    expect(medium).toMatchObject({ score: 85, bandStatus: "compliant", finalStatus: "compliant", severityGated: false });
    expect(high).toMatchObject({ score: 80, bandStatus: "compliant", finalStatus: "at_risk", severityGated: true });
  });

  it("treats an expiration exactly at evaluation time as valid", () => {
    const evidence = passingEvidence();
    evidence.consents[0].expiresAt = now;
    evidence.retentionEndsAt = now;
    expect(assessContact(evidence, rules).score).toBe(100);
  });

  it("rejects incomplete rule version configuration", () => {
    expect(() => assessContact(passingEvidence(), rules.slice(1))).toThrow(/Exactly one active version/);
  });

  it("defines a reversible human-approved remediation for every control", () => {
    expect(Object.keys(REMEDIATION_BY_RULE)).toEqual([...RULE_CODES]);
    for (const ruleCode of RULE_CODES) {
      const definition = REMEDIATION_BY_RULE[ruleCode];
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.draftMessage.length).toBeGreaterThan(0);
      expect(RULE_BY_REMEDIATION_TYPE[definition.type]).toBe(ruleCode);
    }
  });
});

describe("score band boundaries", () => {
  it.each([
    [100, "compliant"], [80, "compliant"], [79, "at_risk"], [50, "at_risk"],
    [49, "non_compliant"], [0, "non_compliant"],
  ] as const)("maps %i to %s", (score, status) => expect(bandForScore(score)).toBe(status));

  it("rejects scores outside 0-100", () => {
    expect(() => bandForScore(-1)).toThrow(RangeError);
    expect(() => bandForScore(101)).toThrow(RangeError);
  });

  it("applies gating only after a compliant band lookup", () => {
    expect(applySeverityGate("compliant", [{ passed: false, severity: "high" }])).toBe("at_risk");
    expect(applySeverityGate("compliant", [{ passed: false, severity: "medium" }])).toBe("compliant");
    expect(applySeverityGate("non_compliant", [{ passed: false, severity: "critical" }])).toBe("non_compliant");
  });
});
