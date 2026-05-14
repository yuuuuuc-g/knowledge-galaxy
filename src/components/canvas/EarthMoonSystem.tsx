"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei"; // ✨ 新增：引入 Line 重新画出地球轨道
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

  // 地球系统绕太阳的初始随机角度
  const angleRef = useRef(Math.random() * Math.PI * 2);
  
  // ✨ 新增：给月亮准备专属的独立角度计算器
  const moonAngleRef = useRef(Math.random() * Math.PI * 2);

  // ✨ 修复：重新计算并补回地球丢失的白色公转轨道线
  const orbitPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius));
    }
    return points;
  }, [orbitRadius]);

  useFrame((_, delta) => {
    // 1. 处理大公转 (地球系统整体绕太阳飞行)
    angleRef.current += delta * orbitSpeed * 0.1;
    if (systemGroupRef.current) {
      systemGroupRef.current.position.x = Math.cos(angleRef.current) * orbitRadius;
      systemGroupRef.current.position.z = Math.sin(angleRef.current) * orbitRadius;
    }

    // ✨ 2. 终极修复：用绝对的数学三角函数算月球的公转，告别嵌套 Bug
    if (moonRef.current) {
      // 推进月球公转角度
      moonAngleRef.current += delta * 0.8; 
      // 设定地月距离
      const moonDistance = size * 2.5; 
      
      // 直接计算并赋值月球在 X 轴和 Z 轴的绝对位置
      moonRef.current.position.x = Math.cos(moonAngleRef.current) * moonDistance;
      moonRef.current.position.z = Math.sin(moonAngleRef.current) * moonDistance;
      
      // 3. 处理月球自转
      moonRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group>
      {/* 画出地球绕日轨道线 */}
      <Line points={orbitPoints} color="#ffffff" lineWidth={1} transparent opacity={0.15} />

      <group ref={systemGroupRef} name={config.name}>
        <Planet 
          config={{
            ...config,
            orbitRadius: 0, 
          }} 
        />
        
        {/* ✨ 现在的月亮不再依赖轴心 Group，
          而是直接挂载，靠上面的 useFrame 物理计算每秒刷新位置！
        */}
        <mesh ref={moonRef}>
          {/* 面数同步优化为 24，确保流畅度 */}
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