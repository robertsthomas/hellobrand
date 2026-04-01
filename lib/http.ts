import { NextResponse } from "next/server";

import { captureHandledError } from "@/lib/monitoring/sentry";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(
  message: string,
  status = 400,
  options?: {
    error?: unknown;
    capture?: boolean;
    area?: string;
    name?: string;
    viewerId?: string | null;
    tags?: Record<string, string | number | boolean | null | undefined>;
    extras?: Record<string, unknown>;
  }
) {
  if (status >= 500 || options?.capture) {
    captureHandledError(options?.error ?? message, {
      area: options?.area ?? "http",
      name: options?.name ?? "response",
      status,
      viewerId: options?.viewerId,
      captureExpected: Boolean(options?.capture),
      tags: options?.tags,
      extras: options?.extras
    });
  }

  return NextResponse.json({ error: message }, { status });
}
