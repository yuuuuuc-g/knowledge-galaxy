"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { NodeData } from "@/app/api/nodes/route";

const NODE_RADIUS = 0.055;
const HIGHLIGHT_COLOR = new THREE.Color("#fbbf24");
const DEEP_JEWEL_TONES = [0x115e59, 0x7f1d1d, 0x3730a3, 0x3f6212, 0x9a3412, 0x7e22ce] as const;
const SPIRAL_BASE_RADIUS = 1.6;
const SPIRAL_RADIUS_STEP = 0.035;
const SPIRAL_RING_COUNT = 37;

export type GalaxyNodeInput = Pick<NodeData, "id" | "book_id">;

export interface GalaxyNodesProps {
  nodesData: GalaxyNodeInput[];
  highlightedNodeId: string | null;
}

interface InstanceColorBuffer {
  needsUpdate: boolean;
}

export interface InstancedColorTarget {
  instanceColor: InstanceColorBuffer | null;
  setColorAt(index: number, color: THREE.Color): void;
}

interface InstancedMeshTarget extends InstancedColorTarget {
  instanceMatrix: InstanceColorBuffer;
  setMatrixAt(index: number, matrix: THREE.Matrix4): void;
}

function isInstancedMeshTarget(value: unknown): value is InstancedMeshTarget {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<InstancedMeshTarget>;

  return (
    typeof candidate.setMatrixAt === "function" &&
    typeof candidate.setColorAt === "function" &&
    Boolean(candidate.instanceMatrix)
  );
}

function getNodePosition(index: number, total: number): THREE.Vector3 {
  const radius = SPIRAL_BASE_RADIUS + (index % SPIRAL_RING_COUNT) * SPIRAL_RADIUS_STEP;
  const angle = index * 2.399963229728653;
  const verticalProgress = total <= 1 ? 0.5 : index / (total - 1);
  const y = (verticalProgress - 0.5) * 2.6;

  return new THREE.Vector3(
    Math.cos(angle) * radius,
    y,
    Math.sin(angle) * radius
  );
}

function buildBookColorMap(nodesData: GalaxyNodeInput[]): Map<string, THREE.Color> {
  const uniqueBookIds = Array.from(new Set(nodesData.map((node) => node.book_id)));
  const bookColorMap = new Map<string, THREE.Color>();

  uniqueBookIds.forEach((bookId, index) => {
    const colorHex = DEEP_JEWEL_TONES[index % DEEP_JEWEL_TONES.length];
    bookColorMap.set(bookId, new THREE.Color(colorHex));
  });

  return bookColorMap;
}

export interface GalaxyNodeBuffers {
  tempPositions: Float32Array;
  colorArray: Float32Array;
}

export function buildGalaxyNodeBuffers(nodesData: GalaxyNodeInput[]): GalaxyNodeBuffers {
  const total = nodesData.length;
  const tempPositions = new Float32Array(total * 3);
  const colorArray = new Float32Array(total * 3);
  const bookColorMap = buildBookColorMap(nodesData);
  const fallbackColor = new THREE.Color(DEEP_JEWEL_TONES[0]);
  const maxRadius = SPIRAL_BASE_RADIUS + (SPIRAL_RING_COUNT - 1) * SPIRAL_RADIUS_STEP;

  for (let index = 0; index < total; index += 1) {
    const node = nodesData[index];
    const position = getNodePosition(index, total);
    const positionOffset = index * 3;
    tempPositions[positionOffset] = position.x;
    tempPositions[positionOffset + 1] = position.y;
    tempPositions[positionOffset + 2] = position.z;

    const baseColor = bookColorMap.get(node.book_id) ?? fallbackColor;
    const liftedColor = baseColor.clone().lerp(new THREE.Color("#94a3b8"), 0.28);
    const radialDistance = Math.sqrt(position.x ** 2 + position.z ** 2);
    const radialProgress = THREE.MathUtils.clamp(
      (radialDistance - SPIRAL_BASE_RADIUS) / (maxRadius - SPIRAL_BASE_RADIUS),
      0,
      1
    );
    const brightnessFactor = 0.9 + (1 - radialProgress) * 0.14;

    colorArray[positionOffset] = liftedColor.r * brightnessFactor;
    colorArray[positionOffset + 1] = liftedColor.g * brightnessFactor;
    colorArray[positionOffset + 2] = liftedColor.b * brightnessFactor;
  }

  return { tempPositions, colorArray };
}

export function updateGalaxyNodeColors(
  mesh: InstancedColorTarget,
  nodesData: GalaxyNodeInput[],
  highlightedNodeId: string | null,
  colorArray: Float32Array
) {
  const color = new THREE.Color();

  nodesData.forEach((node, index) => {
    const offset = index * 3;
    const nodeColor = node.id === highlightedNodeId
      ? HIGHLIGHT_COLOR
      : color.setRGB(colorArray[offset], colorArray[offset + 1], colorArray[offset + 2]);

    mesh.setColorAt(index, nodeColor);
  });

  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
}

export function GalaxyNodes({ nodesData, highlightedNodeId }: GalaxyNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const { tempPositions, colorArray } = useMemo(
    () => buildGalaxyNodeBuffers(nodesData),
    [nodesData]
  );
  const sphereGeometry = useMemo(
    () => new THREE.SphereGeometry(NODE_RADIUS, 8, 8),
    []
  );
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ toneMapped: false }),
    []
  );

  useEffect(() => {
    const mesh = meshRef.current;

    if (!isInstancedMeshTarget(mesh)) {
      return;
    }

    const matrix = new THREE.Matrix4();

    nodesData.forEach((_, index) => {
      const offset = index * 3;
      matrix.setPosition(tempPositions[offset], tempPositions[offset + 1], tempPositions[offset + 2]);
      mesh.setMatrixAt(index, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  }, [nodesData, tempPositions]);

  useEffect(() => {
    const mesh = meshRef.current;

    if (!isInstancedMeshTarget(mesh)) {
      return;
    }

    updateGalaxyNodeColors(mesh, nodesData, highlightedNodeId, colorArray);
  }, [colorArray, highlightedNodeId, nodesData]);

  useEffect(() => {
    return () => {
      sphereGeometry.dispose();
      material.dispose();
    };
  }, [material, sphereGeometry]);

  return (
    <instancedMesh
      args={[sphereGeometry, material, nodesData.length]}
      data-node-count={nodesData.length}
      ref={meshRef}
    />
  );
}
