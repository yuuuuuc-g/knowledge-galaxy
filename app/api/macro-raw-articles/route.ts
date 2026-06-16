import { NextResponse } from "next/server";
import {
  buildMacroRawArticlePayload,
  buildMacroRawArticlePayloadFromArticles,
} from "@/src/modules/intelligence/macro-intel";
import { createIntelligenceRepository } from "@/src/modules/intelligence/repository";
import { createSupabaseAdmin } from "@/src/lib/supabase/admin";
import { getAllIntelligenceSources } from "@/src/modules/intelligence/source-registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    try {
      const repository = createIntelligenceRepository(createSupabaseAdmin());
      const articles = await repository.listRecentSourceArticles(80);
      if (articles.length > 0) {
        const payload = buildMacroRawArticlePayloadFromArticles({
          articles: repository.toMacroSourceArticles(articles),
          generatedAt: new Date().toISOString(),
          sourceCount: getAllIntelligenceSources().length,
          successfulSourceCount: 0,
        });

        return NextResponse.json(payload, {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        });
      }
    } catch (databaseError) {
      console.warn("[Macro Raw Articles API] database unavailable, using live fallback:", databaseError);
    }

    const payload = await buildMacroRawArticlePayload();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[Macro Raw Articles API] failed:", error);

    return NextResponse.json(
      { error: "Unable to refresh macro raw article feed" },
      { status: 502 }
    );
  }
}
