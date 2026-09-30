# Lightweight Threat Model

The application treats receipt content and model output as untrusted inputs.

| Threat | Primary control | Remaining limitation |
|---|---|---|
| Direct prompt injection | Receipt content is treated as data; deterministic backend rules remain authoritative | Model behavior can still vary |
| Indirect prompt injection | Receipt/vendor text cannot directly authorize backend mutations | New ingestion channels need their own validation |
| Excessive agency | Narrow domain tools; no shell/code/filesystem tools; human review | Authentication/tenant controls are not implemented |
| Excessive permissions | Tool allowlist and receipt/run scoping | Permission model is application-local |
| Tool abuse | Strict Zod contracts and deterministic verification | Model/provider remains external |
| Untrusted tool output | Backend verification before financial mutation | New external integrations need trust boundaries |
| Credential leakage | API key remains server-side | Production secret management is still required |
| Data exfiltration | No arbitrary HTTP/file/shell tool | Production network egress should be explicit |
| Malicious receipt content | Receipt fields are untrusted | OCR/external ingestion expands attack surface |
| Model hallucination | Deterministic verification and controlled catalogues | Natural-language explanation can still be imperfect |
| Incorrect classification | Schema-constrained proposal plus backend verification | Ambiguous cases may require review |
| Incorrect tax calculation | Deterministic ITC/meal logic | Ruleset must be maintained against applicable guidance |
| False approval | Review conditions are backend-enforced | Review UI is intentionally minimal |
| Replay/duplicate mutation | Idempotency keys and transactions | Distributed deployments need shared persistence |
| Unauthorized state change | Backend authorization and run/receipt scoping | No tenant-aware authentication yet |
| Stream/backend failure | Run failure is persisted; disconnect is not treated as success | Network observability can be expanded |

## Security Invariants

1. Model instructions cannot directly mutate arbitrary financial state.
2. Tax arithmetic is not accepted from natural-language output as authoritative.
3. GIFI codes must come from the controlled catalogue.
4. Tool requests are schema-validated.
5. Tools operate within the selected receipt/run scope.
6. Duplicate mutations are idempotent.
7. Technical errors are distinct from business review.
8. API credentials are not exposed to the browser.

## Production Work Remaining

Authentication, tenant isolation, role-based authorization, distributed rate limiting, managed secrets, stronger PII redaction/retention, managed PostgreSQL, explicit network egress controls, operational tracing/alerting, and current-rule review/version management.
