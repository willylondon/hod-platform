import "server-only";

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const rateLimitBuckets = new Map<string, number[]>();

export async function requireApiUser(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  return { user, response: null };
}

export function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (rateLimitBuckets.get(key) ?? []).filter(
    (timestamp) => now - timestamp < windowMs
  );

  if (recent.length >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowMs - (now - recent[0])) / 1000)
    );
    rateLimitBuckets.set(key, recent);
    return NextResponse.json(
      { error: "Too many requests. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      }
    );
  }

  recent.push(now);
  rateLimitBuckets.set(key, recent);

  // Bound memory use on long-lived instances. Vercel may also distribute requests
  // across instances, so provider-side key budgets remain the final spend control.
  if (rateLimitBuckets.size > 500) {
    for (const [bucketKey, timestamps] of rateLimitBuckets) {
      if (timestamps.every((timestamp) => now - timestamp >= windowMs)) {
        rateLimitBuckets.delete(bucketKey);
      }
    }
    if (rateLimitBuckets.size > 500) {
      const oldestBucketKey = rateLimitBuckets.keys().next().value;
      if (oldestBucketKey) rateLimitBuckets.delete(oldestBucketKey);
    }
  }

  return null;
}
