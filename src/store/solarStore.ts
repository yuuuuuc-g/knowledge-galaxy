import { create } from "zustand";
import type { PlanetConfig } from "@/src/components/canvas/types";

interface SolarState {
  focusedPlanet: PlanetConfig | null;
  setFocusedPlanet: (planet: PlanetConfig | null) => void;
}

export const useSolarStore = create<SolarState>((set) => ({
  focusedPlanet: null,
  setFocusedPlanet: (planet) => set({ focusedPlanet: planet }),
}));
