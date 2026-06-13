import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaturnConsole } from "./SaturnConsole";

describe("SaturnConsole", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders raw articles from the shared macro feed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: "2026-06-09T03:04:05.000Z",
        sourceCount: 5,
        candidatesCount: 1,
        items: [
          {
            id: 1,
            source: "SCMP Economy",
            title: "China export curbs pressure chip supply chains",
            url: "https://example.test/raw-macro",
            snippet: "RSS raw article excerpt before DeepSeek analysis.",
            publishedAt: "2026-06-09T02:00:00.000Z",
            score: 42,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(<SaturnConsole isOpen onClose={vi.fn()} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/data/macro-raw-articles.json?t="),
      expect.objectContaining({ cache: "no-store" })
    );
    expect(container.textContent).toContain("SATURN // RAW ARTICLE RADAR");
    expect(container.textContent).toContain("China export curbs pressure chip supply chains");
    expect(container.textContent).toContain("RSS raw article excerpt before DeepSeek analysis.");
    expect(container.querySelector('a[href="https://example.test/raw-macro"]')).not.toBeNull();
  });
});
