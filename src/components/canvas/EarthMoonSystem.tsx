"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Planet } from "./Planet";
import type { PlanetProps } from "./types";

export function EarthMoonSystem({ config }: PlanetProps) {
  // 引用整个地月系统，用于同步大公转
  const systemGroupRef = useRef<THREE.Group>(null!);
  // 引用月球本体，用于处理自转
  const moonRef = useRef<THREE.Mesh>(null!);
  // 引用月球轨道枢纽，用于处理绕地公转
  const moonPivotRef = useRef<THREE.Group>(null!);

  const { orbitRadius, orbitSpeed, size } = config;

  // ✨ 1. 加载月球纹理 (请确保 public/textures/ 下有 luna.jpg)
  const moonTexture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load("/textures/luna.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // 用于大公转的初始角度随机化
  const angleRef = useRef(Math.random() * Math.PI * 2);

  useFrame((state, delta) => {
    // ✨ 2. 处理大公转 (地球 + 月亮整体绕太阳)
    angleRef.current += delta * orbitSpeed * 0.1;
    if (systemGroupRef.current) {
      systemGroupRef.current.position.x = Math.cos(angleRef.current) * orbitRadius;
      systemGroupRef.current.position.z = Math.sin(angleRef.current) * orbitRadius;
    }

    // ✨ 3. 处理月球的小公转 (绕地飞行)
    if (moonPivotRef.current) {
      // 月亮的公转速度通常比地球快得多
      moonPivotRef.current.rotation.y += delta * 0.8;
    }

    // ✨ 4. 处理月球的自转
    if (moonRef.current) {
      moonRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group ref={systemGroupRef} name={config.name}>
      {/* 
        🌍 地球本体 
        我们将 orbitRadius 设为 0，因为父群组已经在处理位移了。
        我们将 Planet 组件作为子项，它会继承父项的位置。
      */}
      <Planet 
        config={{
          ...config,
          orbitRadius: 0, // 强制为0，防止位置叠加导致地球“飞”出去
        }} 
      />

      {/* 
        🌙 月球轨道系统 
        moonPivotRef 位于地球中心 (0,0,0)
      */}
      <group ref={moonPivotRef}>
        <mesh ref={moonRef} position={[size * 2.0, 0, 0]}>
          {/* 月球大小通常是地球的 1/4 左右 */}
          <sphereGeometry args={[size * 0.25, 32, 32]} />
          <meshStandardMaterial 
            map={moonTexture} 
            roughness={0.9} 
            metalness={0.1}
          />
        </mesh>
      </group>
    </group>
  );
}