import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";

const baseURL = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const adminPassword = process.env.DEMO_ADMIN_PASSWORD;

if (!adminPassword) {
  throw new Error("DEMO_ADMIN_PASSWORD must be set before running the browser smoke test.");
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
  assert(await page.getByText("Evidence, verdicts,").isVisible(), "Dashboard did not render after login.");
  assert(await page.getByText("Remediation impact analysis").isVisible(), "Remediation impact analysis did not render.");
  consoleErrors.length = 0; // The intentional failed-login 401 above is expected and already asserted in the UI.

  await page.getByRole("button", { name: "Run assessment" }).click();
  await page.getByText(/40 assessments appended/).waitFor({ timeout: 30_000 });

  await page.goto(`${baseURL}/contacts?q=contact.06%40example.in`, { waitUntil: "networkidle" });
  const row = page.locator("tr", { hasText: "contact.06@example.in" });
  await row.getByRole("link").first().click();
  await page.waitForURL("**/contacts/**");
  const contactURL = page.url();
  assert(await page.getByText("Compliance assessment history").isVisible(), "Assessment history did not render.");
  assert(await page.getByText("Remediation scenario analysis").isVisible(), "Remediation analysis did not render.");
  const coreBeforeSimulation = await Promise.all([prisma.contact.count(), prisma.complianceAssessment.count(), prisma.complianceResult.count()]);
  await page.getByRole("button", { name: "Simulate selected" }).click();
  await page.getByText(/Projected:/).waitFor();
  const coreAfterSimulation = await Promise.all([prisma.contact.count(), prisma.complianceAssessment.count(), prisma.complianceResult.count()]);
  assert(JSON.stringify(coreAfterSimulation) === JSON.stringify(coreBeforeSimulation), "Simulation mutated Contact, ComplianceAssessment, or ComplianceResult rows.");
  await page.getByRole("button", { name: "Request remediation" }).click();
  await page.getByText(/submitted for human approval/).waitFor();

  await page.goto(`${baseURL}/dpo`, { waitUntil: "networkidle" });
  await page.getByText("Audit integrity verification").waitFor();
  const checkpointResponse=page.waitForResponse((response)=>response.url().endsWith("/api/audit/integrity")&&response.request().method()==="POST");
  await page.getByRole("button",{name:"Seal checkpoint"}).click();
  assert((await checkpointResponse).ok(),"Merkle checkpoint could not be sealed.");
  await page.locator(".checkpoint .badge.pass").first().waitFor();
  const proofDownload=page.waitForEvent("download");
  await page.getByRole("button",{name:"Export proof bundle"}).click();
  assert((await proofDownload).suggestedFilename().endsWith(".json"),"Merkle proof bundle did not download.");
  await page.getByRole("button", { name: "Approve" }).first().click();
  await page.getByRole("button", { name: "Apply & reassess" }).first().waitFor();
  await page.getByRole("button", { name: "Apply & reassess" }).first().click();
  await page.getByText("Awaiting human action").waitFor();

  await page.goto(`${baseURL}/breach`, { waitUntil: "networkidle" });
  await page.locator('input[name="occurredAt"]').fill(new Date(Date.now() - 3_600_000).toISOString().slice(0, 16));
  await page.locator('input[name="count"]').fill("7");
  await page.locator('textarea[name="description"]').fill("Browser smoke-test incident");
  const incidentResponse = page.waitForResponse((response) => response.url().endsWith("/api/incidents") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create incident" }).click();
  assert((await incidentResponse).ok(), "Incident API rejected the browser journey.");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Browser smoke-test incident" }).waitFor();
  await page.getByRole("button", { name: "Log Board notification" }).first().click();

  await page.goto(`${baseURL}/rights-requests`, { waitUntil: "networkidle" });
  await page.locator('select[name="contactId"]').selectOption({ index: 1 });
  await page.locator('select[name="type"]').selectOption("access");
  await page.locator('textarea[name="details"]').fill("Browser smoke-test access request");
  const rightsResponse = page.waitForResponse((response) => response.url().endsWith("/api/rights-requests") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create request" }).click();
  assert((await rightsResponse).ok(), "Rights-request API rejected the browser journey.");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Mark completed" }).first().waitFor();

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
  console.info("Browser journeys A-F passed: login, bulk assess, investigate, simulate, purpose remediation/approval/apply, breach, rights request, AI fallback/explanation, CSV, integrity proof, and mobile layouts.");
} finally {
  await browser.close();
  await prisma.$disconnect();
}
