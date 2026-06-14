import { createClient } from "@supabase/supabase-js";
import { createAiSdkLanguageModel } from "@/src/modules/ai/provider-adapter";
import {
  createAiBriefingSelector,
  createRssHeadlineFetcher,
  createSupabaseBriefingPersister,
  runDailyBriefingJob,
} from "@/src/modules/intelligence/daily-briefing-job";

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
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return Response.json(
      { error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars." },
      { status: 500 }
    );
  }

  let model: ReturnType<typeof createAiSdkLanguageModel>;
  try {
    model = createAiSdkLanguageModel("deepseek");
  } catch {
    return Response.json(
      { error: "Missing DEEPSEEK_API_KEY env var." },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await runDailyBriefingJob({
    fetchHeadlines: createRssHeadlineFetcher(),
    selectBriefings: createAiBriefingSelector(model),
    persistBriefings: createSupabaseBriefingPersister(supabase),
  });

  if (result.status === "failed") {
    return Response.json({ error: result.error }, { status: result.statusCode });
  }

  return Response.json(result);
}
