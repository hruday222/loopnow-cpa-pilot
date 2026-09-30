type RateLimitEntry = {
    count: number;
    resetAt: number;
  };
  
  const WINDOW_MS = 60_000;
  const MAX_REQUESTS = 20;
  
  const clients = new Map<string, RateLimitEntry>();
  
  export function checkProcessRateLimit(clientId: string): {
    allowed: boolean;
    retryAfterSeconds: number;
  } {
    const now = Date.now();
    const current = clients.get(clientId);
  
    if (!current || now >= current.resetAt) {
      clients.set(clientId, {
        count: 1,
        resetAt: now + WINDOW_MS,
      });
  
      return {
        allowed: true,
        retryAfterSeconds: 0,
      };
    }
  
    if (current.count >= MAX_REQUESTS) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((current.resetAt - now) / 1000),
        ),
      };
    }
  
    current.count += 1;
  
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }