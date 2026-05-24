const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= max) {
    return false;
  }

  bucket.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) {
      buckets.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);
