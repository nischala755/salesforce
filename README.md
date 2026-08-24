# ComplyLens

ComplyLens is a DPDP compliance-operations application built on Next.js 15, React 19, strict TypeScript, Prisma/PostgreSQL, signed HTTP-only cookie sessions, Recharts, Mistral, and Vitest.

The product invariant is deliberately simple: **the rule engine decides, AI explains, and humans approve**. Mistral only receives minimized, persisted verdict metadata. It cannot calculate a score, change a status, mutate a compliance result, or apply remediation.

The DPO view also includes audit integrity verification. New audit entries are canonically encoded, SHA-256 chained under a serialized database lock, and can be sealed into Merkle checkpoints. Operators can verify the chain, inspect the Merkle tree and latest inclusion proof, and export a portable JSON proof bundle.

## Core capabilities

- Deterministic, versioned DPDP assessment rules with persisted evidence and results.
- Interactive no-write Rule Trace Studio with live evidence toggles, per-control execution trace, reproducible scenario fingerprint, and inactive extension preview.
- Remediation impact analysis across the assessed contact portfolio.
- Assessment history with score, resolved-control, and regressed-control comparisons.
- Evidence-grounded AI briefings with rule-cited insights, owned actions, measurable success signals, and a deterministic fallback.
- Reconciled recommendation register with one open action per contact and failed control.
- Human-approved remediation for consent, purpose, retention, notice, and minimization findings.
- Incident command cockpit with deadline visibility, notification evidence, guarded containment/closure, CSV reporting, SDF operational review, and tamper-evident audit verification.

## Operating model and personas

- **DPO / Privacy Operations Lead (primary):** reviews organization posture, independently approves remediation, monitors retention pressure, coordinates privacy-specific breach obligations, and exports audit evidence.
- **CRM or data steward:** investigates contact evidence and requests correction, but cannot approve their own remediation or grant consent for a data principal.
- **Incident Response Lead:** records breach scope and operational milestones while the DPO oversees notification evidence.

ComplyLens is an evidence and decision layer above existing CRM, consent-management, security, and ticketing systems—not a replacement for them. The demo represents connector handoffs locally. In production, minimized metadata is synchronized through adapters while source systems remain systems of record. Consent remediation sends the data principal to an external consent channel; ComplyLens records a consent only after that response is verified and synchronized.

## Rule-engine extension model

Evidence is normalized into five typed inputs, evaluated by deterministic controls, scored from 100 using versioned deductions, checked by a severity gate, and appended to assessment history with the exact rule version and legal mapping. AI can read the persisted verdict afterward but cannot participate in this pipeline. A new policy is added by mapping its evidence, implementing a typed evaluator/remediation definition, publishing a database-backed rule version, adding boundary tests, and activating it for future assessments. Historical verdicts retain their original versions.

## Local setup

1. Copy `.env.example` to `.env.local` and provide `DATABASE_URL`, a random `JWT_SECRET` of at least 32 characters, `MISTRAL_API_KEY`, `DEMO_ADMIN_PASSWORD`, and `DEMO_REVIEWER_PASSWORD`.
2. Install packages with `npm install`.
3. Apply the schema with `npm run db:migrate -- --name init`.
4. Seed the demo dataset with `npm run db:seed`.
5. Start with `npm run dev` and open `http://localhost:3000`.

The current workstation also has an isolated local PostgreSQL container named `complylens-dev-db`, bound to `127.0.0.1:55432`, for migration and browser verification. Production must supply a managed PostgreSQL connection through `DATABASE_URL`.

## Demo access

- Administrator: `admin@complylens.demo` / the value of `DEMO_ADMIN_PASSWORD`
- DPO reviewer: `reviewer@complylens.demo` / the value of `DEMO_REVIEWER_PASSWORD`

The seed requires both environment variables and updates the stored password hashes on every run. Keep the values out of source control, use different passwords per environment, and rotate or remove both accounts before handling real data.

