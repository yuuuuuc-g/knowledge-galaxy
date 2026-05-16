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
    // ✨ 1. 结构出偏心率参数（如果配置里没写，就默认是 0，即正圆）
    eccentricity = 0, 
  } = config; // 这里暂用 as any 防止 types.ts 还没加上 eccentricity 报错

  const texture = useMemo(() => {
    if (!textureUrl) return null;
    const tex = new THREE.TextureLoader().load(textureUrl);
    tex.colorSpace = THREE.SRGBColorSpace; 
    return tex;
  }, [textureUrl]);

  const ringTexture = useMemo(() => {
    if (!ringTextureUrl) return null;
    const tex = new THREE.TextureLoader().load(ringTextureUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [ringTextureUrl]);

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
      const progress = (radius - inner) / (outer - inner);
      uv.setXY(i, progress, progress); 
    }
    
    return geo;
  }, [hasRing, ringInnerRadius, ringOuterRadius, size]);

  // ✨ 2. 核心天体物理计算
  const a = orbitRadius;                           // 长半轴
  const b = a * Math.sqrt(1 - eccentricity * eccentricity); // 短半轴
  const focalShift = a * eccentricity;             // 焦点偏移量（让太阳处于焦点）

  // ✨ 3. 重写轨道白线：画出真实的椭圆
  const orbitPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      // 椭圆参数方程：X应用长半轴并减去焦点偏移，Z应用短半轴
      points.push(new THREE.Vector3(Math.cos(angle) * a - focalShift, 0, Math.sin(angle) * b));
    }
    return points;
  }, [a, b, focalShift]);

  const [initialAngle] = useState(() => Math.random() * Math.PI * 2);
  const angleRef = useRef(initialAngle);

  useFrame((_, delta) => {
    if (planetRef.current) {
      planetRef.current.rotation.y += delta * rotationSpeed;
    }

    angleRef.current += delta * orbitSpeed * 0.1;
    if (groupRef.current) {
      // ✨ 4. 重写行星运动轨迹：严格沿着椭圆轨道飞行
      groupRef.current.position.x = Math.cos(angleRef.current) * a - focalShift;
      groupRef.current.position.z = Math.sin(angleRef.current) * b;
    }
  });

  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setFocusedPlanet(config);
  }, [config, setFocusedPlanet]);

  return (
    <group>
      <Line points={orbitPoints} color="#ffffff" lineWidth={1} transparent opacity={0.15} />

      <group ref={groupRef} name={config.name}>
        <Sphere
          ref={planetRef}
          args={[size, 32, 32]} 
          onPointerOver={(e) => { 
            e.stopPropagation(); 
            setHovered(true); 
            document.body.style.cursor = "pointer"; 
          }}
          onPointerOut={(e) => { 
            e.stopPropagation(); 
            setHovered(false); 
            document.body.style.cursor = "auto"; 
          }}
          onClick={handleClick}
          scale={hovered ? 1.05 : 1}
        >
          <meshStandardMaterial 
            map={texture} 
            color={texture ? "#ffffff" : color} 
            roughness={0.8} 
            metalness={0.1} 
          />
        </Sphere>

        {ringGeometry && (
          <mesh rotation={[Math.PI / 2.5, 0, 0]} geometry={ringGeometry}>
            {ringTexture ? (
              <meshBasicMaterial
                map={ringTexture}          
                color="#ffffff"            
                side={THREE.DoubleSide}
                transparent={true}         
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
