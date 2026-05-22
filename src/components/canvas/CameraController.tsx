"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTime } from "framer-motion-3d";
import * as THREE from "three";
import { useSolarStore } from "@/src/store/solarStore";

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 8, 40);
const LERP_SPEED = 3.5;

export function CameraController() {
  const { camera, scene } = useThree();
  const focusedPlanet = useSolarStore((state) => state.focusedPlanet);
  const motionTime = useTime();
  
  const targetPosition = useRef(new THREE.Vector3().copy(INITIAL_CAMERA_POSITION));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  
  // ✨ 新增：运镜状态锁
  const isTransitioning = useRef(false);

  // Only claim camera control while focusing a planet. Once focus is cleared,
  // OrbitControls owns the camera fully and user drag state must be preserved.
  useEffect(() => {
    isTransitioning.current = focusedPlanet !== null;
  }, [focusedPlanet]);

  useFrame((_, delta) => {
    if (!focusedPlanet) {
      return;
    }

    const planetObj = scene.getObjectByName(focusedPlanet.name);

    if (planetObj) {
      const planetWorldPos = new THREE.Vector3();
      planetObj.getWorldPosition(planetWorldPos);

      const directionFromSun = planetWorldPos.clone().normalize();

      const distance = focusedPlanet.size * 6;
      const height = focusedPlanet.size * 2.5;

      targetPosition.current
        .copy(planetWorldPos)
        .add(directionFromSun.multiplyScalar(distance))
        .add(new THREE.Vector3(0, height, 0));

      targetLookAt.current.copy(planetWorldPos);
    }

    const speedFactor = 0.95 + Math.sin(motionTime.get() / 1000) * 0.05;
    camera.position.lerp(targetPosition.current, delta * LERP_SPEED * speedFactor);
    
    const currentLookAt = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
    currentLookAt.lerp(targetLookAt.current, delta * LERP_SPEED);
    camera.lookAt(currentLookAt);

    if (camera.position.distanceTo(targetPosition.current) < 0.05) {
      isTransitioning.current = false;
    }
  });

  return null;
}
