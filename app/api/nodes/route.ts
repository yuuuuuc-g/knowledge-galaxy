import { createClient } from "@supabase/supabase-js";
import { createRagRepository, type RagNode } from "@/src/modules/rag/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type NodeData = RagNode;

export type NodesData = NodeData[];

interface NodesResponseBody {
  nodes: NodesData;
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function logServerError(context: string, error: unknown) {
  console.error(`[Nodes API] ${context}:`, error);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getRequiredSupabaseKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? getRequiredEnv("SUPABASE_KEY");
}

export async function GET() {
  let supabaseUrl: string;
  let supabaseKey: string;

  try {
    supabaseUrl = getRequiredEnv("SUPABASE_URL");
    supabaseKey = getRequiredSupabaseKey();
  } catch (error) {
    logServerError("missing configuration", error);
    return jsonError("Nodes gateway is not configured.", 500);
  }

  try {
    const repository = createRagRepository(createClient(supabaseUrl, supabaseKey));
    const nodes = await repository.listNodes();

    return Response.json({ nodes } satisfies NodesResponseBody, { status: 200 });
  } catch (error) {
    logServerError("request failed", error);
    return jsonError("Nodes request failed.", 502);
  }
}
