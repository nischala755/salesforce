import { assessContact, RULE_CODES, type RuleCode, type RuleResult } from "@/lib/rules-engine";

export function simulatePersistedResults(results: RuleResult[], rulesToFix: RuleCode[], evaluatedAt: Date) {
  const fixed = new Set(rulesToFix);
  const passes = new Map(results.map((result) => [result.ruleCode, result.passed || fixed.has(result.ruleCode)]));
  const evidence = {
    evaluatedAt,
    consents: passes.get("DPDP-001") ? [{ active: true, expiresAt: null, withdrawnAt: null }] : [],
    purposes: passes.get("DPDP-002") ? [{ active: true, lawfulBasis: "persisted-verdict" }] : [],
    retentionEndsAt: passes.get("DPDP-003") ? new Date(evaluatedAt.getTime() + 86_400_000) : null,
    noticeDeliveredAt: passes.get("DPDP-004") ? evaluatedAt : null,
    minimizationCompliant: Boolean(passes.get("DPDP-005")),
  };
  const versions = results.map(({ ruleCode: code, ruleVersion: version, severity, deduction, legalReference }) => ({ code, version, severity, deduction, legalReference }));
  if (results.length !== RULE_CODES.length) throw new Error("Latest assessment does not contain all five persisted rule results.");
  return assessContact(evidence, versions);
}
