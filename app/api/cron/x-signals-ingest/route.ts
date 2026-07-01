import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/src/lib/supabase/admin";
import { createIntelligenceRepository } from "@/src/modules/intelligence/repository";
import { createSocialSignalRepository } from "@/src/modules/social-signals/repository";
import { runXSignalIngest } from "@/src/modules/social-signals/x-api";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function readMaxResults(request: Request): number | undefined {
  const url = new URL(request.url);
  const value = url.searchParams.get("maxResults");
  if (!value) return undefined;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;

  return Math.min(Math.max(parsed, 10), 100);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) {
    return NextResponse.json(
      { error: "Missing X_BEARER_TOKEN." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdmin();
  const result = await runXSignalIngest({
    bearerToken,
    jobRepository: createIntelligenceRepository(supabase),
    maxResultsPerRule: readMaxResults(request),
    repository: createSocialSignalRepository(supabase),
  });

  if (result.status === "failed") {
    return NextResponse.json(
      { error: result.error ?? "X social signal ingest failed." },
      { status: 502 }
    );
  }

  return NextResponse.json(result);
}
