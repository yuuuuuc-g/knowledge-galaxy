"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
// ✨ 引入 Environment 组件
import { OrbitControls, Stars, Environment } from "@react-three/drei";
import * as THREE from "three";
import { CoreStar } from "@/src/components/canvas/CoreStar";
import { PLANETS, SolarSystem } from "@/src/components/canvas/SolarSystem";
import { CameraController } from "@/src/components/canvas/CameraController";
import { SolarBloom } from "@/src/components/canvas/SolarBloom";
import { NodeDetailPanel } from "@/src/components/hud/NodeDetailPanel";
import { ArchivePanel } from "@/src/components/hud/ArchivePanel";
import { GalaxyTerminalHUD } from "@/src/components/hud/GalaxyTerminalHUD";
import { SunConsole } from "@/src/components/hud/SunConsole";
import { SaturnConsole } from "@/src/components/hud/SaturnConsole";
import { MacroIntelConsole } from "@/src/components/hud/MacroIntelConsole";
import { SystemFrameConsole } from "@/src/components/hud/SystemFrameConsole";
import { useSolarStore } from "@/src/store/solarStore";
import { useDevRenderCounter } from "@/src/lib/dev-render-profiler";
import {
  createCanvasRuntimeProfile,
  type CanvasRuntimeProfile,
} from "@/src/modules/canvas/runtime-controller";

type ActiveSystem =
  | "analytical-pipeline"
  | "archive"
  | "knowledge-graph"
  | "exocortex"
  | "saturn"
  | "macro-intel"
  | null;

const SYSTEM_FRAMES: Record<
  Exclude<ActiveSystem, "archive" | "saturn" | "macro-intel" | null>,
  { eyebrow: string; title: string; src: string }
> = {
  "analytical-pipeline": {
    eyebrow: "MARS // EXOCORTEX CRUCIBLE",
    title: "The Crucible",
    src: "/analytical-pipeline?embed=1",
  },
  "knowledge-graph": {
    eyebrow: "JUPITER // NEXUS GRAPH",
    title: "The Nexus",
    src: "/knowledge-graph?embed=1",
  },
  exocortex: {
    eyebrow: "NEPTUNE // RAG HUB",
    title: "Exocortex",
    src: "/exocortex",
  },
};

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

interface SceneProps {
  hasFocusedPlanet: boolean;
  orbitTarget: [number, number, number];
  onSunClick: () => void;
  runtime: CanvasRuntimeProfile;
}

const Scene = ({ hasFocusedPlanet, orbitTarget, onSunClick, runtime }: SceneProps) => {
  useDevRenderCounter("Home::MemoizedScene");
  return (
    <Canvas
      className="z-0"
      camera={{ position: [0, 8, 40], fov: 45 }}
      dpr={runtime.dpr}
      frameloop={runtime.frameloop}
      gl={{
        antialias: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.92;
        gl.getContext().canvas.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          console.warn("WebGL context lost inside R3F Canvas");
        });
      }}
    >
      {runtime.environmentEnabled && (
        <Environment
          background
          files="/textures/8k_stars_milky_way.jpg"
        />
      )}

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
        enabled={!hasFocusedPlanet}
        target={orbitTarget}
      />

      {runtime.starsEnabled && (
        <Stars
          radius={50}
          depth={50}
          count={100}
          factor={4}
          saturation={0}
          fade
          speed={1}
        />
      )}

      <CameraController />
      <CoreStar onSunClick={onSunClick} />
      <SolarSystem />
      {runtime.bloomEnabled && <SolarBloom />}
    </Canvas>
  );
};

export const MemoizedScene = memo(Scene);

