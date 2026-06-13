import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MacroIntelConsole } from "./MacroIntelConsole";

describe("MacroIntelConsole", () => {
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

  it("renders the complete macro intelligence database from generated JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: "2026-06-09T03:04:05.000Z",
        items: [
          {
            id: 1,
            title: "地方债发行节奏加快",
            source: "Macro Desk",
            url: "https://example.test/macro-signal",
            eventType: "fiscal",
            coreLogic: "财政前置发力，地方融资压力向基建链条传导。",
            policyIntent: "稳投资与稳预期。",
            capitalImpact: "基建链条短期改善。",
            affectedRegions: ["China"],
            affectedSectors: ["infrastructure"],
            timeHorizon: "short",
            confidence: 0.82,
            impactScore: 88,
            evidence: ["地方债发行提速。"],
            publishedAt: "2026-06-09T02:00:00.000Z",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(<MacroIntelConsole isOpen onClose={vi.fn()} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("URANUS // INTELLIGENCE DATABASE");
    expect(container.textContent).toContain("地方债发行节奏加快");
    expect(container.textContent).toContain("财政前置发力");
    expect(container.textContent).toContain("稳投资与稳预期");
    expect(container.textContent).toContain("基建链条短期改善");
    expect(container.textContent).toContain("地方债发行提速");
    expect(
      container.querySelector('a[href="https://example.test/macro-signal"]')
    ).not.toBeNull();
  });
});
