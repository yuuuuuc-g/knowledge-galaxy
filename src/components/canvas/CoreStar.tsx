"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Sphere } from "@react-three/drei";
import * as THREE from "three";

export function CoreStar() {
  // Matt Pocock 规范：明确声明 Ref 类型
  const starRef = useRef<THREE.Mesh>(null!);

  // ✨ 新增：加载太阳表面纹理贴图，并进行色彩空间修正
  const texture = useMemo(() => {
    // 请确保你的 public/textures/ 目录下有这张图片
    const tex = new THREE.TextureLoader().load("/textures/sun.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // 让主星缓慢自转
  useFrame((state, delta) => {
    if (starRef.current) {
      starRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group>
      {/* 发光主星 */}
      <Sphere ref={starRef} args={[2, 64, 64]}>
        {/* ✨ 修改：引入 map 贴图
          依然使用 MeshBasicMaterial，保证太阳不受行星阴影影响。
          color 改为纯白，防止把贴图本身的颜色染得太黄。
          toneMapped={false} 确保在后期特效中保持高亮。
        */}
        <meshBasicMaterial map={texture} color="#ffffff" toneMapped={false} />
      </Sphere>
      
      {/* 核心光源：照亮周围带有 MeshStandardMaterial 的行星 */}
      <pointLight 
        color="#ffddaa" 
        intensity={2} 
        distance={50} 
        decay={2} 
      />
    </group>
  );
}