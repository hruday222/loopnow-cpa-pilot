# Test Report

## Test Scope

The project uses multiple layers of testing:

* deterministic CRA/business-rule unit tests
* tool and schema validation tests
* persistence/integration tests
* security-focused tests
* real HTTP E2E testing
* LLM agent evaluation

The assessment requires unit, integration, E2E, security and evaluation coverage. The test suite is designed to keep deterministic financial logic independent from LLM behavior.

## Baseline Test Suite

Previously verified baseline run:

```text
Total tests:   203
Passed:        132
Skipped:        71
```

The skipped tests are opt-in provider-backed tests:

```text
70 evaluation cases
1 live Gemini E2E test
```

The normal test command is:

```bash
pnpm test
```

## Typecheck, Lint and Build

The submission verification commands are:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

These checks are required before the final repository commit.

## Live HTTP E2E

The live E2E test can be enabled with:

```powershell
$env:RUN_E2E="1"; pnpm test -- e2e/receipt-processing.e2e.test.ts
```

The previously verified Receipt #002 flow passed in approximately 45.95 seconds.

The flow exercised:

```text
HTTP request
→ real Gemini inference
→ tool calls
→ deterministic CRA rules
→ SSE streaming
→ persistence
→ audit events
```

## Security Test Coverage

Security-focused tests cover:

* prompt injection
* receipt/run scoping
* authorization boundaries
* idempotent financial mutations
* malformed tool output
* deterministic verification
* rate limiting
* request-size limits
* safe error handling

Receipt/vendor text is treated as untrusted data and cannot directly override deterministic accounting rules.

## Deterministic Business-Rule Coverage

The unit/integration suite covers the application's deterministic financial boundaries, including:

* GST/HST format validation
* documentation tiers
* ITC calculation
* commercial-use percentage
* meals and entertainment limitations
* GIFI validation
* monetary calculations and rounding
* state transitions
* financial mutation protection

## Evaluation Dataset

The dedicated evaluation dataset contains:

```text
70 cases
```

The verified evaluation run recorded:

```text
70 executed
40 configured passes
30 recorded failures
22 provider-contaminated executions
8 non-provider mismatches
```

The 22 provider-contaminated executions occurred during provider quota exhaustion and are not treated as application-correctness failures.

See:

```text
docs/evaluation.md
evaluation/golden-cases.json

The raw evaluation report is generated locally and is intentionally excluded
from the submitted repository.
```

## Coverage

A code-coverage percentage was **not collected for the verified baseline run**. No coverage percentage is therefore reported.

## Test Philosophy

The most important safety boundary is that the LLM is not the source of truth for deterministic accounting calculations.

The backend remains authoritative for:

* tax calculations
* documentation validation
* ITC eligibility
* GIFI validation
* authorization
* persistence
* protected financial mutations
* audit events

A model failure, malformed model output, or incorrect model proposal must not result in an invalid financial state.
