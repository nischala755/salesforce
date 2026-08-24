import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { AssessmentActions } from "@/components/assessment-actions";
import { AssessButton } from "@/components/assess-button";
import { ComplianceTimeMachine } from "@/components/compliance-time-machine";
import type { RuleCode } from "@/lib/rules-engine";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contact, settings] = await Promise.all([
    prisma.contact.findUnique({
      where: { id },
      include: {
        assessments: {
          orderBy: { assessedAt: "desc" },
          include: { results: { orderBy: { ruleCode: "asc" } } },
        },
        recommendations: { where: { status: "open" }, orderBy: { createdAt: "desc" } },
        consents: { orderBy: { grantedAt: "desc" } },
        purposes: true,
      },
    }),
    prisma.organizationSettings.findUnique({ where: { id: "default" } }),
  ]);

  if (!contact) notFound();
  const latest = contact.assessments[0];

  return (
    <main className="main">
      <p className="eyebrow">Contact evidence</p>
      <h1>{contact.name}</h1>
      <p className="lede">
        {contact.email} · {contact.department}
      </p>
      <div className="section-row">
        <div>
          {latest ? (
            <>
              <strong style={{ fontSize: "2rem" }}>{latest.score}/100</strong>{" "}
              <StatusBadge status={latest.finalStatus} />{" "}
              {settings?.sdfMode && latest.score < 80 && (
                <span className="badge at_risk">▲ SDF Review Required</span>
              )}
            </>
          ) : (
            <span className="muted">No assessment yet</span>
          )}
        </div>
        <AssessButton contactIds={[contact.id]} />
      </div>

      {latest && (
        <>
          <ComplianceTimeMachine
            history={contact.assessments.slice().reverse().map((assessment) => ({
              id: assessment.id,
              score: assessment.score,
              status: assessment.finalStatus,
              assessedAt: assessment.assessedAt.toISOString(),
              results: assessment.results.map((result) => ({
                ruleCode: result.ruleCode,
                passed: result.passed,
              })),
            }))}
          />
          <div className="split" style={{ marginTop: "1rem" }}>
            <section className="stack">
              {latest.results.map((result) => (
                <article className="card rule-card" key={result.id}>
                  <StatusBadge status={result.passed ? "pass" : "fail"} />
                  <div>
                    <span className="rule-code">
                      {result.ruleCode} · v{result.ruleVersion}
                    </span>
                    <h2 style={{ margin: ".35rem 0" }}>{result.reasonCode.replaceAll("_", " ")}</h2>
                    <p className="muted">{result.evidenceExplanation}</p>
                    <p className="small">
                      <strong>Legal mapping:</strong> {result.legalReference}
                    </p>
                  </div>
                  <strong>{result.passed ? "0" : `−${result.deduction}`}</strong>
                </article>
              ))}
            </section>
            <aside className="stack">
              <AssessmentActions
                contactId={contact.id}
                contactName={contact.name}
                assessmentId={latest.id}
                failedRules={latest.results
                  .filter((result) => !result.passed)
                  .map((result) => result.ruleCode as RuleCode)}
              />
              <section className="card">
                <h2>Open recommendations</h2>
                {contact.recommendations.length ? (
                  contact.recommendations.map((recommendation) => (
                    <p key={recommendation.id}>
                      <strong>{recommendation.ruleCode}</strong>
                      <br />
                      <span className="small muted">{recommendation.message}</span>
                    </p>
                  ))
                ) : (
                  <p className="muted">None.</p>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
