"use client";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter(); const search = useSearchParams(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
    const body = await response.json(); setBusy(false); if (!response.ok) { setError(body.error ?? "Login failed."); return; } router.push(search.get("next") || "/dashboard"); router.refresh();
  }
  return <form onSubmit={submit} className="stack">
    <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue="admin@complylens.demo" autoComplete="username" required /></div>
    <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
    {error && <p role="alert" className="error small">⚠ {error}</p>}
    <button className="btn" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}</button>
  </form>;
}
