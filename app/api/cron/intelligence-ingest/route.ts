import { NextResponse } from "next/server";
import { createAiSdkLanguageModel } from "@/src/modules/ai/provider-adapter";
import { runIntelligencePipeline } from "@/src/modules/intelligence/pipeline";
import { createIntelligenceRepository } from "@/src/modules/intelligence/repository";
import { createSupabaseAdmin } from "@/src/lib/supabase/admin";

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

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repository = createIntelligenceRepository(createSupabaseAdmin());
  const dailyBriefingModel = process.env.DEEPSEEK_API_KEY
    ? createAiSdkLanguageModel("deepseek")
    : undefined;
  const result = await runIntelligencePipeline({
    repository,
    dailyBriefingModel,
  });

  if (result.status === "failed") {
    return NextResponse.json({ error: result.error ?? "Intelligence ingest failed." }, { status: 502 });
  }

  return NextResponse.json(result);
}
