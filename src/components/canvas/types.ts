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
  // ✨ 新增：真实天文信息字段
  description?: string;
  mass?: string;
  gravity?: string;
  type?: string; // 类地行星、气态巨行星等
}

export interface PlanetProps {
  config: PlanetConfig;
}
