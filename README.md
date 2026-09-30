# Loopnow CPA Copilot

Production-oriented prototype for Canadian bookkeeping and GST/HST compliance.

## What this demonstrates

- Application-aware receipt processing
- Stateful multi-step agent execution
- Deterministic CRA/business rules
- Controlled GIFI catalogue
- Strict Zod tool contracts
- Real SQLite persistence
- Transactional, idempotent financial mutation
- Human review workflow
- Audit events
- Backend-to-UI SSE streaming
- Tool lifecycle visibility
- Prompt-injection resistance
- Evaluation golden dataset
- Health endpoint
- Docker packaging

## Run locally

Requirements:

- Node.js 22+
- pnpm 12.5.1
- OpenRouter API key

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Set:

```text
GEMINI_API_KEY=

MODEL_PROVIDER=gemini
MODEL_NAME=gemini-3.1-flash-lite
DATABASE_PATH=.data/cpa-copilot.sqlite
```

Open `http://localhost:3000`.

Health:

```text
GET /api/health
```

## Demo path

1. Select `Receipt #003`.
2. Ask: `Process this receipt and tell me if we can claim the GST.`
3. Watch the real tool stream.
4. The system validates documentation and GST/HST information.
5. The deterministic ITC engine refuses false approval because documentation is insufficient.
6. The transaction enters `REVIEW`.
7. Approve/reject the pending review from the dashboard.
8. Select Receipt #002 to demonstrate the 50% business-meal ITC rule.
9. Select Receipt #004 to demonstrate that a cash deposit is not an expense and has no ITC.

## CRA scope
## Important CRA-source note

The supplied assessment specifies documentary thresholds of `$30` and `$150`, and its rubric explicitly asks for tests at `$29.99`, `$30.00`, `$30.01`, `$149.99`, `$150.00`, and `$150.01`. The prototype preserves those assessment-defined thresholds for scoring. Current CRA published guidance has since moved the corresponding thresholds to `$100` and `$500`; therefore this prototype's `2026.09.1` ruleset should not be represented as a current production CRA ruleset without updating `domain/cra/documentation.ts` and its boundary tests. Source references are recorded in `domain/cra/source-registry.ts`.


The prototype implements a deterministic rule set based on the assessment's
required scenarios. It does not perform external CRA registration verification.
A syntactically valid GST/HST number is explicitly not treated as proof of
registration.

See `docs/architecture.md` and `docs/threat-model.md`.

## Tests and evaluation

Existing unit tests cover the deterministic domain layer. The repository also
contains:

```text
evaluation/golden-cases.json
```

with 70 cases covering normal, ambiguous, missing-documentation, tax-edge,
prompt-injection, incorrect-instruction, tool-failure and state-synchronization
scenarios.

The preferred CI sequence is:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Docker

```bash
docker compose up --build
```

The application uses a persistent named volume for SQLite.

## Important prototype limitations

- Authentication and tenant isolation are not implemented.
- SQLite is an assessment-scale persistence choice; PostgreSQL is the intended production database.
- The configured AI provider is OpenRouter.
- GST/HST number validation is syntax/format validation, not CRA registration lookup.
- Human review is intentionally minimal.
