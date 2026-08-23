import { expect, it } from "vitest";
import { assessContact, type ComplianceRuleVersion } from "@/lib/rules-engine";
import { simulatePersistedResults } from "@/lib/simulation";

const now = new Date("2026-08-23T00:00:00.000Z");
const versions: ComplianceRuleVersion[] = [
  { code: "DPDP-001", version: 3, severity: "critical", deduction: 30, legalReference: "s6" },
  { code: "DPDP-002", version: 2, severity: "high", deduction: 20, legalReference: "s4" },
  { code: "DPDP-003", version: 1, severity: "high", deduction: 20, legalReference: "s8" },
  { code: "DPDP-004", version: 1, severity: "medium", deduction: 15, legalReference: "s5" },
  { code: "DPDP-005", version: 1, severity: "medium", deduction: 15, legalReference: "s8" },
];

it("projects from persisted verdicts without mutating them", () => {
  const persisted = assessContact({ evaluatedAt: now, consents: [], purposes: [{ active: true, lawfulBasis: "consent" }], retentionEndsAt: new Date("2027-01-01"), noticeDeliveredAt: now, minimizationCompliant: true }, versions).results;
  const snapshot = structuredClone(persisted);
  const projected = simulatePersistedResults(persisted, ["DPDP-001"], now);
  expect(projected.score).toBe(100);
  expect(projected.finalStatus).toBe("compliant");
  expect(persisted).toEqual(snapshot);
  expect(projected.results.find((item) => item.ruleCode === "DPDP-001")?.ruleVersion).toBe(3);
});
