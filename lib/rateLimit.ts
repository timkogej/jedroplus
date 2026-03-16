// lib/rateLimit.ts
// Rate limiting z Upstash Redis

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

// Gracefully handle missing Upstash env vars (e.g. in production before setup)
const UPSTASH_CONFIGURED =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = UPSTASH_CONFIGURED
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Različni rate limiterji za različne namene
export const rateLimiters = UPSTASH_CONFIGURED && redis
  ? {
      api: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, "10 s"), analytics: true, prefix: "ratelimit:api" }),
      webhook: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(50, "10 s"), analytics: true, prefix: "ratelimit:webhook" }),
      auth: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "60 s"), analytics: true, prefix: "ratelimit:auth" }),
      ai: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "60 s"), analytics: true, prefix: "ratelimit:ai" }),
    }
  : null;

// Tip za rate limiter
type RateLimiterType = "api" | "webhook" | "auth" | "ai";

// Helper funkcija za pridobitev IP naslova
function getIP(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  
  if (xff) {
    return xff.split(",")[0].trim();
  }
  if (realIp) {
    return realIp;
  }
  return "127.0.0.1";
}

// Glavna rate limit funkcija
export async function rateLimit(
  request: NextRequest,
  type: RateLimiterType = "api"
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  // If Upstash is not configured, allow all requests through
  if (!rateLimiters) {
    return { success: true, limit: 999, remaining: 998, reset: Date.now() + 10000 };
  }

  const ip = getIP(request);
  const limiter = rateLimiters[type];

  try {
    const { success, limit, remaining, reset } = await limiter.limit(ip);
    return { success, limit, remaining, reset };
  } catch {
    // If Redis call fails, allow the request through rather than blocking all users
    return { success: true, limit: 999, remaining: 998, reset: Date.now() + 10000 };
  }
}

// Wrapper za API route z rate limiting
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  type: RateLimiterType = "api"
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Preveri rate limit
    const { success, limit, remaining, reset } = await rateLimit(request, type);
    
    // Če je presežen limit
    if (!success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Too many requests. Please try again later.",
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": reset.toString(),
            "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }
    
    // Izvedi handler in dodaj rate limit headerje
    const response = await handler(request);
    
    // Dodaj rate limit headerje v response
    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", reset.toString());
    
    return response;
  };
}