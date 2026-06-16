import { describe, expect, it } from "vitest";
import {
  getAllIntelligenceSources,
  getIntelligenceSourcesForModule,
} from "./source-registry";

describe("intelligence source registry", () => {
  it("keeps shared RSS sources in one registry while exposing module-specific slices", () => {
    const allSources = getAllIntelligenceSources();
    const dailyBriefingSources = getIntelligenceSourcesForModule("daily-briefing");
    const macroSources = getIntelligenceSourcesForModule("macro-intel");
    const apacSources = getIntelligenceSourcesForModule("apac-supply-chain");

    expect(allSources.length).toBeGreaterThan(dailyBriefingSources.length);
    expect(dailyBriefingSources.map((source) => source.id)).toContain("nikkei-asia");
    expect(macroSources.map((source) => source.id)).toContain("nikkei-asia");
    expect(apacSources.map((source) => source.id)).toContain("nikkei-asia");
    expect(apacSources.map((source) => source.id)).toContain("the-loadstar");
    expect(macroSources.map((source) => source.id)).not.toContain("the-loadstar");
  });
});
