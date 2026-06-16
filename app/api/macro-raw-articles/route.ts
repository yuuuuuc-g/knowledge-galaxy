import { NextResponse } from "next/server";
import { buildMacroRawArticlePayload } from "@/src/modules/intelligence/macro-intel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
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
