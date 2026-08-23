"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface IntegrityReport {
  status: "verified" | "attention";
  chain: { valid: boolean; verifiedCount: number; brokenAt: string | null };
  rootHash: string;
  leafCount: number;
  unsealedCount: number;
  canopy: Array<{
    level: number;
    nodes: Array<{ index: number; hash: string; label: string }>;
  }>;
  latestProof: {
    sequence: string;
    entryHash: string;
    steps: Array<{ direction: "left" | "right"; hash: string }>;
    valid: boolean;
  } | null;
  checkpoints: Array<{
    id: string;
    rootHash: string;
    leafCount: number;
    createdAt: string;
    valid: boolean;
  }>;
}

export function AuditProofGraph() {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/audit/integrity", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Integrity report unavailable.");
    setReport(body);
  }, []);

  useEffect(() => {
    load().catch((reason) => setError(reason.message));
  }, [load]);

  const graph = useMemo(() => {
    if (!report) return { width: 1000, height: 280, nodes: [], edges: [] };
    const levels = report.canopy;
    const height = Math.max(240, levels.length * 92);
    const nodes = levels.flatMap((level, levelIndex) =>
      level.nodes.map((node, index) => ({
        id: `${levelIndex}-${index}`,
        hash: node.hash,
        label: node.label,
        x: (1000 / (level.nodes.length + 1)) * (index + 1),
        y: 48 + levelIndex * 86,
        levelIndex,
        index,
      })),
    );
    const edges = nodes
      .filter((node) => node.levelIndex > 0)
      .map((node) => {
        const parentLevel = levels[node.levelIndex - 1];
        const parentIndex = Math.min(Math.floor(node.index / 2), parentLevel.nodes.length - 1);
        const parent = nodes.find(
          (item) => item.levelIndex === node.levelIndex - 1 && item.index === parentIndex,
        )!;
        return { from: parent, to: node };
      });
    return { width: 1000, height, nodes, edges };
  }, [report]);

  async function seal() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/audit/integrity", { method: "POST" });
    const body = await response.json();
    if (!response.ok) setError(body.error ?? "Checkpoint failed.");
    else await load();
    setBusy(false);
  }

  function download() {
    if (!report) return;
    const blob = new Blob(
      [JSON.stringify({ ...report, exportedAt: new Date().toISOString() }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `complylens-merkle-proof-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    if (!report) return;
    await navigator.clipboard.writeText(report.rootHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="card proof-graph">
      <div className="proof-head">
        <div>
          <span className="eyebrow">Audit integrity verification</span>
          <h2>Hash-chain and Merkle validation</h2>
        </div>
        <span className={`integrity-orb ${report?.status ?? "loading"}`}>
          <strong>{report?.status === "verified" ? "✓" : "◇"}</strong>
          <span>{report?.status ?? "checking"}</span>
        </span>
      </div>
      {error && <div className="error">{error}</div>}
      {!report ? (
        <div className="proof-loading">Verifying audit ledger…</div>
      ) : (
        <>
          <div className="proof-stats">
            <div>
              <span>Audit events</span>
              <strong>{report.leafCount}</strong>
            </div>
            <div>
              <span>Hash chain</span>
              <strong>{report.chain.valid ? "Verified" : "Broken"}</strong>
            </div>
            <div>
              <span>Checkpoints</span>
              <strong>{report.checkpoints.length}</strong>
            </div>
            <div>
              <span>Latest proof</span>
              <strong>{report.latestProof?.valid ? "Valid" : "—"}</strong>
            </div>
          </div>
          <button className="root-ribbon" onClick={copy} title="Copy current Merkle root">
            <span>Current Merkle root</span>
            <code>{report.rootHash}</code>
            <strong>{copied ? "Copied" : "Copy"}</strong>
          </button>
          <div className="merkle-stage">
            {report.leafCount === 0 ? (
              <div className="empty-proof">
                <strong>No audit events recorded</strong>
                <span>Run an assessment to create verifiable audit entries.</span>
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${graph.width} ${graph.height}`}
                role="img"
                aria-label="Merkle verification tree"
              >
                <defs>
                  <filter id="nodeGlow">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <linearGradient id="edgeGradient">
                    <stop stopColor="#58c8a3" />
                    <stop offset="1" stopColor="#277a64" />
                  </linearGradient>
                </defs>
                {graph.edges.map((edge, index) => (
                  <line
                    key={index}
                    x1={edge.from.x}
                    y1={edge.from.y}
                    x2={edge.to.x}
                    y2={edge.to.y}
                    stroke="url(#edgeGradient)"
                    strokeWidth="2"
                    opacity=".55"
                  />
                ))}
                {graph.nodes.map((node, index) => (
                  <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
                    <circle
                      r={index === 0 ? 25 : 18}
                      className={index === 0 ? "merkle-root-node" : "merkle-node"}
                      filter="url(#nodeGlow)"
                    />
                    <text y="4" textAnchor="middle" className="merkle-node-index">
                      {index === 0 ? "ROOT" : node.index + 1}
                    </text>
                    <text
                      y={index === 0 ? 42 : 34}
                      textAnchor="middle"
                      className="merkle-hash-label"
                    >
                      {node.label}
                    </text>
                  </g>
                ))}
              </svg>
            )}
          </div>
          <div className="proof-bottom">
            <div className="proof-path">
              <strong>Latest inclusion proof</strong>
              {report.latestProof ? (
                <>
                  {report.latestProof.steps.map((step, index) => (
                    <div key={`${step.hash}-${index}`}>
                      <span>
                        {step.direction === "left" ? "←" : "→"} sibling {index + 1}
                      </span>
                      <code>{step.hash.slice(0, 14)}…</code>
                    </div>
                  ))}
                  <span className="proof-valid">✓ Recomputes to root</span>
                </>
              ) : (
                <span className="muted small">Awaiting the first audit event.</span>
              )}
            </div>
            <div className="checkpoint-stack">
              <strong>Merkle checkpoints</strong>
              {report.checkpoints.slice(0, 3).map((checkpoint) => (
                <div className="checkpoint" key={checkpoint.id}>
                  <span className={`badge ${checkpoint.valid ? "pass" : "fail"}`}>
                    {checkpoint.valid ? "✓ Verified" : "✕ Changed"}
                  </span>
                  <span>
                    {checkpoint.leafCount} events ·{" "}
                    {new Date(checkpoint.createdAt).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
              {report.checkpoints.length === 0 && (
                <span className="muted small">No checkpoint sealed yet.</span>
              )}
            </div>
          </div>
          <div className="proof-actions">
            <button className="btn" onClick={seal} disabled={busy || report.leafCount === 0}>
              {busy ? "Sealing…" : "Seal checkpoint"}
            </button>
            <button className="btn secondary" onClick={download}>
              Export proof bundle
            </button>
            <span className="legal-chip">SHA-256 · canonical JSON · inclusion proof</span>
          </div>
          <footer className="metric-foot">
            Tamper-evident verification, not physical database immutability. External anchoring or
            WORM storage is required for that guarantee.
          </footer>
        </>
      )}
    </section>
  );
}
