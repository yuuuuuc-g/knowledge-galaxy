import { NextResponse } from "next/server";
import { buildApacSupplyChainPayload } from "@/src/lib/apac-supply-chain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
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
