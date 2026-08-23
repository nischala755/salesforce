import { Suspense } from "react";
import { LoginForm } from "./login-form";
export default function LoginPage() {
  return (
    <main className="login-wrap">
      <section className="login-card">
        <p className="eyebrow">DPDP operations</p>
        <h1>ComplyLens</h1>
        <p className="lede">Deterministic compliance assessment with human-approved remediation.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
