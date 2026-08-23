"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatusBadge } from "@/components/status-badge";

interface HistoryPoint {
  id: string;
  score: number;
  status: string;
  assessedAt: string;
  results: Array<{ ruleCode: string; passed: boolean }>;
}

export function ComplianceTimeMachine({ history }: { history: HistoryPoint[] }) {
  const [selected, setSelected] = useState(history.length - 1);
  const current = history[selected];
  const previous = selected > 0 ? history[selected - 1] : null;
  const delta = previous ? current.score - previous.score : 0;
  const changes = useMemo(() => {
    if (!previous) return { resolved: [] as string[], regressed: [] as string[] };
    const before = new Map(previous.results.map((result) => [result.ruleCode, result.passed]));
    return {
      resolved: current.results
        .filter((result) => result.passed && before.get(result.ruleCode) === false)
        .map((result) => result.ruleCode),
      regressed: current.results
        .filter((result) => !result.passed && before.get(result.ruleCode) === true)
        .map((result) => result.ruleCode),
    };
  }, [current, previous]);
  const chart = history.map((point, index) => ({
    ...point,
    label: new Date(point.assessedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    index,
  }));

  return (
    <section className="card time-machine">
      <div className="time-head">
        <div>
          <span className="eyebrow">Compliance assessment history</span>
          <h2>Score and control changes over time</h2>
        </div>
        <div className={`delta-orb ${delta > 0 ? "up" : delta < 0 ? "down" : ""}`}>
          <strong>{previous ? `${delta >= 0 ? "+" : ""}${delta}` : "100"}</strong>
          <span>{previous ? "score change" : "baseline"}</span>
        </div>
      </div>
      <div className="time-grid">
        <div className="time-chart">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#0c6b58"
                strokeWidth={4}
                dot={{ r: 5, fill: "#fff", strokeWidth: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="time-inspector">
          <span className="muted small">
            Selected assessment · {new Date(current.assessedAt).toLocaleString("en-IN")}
          </span>
          <div>
            <strong className="time-score">{current.score}</strong>{" "}
            <StatusBadge status={current.status} />
          </div>
          {previous ? (
            <>
              <div className="change-row">
                <span className="badge pass">✓ Resolved</span>
                <span>{changes.resolved.join(", ") || "None"}</span>
              </div>
              <div className="change-row">
                <span className="badge fail">✕ Regressed</span>
                <span>{changes.regressed.join(", ") || "None"}</span>
              </div>
            </>
          ) : (
            <p className="muted small">
              First persisted assessment. Run another assessment to compare resolved and regressed controls.
            </p>
          )}
        </div>
      </div>
      {history.length > 1 && (
        <div className="time-slider">
          <span>Oldest</span>
          <input
            aria-label="Select assessment in history"
            type="range"
            min="0"
            max={history.length - 1}
            value={selected}
            onChange={(event) => setSelected(Number(event.target.value))}
          />
          <span>Latest</span>
        </div>
      )}
      <footer className="metric-foot">
        Each point is an append-only persisted assessment, not a live recomputation.
      </footer>
    </section>
  );
}
