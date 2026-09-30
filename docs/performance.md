# Performance Report

These are assessment/development measurements, not production capacity claims.

## Verified HTTP E2E

Scenario:

```text
POST /api/process
    ↓
real Gemini inference
    ↓
structured tool execution
    ↓
deterministic verification
    ↓
SSE final event
    ↓
persisted receipt/run/tool/audit state
```

| Metric            | Measurement |
| ----------------- | ----------: |
| Total E2E runtime |     45.95 s |
| Result            |      Passed |
| Receipt           |        #002 |
| Model path        |      Gemini |
| Final status      |  `complete` |
| Gross GST         |      $12.00 |
| ITC eligibility   |         50% |
| Eligible ITC      |       $6.00 |
| GIFI              |        8523 |

The approximately 46-second measurement is a single live development run and is not a production latency target.

## Agent Evaluation Timing

The verified 70-case provider-backed evaluation run produced the timing observations below.

| Metric                    | Measurement |
| ------------------------- | ----------: |
| Evaluation cases executed |          70 |
| Duration p50              |    35.516 s |
| Duration p95              |    77.333 s |
| Maximum duration          |   103.104 s |
| TTFT observations         |          43 |
| TTFT p50                  |    47.705 s |
| TTFT p95                  |    76.006 s |
| Maximum TTFT              |    80.374 s |

These measurements are affected by external model-provider latency and quota behavior. They should not be interpreted as application-only latency or as a production SLO.

## Provider Limitations

The 70-case evaluation encountered provider quota exhaustion. 22 cases terminated with the generic model-stream error:

```text
The model stream failed.
```

Those cases are retained in the report for reproducibility but are excluded from correctness interpretation.

## Not Yet Measured

The following production-scale measurements have not been performed:

* sustained concurrent throughput
* load-test latency under concurrency
* database contention
* multi-instance behavior
* distributed rate limiting
* provider failover latency
* production network latency
* long-duration reliability

The prototype therefore demonstrates the measurement pipeline and representative development timings rather than production capacity.
