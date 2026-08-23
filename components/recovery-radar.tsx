"use client";

import { useState } from "react";
import Link from "next/link";

interface RecoveryItem {
  code: string;
  label: string;
  deduction: number;
  failedCount: number;
  recoverablePoints: number;
  statusImprovements: number;
  contacts: Array<{ id: string; name: string }>;
}

export function RecoveryRadar({ items }: { items: RecoveryItem[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const max = Math.max(1, ...items.map((item) => item.recoverablePoints));
  const top = items[0];

  return (
    <section className="card recovery-radar">
      <div className="recovery-head">
        <div>
          <span className="eyebrow">Remediation impact analysis</span>
          <h2>Prioritized control improvements</h2>
        </div>
        <div className="recovery-hero">
          <strong>{top?.code ?? "—"}</strong>
          <span>highest projected impact</span>
        </div>
      </div>
      <div className="recovery-list">
        {items.map((item) => (
          <div className="recovery-row" key={item.code}>
            <button
              className="recovery-summary"
              onClick={() => setExpanded(expanded === item.code ? null : item.code)}
              aria-expanded={expanded === item.code}
            >
              <span className="rule-code">{item.code}</span>
              <span className="recovery-track">
                <span
                  style={{
                    width: `${Math.max(
                      item.recoverablePoints ? 8 : 0,
                      (item.recoverablePoints / max) * 100,
                    )}%`,
                  }}
                />
              </span>
              <strong>+{item.recoverablePoints} pts</strong>
              <span className="muted small">
                {item.failedCount} records · {item.statusImprovements} status shifts
              </span>
            </button>
            {expanded === item.code && (
              <div className="recovery-contacts">
                {item.contacts.length
                  ? item.contacts.map((contact, index) => (
                      <span key={contact.id}>
                        {index ? " · " : ""}
                        <Link href={`/contacts/${contact.id}`}>{contact.name}</Link>
                      </span>
                    ))
                  : "No active findings"}
              </div>
            )}
          </div>
        ))}
      </div>
      <footer className="metric-foot">
        Deterministic portfolio projection · no records changed
      </footer>
    </section>
  );
}
