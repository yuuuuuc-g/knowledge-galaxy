import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GalaxyWorkspace } from "@/src/components/galaxy-workspace";

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="canvas-layer">
      {children}
    </div>
  ),
}));

vi.mock("@react-three/drei", () => ({
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OrbitControls: () => null,
  Stars: () => null,
}));

vi.mock("@/src/components/canvas/GalaxyNodes", () => ({
  GalaxyNodes: ({
    highlightedNodeId,
    nodesData,
  }: {
    highlightedNodeId: string | null;
    nodesData: { id: string }[];
  }) => (
    <div
      data-highlighted-node-id={highlightedNodeId ?? ""}
      data-node-count={nodesData.length}
      data-testid="galaxy-nodes"
    />
  ),
}));

describe("GalaxyWorkspace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.restoreAllMocks();
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

  function renderGalaxyWorkspace() {
    act(() => {
      root.render(<GalaxyWorkspace />);
    });
  }

  function getByTestId(testId: string): HTMLElement {
    const element = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

    if (!element) {
      throw new Error(`Unable to find element with data-testid="${testId}"`);
    }

    return element;
  }

  function getButton(name: RegExp): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      name.test(candidate.textContent ?? "")
    );

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Unable to find matching button");
    }

    return button;
  }

  async function waitForExpectation(assertion: () => void) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < 1000) {
      try {
        assertion();
        return;
      } catch {
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
      }
    }

    assertion();
  }

  function updateInputValue(input: HTMLInputElement, value: string) {
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function textStream(parts: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
      start(controller) {
        parts.forEach((part) => {
          controller.enqueue(encoder.encode(part));
        });
        controller.close();
      },
    });
  }

  it("keeps the Canvas layer at z-0 and the HUD layer at z-10", () => {
    renderGalaxyWorkspace();

    expect(getByTestId("canvas-layer").className).toContain("z-0");
    expect(getByTestId("search-hud").className).toContain("z-10");
  });

  it("does not submit empty queries", () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nodes: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderGalaxyWorkspace();

    act(() => {
      getButton(/search/i).click();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/nodes");
    expect(container.textContent).toContain("Enter a question to search the Exocortex.");
  });

  it("loads nodes on mount and sends Hit@1 id into GalaxyNodes after search", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/nodes") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            nodes: [
              { id: "chunk-1", chapter_title: "制度与合作", chunk_index: 0, book_id: "book-a" },
              { id: "chunk-2", chapter_title: "分工", chunk_index: 1, book_id: "book-b" },
              { id: "chunk-3", chapter_title: "产权", chunk_index: 2, book_id: "book-a" },
            ],
          }),
        });
      }

      if (url === "/api/search") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              {
                id: "chunk-2",
                content: "专业化依赖可预期规则。",
                chapter_title: "分工",
                similarity: 0.82,
                chapter_index: 5,
                chunk_index: 1,
              },
              {
                id: "chunk-3",
                content: "产权界定冲突边界。",
                chapter_title: "产权",
                similarity: 0.73,
                chapter_index: 6,
                chunk_index: 7,
              },
              {
                id: "chunk-4",
                content: "This should not render.",
                chapter_title: "Overflow",
                similarity: 0.4,
                chapter_index: 7,
                chunk_index: 1,
              },
              {
                id: "chunk-5",
                content: "Fourth result should not render.",
                chapter_title: "Overflow 2",
                similarity: 0.3,
                chapter_index: 8,
                chunk_index: 1,
              },
            ],
          }),
        });
      }

      return Promise.resolve(new Response(textStream(["制度", "降低", "交易成本"]), {
        status: 200,
      }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderGalaxyWorkspace();

    await waitForExpectation(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/nodes");
      expect(getByTestId("galaxy-nodes").getAttribute("data-node-count")).toBe("3");
    });

    const input = container.querySelector<HTMLInputElement>("#exocortex-query");

    if (!input) {
      throw new Error("Unable to find Exocortex query input");
    }

    act(() => {
      updateInputValue(input, "  规则如何促进合作？  ");
    });

    const form = container.querySelector("form");

    if (!form) {
      throw new Error("Unable to find Exocortex search form");
    }

    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    await waitForExpectation(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "规则如何促进合作？" }),
      });
    });

    await waitForExpectation(() => {
      const resultsPanel = getByTestId("search-results");

      expect(resultsPanel.querySelectorAll("article")).toHaveLength(3);
      expect(resultsPanel.textContent).not.toContain("Fourth result should not render.");
      expect(getByTestId("galaxy-nodes").getAttribute("data-highlighted-node-id")).toBe(
        "chunk-2"
      );
    });

    await waitForExpectation(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "规则如何促进合作？",
          references: [
            { content: "专业化依赖可预期规则。" },
            { content: "产权界定冲突边界。" },
            { content: "This should not render." },
          ],
        }),
      });
      expect(getByTestId("ai-response").textContent).toContain("制度降低交易成本");
    });
  });
});
