import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn((url: string, key: string) => {
    mocks.createClient(url, key);

    return {
      from: mocks.from,
    };
  }),
}));

async function getNodes() {
  const { GET } = await import("./route");

  return GET();
}

describe("GET /api/nodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_KEY = "supabase-key";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ order: mocks.order });
  });

  it("fetches lightweight node metadata for the target book in chunk order", async () => {
    mocks.order.mockResolvedValue({
      data: [
        { id: "chunk-1", chapter_title: "规则", chunk_index: 0, book_id: "book-1" },
        { id: "chunk-2", chapter_title: "产权", chunk_index: 1, book_id: "book-1" },
      ],
      error: null,
    });

    const response = await getNodes();

    await expect(response.json()).resolves.toEqual({
      nodes: [
        { id: "chunk-1", chapter_title: "规则", chunk_index: 0, book_id: "book-1" },
        { id: "chunk-2", chapter_title: "产权", chunk_index: 1, book_id: "book-1" },
      ],
    });
    expect(response.status).toBe(200);
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "supabase-key"
    );
    expect(mocks.from).toHaveBeenCalledWith("rag_chunks");
    expect(mocks.select).toHaveBeenCalledWith("id, chapter_title, chunk_index, book_id");
    expect(mocks.eq).not.toHaveBeenCalled();
    expect(mocks.order).toHaveBeenCalledWith("chunk_index", { ascending: true });
  });

  it("prefers the service-role key for server-side metadata reads", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    mocks.order.mockResolvedValue({ data: [], error: null });

    const response = await getNodes();

    expect(response.status).toBe(200);
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key"
    );
  });
});
