import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildDeterministicExplanation, explainVerdict, parseStructuredExplanation } from "@/lib/ai/mistral";

beforeEach(() => { process.env.MISTRAL_API_KEY = "test-only"; });
afterEach(() => vi.restoreAllMocks());

it("fails closed as an optional explanation when Mistral is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
  const persisted = { score: 80, status: "at_risk", results: [{ ruleCode: "DPDP-002", ruleVersion: 1, severity: "high", deduction: 20, passed: false, reasonCode: "NO_LAWFUL_PURPOSE", evidenceExplanation: "No lawful basis recorded.", legalReference: "DPDP Act, section 4" }] };
  const snapshot = structuredClone(persisted);
  await expect(explainVerdict(persisted)).rejects.toThrow("network unavailable");
  expect(persisted).toEqual(snapshot);
});

it("accepts only the structured AI briefing contract", () => {
  const briefing = { headline: "Consent evidence is missing", executiveSummary: "The persisted verdict contains one targeted consent gap.", riskSignal: { level: "elevated", label: "One active finding", rationale: "DPDP-001 is the only failed control." }, insights: [{ category: "root_cause", title: "Consent is the score constraint", insight: "The supplied evidence contains no active consent.", evidence: ["DPDP-001"], confidence: "high" }, { category: "verification", title: "A correction needs proof", insight: "Reassess only after independent evidence review.", evidence: ["DPDP-001"], confidence: "high" }], actions: [{ priority: 1, owner: "Consent operations", action: "Request renewal through the external consent channel.", successSignal: "A verified active consent record is synchronized." }], legalNote: "Operational explanation only; not legal advice." };
  const parsed = parseStructuredExplanation(JSON.stringify(briefing));
  expect(parsed).toMatchObject({ headline: "Consent evidence is missing", riskSignal: { level: "elevated" } });
  expect(parsed.insights.map((insight) => insight.category)).toEqual(["root_cause", "verification"]);
  expect(() => parseStructuredExplanation('{"summary":"missing required fields"}')).toThrow();
});

it("builds distinct evidence-grounded fallback insights and owned actions", () => {
  const briefing = buildDeterministicExplanation({
    score: 80,
    status: "at_risk",
    results: [
      { ruleCode: "DPDP-001", ruleVersion: 1, severity: "critical", deduction: 30, passed: true, reasonCode: "ACTIVE_CONSENT_FOUND", evidenceExplanation: "Active consent exists.", legalReference: "section 6" },
      { ruleCode: "DPDP-002", ruleVersion: 1, severity: "high", deduction: 20, passed: false, reasonCode: "NO_LAWFUL_PURPOSE", evidenceExplanation: "No lawful basis recorded.", legalReference: "section 4" },
    ],
  });
  expect(new Set(briefing.insights.map((insight) => insight.title)).size).toBe(briefing.insights.length);
  expect(new Set(briefing.actions.map((action) => action.action)).size).toBe(briefing.actions.length);
  expect(briefing.insights.every((insight) => insight.evidence.length > 0)).toBe(true);
  expect(briefing.actions[0]).toMatchObject({ owner: "Processing owner" });
});
