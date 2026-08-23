import Link from "next/link";
import { prisma } from "@/lib/db";
import { DashboardCharts } from "@/components/dashboard-charts";
import { AssessButton } from "@/components/assess-button";
import { StatusBadge } from "@/components/status-badge";
import { RecoveryRadar } from "@/components/recovery-radar";
import { RULE_CODES, type RuleResult } from "@/lib/rules-engine";
import { simulatePersistedResults } from "@/lib/simulation";

const ruleNames: Record<string,string> = {"DPDP-001":"Consent","DPDP-002":"Purpose","DPDP-003":"Retention","DPDP-004":"Notice","DPDP-005":"Minimization"};

export default async function DashboardPage() {
  const contacts = await prisma.contact.findMany({ include: { assessments: { orderBy: { assessedAt: "desc" }, take: 1, include: { results: true } } } });
  const assessed = contacts.flatMap((contact)=>contact.assessments[0]?[{contact,assessment:contact.assessments[0]}]:[]);
  const counts={compliant:0,at_risk:0,non_compliant:0}; assessed.forEach(({assessment})=>{counts[assessment.finalStatus]+=1;});
  const percent=assessed.length?Math.round(counts.compliant/assessed.length*100):0;
  const illustrative=assessed.reduce((sum,{assessment})=>sum+assessment.results.filter((result)=>!result.passed&&result.ruleCode!=="DPDP-005").length*50,0);
  const recovery=RULE_CODES.map(code=>{const impacted=assessed.filter(({assessment})=>assessment.results.some(result=>result.ruleCode===code&&!result.passed));const sample=impacted[0]?.assessment.results.find(result=>result.ruleCode===code);const statusImprovements=impacted.filter(({assessment})=>simulatePersistedResults(assessment.results as unknown as RuleResult[],[code],new Date()).finalStatus!==assessment.finalStatus).length;return{code,label:ruleNames[code],deduction:sample?.deduction??0,failedCount:impacted.length,recoverablePoints:impacted.length*(sample?.deduction??0),statusImprovements,contacts:impacted.map(({contact})=>({id:contact.id,name:contact.name}))};}).sort((a,b)=>b.recoverablePoints-a.recoverablePoints);
  const recent=assessed.sort((a,b)=>b.assessment.assessedAt.getTime()-a.assessment.assessedAt.getTime()).slice(0,6);
  return <main className="main"><p className="eyebrow">Operational overview</p><h1>Evidence, verdicts,<br/>human decisions.</h1><p className="lede">Rules calculate every score. AI can explain persisted results, but cannot change them.</p>
    <div className="grid metrics"><div className="card"><span className="metric-label">Organization compliance</span><strong className="metric-value">{percent}%</strong></div><div className="card"><span className="metric-label">Contacts assessed</span><strong className="metric-value">{assessed.length}/{contacts.length}</strong></div><div className="card"><span className="metric-label">Open findings</span><strong className="metric-value">{assessed.reduce((n,x)=>n+x.assessment.results.filter(r=>!r.passed).length,0)}</strong></div><div className="card"><span className="metric-label">Illustrative exposure</span><strong className="metric-value">₹{illustrative} cr</strong><span className="metric-foot" title="Internal ₹50 crore-per-finding model; not predicted liability and not additive toward a regulatory total.">ⓘ Illustrative · non-additive</span></div></div>
    <RecoveryRadar items={recovery}/>
    <div className="section-row"><div><h2>Current posture</h2><p className="muted">Latest persisted assessment per contact.</p></div><AssessButton /></div>
    <div className="grid chart-grid"><DashboardCharts counts={counts} scores={assessed.map(item=>item.assessment.score)}/><section className="card statutory"><h2>Statutory ceiling context</h2><div className="stat-grid"><div><strong>₹250 cr</strong><span>Safeguards</span></div><div><strong>₹200 cr</strong><span>Breach notice</span></div><div><strong>₹150 cr</strong><span>SDF duties</span></div></div><p className="metric-foot">ⓘ DPDP Act schedule · maximums, not predictions</p></section></div>
    <div className="section-row"><h2>Recent assessments</h2><Link className="btn secondary" href="/contacts">View contacts</Link></div><div className="table-wrap"><table><thead><tr><th>Contact</th><th>Score</th><th>Status</th><th>Assessed</th></tr></thead><tbody>{recent.map(({contact,assessment})=><tr key={assessment.id}><td><Link href={`/contacts/${contact.id}`}><strong>{contact.name}</strong></Link><br/><span className="muted small">{contact.department}</span></td><td>{assessment.score}</td><td><StatusBadge status={assessment.finalStatus}/></td><td>{assessment.assessedAt.toLocaleString("en-IN")}</td></tr>)}</tbody></table></div>
  </main>;
}