export default function Home() {
  useDevRenderCounter("Home::Root");
  const focusedPlanet = useSolarStore((state) => state.focusedPlanet);
  const setFocusedPlanet = useSolarStore((state) => state.setFocusedPlanet);
  const [webglLost, setWebglLost] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [activeSystem, setActiveSystem] = useState<ActiveSystem>(null);
  const orbitTarget = useMemo<[number, number, number]>(() => [0, 0, 0], []);
  const deviceMemoryGb =
    typeof navigator !== "undefined" && "deviceMemory" in navigator
      ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory)
      : undefined;
  const canvasRuntime = useMemo(
    () =>
      createCanvasRuntimeProfile({
        overlayActive: isConsoleOpen || activeSystem !== null,
        deviceMemoryGb,
      }),
    [activeSystem, deviceMemoryGb, isConsoleOpen]
  );

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
    if (
      ((activeSystem === "saturn" && focusedPlanet?.name !== "Saturn") ||
        (activeSystem === "macro-intel" && focusedPlanet?.name !== "Uranus"))
    ) {
      const timer = window.setTimeout(() => setActiveSystem(null), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [activeSystem, focusedPlanet?.name]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsConsoleOpen(false);
        setActiveSystem(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      if (
        typeof event.data === "object" &&
        event.data !== null &&
        "type" in event.data &&
        event.data.type === "knowledge-galaxy:close-system"
      ) {
        setActiveSystem(null);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleSunConsolePlanetSelect = useCallback(
    (planetId: string) => {
      const selectedPlanet = PLANETS.find(
        (planet) => planet.name.toLowerCase() === planetId.toLowerCase()
      );
      if (!selectedPlanet) {
        return;
      }
      setFocusedPlanet(selectedPlanet);
      setIsConsoleOpen(false);
    },
    [setFocusedPlanet]
  );
  const handleSunClick = useCallback(() => {
    setIsConsoleOpen(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyHashFocus = () => {
      const hash = window.location.hash.replace(/^#/, "").toLowerCase();
      if (!hash) return;
      const candidate = PLANETS.find(
        (planet) => planet.name.toLowerCase() === hash
      );
      if (candidate) {
        setFocusedPlanet(candidate);
      }
    };
    applyHashFocus();
    window.addEventListener("hashchange", applyHashFocus);
    return () => window.removeEventListener("hashchange", applyHashFocus);
  }, [setFocusedPlanet]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const system = new URLSearchParams(window.location.search).get("system");
    if (system !== "archive") return;

    const timer = window.setTimeout(() => {
      const earth = PLANETS.find((planet) => planet.name === "Earth");
      if (earth) {
        setFocusedPlanet(earth);
      }
      setActiveSystem("archive");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setFocusedPlanet]);

  return (
    <main className="relative h-screen w-screen bg-black">
      {webglLost && <WebGLWarning />}
      
      <GalaxyTerminalHUD />

      <MemoizedScene
        hasFocusedPlanet={focusedPlanet !== null}
        orbitTarget={orbitTarget}
        onSunClick={handleSunClick}
        runtime={canvasRuntime}
      />

      {!activeSystem && (
        <NodeDetailPanel
          onEnterAnalyticalPipeline={() => setActiveSystem("analytical-pipeline")}
          onEnterArchive={() => setActiveSystem("archive")}
          onEnterKnowledgeGraph={() => setActiveSystem("knowledge-graph")}
          onEnterExocortex={() => setActiveSystem("exocortex")}
          onEnterMacroIntel={() => setActiveSystem("macro-intel")}
          onOpenSaturnRadar={() => setActiveSystem("saturn")}
          isRAGOpen={activeSystem === "exocortex"}
        />
      )}

      {activeSystem === "archive" && (
        <ArchivePanel onClose={() => setActiveSystem(null)} />
      )}

      <SunConsole
        isOpen={isConsoleOpen}
        onClose={() => setIsConsoleOpen(false)}
        onPlanetSelect={handleSunConsolePlanetSelect}
      />

      <SaturnConsole
        isOpen={activeSystem === "saturn"}
        onClose={() => setActiveSystem(null)}
      />

      <MacroIntelConsole
        isOpen={activeSystem === "macro-intel"}
        onClose={() => setActiveSystem(null)}
      />

      {activeSystem &&
        activeSystem !== "archive" &&
        activeSystem !== "saturn" &&
        activeSystem !== "macro-intel" && (
          <SystemFrameConsole
            isOpen
            onClose={() => setActiveSystem(null)}
            src={SYSTEM_FRAMES[activeSystem].src}
            title={SYSTEM_FRAMES[activeSystem].title}
            eyebrow={SYSTEM_FRAMES[activeSystem].eyebrow}
            fullBleed={activeSystem === "knowledge-graph"}
            borderClassName={
              activeSystem === "knowledge-graph"
                ? "border-cyan-200/45 shadow-[0_0_90px_rgba(34,211,238,0.22)]"
                : undefined
            }
          />
        )}
    </main>
  );
}
