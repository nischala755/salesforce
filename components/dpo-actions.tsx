"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SdfToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  return <button className="btn secondary" onClick={async () => {
    await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sdfMode: !enabled }) });
    router.refresh();
  }}>{enabled ? "Disable" : "Enable"} SDF mode</button>;
}

export function RemediationReview({ id, consent }: { id: string; consent?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function act(action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("Rejection reason")?.trim() : undefined;
    if (action === "reject" && !reason) return;
    setError("");
    const response = await fetch(`/api/remediation/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "reject" ? JSON.stringify({ reason }) : undefined,
    });
    if (!response.ok) {
      setError((await response.json()).error ?? "The review could not be completed.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="review-action">
      <span style={{ display: "flex", gap: 6 }}>
        <button className="btn" onClick={() => act("approve")}>{consent ? "Approve outreach" : "Approve"}</button>
        <button className="btn secondary" onClick={() => act("reject")}>Reject</button>
      </span>
      {error && <span className="small error-inline">{error}</span>}
    </span>
  );
}

export function ApplyRemediation({ id, consent }: { id: string; consent?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");

  return (
    <span className="review-action">
      <button className="btn" onClick={async () => {
        if (consent && !window.confirm("Demo connector: confirm that the data principal approved in the external consent channel and the response is ready to sync.")) return;
        setError("");
        const response = await fetch(`/api/remediation/${id}/apply`, { method: "POST" });
        if (!response.ok) {
          setError((await response.json()).error ?? "The evidence could not be synced.");
          return;
        }
        router.refresh();
      }}>{consent ? "Sync verified consent & reassess" : "Apply & reassess"}</button>
      {error && <span className="small error-inline">{error}</span>}
    </span>
  );
}
