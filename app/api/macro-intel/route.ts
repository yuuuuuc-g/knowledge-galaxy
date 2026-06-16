import { NextResponse } from "next/server";
import {
  buildMacroIntelPayload,
  buildMacroIntelPayloadFromArticles,
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
      const items = await repository.listMacroIntelItems(20);
      if (items.length > 0) {
        return NextResponse.json(
          {
            generatedAt: new Date().toISOString(),
            sourceCount: getAllIntelligenceSources().length,
            successfulSourceCount: 0,
            candidatesCount: items.length,
            llmEnabled: false,
            llmProvider: null,
            items,
          },
          {
            headers: {
              "Cache-Control": "no-store, max-age=0",
            },
          }
        );
      }

      const articles = await repository.listRecentSourceArticles(80);
      if (articles.length > 0) {
        const payload = buildMacroIntelPayloadFromArticles({
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
      console.warn("[Macro Intel API] database unavailable, using live fallback:", databaseError);
    }

    const payload = await buildMacroIntelPayload();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[Macro Intel API] failed:", error);

    return NextResponse.json(
      { error: "Unable to refresh macro intelligence feed" },
      { status: 502 }
    );
  }
}
