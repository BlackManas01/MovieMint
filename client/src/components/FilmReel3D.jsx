// components/FilmReel3D.jsx - Auto-rotating 3D film reel (lazy-loaded). Used on the 404 page.
import React, { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

function Reel() {
    const spin = useRef();
    useFrame((_, dt) => {
        if (spin.current) spin.current.rotation.z += dt * 0.6;
    });

    const holes = Array.from({ length: 5 });

    return (
        // Outer tilt gives it a 3D angle; inner group spins.
        <group rotation={[0.55, 0, 0]}>
            <group ref={spin}>
                {/* main disc (flat face toward camera) */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[2, 2, 0.22, 56]} />
                    <meshStandardMaterial color="#1a1430" metalness={0.6} roughness={0.35} />
                </mesh>
                {/* glowing rim */}
                <mesh>
                    <torusGeometry args={[2, 0.11, 16, 80]} />
                    <meshStandardMaterial color="#c084fc" emissive="#c084fc" emissiveIntensity={0.5} metalness={0.5} roughness={0.2} />
                </mesh>
                {/* centre hub */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.45, 0.45, 0.34, 32]} />
                    <meshStandardMaterial color="#c084fc" emissive="#a855f7" emissiveIntensity={0.6} metalness={0.4} roughness={0.3} />
                </mesh>
                {/* reel holes */}
                {holes.map((_, i) => {
                    const a = (i / holes.length) * Math.PI * 2;
                    return (
                        <mesh key={i} rotation={[Math.PI / 2, 0, 0]} position={[Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0]}>
                            <cylinderGeometry args={[0.4, 0.4, 0.4, 24]} />
                            <meshStandardMaterial color="#08060d" />
                        </mesh>
                    );
                })}
            </group>
        </group>
    );
}

export default function FilmReel3D() {
    return (
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 6], fov: 50 }} style={{ width: "100%", height: "100%" }}>
            <ambientLight intensity={0.45} />
            <pointLight position={[4, 4, 6]} intensity={70} color="#c084fc" />
            <pointLight position={[-4, -2, 4]} intensity={35} color="#ffffff" />
            <Suspense fallback={null}>
                <Reel />
            </Suspense>
            <OrbitControls enablePan={false} enableZoom={false} />
        </Canvas>
    );
}
