"use client";

import { useSolarStore } from "@/src/store/solarStore";

export function NodeDetailPanel() {
  const focusedPlanet = useSolarStore((state) => state.focusedPlanet);
  const setFocusedPlanet = useSolarStore((state) => state.setFocusedPlanet);

  if (!focusedPlanet) return null;

  return (
    <div className="pointer-events-auto absolute right-0 top-0 z-20 flex h-full w-80 flex-col border-l border-white/10 bg-black/80 p-6 text-white backdrop-blur-md">
      <div className="mb-6">
        <h2 className="font-serif text-2xl tracking-wider">{focusedPlanet.name}</h2>
        <p className="mt-1 text-sm font-medium tracking-wide text-white/60">
          {focusedPlanet.label}
        </p>
      </div>

      <div className="space-y-4 text-sm">
        <div className="flex justify-between border-b border-white/10 pb-2">
          <span className="text-white/40">Orbit Radius</span>
          <span>{focusedPlanet.orbitRadius} AU</span>
        </div>
        <div className="flex justify-between border-b border-white/10 pb-2">
          <span className="text-white/40">Size</span>
          <span>{focusedPlanet.size} R⊕</span>
        </div>
        <div className="flex justify-between border-b border-white/10 pb-2">
          <span className="text-white/40">Orbit Speed</span>
          <span>{focusedPlanet.orbitSpeed}</span>
        </div>
        <div className="flex justify-between border-b border-white/10 pb-2">
          <span className="text-white/40">Rotation Speed</span>
          <span>{focusedPlanet.rotationSpeed}</span>
        </div>
      </div>

      <div className="mt-auto">
        <button
          onClick={() => setFocusedPlanet(null)}
          className="w-full rounded border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium tracking-wide transition-colors hover:bg-white/10"
        >
          Back to Galaxy
        </button>
      </div>
    </div>
  );
}
