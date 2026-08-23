"use client";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const colors = ["#27855f", "#d99b22", "#ba453c"];
export function DashboardCharts({ counts, scores }: { counts: { compliant: number; at_risk: number; non_compliant: number }; scores: number[] }) {
  const data = [{ name: "Compliant", value: counts.compliant }, { name: "At risk", value: counts.at_risk }, { name: "Non-compliant", value: counts.non_compliant }];
  const distribution = [{name:"0–49",value:scores.filter(score=>score<50).length},{name:"50–79",value:scores.filter(score=>score>=50&&score<80).length},{name:"80–100",value:scores.filter(score=>score>=80).length}];
  return <><div className="card"><h2>Status breakdown</h2><div style={{ height: 260 }}><ResponsiveContainer><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={3}>{data.map((entry, index) => <Cell key={entry.name} fill={colors[index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="small muted">✓ Compliant · ▲ At risk · ✕ Non-compliant</div></div><div className="card"><h2>Score distribution</h2><div style={{height:260}}><ResponsiveContainer><BarChart data={distribution}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="value" name="Contacts" fill="#0c6b58" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></div><p className="small muted">Latest persisted assessments grouped by score band.</p></div></>;
}
