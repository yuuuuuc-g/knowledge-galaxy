"use client";

import { Canvas } from "@react-three/fiber";
// ✨ 引入 Environment 组件
import { OrbitControls, Stars, Environment } from "@react-three/drei";
import { CoreStar } from "@/src/components/canvas/CoreStar";
import { SolarSystem } from "@/src/components/canvas/SolarSystem";
import { CameraController } from "@/src/components/canvas/CameraController";
import { NodeDetailPanel } from "@/src/components/hud/NodeDetailPanel";
import { useSolarStore } from "@/src/store/solarStore";

export default function Home() {
  const focusedPlanet = useSolarStore((state) => state.focusedPlanet);

  return (
    <main className="relative h-screen w-screen bg-black">
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col p-8 text-white">
        <h1 className="font-serif text-2xl tracking-widest text-white/50">A SPACE</h1>
        <p className="mt-2 text-xs tracking-wider text-white/30">
          {focusedPlanet ? "Click Back to Galaxy to return" : "Drag to rotate • Scroll to zoom • Click planet to focus"}
        </p>
      </div>

      <Canvas
  className="z-0"
  camera={{ position: [0, 8, 25], fov: 45 }}
  dpr={[1, 1.5]} // ✨ 新增：限制像素倍率，防卡顿神器！
>
        {/* ✨ 核心升级：挂载银河系全景背景 */}
        <Environment 
          background 
          files="/textures/8k_stars_milky_way.jpg" 
        />

        <ambientLight intensity={0.6} />

        <directionalLight 
          position={[15, 10, 5]} 
          intensity={1.8} 
          color="#ffffff"
        />

        {!focusedPlanet && (
          <OrbitControls
            enablePan={false}
            minDistance={5}
            maxDistance={30}
          />
        )}

        {/* 保留原有的 Stars 组件。
          银河贴图作为远景背景，点状的 Stars 作为近景悬浮物。
          拖拽视角时，两者会产生极其深邃的视差 (Parallax) 效果！
        */}
        <Stars
          radius={50}
          depth={50}
          count={100}
          factor={4}
          saturation={0}
          fade
          speed={1}
        />

        <CameraController />
        <CoreStar />
        <SolarSystem />
      </Canvas>

      <NodeDetailPanel />
    </main>
  );
}