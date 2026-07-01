import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/src/lib/supabase/admin";
import {
  buildSocialSignalDashboard,
  createSocialSignalRepository,
  type SocialSignalListFilters,
} from "@/src/modules/social-signals/repository";
import type {
  SocialSignalDomain,
  SocialSignalRegionScope,
  SocialSignalSourceType,
  SocialSignalUrgency,
} from "@/src/modules/social-signals/x-signals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isDomain(value: string | null): value is SocialSignalDomain {
  return (
    value === "macro" ||
    value === "politics" ||
    value === "society" ||
    value === "history" ||
    value === "trade" ||
    value === "finance" ||
    value === "investment" ||
    value === "geopolitics"
  );
}

function isUrgency(value: string | null): value is SocialSignalUrgency {
  return value === "low" || value === "medium" || value === "high";
}

function isRegionScope(value: string | null): value is SocialSignalRegionScope {
  return value === "china" || value === "us_china" || value === "eu_china" || value === "apac" || value === "global";
}

function isSourceType(value: string | null): value is SocialSignalSourceType {
  return (
    value === "post" ||
    value === "thread" ||
    value === "user" ||
    value === "trend" ||
    value === "news_story" ||
    value === "media" ||
    value === "space"
  );
}

function parseLimit(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function parseFilters(request: Request): SocialSignalListFilters {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");
  const urgency = url.searchParams.get("urgency");
  const regionScope = url.searchParams.get("regionScope");
  const sourceType = url.searchParams.get("sourceType");

  return {
    ...(isDomain(domain) ? { domain } : {}),
    ...(isUrgency(urgency) ? { urgency } : {}),
    ...(isRegionScope(regionScope) ? { regionScope } : {}),
    ...(isSourceType(sourceType) ? { sourceType } : {}),
    limit: parseLimit(url.searchParams.get("limit")),
  };
}

export async function GET(request: Request) {
  try {
    const repository = createSocialSignalRepository(createSupabaseAdmin());
    const payload = await buildSocialSignalDashboard(repository, parseFilters(request));

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[Social Signals API] failed:", error);

    return NextResponse.json(
      { error: "Unable to load X social signals." },
      { status: 502 }
    );
  }
}
