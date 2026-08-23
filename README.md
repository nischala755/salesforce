# ComplyLens

ComplyLens is a DPDP compliance-operations application built on Next.js 15, React 19, strict TypeScript, Prisma/PostgreSQL, signed HTTP-only cookie sessions, Recharts, Mistral, and Vitest.

The product invariant is deliberately simple: **the rule engine decides, AI explains, and humans approve**. Mistral only receives minimized, persisted verdict metadata. It cannot calculate a score, change a status, mutate a compliance result, or apply remediation.

The DPO view also includes audit integrity verification. New audit entries are canonically encoded, SHA-256 chained under a serialized database lock, and can be sealed into Merkle checkpoints. Operators can verify the chain, inspect the Merkle tree and latest inclusion proof, and export a portable JSON proof bundle.

## Core capabilities

- Deterministic, versioned DPDP assessment rules with persisted evidence and results.
- Remediation impact analysis across the assessed contact portfolio.
- Assessment history with score, resolved-control, and regressed-control comparisons.
- Read-only AI briefings generated from minimized persisted verdict metadata.
- Human-approved remediation for consent, purpose, retention, notice, and minimization findings.
- Breach operations, data-principal rights requests, CSV reporting, SDF operational review, and tamper-evident audit verification.

## Local setup

1. Copy `.env.example` to `.env.local` and provide `DATABASE_URL`, a random `JWT_SECRET` of at least 32 characters, and `MISTRAL_API_KEY`.
2. Install packages with `npm install`.
3. Apply the schema with `npm run db:migrate -- --name init`.
4. Seed the demo dataset with `npm run db:seed`.
5. Start with `npm run dev` and open `http://localhost:3000`.

The current workstation also has an isolated local PostgreSQL container named `complylens-dev-db`, bound to `127.0.0.1:55432`, for migration and browser verification. Production must supply a managed PostgreSQL connection through `DATABASE_URL`.

## Demo access

- Administrator: `admin@complylens.demo` / `DemoAdmin!2026`
- DPO reviewer: `reviewer@complylens.demo` / `DemoReviewer!2026`

These accounts are explicitly DEMO credentials. Rotate or remove both passwords before any real deployment.

## Verification

```text
npm test
npm run lint
npm run typecheck
npm run build
npm run smoke:browser
```

The browser smoke test uses installed Chrome against a running production server (`npm start`). It covers authentication, bulk assessment, contact investigation, non-mutating simulation, purpose-remediation approval/apply/reassessment, breach tracking, rights requests, optional AI explanation/fallback, integrity checkpoints, proof export, CSV download, console errors, and mobile overflow on the dashboard, contact list, and contact detail.

## Render deployment

The included `render.yaml` defines a free-tier Next.js web service and PostgreSQL database. It generates `JWT_SECRET`, prompts for `MISTRAL_API_KEY`, and runs the idempotent migration/demo-bootstrap steps as part of the build because Render does not support pre-deploy commands on free web services. Existing user passwords and operational records are not overwritten on later deploys.

1. In Render, select **New → Blueprint** and connect this repository.
2. Confirm Render detects `render.yaml`.
3. Enter `MISTRAL_API_KEY` when prompted. Never expose it through a `NEXT_PUBLIC_` variable.
4. Create the Blueprint and wait for the database migration, idempotent demo bootstrap, production build, and web-service health check.
5. Open the generated `https://complylens-....onrender.com/login` URL and rotate or remove the seeded demo credentials before using non-demo data.

For a manual free-tier Render web service, use `npm ci && npm run db:deploy && npm run db:seed && npm run build` as the build command and `npm start` as the start command. On a paid service, move `npm run db:deploy` to Render's pre-deploy command and run the demo seed only when intentionally bootstrapping a new environment.

## Vercel deployment

1. Create a managed PostgreSQL database and copy its pooled production connection string.
2. Import this GitHub repository in Vercel as a Next.js project.
3. Add `DATABASE_URL`, `JWT_SECRET` (at least 32 random characters), and `MISTRAL_API_KEY` to the Production environment.
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
