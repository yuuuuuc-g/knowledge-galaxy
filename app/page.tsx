"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
// ✨ 引入 Environment 组件
import { OrbitControls, Stars, Environment } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
import { CoreStar } from "@/src/components/canvas/CoreStar";
import { SolarSystem } from "@/src/components/canvas/SolarSystem";
import { CameraController } from "@/src/components/canvas/CameraController";
import { NodeDetailPanel } from "@/src/components/hud/NodeDetailPanel";
import { ArchivePanel } from "@/src/components/hud/ArchivePanel";
import { GalaxyWorkspace } from "@/src/components/galaxy-workspace";
import { useSolarStore } from "@/src/store/solarStore";

function WebGLWarning() {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 text-white">
      <div className="text-center">
        <p className="text-lg font-bold">WebGL Context Lost</p>
        <p className="mt-2 text-sm text-white/60">Please refresh the page to restore 3D rendering</p>
      </div>
    </div>
  );
}

export default function Home() {
  const focusedPlanet = useSolarStore((state) => state.focusedPlanet);
  const [webglLost, setWebglLost] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [isRAGOpen, setIsRAGOpen] = useState(false);
  const orbitTarget = useMemo<[number, number, number]>(() => [0, 0, 0], []);

  const handleContextLost = useCallback((event: Event) => {
    event.preventDefault();
    console.warn("WebGL context lost - attempting recovery");
    setWebglLost(true);
  }, []);

  const handleContextRestored = useCallback(() => {
    console.log("WebGL context restored");
    setWebglLost(false);
  }, []);

  useEffect(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, [handleContextLost, handleContextRestored]);

  useEffect(() => {
    if (focusedPlanet?.name !== "Neptune" && isRAGOpen) {
      setIsRAGOpen(false);
    }
  }, [focusedPlanet, isRAGOpen]);

  return (
    <main className="relative h-screen w-screen bg-black">
      {webglLost && <WebGLWarning />}
      
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col p-8 text-white">
        <h1 className="font-serif text-2xl tracking-widest text-white/50">A SPACE</h1>
        <p className="mt-2 text-xs tracking-wider text-white/30">
          {focusedPlanet ? "Click Back to Galaxy to return" : "Drag to rotate • Scroll to zoom • Click planet to focus"}
        </p>
      </div>

      <Canvas
        className="z-0"
        camera={{ position: [0, 8, 40], fov: 45 }}
        dpr={[1, 1.5]} // ✨ 新增：限制像素倍率，防卡顿神器！
        onCreated={({ gl }) => {
          gl.getContext().canvas.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            console.warn("WebGL context lost inside R3F Canvas");
          });
        }}
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

        <OrbitControls
          enablePan={false}
          minDistance={5}
          maxDistance={100}
          enabled={!focusedPlanet}
          target={orbitTarget}
        />

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

      <NodeDetailPanel
        onEnterArchive={() => setShowArchive(true)}
        onEnterExocortex={() => {
          setShowArchive(false);
          setIsRAGOpen(true);
        }}
        isRAGOpen={isRAGOpen}
      />

      {showArchive && (
        <ArchivePanel onClose={() => setShowArchive(false)} />
      )}

      <AnimatePresence>
        {isRAGOpen && (
          <motion.aside
            className="absolute inset-y-0 right-0 z-30 flex h-full h-screen w-full max-w-[min(1100px,95vw)] flex-col border-l border-cyan-300/20 bg-black/95 shadow-[-24px_0_80px_rgba(0,0,0,0.6)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          >
            <button
              aria-label="Close Exocortex panel"
              className="absolute right-4 top-4 z-40 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/65 transition-colors hover:text-white"
              onClick={() => setIsRAGOpen(false)}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
            <GalaxyWorkspace />
          </motion.aside>
        )}
      </AnimatePresence>
    </main>
  );
}
