# AI Bookkeeping & CPA Agent

A low-latency AI bookkeeping and CPA review agent for Canadian corporate tax compliance. The system processes receipt documents, extracts structured financial information, determines tax treatment, calculates GST/HST and ITC eligibility, assigns GIFI codes, and routes uncertain cases to human review.

The implementation is designed around **agentic tool use, deterministic financial calculations, fail-closed behavior, auditability, and explicit separation between AI reasoning and financial mutation**.

---

## Core Capabilities

* Receipt/document processing
* Structured financial extraction
* Canadian GST/HST calculation
* ITC eligibility determination
* GIFI classification
* Human-review routing for ambiguous or unsupported cases
* Persistent receipt/review state
* Audit logging
* Idempotent processing
* Prompt-injection defenses
* Tool authorization and receipt scoping
* Rate limiting
* Deterministic financial verification
* SSE streaming for agent responses
* Evaluation harness with categorized golden cases

---

## Architecture

The application separates the conversational/agent layer from deterministic financial and persistence boundaries.

```text
User
 │
 ▼
Next.js Application
 │
 ├── Receipt / Review API
 │
 ├── Agent Runtime
 │     ├── Model
 │     ├── Tool definitions
 │     └── Tool authorization
 │
 ├── Deterministic Financial Logic
 │     ├── GST/HST
 │     ├── ITC
 │     └── GIFI
 │
 ├── Persistence
 │     ├── Receipts
 │     ├── Reviews
 │     └── Audit events
 │
 └── Security / Reliability Boundaries
       ├── Prompt-injection defenses
       ├── Receipt scoping
       ├── Idempotency
       ├── Rate limiting
       └── Fail-closed review states
```

See [`docs/architecture.md`](docs/architecture.md) for the detailed architecture and design decisions.

---

## Agent Safety Model

The agent is intentionally not allowed to freely mutate financial state.

Financially meaningful operations are constrained through explicit tools and server-side validation.

Important boundaries include:

* Model output is treated as untrusted input.
* Tool arguments are validated server-side.
* Receipt access is scoped to the active receipt.
* Financial calculations are deterministic rather than delegated to the model.
* Unsupported or ambiguous cases are routed to review.
* Failed processing does not silently produce an approval.
* Audit events are recorded for important state transitions.
* Duplicate processing is protected through idempotency controls.

Prompt-injection attempts are treated as untrusted receipt content rather than instructions.

See [`docs/threat-model.md`](docs/threat-model.md) for the threat model and security controls.

---

## Financial Logic

The system separates financial calculations from model reasoning.

### GST/HST

GST/HST is calculated deterministically from the structured receipt data and applicable tax information.

### ITC

ITC eligibility is determined through explicit business rules rather than allowing the language model to directly invent the financial result.

### GIFI

GIFI classification is represented separately from the conversational reasoning layer so the final classification can be validated and audited.

### Human Review

Cases with insufficient documentation, ambiguity, unsupported tax situations, or other configured review conditions are not silently approved.

---

## Observability and Auditability

The application records important processing and state information to support debugging and auditability.

The system tracks:

* Receipt processing
* Review state transitions
* Tool calls
* Financial decisions
* Audit events
* Processing failures
* Idempotency behavior

The application also exposes timing information for evaluation and performance analysis.

---

## Testing

The repository contains unit/integration tests, security tests, evaluation cases, and an optional live HTTP/Gemini E2E test.

Run the deterministic test suite with:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The live E2E test is opt-in:

```powershell
$env:RUN_E2E="1"; pnpm test -- e2e/receipt-processing.e2e.test.ts
```

The live E2E path exercises the real application boundary:

```text
HTTP request
   ↓
Receipt processing
   ↓
Gemini
   ↓
Agent tools
   ↓
SSE response
   ↓
Persistence
   ↓
Audit events
```

See [`docs/test-report.md`](docs/test-report.md) for the test-suite breakdown and [`docs/evaluation.md`](docs/evaluation.md) for the agent evaluation results.

---

## Evaluation

The repository contains a categorized 70-case evaluation dataset covering:

* Normal receipts
* Ambiguous receipts
* Missing documentation
* Tax edge cases
* Prompt injection
* Incorrect user instructions
* Tool failures
* State synchronization

The checked-in artifact is:

```text
evaluation/latest-report.json
```

The latest run executed **70 cases**.

* 40 cases satisfied all configured assertions.
* 22 cases ended with the generic `The model stream failed.` error during a provider-quota failure event and should not be interpreted as correctness failures.
* The remaining 8 cases exposed application/evaluator expectation mismatches.

