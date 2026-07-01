"use client";

import { Planet } from "./Planet";
// ✨ 新增：引入我们刚刚创建的地月系统组件
import { EarthMoonSystem } from "./EarthMoonSystem"; 
import type { PlanetConfig } from "./types";

export const PLANETS: PlanetConfig[] = [
  {
    name: "Mercury",
    size: 0.4,
    orbitRadius: 4,
    orbitSpeed: 0.8,
    rotationSpeed: 0.5,
    color: "#a0a0a0",
    textureUrl: "/textures/2k_mercury.jpg",
    type: "Terrestrial Planet",
    gravity: "3.7 m/s²",
    mass: "3.30 × 10²³ kg",
    description: "The smallest and innermost planet in the Solar System, characterized by a heavily cratered surface and extreme day-night temperature fluctuations."
  },
  {
    name: "Venus",
    size: 0.7,
    orbitRadius: 6,
    orbitSpeed: 0.6,
    rotationSpeed: 0.3,
    color: "#e6c288",
    label: "Social Signals",
    module: "social-signals",
    textureUrl: "/textures/2k_venus_atmosphere.jpg",
    type: "Terrestrial Planet",
    gravity: "8.87 m/s²",
    mass: "4.87 × 10²⁴ kg",
    description:
      "A real-time public-discourse sensorium for X posts, threads, media, trends, news, and Spaces about China macro, policy, society, trade, finance, investment, history, and geopolitics."
  },
  {
    name: "Earth",
    size: 0.75,
    orbitRadius: 8,
    orbitSpeed: 0.5,
    rotationSpeed: 1.0,
    color: "#4f86f7",
    label: "Archive",
    module: "archive",
    textureUrl: "/textures/2k_earth_daymap.jpg",
    type: "Terrestrial Planet",
    gravity: "9.80 m/s²",
    mass: "5.97 × 10²⁴ kg",
    description: "The central document repository where all generated knowledge is aggregated, organized, and made browsable."
  },
  {
    name: "Mars",
    size: 0.5,
    orbitRadius: 10,
    orbitSpeed: 0.4,
    rotationSpeed: 0.9,
    color: "#c1440e",
    label: "Analytical Pipeline",
    module: "analytical-pipeline",
    textureUrl: "/textures/2k_mars.jpg",
    type: "Terrestrial Planet",
    gravity: "3.71 m/s²",
    mass: "6.42 × 10²³ kg",
    description: "The analytical engine for deep cognitive refinement. Enter to decompose events, extract atomic facts, and synthesize structured analysis through a rigorous A→B→C→D workflow."
  },
  {
    name: "Jupiter",
    size: 1.8,
    orbitRadius: 14,
    orbitSpeed: 0.2,
    rotationSpeed: 2.0,
    color: "#d4a373",
    label: "Knowledge Graph",
    module: "knowledge-graph",
    textureUrl: "/textures/2k_jupiter.jpg",
    type: "Gas Giant",
    gravity: "24.79 m/s²",
    mass: "1.90 × 10²⁷ kg",
    description: "The Nexus functions as a dynamic topological indexing map. Through the semantic analysis of shared keywords, it autonomously establishes logical vectors between discrete informational islands, transmuting linear consumption into a networked cognitive emergence. Within this space, knowledge ceases to be isolated archival entries; it becomes an interwoven, symbiotic matrix designed to illuminate the convergence and divergence of underlying logic."
  },
  {
    name: "Saturn",
    size: 1.5,
    orbitRadius: 18,
    orbitSpeed: 0.15,
    rotationSpeed: 1.8,
    color: "#e3dccb",
    hasRing: true,
    ringInnerRadius: 1.3,
    ringOuterRadius: 2.0,
    textureUrl: "/textures/2k_saturn.jpg",
    ringTextureUrl: "/textures/2k_saturn_ring_alpha.png",
    type: "Gas Giant",
    gravity: "10.44 m/s²",
    mass: "5.68 × 10²⁶ kg",
    description: "A massive gas giant distinguished by its spectacular and complex ring system made primarily of ice particles, rocky debris, and cosmic dust."
  },
  {
    name: "Uranus",
    size: 1.0,
    orbitRadius: 22,
    orbitSpeed: 0.1,
    rotationSpeed: 1.2,
    color: "#a7d6d6",
    label: "Intelligence Board",
    module: "macro-intel",
    textureUrl: "/textures/2k_uranus.jpg",
    type: "Ice Giant",
    gravity: "8.87 m/s²",
    mass: "8.68 × 10²⁵ kg",
    description:
      "The macro intelligence archive for structured policy, fiscal, trade, and capital-market signals extracted from source feeds.",
  },
  {
    name: "Neptune",
    size: 0.95,
    orbitRadius: 26,
    orbitSpeed: 0.08,
    rotationSpeed: 1.1,
    color: "#4b70dd",
    label: "Exocortex",
    module: "exocortex",
    textureUrl: "/textures/2k_neptune.jpg",
    type: "Ice Giant",
    gravity: "11.15 m/s²",
    mass: "1.02 × 10²⁶ kg",
    description:
      "The outermost gas giant of the solar system, now serving as the deep knowledge base gateway for the Exocortex.",
  },
];

export function SolarSystem() {
  return (
    <group>
      {PLANETS.map((planet) => {
        // ✨ 核心修改：精准拦截地球的渲染逻辑
        if (planet.name === "Earth") {
          return <EarthMoonSystem key={planet.name} config={planet} />;
        }
        
        // 其他行星依然使用普通的 Planet 组件渲染
        return <Planet key={planet.name} config={planet} />;
      })}
    </group>
  );
}
