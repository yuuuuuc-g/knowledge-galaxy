"use client";

import { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { Planet } from "./Planet";
import type { PlanetProps } from "./types";

export function EarthMoonSystem({ config }: PlanetProps) {
  const systemGroupRef = useRef<THREE.Group>(null!);
  const moonRef = useRef<THREE.Mesh>(null!);

  const { orbitRadius, orbitSpeed, size } = config;

  const moonTexture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load("/textures/luna.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // ✨ 1. 核心物理参数计算：引入偏心率
  const eccentricity = config.eccentricity || 0;
  const a = orbitRadius;                                      // 长半轴
  const b = a * Math.sqrt(1 - eccentricity * eccentricity);    // 短半轴
  const focalShift = a * eccentricity;                        // 焦点偏移

// ✅ 完美的惰性初始化新代码
const [initialAngle] = useState(() => Math.random() * Math.PI * 2);
const angleRef = useRef(initialAngle);

// (在地月系统中，月球的也一样改)
const [initialMoonAngle] = useState(() => Math.random() * Math.PI * 2);
const moonAngleRef = useRef(initialMoonAngle);

  // ✨ 2. 修改轨道线：画出椭圆轨迹
  const orbitPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      // 使用椭圆参数方程
      points.push(new THREE.Vector3(Math.cos(angle) * a - focalShift, 0, Math.sin(angle) * b));
    }
    return points;
  }, [a, b, focalShift]);

  useFrame((_, delta) => {
    // ✨ 3. 修改大公转逻辑：让地月系统整体沿椭圆飞行
    angleRef.current += delta * orbitSpeed * 0.1;
    if (systemGroupRef.current) {
      systemGroupRef.current.position.x = Math.cos(angleRef.current) * a - focalShift;
      systemGroupRef.current.position.z = Math.sin(angleRef.current) * b;
    }

    // 处理月球的小公转 (绕地飞行保持正圆，因为地月偏心率极小，视觉不明显)
    if (moonRef.current) {
      moonAngleRef.current += delta * 0.8; 
      const moonDistance = size * 2.5; 
      
      moonRef.current.position.x = Math.cos(moonAngleRef.current) * moonDistance;
      moonRef.current.position.z = Math.sin(moonAngleRef.current) * moonDistance;
      
      moonRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group>
      {/* 补回基于椭圆算法的地球轨道线 */}
      <Line points={orbitPoints} color="#ffffff" lineWidth={1} transparent opacity={0.15} />

      <group ref={systemGroupRef} name={config.name}>
        <Planet 
          config={{
            ...config,
            orbitRadius: 0, 
            eccentricity: 0, // 强制子组件内部不再计算偏移
          }} 
        />
        
        <mesh ref={moonRef}>
          <sphereGeometry args={[size * 0.25, 24, 24]} />
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