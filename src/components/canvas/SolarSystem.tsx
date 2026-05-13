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
  },
  {
    name: "Venus",
    size: 0.7,
    orbitRadius: 6,
    orbitSpeed: 0.6,
    rotationSpeed: 0.3,
    color: "#e6c288",
    textureUrl: "/textures/2k_venus_atmosphere.jpg",
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
  },
  {
    name: "Uranus",
    size: 1.0,
    orbitRadius: 22,
    orbitSpeed: 0.1,
    rotationSpeed: 1.2,
    color: "#a7d6d6",
    textureUrl: "/textures/2k_uranus.jpg",
  },
  {
    name: "Neptune",
    size: 0.95,
    orbitRadius: 26,
    orbitSpeed: 0.08,
    rotationSpeed: 1.1,
    color: "#4b70dd",
    textureUrl: "/textures/2k_neptune.jpg",
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