The raw JSON currently records all 30 unsuccessful executions as `application_failure`; it does not independently classify the 22 provider-contaminated cases as provider failures. The provider-contamination interpretation is therefore documented separately rather than presented as a field produced by the evaluator itself.

Because of this contamination, the raw `40/70` result should **not** be presented as the application's correctness accuracy.

The evaluation report is retained as an audit artifact rather than replaced with a cleaner-looking result.

See [`docs/evaluation.md`](docs/evaluation.md) for the detailed breakdown and interpretation.

---

## Performance

The evaluation harness records:

* Total execution duration
* Time to first token (TTFT)
* p50 latency
* p95 latency
* Maximum observed latency

The latest 70-case run recorded:

* Execution p50: ~35.5 seconds
* Execution p95: ~77.3 seconds
* Maximum execution time: ~103.1 seconds
* TTFT p50: ~47.7 seconds
* TTFT p95: ~76.0 seconds
* Maximum TTFT: ~80.4 seconds

These measurements are development/evaluation-environment measurements and are not production SLA measurements.

See [`docs/performance.md`](docs/performance.md).

---

## Docker

Build the application:

```bash
docker build -t ai-bookkeeping-agent .
```

Run it with the required environment variables:

```bash
docker run --env-file .env.local -p 3000:3000 ai-bookkeeping-agent
```

Do not commit real credentials.

The repository includes `.env.example` as the configuration template.

---

## Environment Variables

Copy the example configuration:

```bash
cp .env.example .env.local
```

Required provider/model configuration and other runtime settings are documented in `.env.example`.

Never commit:

* API keys
* Provider credentials
* Database credentials
* Production secrets
* `.env.local`

---

## Security Considerations

The application implements several application-level controls:

* Prompt-injection handling
* Tool authorization
* Receipt-level data scoping
* Input validation
* Idempotency
* Rate limiting
* Fail-closed review behavior
* Audit logging
* Deterministic financial calculations

The security model is documented in:

[`docs/threat-model.md`](docs/threat-model.md)

---

## Known Limitations

The current assessment implementation intentionally has several limitations:

* Authentication and multi-tenant isolation are not implemented.
* SQLite is appropriate for assessment-scale usage but is not the intended production database architecture.
* GST/HST validation is focused on the implemented assessment scenarios rather than full Canadian tax-rule coverage.
* The human-review UI is intentionally minimal.
* Rate limiting is process-local.
* The checked-in 70-case evaluation was affected by provider quota exhaustion; see `docs/evaluation.md` for the detailed breakdown.
* Performance measurements were collected in the development/evaluation environment and should not be treated as production benchmarks.

---

## Production Considerations

A production deployment would additionally require:

* Strong authentication and authorization
* Tenant isolation
* Production-grade database infrastructure
* Secret management
* Distributed rate limiting
* Structured application metrics
* Centralized tracing
* Provider fallback/retry strategy
* Queue-based asynchronous processing for long-running workloads
* Expanded tax-rule coverage
* Stronger document validation
* More extensive automated regression evaluation
* Production security review
* Operational alerting and incident response

---

## Project Structure

```text
.
├── src/
│   ├── app/
│   ├── agent/
│   ├── db/
│   ├── domain/
│   └── ...
├── evaluation/
│   ├── golden-cases.json
│   ├── latest-report.json
│   └── run-evaluation.test.ts
├── docs/
│   ├── architecture.md
│   ├── evaluation.md
│   ├── performance.md
│   ├── test-report.md
│   └── threat-model.md
├── e2e/
├── public/
├── Dockerfile
├── .env.example
├── package.json
└── README.md
```

---

## Architecture Decisions

### Deterministic financial calculations

Financial calculations are implemented outside the language model so that the model cannot directly determine numerical tax outcomes.

### Tool-based agent architecture

The model interacts with the application through explicitly defined tools rather than direct database manipulation.

### Fail-closed review states

When required information is missing or a case cannot be safely resolved, the system routes the case to review rather than silently approving it.

### Auditability

Important actions and state transitions are persisted so the system can be inspected after processing.

### Evaluation as a separate layer

The evaluation harness is kept separate from application runtime logic so test scenarios can be expanded without coupling them to production code.

---

## Submission Notes

The repository is intended to demonstrate:

1. Agentic workflow design
2. Safe tool usage
3. Deterministic financial logic
4. Persistence and auditability
5. Prompt-injection resistance
6. Human-review boundaries
7. Evaluation methodology
8. Testing and E2E verification
9. Containerization
10. Engineering documentation

For the assessment submission, include the private GitHub repository and the requested demonstration video.
