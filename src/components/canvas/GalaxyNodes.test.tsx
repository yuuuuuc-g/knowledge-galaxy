import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGalaxyNodeBuffers, GalaxyNodes, updateGalaxyNodeColors } from "./GalaxyNodes";
import type { NodeData } from "@/app/api/nodes/route";

describe("GalaxyNodes", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("uses nodesData length as the instanced node count", () => {
    const nodesData: NodeData[] = [
      { id: "chunk-1", chapter_title: "规则", chunk_index: 0, book_id: "book-a" },
      { id: "chunk-2", chapter_title: "产权", chunk_index: 1, book_id: "book-a" },
      { id: "chunk-3", chapter_title: "分工", chunk_index: 2, book_id: "book-b" },
    ];

    act(() => {
      root.render(<GalaxyNodes highlightedNodeId={null} nodesData={nodesData} />);
    });

    expect(container.querySelector("[data-node-count]")).toHaveAttribute(
      "data-node-count",
      "3"
    );
  });

  it("updates every instance color and marks instanceColor dirty once per target change", () => {
    const nodesData: Pick<NodeData, "id" | "book_id">[] = [
      { id: "chunk-1", book_id: "book-a" },
      { id: "chunk-2", book_id: "book-b" },
      { id: "chunk-3", book_id: "book-c" },
    ];
    const setColorAt = vi.fn();
    const colorArray = new Float32Array([
      0.1, 0.2, 0.3,
      0.2, 0.3, 0.4,
      0.3, 0.4, 0.5,
    ]);
    const mesh = {
      setColorAt,
      instanceColor: {
        needsUpdate: false,
      },
    };

    updateGalaxyNodeColors(mesh, nodesData, "chunk-2", colorArray);

    expect(setColorAt).toHaveBeenCalledTimes(3);
    expect(setColorAt).toHaveBeenNthCalledWith(2, 1, new THREE.Color("#fcd34d"));
    expect(mesh.instanceColor.needsUpdate).toBe(true);
  });

  it("builds at least two visually distinct colors for two book clusters", () => {
    const nodesData: Pick<NodeData, "id" | "book_id">[] = [
      { id: "chunk-1", book_id: "book-a" },
      { id: "chunk-2", book_id: "book-b" },
      { id: "chunk-3", book_id: "book-a" },
      { id: "chunk-4", book_id: "book-b" },
    ];
    const { colorArray } = buildGalaxyNodeBuffers(nodesData);
    const uniqueColors = new Set<string>();

    for (let index = 0; index < nodesData.length; index += 1) {
      const offset = index * 3;
      const r = colorArray[offset];
      const g = colorArray[offset + 1];
      const b = colorArray[offset + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      uniqueColors.add(`${r.toFixed(4)}-${g.toFixed(4)}-${b.toFixed(4)}`);
      expect(luminance).toBeGreaterThan(0.13);
      expect(luminance).toBeLessThan(0.75);
    }

    expect(uniqueColors.size).toBeGreaterThanOrEqual(2);
  });
});
