import { describe, expect, it } from "vitest";
import { createCanvasRuntimeProfile } from "./runtime-controller";

describe("CanvasRuntimeController", () => {
  it("keeps full scene effects when no overlay is active", () => {
    expect(createCanvasRuntimeProfile({ overlayActive: false })).toEqual({
      dpr: [1, 1.5],
      environmentEnabled: true,
      frameloop: "always",
      bloomEnabled: true,
      starsEnabled: true,
    });
  });

  it("reduces render pressure while a modal or iframe is active", () => {
    expect(createCanvasRuntimeProfile({ overlayActive: true })).toEqual({
      dpr: [1, 1],
      environmentEnabled: false,
      frameloop: "demand",
      bloomEnabled: false,
      starsEnabled: false,
    });
  });

  it("caps DPR on low-memory devices even without an overlay", () => {
    expect(createCanvasRuntimeProfile({ overlayActive: false, deviceMemoryGb: 4 }).dpr).toEqual([
      1,
      1,
    ]);
  });
});
