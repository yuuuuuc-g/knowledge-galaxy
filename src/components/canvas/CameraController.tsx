"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSolarStore } from "@/src/store/solarStore";

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 8, 25);
const LERP_SPEED = 2.5;

export function CameraController() {
  const { camera } = useThree();
  const focusedPlanet = useSolarStore((state) => state.focusedPlanet);
  const isTransitioning = useRef(false);
  const targetPosition = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());

  useEffect(() => {
    if (focusedPlanet) {
      isTransitioning.current = true;
    } else {
      isTransitioning.current = true;
    }
  }, [focusedPlanet]);

  useFrame((_, delta) => {
    if (!isTransitioning.current) return;

    if (focusedPlanet) {
      const planetPos = new THREE.Vector3(
        Math.cos(focusedPlanet.orbitRadius) * focusedPlanet.orbitRadius,
        0,
        Math.sin(focusedPlanet.orbitRadius) * focusedPlanet.orbitRadius
      );
      
      const offset = new THREE.Vector3(3, 2, 3);
      targetPosition.current.copy(planetPos).add(offset);
      targetLookAt.current.copy(planetPos);
    } else {
      targetPosition.current.copy(INITIAL_CAMERA_POSITION);
      targetLookAt.current.set(0, 0, 0);
    }

    camera.position.lerp(targetPosition.current, delta * LERP_SPEED);
    
    const currentLookAt = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
    currentLookAt.lerp(targetLookAt.current, delta * LERP_SPEED);
    camera.lookAt(currentLookAt);

    if (camera.position.distanceTo(targetPosition.current) < 0.05) {
      isTransitioning.current = false;
    }
  });

  return null;
}
