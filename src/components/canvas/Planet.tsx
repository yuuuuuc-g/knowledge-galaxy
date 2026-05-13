"use client";

import { useRef, useState, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Sphere, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import type { PlanetProps } from "./types";
import { useSolarStore } from "@/src/store/solarStore";

export function Planet({ config }: PlanetProps) {
  const planetRef = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);
  const setFocusedPlanet = useSolarStore((state) => state.setFocusedPlanet);

  const {
    size,
    orbitRadius,
    orbitSpeed,
    rotationSpeed,
    color,
    hasRing,
    ringInnerRadius,
    ringOuterRadius,
    label,
    textureUrl,
    ringTextureUrl,
  } = config; 

  // 1. 加载行星本体贴图
  const texture = useMemo(() => {
    if (!textureUrl) return null;
    const tex = new THREE.TextureLoader().load(textureUrl);
    tex.colorSpace = THREE.SRGBColorSpace; 
    return tex;
  }, [textureUrl]);

  // 2. 加载官方细长条星环贴图 (不需要任何旋转)
  const ringTexture = useMemo(() => {
    if (!ringTextureUrl) return null;
    const tex = new THREE.TextureLoader().load(ringTextureUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [ringTextureUrl]);

  // ✨ 终极绝杀：手动生成 RingGeometry，使用“对角线 UV 映射法”
  const ringGeometry = useMemo(() => {
    if (!hasRing || !ringInnerRadius || !ringOuterRadius) return null;
    
    const inner = ringInnerRadius * size;
    const outer = ringOuterRadius * size;
    const geo = new THREE.RingGeometry(inner, outer, 128);
    
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const radius = Math.sqrt(x * x + y * y);
      
      // 将半径转换为 0 到 1 的进度
      const progress = (radius - inner) / (outer - inner);
      
      // ⚠️ 对角线映射法：无论图片是横长条还是竖长条，都能完美沿半径铺满！
      uv.setXY(i, progress, progress); 
    }
    
    return geo;
  }, [hasRing, ringInnerRadius, ringOuterRadius, size]);

  const orbitPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius));
    }
    return points;
  }, [orbitRadius]);

  const angleRef = useRef(Math.random() * Math.PI * 2);

  useFrame((_, delta) => {
    if (planetRef.current) {
      planetRef.current.rotation.y += delta * rotationSpeed;
    }

    angleRef.current += delta * orbitSpeed * 0.1;
    if (groupRef.current) {
      groupRef.current.position.x = Math.cos(angleRef.current) * orbitRadius;
      groupRef.current.position.z = Math.sin(angleRef.current) * orbitRadius;
    }
  });

  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (label) {
      setFocusedPlanet(config);
    }
  }, [label, config, setFocusedPlanet]);

  return (
    <group>
      <Line points={orbitPoints} color="#ffffff" lineWidth={1} transparent opacity={0.15} />

      <group ref={groupRef}>
        <Sphere
          ref={planetRef}
          args={[size, 32, 32]}
          onPointerOver={(e) => { e.stopPropagation(); if (label) { setHovered(true); document.body.style.cursor = "pointer"; } }}
          onPointerOut={(e) => { e.stopPropagation(); if (label) { setHovered(false); document.body.style.cursor = "auto"; } }}
          onClick={handleClick}
          scale={hovered ? 1.1 : 1}
        >
          <meshStandardMaterial 
            map={texture} 
            color={texture ? "#ffffff" : color} 
            roughness={0.8} 
            metalness={0.1} 
          />
        </Sphere>

        {/* ✨ 星环渲染：直接读取 RGBA 原色和原透明度 */}
        {ringGeometry && (
          <mesh rotation={[Math.PI / 2.5, 0, 0]} geometry={ringGeometry}>
            {ringTexture ? (
              <meshBasicMaterial
                map={ringTexture}          // ✨ 直接用 map
                color="#ffffff"            // ✨ 纯白底色，完美还原土星黄
                side={THREE.DoubleSide}
                transparent={true}         // ✨ 激活贴图自带的 Alpha 镂空
                opacity={0.9} 
                depthWrite={false} 
              />
            ) : (
              <meshStandardMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.6} />
            )}
          </mesh>
        )}

        {label && hovered && (
          <Html position={[0, size * 1.8, 0]} center distanceFactor={10}>
            <div className="pointer-events-none whitespace-nowrap rounded bg-black/70 px-2 py-1 text-xs font-medium tracking-wide text-white backdrop-blur-sm">
              {label}
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}