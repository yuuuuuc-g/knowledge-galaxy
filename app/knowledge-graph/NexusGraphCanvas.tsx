"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ForceGraphMethods,
  ForceGraphProps,
  GraphData,
  LinkObject,
  NodeObject,
} from "react-force-graph-2d";
import type ForceGraph2DComponent from "react-force-graph-2d";
import type { NexusGraphData, NexusLink, NexusNode } from "./types";

const ForceGraph2D = dynamic<ForceGraphProps<NexusNode, NexusLink>>(
  () => import("react-force-graph-2d"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm tracking-[0.2em] text-white/35">
        LOADING NEXUS
      </div>
    ),
  },
) as typeof ForceGraph2DComponent<NexusNode, NexusLink>;

interface NexusGraphCanvasProps {
  graphData: NexusGraphData;
}

interface LinkForce {
  distance: (distance: number) => LinkForce;
  strength: (strength: number) => LinkForce;
}

interface StrengthForce {
  strength: (strength: number) => unknown;
}

function isLinkForce(force: unknown): force is LinkForce {
  if (typeof force !== "object" || force === null) {
    return false;
  }

  return "distance" in force && "strength" in force;
}

function isStrengthForce(force: unknown): force is StrengthForce {
  if (typeof force !== "object" || force === null) {
    return false;
  }

  return "strength" in force;
}

function getNodeId(node: string | number | NodeObject<NexusNode> | undefined) {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  return typeof node?.id === "string" ? node.id : "";
}

function getNodeRadius(node: NodeObject<NexusNode>, highlighted: boolean) {
  const baseRadius = node.type === "document" ? 7 : 4;
  return highlighted ? baseRadius + 3 : baseRadius;
}

export function NexusGraphCanvas({ graphData }: NexusGraphCanvasProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef =
    useRef<ForceGraphMethods<NexusNode, NexusLink> | undefined>(undefined);
  const [size, setSize] = useState({ width: 960, height: 620 });
  const [highlightedConceptId, setHighlightedConceptId] = useState<string | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  const prevSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const newWidth = Math.max(element.clientWidth, 320);
      const newHeight = Math.max(element.clientHeight, 420);

      if (
        prevSizeRef.current.width !== newWidth ||
        prevSizeRef.current.height !== newHeight
      ) {
        prevSizeRef.current = { width: newWidth, height: newHeight };
        setSize({ width: newWidth, height: newHeight });

        requestAnimationFrame(() => {
          graphRef.current?.d3ReheatSimulation();
        });
      }
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    const linkForce = graph?.d3Force("link");
    if (isLinkForce(linkForce)) {
      linkForce.distance(120).strength(0.25);
    }

    const chargeForce = graph?.d3Force("charge");
    if (isStrengthForce(chargeForce)) {
      chargeForce.strength(-420);
    }

    graph?.d3ReheatSimulation();
    graph?.zoomToFit(800, 72);
  }, [graphData]);

  const connectedDocumentIds = useMemo(() => {
    if (!highlightedConceptId) {
      return new Set<string>();
    }

    const ids = new Set<string>();
    graphData.links.forEach((link) => {
      if (link.target === highlightedConceptId) {
        ids.add(link.source);
      }
    });
    return ids;
  }, [graphData.links, highlightedConceptId]);

  const renderedGraphData = useMemo<GraphData<NexusNode, NexusLink>>(
    () => ({
      nodes: JSON.parse(JSON.stringify(graphData.nodes)),
      links: JSON.parse(JSON.stringify(graphData.links)),
    }),
    [graphData],
  );

  const isNodeHighlighted = (node: NodeObject<NexusNode>) =>
    !highlightedConceptId ||
    node.id === highlightedConceptId ||
    connectedDocumentIds.has(getNodeId(node.id));

  const isLinkHighlighted = (link: LinkObject<NexusNode, NexusLink>) =>
    highlightedConceptId === null || getNodeId(link.target) === highlightedConceptId;

  return (
    <section className="relative min-h-[calc(100vh-9rem)]">
      <div
        ref={containerRef}
        className="relative min-h-[calc(100vh-9rem)] overflow-hidden rounded border border-white/10 bg-zinc-950/80"
      >
        {graphData.nodes.length === 0 ? (
          <div className="flex h-full min-h-[calc(100vh-9rem)] items-center justify-center px-6 text-center text-sm leading-6 text-white/40">
            The Nexus is empty. Archive a completed analytical session to seed
            the graph.
          </div>
        ) : mounted ? (
          <ForceGraph2D
            ref={graphRef}
            graphData={renderedGraphData}
            width={size.width}
            height={size.height}
            backgroundColor="rgba(9,9,11,0)"
            nodeId="id"
            nodeRelSize={6}
            nodeVal="val"
            nodeLabel={(node) => node.name}
            nodeColor={(node) =>
              isNodeHighlighted(node) ? node.color : "rgba(255,255,255,0.16)"
            }
            linkColor={(link) =>
              isLinkHighlighted(link)
                ? "rgba(222,255,154,0.42)"
                : "rgba(255,255,255,0.06)"
            }
            linkWidth={(link) => (isLinkHighlighted(link) ? 1.4 : 0.45)}
            linkDirectionalParticles={(link) => (isLinkHighlighted(link) ? 1 : 0)}
            linkDirectionalParticleSpeed={0.003}
            linkDirectionalParticleWidth={1.4}
            d3AlphaDecay={0.018}
            d3VelocityDecay={0.32}
            cooldownTicks={160}
            warmupTicks={60}
            minZoom={0.45}
            maxZoom={5}
            onNodeClick={(node) => {
              if (node.type === "document" && node.documentId) {
                router.push(`/archive/${node.documentId}`);
                return;
              }

              if (node.type === "concept" && node.id) {
                setHighlightedConceptId((current) =>
                  current === node.id ? null : String(node.id),
                );
              }
            }}
            onBackgroundClick={() => setHighlightedConceptId(null)}
            showPointerCursor={(object) => Boolean(object)}
            nodeCanvasObject={(node, context, globalScale) => {
              const highlighted = isNodeHighlighted(node);
              const radius = getNodeRadius(node, highlighted);
              const label = node.name ?? "";
              const labelFontSize = node.type === "document" ? 13 : 11;
              const fontSize = labelFontSize / globalScale;

              context.beginPath();
              context.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI);
              context.fillStyle = highlighted
                ? node.color
                : "rgba(255,255,255,0.16)";
              context.fill();

              if (node.type === "document") {
                context.strokeStyle = "rgba(222,255,154,0.65)";
                context.lineWidth = 1.5 / globalScale;
                context.stroke();
              }

              context.font = `${fontSize}px serif`;
              context.textAlign = "left";
              context.textBaseline = "middle";
              context.fillStyle = highlighted
                ? "rgba(255,255,255,0.88)"
                : "rgba(255,255,255,0.32)";
              context.fillText(label, (node.x ?? 0) + radius + 4, node.y ?? 0);
            }}
            nodePointerAreaPaint={(node, color, context) => {
              const radius = getNodeRadius(node, true) + 8;
              context.fillStyle = color;
              context.beginPath();
              context.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI);
              context.fill();
            }}
          />
        ) : null}
      </div>

      {highlightedConceptId && (
        <button
          type="button"
          onClick={() => setHighlightedConceptId(null)}
          className="absolute right-4 top-4 rounded border border-[#deff9a]/25 bg-zinc-950/50 px-3 py-2 text-xs font-semibold tracking-wide text-[#deff9a] backdrop-blur-sm transition hover:border-[#deff9a]/50"
        >
          CLEAR FOCUS
        </button>
      )}
    </section>
  );
}
