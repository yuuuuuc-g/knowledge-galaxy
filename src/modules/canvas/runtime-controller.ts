export type CanvasFrameLoop = "always" | "demand" | "never";

export interface CanvasRuntimeInput {
  overlayActive: boolean;
  deviceMemoryGb?: number;
}

export interface CanvasRuntimeProfile {
  dpr: [number, number];
  environmentEnabled: boolean;
  frameloop: CanvasFrameLoop;
  bloomEnabled: boolean;
  starsEnabled: boolean;
}

export function createCanvasRuntimeProfile(input: CanvasRuntimeInput): CanvasRuntimeProfile {
  const lowMemoryDevice =
    typeof input.deviceMemoryGb === "number" && input.deviceMemoryGb > 0 && input.deviceMemoryGb <= 4;

  if (input.overlayActive) {
    return {
      dpr: [1, 1],
      environmentEnabled: false,
      frameloop: "demand",
      bloomEnabled: false,
      starsEnabled: false,
    };
  }

  return {
    dpr: lowMemoryDevice ? [1, 1] : [1, 1.5],
    environmentEnabled: true,
    frameloop: "always",
    bloomEnabled: true,
    starsEnabled: true,
  };
}
