import { NextResponse } from "next/server";
import { buildMacroIntelPayload } from "@/src/modules/intelligence/macro-intel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
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
