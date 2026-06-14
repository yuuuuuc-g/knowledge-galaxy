import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/src/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("topics")
      .select("id, title, description, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[Topics API] Supabase query failed:", error);
      return NextResponse.json({ error: "Unable to load topics." }, { status: 502 });
    }

    return NextResponse.json({ topics: data ?? [] });
  } catch (error) {
    console.error("[Topics API] request failed:", error);
    return NextResponse.json({ error: "Topics gateway is not configured." }, { status: 500 });
  }
}
