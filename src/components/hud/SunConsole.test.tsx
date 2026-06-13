import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SunConsole } from "./SunConsole";

describe("SunConsole", () => {
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function renderSunConsole(onPlanetSelect = vi.fn()) {
    act(() => {
      root.render(
        <SunConsole
          isOpen
          onClose={vi.fn()}
          onPlanetSelect={onPlanetSelect}
        />
      );
    });

    return onPlanetSelect;
  }

  function getButton(name: string): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.includes(name)
    );

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Unable to find button containing "${name}"`);
    }

    return button;
  }

  it("renders the planet navigation with mounted and placeholder planets", () => {
    renderSunConsole();
    const sidebar = container.querySelector('[data-testid="planet-nav-sidebar"]');
    const mainContent = container.querySelector('[data-testid="sun-console-main"]');

    expect(container.textContent).toContain("行星导航 / PLANET NAV");
    expect(sidebar?.tagName).toBe("ASIDE");
    expect(mainContent?.tagName).toBe("MAIN");
    expect(sidebar?.nextElementSibling).toBe(mainContent);
    expect(sidebar?.querySelectorAll('button[aria-label^="Navigate to"]')).toHaveLength(8);
    expect(container.textContent).not.toContain("工具 / Tools");
    expect(container.textContent).not.toContain("[ 数据同步 ]");
    expect(container.textContent).not.toContain("[ 火星编辑器 ]");
    expect(container.textContent).not.toContain("[ 全文检索 ]");

    [
      "Mercury",
      "Venus",
      "Earth",
      "Mars",
      "Jupiter",
      "Saturn",
      "Uranus",
      "Neptune",
    ].forEach((planetName) => {
      expect(container.textContent).toContain(planetName);
    });

    expect(container.textContent).toContain("Module Placeholder");
    expect(container.textContent).toContain("Intelligence Board");
    expect(container.textContent).toContain("STANDBY");
    expect(container.textContent).toContain("ONLINE");
  });

  it("does not render the former central earth situation map inside the intelligence board", () => {
    renderSunConsole();

    expect(
      container.querySelector('[data-testid="central-earth-situation-map"]')
    ).toBeNull();
  });

  it("renders a compact waveform for fleet system health", () => {
    renderSunConsole();
    const waveform = container.querySelector('[data-testid="fleet-health-waveform"]');

    expect(waveform?.querySelectorAll("path")).toHaveLength(2);
  });

  it("renders native SVG micro charts and updates chart data every second", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T03:04:05Z"));
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith("/data/macro-intel.json")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            generatedAt: "2026-06-09T03:04:05.000Z",
            sourceCount: 5,
            successfulSourceCount: 4,
            candidatesCount: 12,
            items: [
              {
                id: 1,
                title: "地方债发行节奏加快",
                source: "Macro Desk",
                url: "https://example.test/macro-signal",
                eventType: "fiscal",
                coreLogic: "财政前置发力。",
                policyIntent: "稳投资。",
                capitalImpact: "基建链条改善。",
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
      }

      if (url.startsWith("/data/macro-raw-articles.json")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            generatedAt: "2026-06-09T03:04:05.000Z",
            sourceCount: 5,
            successfulSourceCount: 4,
            candidatesCount: 12,
            items: [],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          generatedAt: "2026-06-09T03:04:05.000Z",
          items: [],
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderSunConsole();

    await act(async () => {
      await Promise.resolve();
    });

    const ringChart = container.querySelector('[data-testid="micro-chart-ring"]');
    const lineChart = container.querySelector('[data-testid="micro-chart-line"]');
    const barCharts = container.querySelectorAll('[data-testid="micro-chart-bar"]');
    const initialBars = barCharts[0]?.querySelectorAll("rect");
    const initialBarHeights = Array.from(initialBars ?? []).map((bar) =>
      bar.getAttribute("height")
    );

    expect(ringChart?.querySelector("circle")).not.toBeNull();
    expect(lineChart?.querySelector("polyline")).not.toBeNull();
    expect(barCharts).toHaveLength(2);
    expect(container.textContent).toContain("SOURCE SYNC");
    expect(container.textContent).toContain("RAW VOLUME");
    expect(container.textContent).toContain("IMPACT DENSITY");
    expect(container.textContent).toContain("ANALYST CONFIDENCE");

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    const updatedBars = container
      .querySelectorAll('[data-testid="micro-chart-bar"]')[0]
      ?.querySelectorAll("rect");
    const updatedBarHeights = Array.from(updatedBars ?? []).map((bar) =>
      bar.getAttribute("height")
    );
    expect(updatedBarHeights).not.toEqual(initialBarHeights);
  });

  it("loads clickable APAC supply-chain rows from the dynamic API", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith("/data/macro-intel.json")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            generatedAt: "2026-06-09T03:04:05.000Z",
            sourceCount: 5,
            successfulSourceCount: 4,
            candidatesCount: 12,
            items: [],
          }),
        });
      }

      if (url.startsWith("/data/macro-raw-articles.json")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            generatedAt: "2026-06-09T03:04:05.000Z",
            sourceCount: 5,
            successfulSourceCount: 4,
            candidatesCount: 12,
            items: [],
          }),
        });
      }

      if (url.startsWith("/api/apac-supply-chain")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            generatedAt: "2026-06-09T03:04:05.000Z",
            sourceCount: 5,
            successfulSourceCount: 4,
            candidatesCount: 12,
            items: [
              {
                id: 1,
                label: "新加坡枢纽",
                subtitle: "Live Feed · example.test",
                value: "Cargo throughput rises on APAC lanes",
                metricLabel: "Maritime Signal",
                icon: "port",
                variant: "positive",
                url: "https://example.test/apac-cargo",
                publishedAt: "2026-06-09T02:00:00.000Z",
              },
            ],
          }),
        });
      }

      if (url.startsWith("/data/macro-raw-articles.json")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            generatedAt: "2026-06-09T03:04:05.000Z",
            sourceCount: 5,
            successfulSourceCount: 4,
            candidatesCount: 12,
            items: [],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          generatedAt: "2026-06-08T03:04:05.000Z",
          items: [
            {
              id: 1,
              label: "缓存航运",
              subtitle: "Cache · example.test",
              value: "Cached APAC maritime article",
              metricLabel: "Cached Signal",
              icon: "port",
              url: "https://example.test/cache-cargo",
            },
          ],
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSunConsole();

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/apac-supply-chain?t="),
      expect.objectContaining({ cache: "no-store" })
    );
    expect(container.textContent).toContain("Cargo throughput rises on APAC lanes");
    expect(container.textContent).toContain("Updated 09/06, 11:04 BJT");

    const articleLink = container.querySelector<HTMLAnchorElement>(
      'a[href="https://example.test/apac-cargo"]'
    );

    expect(articleLink?.target).toBe("_blank");
    expect(articleLink?.getAttribute("rel")).toBe("noreferrer");
  });

  it("loads structured macro intelligence into the intelligence board", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith("/data/macro-intel.json")) {
        return Promise.resolve({
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
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          generatedAt: "2026-06-09T03:04:05.000Z",
          items: [],
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSunConsole();

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("信息板 / INTELLIGENCE BOARD");
    expect(container.textContent).toContain("地方债发行节奏加快");
    expect(container.textContent).not.toContain("财政前置发力");
    expect(container.textContent).not.toContain("Impact 88");
    expect(
      container.querySelector('a[href="https://example.test/macro-signal"]')
    ).not.toBeNull();
  });

  it("only renders APAC dynamic rows that have readable article URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: "2026-06-09T03:04:05.000Z",
        items: [
          {
            id: 1,
            label: "中国供应链",
            subtitle: "Live Feed · example.test",
            value: "Live item with URL",
            metricLabel: "Maritime Signal",
            icon: "port",
            url: "https://example.test/live-1",
          },
          {
            id: 2,
            label: "占位供应链",
            subtitle: "Awaiting live crawl",
            value: "Live fallback without URL",
            metricLabel: "Maritime Signal",
            icon: "port",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSunConsole();

    await act(async () => {
      await Promise.resolve();
    });

    const articleLinks = container.querySelectorAll<HTMLAnchorElement>(
      'a[aria-label^="Read APAC supply-chain article"]'
    );

    expect(articleLinks).toHaveLength(1);
    expect(container.querySelector('a[href="https://example.test/live-1"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Live fallback without URL");
  });

  it("refreshes APAC supply-chain data every hour while the console is open", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith("/data/macro-intel.json")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            generatedAt: "2026-06-09T03:04:05.000Z",
            sourceCount: 5,
            successfulSourceCount: 4,
            candidatesCount: 12,
            items: [],
          }),
        });
      }

      if (url.startsWith("/data/macro-raw-articles.json")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            generatedAt: "2026-06-09T03:04:05.000Z",
            sourceCount: 5,
            successfulSourceCount: 4,
            candidatesCount: 12,
            items: [],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          generatedAt: url.startsWith("/api/apac-supply-chain")
            ? "2026-06-09T03:04:05.000Z"
            : "2026-06-08T03:04:05.000Z",
          items: [
            {
              id: 1,
              label: "新加坡枢纽",
              subtitle: "Live Feed · example.test",
              value: "Cargo throughput rises on APAC lanes",
              metricLabel: "Maritime Signal",
              icon: "port",
              url: "https://example.test/apac-cargo",
            },
          ],
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSunConsole();

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    await act(async () => {
      vi.advanceTimersByTime(60 * 60 * 1000);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("allows placeholder planets to be selected from the navigation", () => {
    const onPlanetSelect = renderSunConsole();

    act(() => {
      getButton("Venus").click();
    });

    expect(onPlanetSelect).toHaveBeenCalledWith("venus");
  });

  it("moves planet navigation highlight with pointer hover instead of pinning Earth", () => {
    renderSunConsole();
    const earthButton = getButton("Earth");
    const marsButton = getButton("Mars");

    expect(earthButton.className).not.toContain("border-cyan-300/80");
    expect(marsButton.textContent).not.toContain(">");

    act(() => {
      marsButton.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true, relatedTarget: null })
      );
    });

    expect(marsButton.className).toContain("border-cyan-300/80");
    expect(earthButton.className).not.toContain("border-cyan-300/80");
    expect(marsButton.textContent).toContain(">");
  });

  it("renders a live Beijing clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T03:04:05Z"));

    renderSunConsole();

    expect(container.textContent).toContain("Time (BJT)");
    expect(container.textContent).toContain("11:04:05");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(container.textContent).toContain("11:04:06");
  });
});
