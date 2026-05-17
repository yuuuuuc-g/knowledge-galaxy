"use client";

import { useRouter } from "next/navigation";
import { useSolarStore } from "@/src/store/solarStore";
import { CyberButton } from "@/src/components/ui/CyberButton";
import { GlassPanel } from "@/src/components/ui/GlassPanel";

interface NodeDetailPanelProps {
  onEnterArchive: () => void;
}

export function NodeDetailPanel({ onEnterArchive }: NodeDetailPanelProps) {
  const router = useRouter();
  const focusedPlanet = useSolarStore((state) => state.focusedPlanet);
  const setFocusedPlanet = useSolarStore((state) => state.setFocusedPlanet);

  if (!focusedPlanet) return null;

  const handleEnterSystem = () => {
    switch (focusedPlanet.module) {
      case "analytical-pipeline":
        router.push("/analytical-pipeline");
        break;
      case "archive":
        onEnterArchive();
        break;
      case "knowledge-graph":
        alert("Knowledge Graph module coming soon...");
        break;
      default:
        alert(`Entering ${focusedPlanet.label}...`);
    }
  };

  return (
    <GlassPanel className="pointer-events-auto absolute right-0 top-0 z-20 flex h-full w-80 flex-col border-y-0 border-r-0 p-6">
      <div className="mb-8">
        <h2 className="font-serif text-3xl tracking-widest text-[#deff9a]">
          {focusedPlanet.name.toUpperCase()}
        </h2>

        <div className="mt-2 flex flex-col gap-1">
          {focusedPlanet.label && (
            <span className="text-xs font-bold tracking-widest text-[#deff9a]/80">
              [ {focusedPlanet.label.toUpperCase()} ]
            </span>
          )}
          {focusedPlanet.type && (
            <span className="text-xs font-medium tracking-wide text-white/50">
              {focusedPlanet.type.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {focusedPlanet.description && (
        <div className="mb-8 text-sm leading-relaxed tracking-wide text-white/70">
          <p>{focusedPlanet.description}</p>
        </div>
      )}

      <div className="space-y-4 text-sm">
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

      <div className="mt-auto pt-6">
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
