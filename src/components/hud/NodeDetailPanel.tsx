"use client";

import { useRouter } from "next/navigation";
import { useSolarStore } from "@/src/store/solarStore";
import { CyberButton } from "@/src/components/ui/CyberButton";
import { GlassPanel } from "@/src/components/ui/GlassPanel";

export function NodeDetailPanel() {
  const router = useRouter();
  const focusedPlanet = useSolarStore((state) => state.focusedPlanet);
  const setFocusedPlanet = useSolarStore((state) => state.setFocusedPlanet);

  if (!focusedPlanet) return null;

  const handleEnterSystem = () => {
    if (focusedPlanet.label === "Obsidian Vault") {
      router.push("/refinery");
      return;
    }

    alert(`Entering ${focusedPlanet.label}...`);
  };

  return (
    <GlassPanel className="pointer-events-auto absolute right-0 top-0 z-20 flex h-full w-80 flex-col border-y-0 border-r-0 p-6">
      
      {/* ============ 顶部标题与标签 ============ */}
      <div className="mb-8">
        <h2 className="font-serif text-3xl tracking-widest text-[#deff9a]">
          {focusedPlanet.name.toUpperCase()}
        </h2>
        
        <div className="mt-2 flex flex-col gap-1">
          {/* 如果有接入系统，高亮显示系统名称 */}
          {focusedPlanet.label && (
            <span className="text-xs font-bold tracking-widest text-[#deff9a]/80">
              [ {focusedPlanet.label.toUpperCase()} ]
            </span>
          )}
          {/* 显示行星的天文类型 (如 Gas Giant) */}
          {focusedPlanet.type && (
            <span className="text-xs font-medium tracking-wide text-white/50">
              {focusedPlanet.type.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* ============ 行星物理描述 ============ */}
      {focusedPlanet.description && (
        <div className="mb-8 text-sm leading-relaxed tracking-wide text-white/70">
          <p>{focusedPlanet.description}</p>
        </div>
      )}

      {/* ============ 数据面板列表 ============ */}
      <div className="space-y-4 text-sm">
        {/* 只在数据存在时渲染该行 */}
        {focusedPlanet.mass && (
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-white/40">Mass</span>
            <span className="font-mono text-[#deff9a]">{focusedPlanet.mass}</span>
          </div>
        )}
        
        {focusedPlanet.gravity && (
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-white/40">Gravity</span>
            <span className="font-mono text-[#deff9a]">{focusedPlanet.gravity}</span>
          </div>
        )}

        <div className="flex justify-between border-b border-white/10 pb-2">
          <span className="text-white/40">Orbit Radius</span>
          <span className="font-mono text-white/90">{focusedPlanet.orbitRadius} AU</span>
        </div>
        
        <div className="flex justify-between border-b border-white/10 pb-2">
          <span className="text-white/40">Size</span>
          <span className="font-mono text-white/90">{focusedPlanet.size} R⊕</span>
        </div>
        
        <div className="flex justify-between border-b border-white/10 pb-2">
          <span className="text-white/40">Orbit Speed</span>
          <span className="font-mono text-white/90">{focusedPlanet.orbitSpeed}</span>
        </div>
      </div>

      {/* ============ 底部操作按钮 ============ */}
      <div className="mt-auto pt-6">
        {/* 如果这个行星接入了业务功能，显示一个醒目的进入按钮 */}
        {focusedPlanet.label && (
          <CyberButton
            className="mb-3 w-full"
            onClick={handleEnterSystem}
          >
            ENTER SYSTEM
          </CyberButton>
        )}

        <CyberButton
          variant="secondary"
          onClick={() => setFocusedPlanet(null)}
          className="w-full"
        >
          BACK TO GALAXY
        </CyberButton>
      </div>
    </GlassPanel>
  );
}
