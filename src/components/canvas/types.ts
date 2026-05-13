export type PlanetLabel = 'Knowledge Graph' | 'Obsidian Vault' | 'Spatial Canvas';

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
  textureUrl?: string;
  ringTextureUrl?: string;
}

export interface PlanetProps {
  config: PlanetConfig;
}
