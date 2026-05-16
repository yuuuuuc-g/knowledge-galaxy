"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSolarStore } from "@/src/store/solarStore";

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 8, 40);
const LERP_SPEED = 3.5;

export function CameraController() {
  const { camera, scene } = useThree();
  const focusedPlanet = useSolarStore((state) => state.focusedPlanet);
  
  const targetPosition = useRef(new THREE.Vector3().copy(INITIAL_CAMERA_POSITION));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  
  // ✨ 新增：运镜状态锁
  const isTransitioning = useRef(false);

  // ✨ 监听焦点变化：不管是聚焦行星，还是退回全局，只要状态变了，就开启运镜锁
  useEffect(() => {
    isTransitioning.current = true;
  }, [focusedPlanet]);

  useFrame((_, delta) => {
    // ✨ 核心修复：如果没有在运镜，且当前没有聚焦行星，直接休眠！
    // 这就把摄像机的控制权彻底交还给了用户的鼠标 (OrbitControls)
    if (!isTransitioning.current && !focusedPlanet) return;

    if (focusedPlanet) {
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
    } else {
      // 退回全局视角
      targetPosition.current.copy(INITIAL_CAMERA_POSITION);
      targetLookAt.current.set(0, 0, 0);
    }

    // ============ 执行丝滑的镜头插值运算 ============
    camera.position.lerp(targetPosition.current, delta * LERP_SPEED);
    
    const currentLookAt = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
    currentLookAt.lerp(targetLookAt.current, delta * LERP_SPEED);
    camera.lookAt(currentLookAt);

    // ✨ 核心修复：如果摄像机已经非常接近目标点了，关闭运镜锁，释放控制权
    if (camera.position.distanceTo(targetPosition.current) < 0.1) {
      isTransitioning.current = false;
    }
  });

  return null;
}