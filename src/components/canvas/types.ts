export type ModuleType =
  | "archive"
  | "analytical-pipeline"
  | "knowledge-graph"
  | "exocortex"
  | "macro-intel"
  | "social-signals";

export type PlanetLabel =
  | "Archive"
  | "Analytical Pipeline"
  | "Knowledge Graph"
  | "Exocortex"
  | "Intelligence Board"
  | "Social Signals";

export interface PlanetConfig {
  name: string;
  size: number;
  orbitRadius: number;
  orbitSpeed: number;
  rotationSpeed: number;
  color: string;
  hasRing?: boolean;
  ringInnerRadius?: number;
  ringOuterRadius?: number;
  label?: PlanetLabel;
  module?: ModuleType;
  textureUrl?: string;
  ringTextureUrl?: string;
  description?: string;
  mass?: string;
  gravity?: string;
  type?: string;
  eccentricity?: number;
}

export interface PlanetProps {
  config: PlanetConfig;
}
