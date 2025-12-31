/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const Ribbon = ({ index }: { index: number }) => {
  const lineRef = useRef<THREE.Line>(null);
  const segmentCount = 100;
  
  // Sophisticated Palette: Deep indigo, Gold, Soft White, Purple
  const colors = [0x4F46E5, 0xC5A059, 0xFFFFFF, 0x9333EA];
  // Seed random deterministically if we want consistent colors per index, 
  // but using simple random here as per the example is fine.
  // To avoid changing color on every render, useMemo:
  const color = useMemo(() => colors[Math.floor(Math.random() * colors.length)], []);
  const opacity = useMemo(() => Math.random() * 0.4 + 0.1, []);

  // Meta-data for animation
  const params = useMemo(() => ({
    offset: Math.random() * 100,
    speed: Math.random() * 0.005 + 0.002,
    radius: Math.random() * 4 + 2,
    freq: Math.random() * 0.5 + 0.2
  }), []);

  const positions = useMemo(() => new Float32Array(segmentCount * 3), []);
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  useFrame((state) => {
    if (lineRef.current && geometryRef.current) {
        const time = state.clock.getElapsedTime() * 10; // Match the speed scale roughly (performance.now() * 0.1)
        const { offset, speed, radius, freq } = params;
        const t = time * speed + offset;

        const positionsArray = geometryRef.current.attributes.position.array as Float32Array;

        for (let j = 0; j < segmentCount; j++) {
            const ratio = j / segmentCount;
            const angle = ratio * Math.PI * 2 + t;
            
            // Complex motion using sine/cosine combinations
            const x = Math.cos(angle) * radius + Math.sin(t * 0.5 + index) * 2;
            const y = Math.sin(angle * freq) * (radius * 0.5) + Math.cos(t + index) * 1;
            const z = Math.sin(angle + t) * 2 - ratio * 5;

            positionsArray[j * 3] = x;
            positionsArray[j * 3 + 1] = y;
            positionsArray[j * 3 + 2] = z;
        }
        
        geometryRef.current.attributes.position.needsUpdate = true;
        lineRef.current.rotation.z += 0.001;
        lineRef.current.rotation.y += 0.0005;
    }
  });

  return (
    <line ref={lineRef as any}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
      />
    </line>
  );
};

const RibbonsGroup = () => {
    const count = 40;
    // Create an array of indices to map over
    const indices = useMemo(() => Array.from({ length: count }, (_, i) => i), []);

    return (
        <>
            {indices.map(i => <Ribbon key={i} index={i} />)}
        </>
    )
}

const CameraController = () => {
  const { camera, pointer } = useThree();
  
  useFrame(() => {
    // Mouse influence
    // pointer.x/y are normalized coordinates (-1 to 1)
    
    // Subtle camera tilt
    // Note: React Three Fiber's pointer is -1 to 1 already.
    const targetX = pointer.x * 2;
    const targetY = -pointer.y * 2;

    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0); // Assuming look at center
  });

  return null;
}

const SilkScene: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0 bg-[#020617]">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 45 }}
        dpr={[1, 2]} // Match window.devicePixelRatio, max 2
      >
        <ambientLight intensity={0.5} />
        <RibbonsGroup />
        <CameraController />
      </Canvas>
    </div>
  );
};

export default SilkScene;
