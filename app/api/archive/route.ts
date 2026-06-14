import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/src/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Archive API] Supabase query failed:", error);
      return NextResponse.json({ error: "Unable to load archive documents." }, { status: 502 });
    }

    return NextResponse.json({ documents: data ?? [] });
  } catch (error) {
    console.error("[Archive API] request failed:", error);
    return NextResponse.json({ error: "Archive gateway is not configured." }, { status: 500 });
  }
}
