export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

type RateLimitBucket = {
  count: number
  resetAt: number
}

// TODO: Replace this per-instance limiter with Upstash Redis when revenue justifies it.
const buckets = new Map<string, RateLimitBucket>()

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()

  // Clean up expired entries to prevent unbounded Map growth
  buckets.forEach((b, k) => {
    if (now > b.resetAt) {
      buckets.delete(k)
    }
  })

  let bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
  }

  bucket.count += 1
  buckets.set(key, bucket)

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt
  }
}