## Verification

```text
npm test
npm run lint
npm run typecheck
npm run build
npm run smoke:browser
```

The browser smoke test uses installed Chrome against a running production server (`npm start`). It covers authentication, bulk assessment, contact investigation, non-mutating simulation, purpose-remediation approval/apply/reassessment, incident tracking, optional AI explanation/fallback, integrity checkpoints, proof export, CSV download, console errors, and mobile overflow on the dashboard, contact list, and contact detail.

## Render deployment

The included `render.yaml` defines a free-tier Next.js web service and PostgreSQL database. It generates `JWT_SECRET`, prompts for the server-side secrets, and runs the idempotent migration/demo-bootstrap steps as part of the build because Render does not support pre-deploy commands on free web services. Demo password hashes are refreshed from environment variables on every seed; operational records are not overwritten.

1. In Render, select **New → Blueprint** and connect this repository.
2. Confirm Render detects `render.yaml`.
3. Enter `MISTRAL_API_KEY`, `DEMO_ADMIN_PASSWORD`, and `DEMO_REVIEWER_PASSWORD` when prompted. Never expose any of them through a `NEXT_PUBLIC_` variable.
4. Create the Blueprint and wait for the database migration, idempotent demo bootstrap, production build, and web-service health check.
5. Open `https://complylens.onrender.com/login` and verify both environment-managed demo accounts.

For a manual free-tier Render web service, use `npm ci && npm run db:deploy && npm run db:seed && npm run build` as the build command and `npm start` as the start command. On a paid service, move `npm run db:deploy` to Render's pre-deploy command and run the demo seed only when intentionally bootstrapping a new environment.

## Vercel deployment

1. Create a managed PostgreSQL database and copy its pooled production connection string.
2. Import this GitHub repository in Vercel as a Next.js project.
3. Add `DATABASE_URL`, `JWT_SECRET` (at least 32 random characters), `MISTRAL_API_KEY`, `DEMO_ADMIN_PASSWORD`, and `DEMO_REVIEWER_PASSWORD` to the Production environment.
4. Against the production `DATABASE_URL`, run `npm run db:deploy` and then `npm run db:seed` once for the demo dataset. Do not run `prisma migrate dev` against production.
5. Deploy from the `main` branch and verify `/login`, authentication, an assessment run, remediation approval, and `/api/audit/integrity` through the UI.

Vercel automatically redeploys connected Git repositories on pushes. Run production migrations as an explicit CI/CD step before promoting schema-changing releases.

## Compliance and security boundaries

- `ComplianceAssessment`, `ComplianceResult`, and `AuditLog` are append-only in application code. The audit hash chain and Merkle checkpoints make changes detectable; they do not prevent a sufficiently privileged database operator from rewriting data and recomputing hashes. External root anchoring plus database-enforced immutability (triggers, restricted roles, or WORM storage) remains a Phase 2 hardening item.
- Every API route except `/api/auth/login` calls `requireSession()` before reading or writing data. Middleware provides an additional outer check.
- Session cookies are HTTP-only, SameSite=Lax, signed with JOSE, expire after eight hours, and are Secure in production.
- Incoming API bodies and queries are validated with Zod.
- Mistral is server-side only. The browser bundle has no API-key reference, and direct personal fields are excluded from model input.
- Data residency and cross-border processing implications for LLM calls are **not documented or approved**. Treat that review, vendor terms, transfer basis, retention configuration, and deployment-region selection as a Phase 2 item before real personal data is used.
- Penalty figures in the UI are explicitly illustrative operational context, never a prediction of actual liability.
- SDF mode is an operational setting and does not legally determine SDF classification, which depends on government notification.
- The 144-hour affected-person breach timer is an internal escalation target, not a statutory deadline.

This software is an operational aid, not legal certification or legal advice. Have qualified counsel validate rule mappings and deployment controls before production use.
