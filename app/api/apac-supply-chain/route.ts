import { NextResponse } from "next/server";
import { buildApacSupplyChainPayload } from "@/src/lib/apac-supply-chain";
import { createIntelligenceRepository } from "@/src/modules/intelligence/repository";
import { createSupabaseAdmin } from "@/src/lib/supabase/admin";
import { getIntelligenceSourcesForModule } from "@/src/modules/intelligence/source-registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    try {
      const repository = createIntelligenceRepository(createSupabaseAdmin());
      const items = await repository.listApacSupplyChainSignals(20);
      if (items.length > 0) {
        return NextResponse.json(
          {
            generatedAt: new Date().toISOString(),
            sourceCount: getIntelligenceSourcesForModule("apac-supply-chain").length,
            candidatesCount: items.length,
            items,
          },
          {
            headers: {
              "Cache-Control": "no-store, max-age=0",
            },
          }
        );
      }
    } catch (databaseError) {
      console.warn("[APAC supply-chain API] database unavailable, using live fallback:", databaseError);
    }

    const payload = await buildApacSupplyChainPayload();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[APAC supply-chain API] failed:", error);

    return NextResponse.json(
      { error: "Unable to refresh APAC supply-chain feed" },
      { status: 502 }
    );
  }
}
