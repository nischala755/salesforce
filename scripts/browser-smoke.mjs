import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";

const baseURL = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
const reviewerPassword = process.env.DEMO_REVIEWER_PASSWORD;

if (!adminPassword || !reviewerPassword) {
  throw new Error("DEMO_ADMIN_PASSWORD and DEMO_REVIEWER_PASSWORD must be set before running the browser smoke test.");
}

const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const prisma = new PrismaClient();
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => consoleErrors.push(error.message));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill("admin@complylens.demo");
  await page.getByLabel("Password").fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.getByRole("alert").waitFor();
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("heading", { name: "Evidence to accountable action." }).waitFor();
  await page.getByText("How the scoring engine works").click();
  await page.getByText("How evidence becomes a reproducible verdict").waitFor();
  assert(await page.getByText("How evidence becomes a reproducible verdict").isVisible(), "Rule-engine explanation did not render.");
  const coreBeforeRuleTrace = await Promise.all([prisma.contact.count(), prisma.complianceAssessment.count(), prisma.complianceResult.count()]);
  const studio = page.locator(".rule-studio");
  await studio.getByRole("heading", { name: "Rule Trace Studio" }).waitFor();
  await page.waitForFunction(() => !document.querySelector(".fingerprint-band code")?.textContent?.includes("calculating"));
  const aditiFingerprint = await studio.locator(".fingerprint-band code").textContent();
  await studio.getByRole("button", { name: "Fully compliant" }).click();
  await studio.getByRole("button", { name: "Execute changed evidence" }).click();
  await studio.locator(".score-orb strong").getByText("100", { exact: true }).waitFor();
  await page.waitForFunction((previous) => document.querySelector(".fingerprint-band code")?.textContent !== previous, aditiFingerprint);
  const compliantFingerprint = await studio.locator(".fingerprint-band code").textContent();
  assert(compliantFingerprint !== aditiFingerprint, "Changing evidence did not change the deterministic scenario fingerprint.");
  await studio.getByRole("button", { name: "Replay identical evidence" }).click();
  await studio.getByText("✓ IDENTICAL REPLAY CONFIRMED").waitFor();
  assert(await studio.locator(".fingerprint-band code").textContent() === compliantFingerprint, "Identical evidence did not reproduce the same fingerprint.");
  await studio.getByRole("button", { name: "Preview a future rule" }).click();
  await studio.getByText("INACTIVE · ZERO SCORE IMPACT").waitFor();
  const coreAfterRuleTrace = await Promise.all([prisma.contact.count(), prisma.complianceAssessment.count(), prisma.complianceResult.count()]);
  assert(JSON.stringify(coreAfterRuleTrace) === JSON.stringify(coreBeforeRuleTrace), "Rule Trace Studio mutated customer or assessment records.");
  assert(await page.getByText("Remediation impact analysis").isVisible(), "Remediation impact analysis did not render.");
  consoleErrors.length = 0; // The intentional failed-login 401 above is expected and already asserted in the UI.

  await page.getByRole("button", { name: "Run assessment" }).click();
  await page.getByText(/40 assessments appended/).waitFor({ timeout: 30_000 });
  const openRecommendations = await prisma.complianceRecommendation.findMany({ where: { status: "open" }, select: { contactId: true, ruleCode: true } });
  const recommendationKeys = openRecommendations.map((recommendation) => `${recommendation.contactId}:${recommendation.ruleCode}`);
  assert(new Set(recommendationKeys).size === recommendationKeys.length, "Duplicate open recommendations exist for the same contact and control.");

  await page.goto(`${baseURL}/contacts?q=contact.06%40example.in`, { waitUntil: "networkidle" });
  const row = page.locator("tr", { hasText: "contact.06@example.in" });
  await row.getByRole("link").first().click();
  await page.waitForURL("**/contacts/**");
  const contactURL = page.url();
  assert(await page.getByText("Compliance assessment history").isVisible(), "Assessment history did not render.");
  assert(await page.getByText("Resolve failed controls").isVisible(), "Corrective-action workspace did not render.");
  assert(await page.locator(".decision-lab button").count() === 2, "Corrective-action workspace contains an unexpected extra action.");
  await page.getByRole("button", { name: "Request remediation" }).click();
  await page.getByText(/submitted for independent DPO approval/).waitFor();

  const purposeRequest = await prisma.remediationRequest.findFirstOrThrow({
    where: { type: "purpose_registration", status: "pending_approval" },
    orderBy: { createdAt: "desc" },
  });
  const forbiddenApprovalStatus = await page.evaluate(async (requestId) => {
    const response = await fetch(`/api/remediation/${requestId}/approve`, { method: "POST" });
    return response.status;
  }, purposeRequest.id);
  assert(forbiddenApprovalStatus === 403, `Operational administrator approval returned ${forbiddenApprovalStatus}, expected 403.`);
  consoleErrors.length = 0; // The intentional role-separation 403 is expected and asserted above.

  const aditi = await prisma.contact.findUniqueOrThrow({ where: { email: "contact.02@example.in" } });
  await page.goto(`${baseURL}/contacts/${aditi.id}`, { waitUntil: "networkidle" });
  assert(await page.getByText(/The operator never grants consent for Aditi/).isVisible(), "The external consent handoff was not explained.");
  await page.getByRole("button", { name: "Request remediation" }).click();
  await page.getByText(/Consent email queued for the data principal/).waitFor();

  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL("**/login");
  await page.getByLabel("Email").fill("reviewer@complylens.demo");
  await page.getByLabel("Password").fill(reviewerPassword);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL("**/dashboard");

  await page.goto(`${baseURL}/dpo`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Review, approve, verify." }).waitFor();
  await page.getByText("Audit integrity and Merkle proof").click();
  await page.getByText("Audit integrity verification").waitFor();
  const checkpointResponse=page.waitForResponse((response)=>response.url().endsWith("/api/audit/integrity")&&response.request().method()==="POST");
  await page.getByRole("button",{name:"Seal checkpoint"}).click();
  assert((await checkpointResponse).ok(),"Merkle checkpoint could not be sealed.");
  await page.locator(".checkpoint .badge.pass").first().waitFor();
  const proofDownload=page.waitForEvent("download");
  await page.getByRole("button",{name:"Export proof bundle"}).click();
  assert((await proofDownload).suggestedFilename().endsWith(".json"),"Merkle proof bundle did not download.");
  let purposeRow = page.locator("tr", { hasText: "purpose registration" }).first();
  const purposeApprovalResponse = page.waitForResponse((response) => response.url().includes(`/api/remediation/${purposeRequest.id}/approve`) && response.request().method() === "POST");
  await purposeRow.getByRole("button", { name: "Approve" }).click();
  assert((await purposeApprovalResponse).ok(), "Purpose remediation could not be independently approved.");
  await page.reload({ waitUntil: "networkidle" });
  purposeRow = page.locator("tr", { hasText: "purpose registration" }).first();
  await purposeRow.getByRole("button", { name: "Apply & reassess" }).waitFor();
  const purposeApplyResponse = page.waitForResponse((response) => response.url().includes(`/api/remediation/${purposeRequest.id}/apply`) && response.request().method() === "POST");
  await purposeRow.getByRole("button", { name: "Apply & reassess" }).click();
  assert((await purposeApplyResponse).ok(), "Approved purpose remediation could not be applied.");

  let consentRow = page.locator("tr", { hasText: "consent renewal" }).first();
  const consentRequest = await prisma.remediationRequest.findFirstOrThrow({
    where: { type: "consent_renewal", status: "pending_approval" },
    orderBy: { createdAt: "desc" },
  });
  const consentApprovalResponse = page.waitForResponse((response) => response.url().includes(`/api/remediation/${consentRequest.id}/approve`) && response.request().method() === "POST");
  await consentRow.getByRole("button", { name: "Approve outreach" }).click();
  assert((await consentApprovalResponse).ok(), "Consent outreach could not be independently approved.");
  await page.reload({ waitUntil: "networkidle" });
  consentRow = page.locator("tr", { hasText: "consent renewal" }).first();
  await consentRow.getByRole("button", { name: "Sync verified consent & reassess" }).waitFor();
  page.once("dialog", (dialog) => dialog.accept());
  const consentSyncResponse = page.waitForResponse((response) => response.url().includes(`/api/remediation/`) && response.url().endsWith("/apply") && response.request().method() === "POST");
  await consentRow.getByRole("button", { name: "Sync verified consent & reassess" }).click();
  assert((await consentSyncResponse).ok(), "Verified consent response could not be synced.");
  const syncedConsent = await prisma.consentRecord.findFirst({ where: { contactId: aditi.id, active: true }, orderBy: { grantedAt: "desc" } });
  assert(syncedConsent?.source.includes("data-principal response") ?? false, "Consent was not attributed to the external data-principal response.");
  await page.getByText("Awaiting human action").waitFor();

  await page.goto(`${baseURL}/breach`, { waitUntil: "networkidle" });
  await page.getByText("Log a new incident").click();
  await page.locator('input[name="occurredAt"]').fill(new Date(Date.now() - 3_600_000).toISOString().slice(0, 16));
  await page.locator('input[name="count"]').fill("7");
  await page.locator('textarea[name="description"]').fill("Browser smoke-test incident");
  const incidentResponse = page.waitForResponse((response) => response.url().endsWith("/api/incidents") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create incident" }).click();
  assert((await incidentResponse).ok(), "Incident API rejected the browser journey.");
  await page.reload({ waitUntil: "networkidle" });
  let incidentCard = page.locator(".incident-card", { hasText: "Browser smoke-test incident" });
  await incidentCard.getByRole("heading", { name: "Browser smoke-test incident" }).waitFor();
  await incidentCard.getByRole("button", { name: "Log Board notification" }).click();
  await incidentCard.getByRole("button", { name: "Log affected-person notification" }).click();
  await incidentCard.getByRole("button", { name: "Mark contained" }).click();
  await incidentCard.getByRole("button", { name: "Close incident" }).click();
  incidentCard = page.locator(".incident-card", { hasText: "Browser smoke-test incident" });
  await incidentCard.getByText("Closed", { exact: true }).waitFor();

  await page.goto(contactURL, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ask AI to explain" }).click();
  await page.locator("[aria-live=polite]").waitFor({ timeout: 25_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.goto(`${baseURL}/dpo`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Download board CSV" }).click();
  const download = await downloadPromise;
  assert((await download.suggestedFilename()).endsWith(".csv"), "CSV board report did not download.");

  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/dashboard", "/contacts", contactURL.replace(baseURL, "")]) {
    await page.goto(`${baseURL}${path}`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert(!overflow, `Mobile layout overflowed at ${path}.`);
  }

  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto(`${baseURL}/dashboard`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL("**/login");
  await page.goto(`${baseURL}/dashboard`);
  await page.waitForURL("**/login**");

  assert(consoleErrors.length === 0, `Browser console errors: ${consoleErrors.join(" | ")}`);
  console.info("Browser journeys A-E passed: interactive rule trace/replay, admin investigation/request, Aditi external-consent sync, independent DPO approval/apply, incident response, AI fallback/explanation, CSV, integrity proof, and mobile layouts.");
} finally {
  await browser.close();
  await prisma.$disconnect();
}
