import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/src/lib/supabase/admin";
import {
  ArchiveRepositoryError,
  createArchiveRepository,
} from "@/src/modules/archive/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ArchiveDocumentRouteContext {
  params: Promise<{ id: string }>;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    value
  );
}

export async function DELETE(_request: Request, context: ArchiveDocumentRouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Document id must be a valid UUID." }, { status: 400 });
  }

  try {
    const repository = createArchiveRepository(createSupabaseAdmin());
    await repository.deleteDocument(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ArchiveRepositoryError) {
      console.error("[Archive API] repository delete failed:", error.message);
      return NextResponse.json({ error: error.publicMessage }, { status: error.status });
    }
    console.error("[Archive API] delete request failed:", error);
    return NextResponse.json({ error: "Archive gateway is not configured." }, { status: 500 });
  }
}
