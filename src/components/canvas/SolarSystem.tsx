"use client";

import { Planet } from "./Planet";
// ✨ 新增：引入我们刚刚创建的地月系统组件
import { EarthMoonSystem } from "./EarthMoonSystem"; 
import type { PlanetConfig } from "./types";

const PLANETS: PlanetConfig[] = [
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
    textureUrl: "/textures/2k_venus_atmosphere.jpg",
    type: "Terrestrial Planet",
    gravity: "8.87 m/s²",
    mass: "4.87 × 10²⁴ kg",
    description: "Often called Earth's sister planet, Venus has a thick, toxic atmosphere that traps heat in a runaway greenhouse effect, making it the hottest planet in our system."
  },
  {
    name: "Earth",
    size: 0.75,
    orbitRadius: 8,
    orbitSpeed: 0.5,
    rotationSpeed: 1.0,
    color: "#4f86f7",
    label: "Knowledge Graph",
    textureUrl: "/textures/2k_earth_daymap.jpg", 
    type: "Terrestrial Planet",
    gravity: "9.80 m/s²",
    mass: "5.97 × 10²⁴ kg",
    description: "The third planet from the Sun and the only known celestial body to harbor life, featuring vast oceans of liquid water and a protective nitrogen-oxygen atmosphere."
  },
  {
    name: "Mars",
    size: 0.5,
    orbitRadius: 10,
    orbitSpeed: 0.4,
    rotationSpeed: 0.9,
    color: "#c1440e",
    label: "Obsidian Vault",
    textureUrl: "/textures/2k_mars.jpg",
    type: "Terrestrial Planet",
    gravity: "3.71 m/s²",
    mass: "6.42 × 10²³ kg",
    description: "The Red Planet is a dusty, cold, desert world with a very thin atmosphere, featuring extinct volcanoes and massive canyon systems."
  },
  {
    name: "Jupiter",
    size: 1.8,
    orbitRadius: 14,
    orbitSpeed: 0.2,
    rotationSpeed: 2.0,
    color: "#d4a373",
    hasRing: true,
    ringInnerRadius: 1.4,
    ringOuterRadius: 2.2,
    label: "Spatial Canvas",
    textureUrl: "/textures/2k_jupiter.jpg",
    ringTextureUrl: "/textures/2k_jupiter_ring_alpha.png", 
    type: "Gas Giant",
    gravity: "24.79 m/s²",
    mass: "1.90 × 10²⁷ kg",
    description: "The largest planet in our solar system, a gas giant known for its iconic Great Red Spot—a massive storm larger than Earth—and dozens of orbiting moons."
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
    textureUrl: "/textures/2k_uranus.jpg",
    type: "Ice Giant",
    gravity: "8.87 m/s²",
    mass: "8.68 × 10²⁵ kg",
    description: "An ice giant that peculiarly rotates on its side. Uranus has a pale blue-green color due to methane in its atmosphere and experiences extreme seasonal variations."
  },
  {
    name: "Neptune",
    size: 0.95,
    orbitRadius: 26,
    orbitSpeed: 0.08,
    rotationSpeed: 1.1,
    color: "#4b70dd",
    textureUrl: "/textures/2k_neptune.jpg",
    type: "Ice Giant",
    gravity: "11.15 m/s²",
    mass: "1.02 × 10²⁶ kg",
    description: "The most distant major planet, Neptune is a dark, cold, and supersonic wind-whipped ice giant, appearing as a deep, vibrant blue world."
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