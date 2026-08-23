export function StatusBadge({ status }: { status: string }) {
  const icon = status === "compliant" || status === "pass" ? "✓" : status === "at_risk" ? "▲" : "✕";
  return <span className={`badge ${status}`}><span aria-hidden>{icon}</span>{status.replaceAll("_", " ")}</span>;
}
