import { PrismaClient, Severity, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import { assessContact, type ComplianceRuleVersion } from "../lib/rules-engine";

const prisma = new PrismaClient();
const now = new Date("2026-08-23T00:00:00.000Z");

const ruleSeed = [
  { code: "DPDP-001", control: "Consent validation", severity: Severity.critical, deduction: 30, legalReference: "DPDP Act, 2023, section 6", description: "Active, non-expired consent exists." },
  { code: "DPDP-002", control: "Purpose validation", severity: Severity.high, deduction: 20, legalReference: "DPDP Act, 2023, sections 4-7", description: "Active purpose with a recorded lawful basis exists." },
  { code: "DPDP-003", control: "Retention validation", severity: Severity.high, deduction: 20, legalReference: "DPDP Act, 2023, section 8(7)", description: "Retention end date exists and has not passed." },
  { code: "DPDP-004", control: "Transparency notice", severity: Severity.medium, deduction: 15, legalReference: "DPDP Act, 2023, section 5", description: "Notice delivery is recorded." },
  { code: "DPDP-005", control: "Data minimization", severity: Severity.medium, deduction: 15, legalReference: "DPDP Act, 2023, section 8", description: "Internal minimization status is compliant." },
] as const;

const firstNames = ["Aarav", "Aditi", "Ananya", "Arjun", "Diya", "Ishaan", "Kabir", "Kavya", "Meera", "Nikhil", "Priya", "Rahul", "Riya", "Rohan", "Saanvi", "Siddharth", "Tanvi", "Varun", "Vihaan", "Zoya"];
const lastNames = ["Agarwal", "Bose", "Chandra", "Desai", "Gupta", "Iyer", "Jain", "Kapoor", "Mehta", "Nair", "Patel", "Rao", "Shah", "Sharma", "Singh", "Verma"];
const departments = ["Sales", "Support", "Finance", "Marketing", "Operations", "People"];

async function main() {
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
  const reviewerPassword = process.env.DEMO_REVIEWER_PASSWORD;

  if (!adminPassword || !reviewerPassword) {
    throw new Error("DEMO_ADMIN_PASSWORD and DEMO_REVIEWER_PASSWORD must be set before seeding.");
  }

  const adminHash = await bcrypt.hash(adminPassword, 12);
  const reviewerHash = await bcrypt.hash(reviewerPassword, 12);
  const [admin] = await Promise.all([
    prisma.user.upsert({ where: { email: "admin@complylens.demo" }, update: { active: true, passwordHash: adminHash }, create: { email: "admin@complylens.demo", name: "Demo Administrator", passwordHash: adminHash, role: UserRole.admin } }),
    prisma.user.upsert({ where: { email: "reviewer@complylens.demo" }, update: { active: true, passwordHash: reviewerHash }, create: { email: "reviewer@complylens.demo", name: "Demo DPO Reviewer", passwordHash: reviewerHash, role: UserRole.dpo } }),
  ]);

  await prisma.organizationSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", organizationName: "ComplyLens Demo Organization" },
  });

  const versions: ComplianceRuleVersion[] = [];
  for (const item of ruleSeed) {
    const rule = await prisma.complianceRule.upsert({
      where: { code: item.code },
      update: { control: item.control, severity: item.severity, deduction: item.deduction, active: true },
      create: { code: item.code, control: item.control, severity: item.severity, deduction: item.deduction },
    });
    await prisma.complianceRuleVersion.upsert({
      where: { ruleId_version: { ruleId: rule.id, version: 1 } },
      update: { legalReference: item.legalReference, description: item.description },
      create: { ruleId: rule.id, version: 1, legalReference: item.legalReference, description: item.description, effectiveFrom: new Date("2023-08-11T00:00:00.000Z") },
    });
    versions.push({ code: item.code, version: 1, severity: item.severity, deduction: item.deduction, legalReference: item.legalReference });
  }

  for (let index = 0; index < 40; index += 1) {
    const name = `${firstNames[index % firstNames.length]} ${lastNames[(index * 7) % lastNames.length]}`;
    const email = `contact.${String(index + 1).padStart(2, "0")}@example.in`;
    const scenario = index % 8;
    const contact = await prisma.contact.upsert({
      where: { email },
      update: {},
      create: {
        externalId: `DEMO-${String(index + 1).padStart(4, "0")}`,
        name,
        email,
        phone: `+91 90000 ${String(10000 + index).slice(-5)}`,
        department: departments[index % departments.length],
        noticeDeliveredAt: [3, 7].includes(scenario) ? null : new Date("2026-02-10T00:00:00.000Z"),
        retentionEndsAt: scenario === 2 ? null : scenario === 6 ? new Date("2025-12-31T00:00:00.000Z") : new Date(2027 + (index % 2), 5, 30),
        minimizationCompliant: ![4, 7].includes(scenario),
      },
    });

    const hasConsent = ![1, 7].includes(scenario);
    const hasPurpose = ![5, 7].includes(scenario);
    if ((await prisma.consentRecord.count({ where: { contactId: contact.id } })) === 0) {
      await prisma.consentRecord.create({ data: { contactId: contact.id, purpose: "Customer relationship management", active: hasConsent, grantedAt: new Date("2025-01-15T00:00:00.000Z"), expiresAt: scenario === 1 ? new Date("2026-01-01T00:00:00.000Z") : new Date("2027-12-31T00:00:00.000Z"), source: "DEMO seed import" } });
    }
    if ((await prisma.processingPurpose.count({ where: { contactId: contact.id } })) === 0) {
      await prisma.processingPurpose.create({ data: { contactId: contact.id, name: "Customer relationship management", active: true, lawfulBasis: hasPurpose ? "consent" : null } });
    }

    if ((await prisma.complianceAssessment.count({ where: { contactId: contact.id } })) === 0) {
      const evidence = {
        evaluatedAt: now,
        consents: [{ active: hasConsent, expiresAt: scenario === 1 ? new Date("2026-01-01T00:00:00.000Z") : new Date("2027-12-31T00:00:00.000Z"), withdrawnAt: null }],
        purposes: [{ active: true, lawfulBasis: hasPurpose ? "consent" : null }],
        retentionEndsAt: scenario === 2 ? null : scenario === 6 ? new Date("2025-12-31T00:00:00.000Z") : new Date(2027 + (index % 2), 5, 30),
        noticeDeliveredAt: [3, 7].includes(scenario) ? null : new Date("2026-02-10T00:00:00.000Z"),
        minimizationCompliant: ![4, 7].includes(scenario),
      };
      const result = assessContact(evidence, versions);
      await prisma.complianceAssessment.create({
        data: {
          contactId: contact.id,
          score: result.score,
          bandStatus: result.bandStatus,
          finalStatus: result.finalStatus,
          assessedById: admin.id,
          results: { create: result.results },
        },
      });
      if (result.recommendations.length) {
        const latest = await prisma.complianceAssessment.findFirstOrThrow({ where: { contactId: contact.id }, orderBy: { assessedAt: "desc" } });
        await prisma.complianceRecommendation.createMany({ data: result.recommendations.map((recommendation) => ({ contactId: contact.id, assessmentId: latest.id, ...recommendation })) });
      }
    }
  }

  console.info("Seeded 2 DEMO users and 40 DEMO contacts using environment-managed passwords.");
}

main().finally(async () => prisma.$disconnect());
