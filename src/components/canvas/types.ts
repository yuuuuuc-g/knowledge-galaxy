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
  // ✨ 新增：轨道偏心率 (0 是正圆，接近 1 则是极扁的椭圆)
  eccentricity?: number;
}

export interface PlanetProps {
  config: PlanetConfig;
}
