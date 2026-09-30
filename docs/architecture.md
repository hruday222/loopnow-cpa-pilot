# Loopnow CPA Copilot — Architecture

## Runtime flow

```text
Browser selectedReceiptId
        |
        v
POST /api/process
        |
        v
Agent Run (runId + receiptId)
        |
        +--> AI SDK / OpenRouter
        |       |
        |       +--> strict tools
        |               |
        |               +--> deterministic CRA rules
        |               +--> controlled GIFI catalogue
        |               +--> persisted receipt state
        |
        v
Deterministic verification
        |
        +--> review
        |
        +--> authorized/idempotent mutation
        |
        v
SQLite persistence + audit event
        |
        v
SSE stream -> dashboard
```

## State ownership

- **UI-owned:** selected receipt, textarea, local display state.
- **Agent-owned:** run ID, stage, tool lifecycle and analysis while a run executes.
- **Persisted domain state:** receipts, classifications, analyses, approvals, agent runs, tool calls and audit events.
- No request path relies on a module-level mutable selected receipt.

## Mutation boundary

Financial classification follows:

1. LLM proposal
2. Zod tool validation
3. run/receipt authorization
4. deterministic business-rule verification
5. idempotency key
6. SQLite transaction
7. audit event

The LLM never supplies authoritative financial arithmetic.

## Review semantics

`REVIEW` means the system executed normally but business evidence is missing,
ambiguous or insufficient. `ERROR` means a technical/system failure.

Receipt #003 is intentionally a review scenario because its GST/HST number and
higher-tier documentation evidence are missing.

## Persistence

SQLite is used for the assessment prototype because Node 22 provides the
embedded relational database through `node:sqlite`. The schema is deliberately
small and can be migrated to PostgreSQL without changing the domain rules.

Tables:

- receipts
- agent_runs
- tool_calls
- audit_events
- approvals
- idempotency_keys

## Deterministic rule boundary

The LLM proposes classifications and explanations. The backend owns:

- documentation tiers
- GST/HST format validation
- ITC arithmetic
- meal limitations
- GIFI catalogue validation
- transaction-type consistency
- mutation authorization
- persistence
- audit records

## Security model

Receipt text is untrusted. The model is instructed not to execute instructions
embedded in receipt content. Tool access is allowlisted and scoped to the run's
selected receipt. No generic shell or arbitrary code execution tool exists.

## Known limitations

- Authentication/tenant isolation is not implemented in this assessment prototype.
- GST/HST account validation is format validation only; it does not verify CRA registration externally.
- SQLite is suitable for the demo but PostgreSQL is the production scaling target.
- Model provider abstraction is configuration-level; the current installed provider is OpenRouter.
- Approval editing is intentionally minimal.
