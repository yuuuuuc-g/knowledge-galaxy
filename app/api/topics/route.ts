import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/src/lib/supabase/admin";
import {
  ArchiveRepositoryError,
  createArchiveRepository,
} from "@/src/modules/archive/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repository = createArchiveRepository(createSupabaseAdmin());
    const topics = await repository.listTopics();

    return NextResponse.json({ topics });
  } catch (error) {
    if (error instanceof ArchiveRepositoryError) {
      console.error("[Topics API] repository failed:", error.message);
      return NextResponse.json({ error: error.publicMessage }, { status: error.status });
    }
    console.error("[Topics API] request failed:", error);
    return NextResponse.json({ error: "Topics gateway is not configured." }, { status: 500 });
  }
}
