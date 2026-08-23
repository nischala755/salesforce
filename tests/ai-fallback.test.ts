import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { explainVerdict, parseStructuredExplanation } from "@/lib/ai/mistral";

beforeEach(() => { process.env.MISTRAL_API_KEY = "test-only"; });
afterEach(() => vi.restoreAllMocks());

it("fails closed as an optional explanation when Mistral is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
  const persisted = { score: 80, status: "at_risk", results: [{ ruleCode: "DPDP-002", ruleVersion: 1, passed: false, reasonCode: "NO_LAWFUL_PURPOSE", evidenceExplanation: "No lawful basis recorded.", legalReference: "DPDP Act, section 4" }] };
  const snapshot = structuredClone(persisted);
  await expect(explainVerdict(persisted)).rejects.toThrow("network unavailable");
  expect(persisted).toEqual(snapshot);
});

it("accepts only the structured AI briefing contract", () => {
  expect(parseStructuredExplanation(JSON.stringify({ headline: "Consent evidence is missing", summary: "The persisted verdict shows one failed consent control.", keyFindings: [{ ruleCode: "DPDP-001", status: "fail", meaning: "No active consent was found in the evaluated evidence." }], nextSteps: ["Have a reviewer verify whether consent renewal is appropriate."], legalNote: "This suggests an operational gap; consult legal counsel for a legal conclusion." }))).toMatchObject({ headline: "Consent evidence is missing", keyFindings: [{ ruleCode: "DPDP-001", status: "fail" }] });
  expect(() => parseStructuredExplanation('{"summary":"missing required fields"}')).toThrow();
});
