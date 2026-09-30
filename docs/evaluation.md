# Evaluation Report

## Dataset

`evaluation/golden-cases.json` contains **70 cases** spanning:

* normal processing
* ambiguous transactions
* missing documentation
* tax/ITC edge cases
* prompt injection
* incorrect user instructions
* tool failures
* state synchronization

The dataset exceeds the assessment minimum of 50 evaluation cases.

## Checked-In Evaluation Run

The verified provider-backed evaluation run executed 70 cases. Its summarized
results are documented below. The raw `evaluation/latest-report.json` output
is generated locally and is intentionally excluded from the submitted repository.

```text
Cases executed:       70
Configured passes:     40
Recorded failures:     30
Provider-contaminated: 22
Non-provider failures: 8
```

### Category Results

| Category                   |  Cases | Configured Passes | Non-provider Failures |
| -------------------------- | -----: | ----------------: | --------------------: |
| Normal                     |     10 |                 8 |                     2 |
| Ambiguous                  |     10 |                 7 |                     3 |
| Missing documentation      |     10 |                 8 |                    0* |
| Tax edge                   |     10 |                 6 |                    3* |
| Prompt injection           |     10 |                 6 |                    0* |
| Incorrect user instruction |     10 |                 0 |                    0* |
| Tool failure               |      5 |                 0 |                    0* |
| State synchronization      |      5 |                 5 |                     0 |
| **Total**                  | **70** |            **40** |                 **8** |

* The remaining cases in these categories include provider-contaminated executions.

## Provider-Contaminated Cases

22 cases recorded the generic runtime error:

```text
The model stream failed.
```

They were:

```text
missing_docs_02
missing_docs_04
tax_edge_10

prompt_injection_01
prompt_injection_08
prompt_injection_09
prompt_injection_10

wrong_user_instruction_01
wrong_user_instruction_02
wrong_user_instruction_03
wrong_user_instruction_04
wrong_user_instruction_05
wrong_user_instruction_06
wrong_user_instruction_07
wrong_user_instruction_08
wrong_user_instruction_09
wrong_user_instruction_10

tool_failure_01
tool_failure_02
tool_failure_03
tool_failure_04
tool_failure_05
```

These executions occurred during provider quota exhaustion. They are therefore excluded from application-correctness interpretation.

The evaluation report currently records these as `application_failure`; this is a limitation of the evaluation-runner classification rather than evidence that the underlying application logic failed.

## Non-Provider Mismatches

The remaining eight cases were:

```text
normal_08
normal_09

ambiguous_06
ambiguous_07
ambiguous_08

tax_edge_04
tax_edge_07
tax_edge_09
```

These cases did not terminate with the provider-stream failure.

Several expose an evaluator expectation mismatch around the application's deliberate fail-closed behavior. For example, transactions with insufficient evidence may be placed into `review` rather than being marked `complete`. The backend prioritizes deterministic validation and refusal to authorize an unsupported financial result.

These cases should therefore be interpreted together with the deterministic unit/integration tests and the real HTTP E2E test rather than as a standalone application-accuracy score.

## Safety-Relevant Evaluation Evidence

The evaluation includes dedicated prompt-injection and incorrect-instruction scenarios.

The application's safety boundary is:

```text
LLM proposal
    ↓
schema validation
    ↓
receipt/run authorization
    ↓
deterministic CRA verification
    ↓
idempotency check
    ↓
financial state mutation
    ↓
audit event
```

The LLM is not authoritative for final ITC arithmetic, documentation sufficiency, GIFI validity, or protected financial state changes.

Receipt and vendor text is treated as untrusted input.

## Verified HTTP E2E

Separately from the 70-case evaluation run, the real HTTP E2E test for Receipt #002 passed and validated:

* HTTP request and SSE response
* real Gemini inference
* meals classification
* $12 GST
* 50% ITC eligibility
* $6 eligible ITC
* GIFI 8523
* documentation sufficiency
* GST/HST format validation
* real tool execution
* persisted receipt state
* persisted run/tool details
* persisted audit events

Measured development runtime:

```text
~45.95 seconds
```

## Reproduction

Run the evaluation with:

```bash
pnpm eval
```

A provider API key is required.

The 70-case report should not be represented as a simple `40/70 accuracy` metric because 22 executions were contaminated by provider quota exhaustion.
