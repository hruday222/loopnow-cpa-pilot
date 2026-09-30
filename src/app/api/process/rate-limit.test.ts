import { describe, expect, it } from "vitest";

import { checkProcessRateLimit } from "./rate-limit";

describe("process rate limiter", () => {
  it("allows requests under the limit", () => {
    const clientId = `test-${crypto.randomUUID()}`;

    for (let i = 0; i < 20; i += 1) {
      expect(checkProcessRateLimit(clientId).allowed).toBe(true);
    }
  });

  it("blocks the 21st request within the same window", () => {
    const clientId = `test-${crypto.randomUUID()}`;

    for (let i = 0; i < 20; i += 1) {
      checkProcessRateLimit(clientId);
    }

    const result = checkProcessRateLimit(clientId);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks clients independently", () => {
    const clientA = `test-a-${crypto.randomUUID()}`;
    const clientB = `test-b-${crypto.randomUUID()}`;

    for (let i = 0; i < 20; i += 1) {
      checkProcessRateLimit(clientA);
    }

    expect(checkProcessRateLimit(clientA).allowed).toBe(false);
    expect(checkProcessRateLimit(clientB).allowed).toBe(true);
  });
});