# Lightweight Threat Model

| Threat | Control |
|---|---|
| Direct prompt injection | System prompt treats receipt fields as untrusted data. |
| Indirect prompt injection | Receipt/vendor/OCR text cannot override deterministic backend rules. |
| Excessive agency | Financial mutation is not exposed as a direct trusted model mutation. |
| Tool abuse | Strict Zod schemas and a fixed tool allowlist. |
| Cross-receipt access | Every production tool is scoped to the run's receipt ID. |
| Duplicate mutation | Database idempotency key and unique primary key. |
| Credential leakage | API key is server-side only. |
| Data exfiltration | No generic HTTP/shell/file tools are exposed to the model. |
| False financial approval | Deterministic verification precedes mutation; review is first-class. |
| Audit gaps | Agent runs, tool calls and meaningful state transitions are persisted. |
| Malformed model output | Tool schemas and deterministic verification reject invalid results. |
| Stream interruption | Backend records run failure; UI does not treat a disconnected run as success. |

## Remaining production work

Authentication, tenant isolation, rate limiting at the edge, stronger PII
redaction and a managed PostgreSQL deployment should be added before production
use.
