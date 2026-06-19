// components/SeatViewPreview.jsx - 3D "view from this seat" preview (lazy-loaded).
import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";

const SEAT_DX = 0.72;   // horizontal spacing
const ROW_DZ = 1.0;     // depth between rows
const RISE = 0.22;      // stadium rise per row
const SCREEN = { z: -9, y: 2.8, w: 15, h: 6 };

function Scene({ rows, cols, rowIndex, colIndex }) {
    const seatX = (c) => (c - (cols - 1) / 2) * SEAT_DX;
    const seatZ = (r) => -2.5 + r * ROW_DZ;
    const seatY = (r) => 0.45 + r * RISE;

    const camPos = [seatX(colIndex), seatY(rowIndex) + 0.8, seatZ(rowIndex) + 0.45];

    return (
        <>
            <PerspectiveCamera makeDefault position={camPos} fov={74} />
            <OrbitControls
                target={[0, SCREEN.y, SCREEN.z + 0.5]}
                enablePan={false}
                minDistance={1}
                maxDistance={24}
                maxPolarAngle={Math.PI / 1.9}
            />

            <ambientLight intensity={0.3} />
            <pointLight position={[0, 6, -7]} intensity={60} color="#c084fc" distance={40} />
            <spotLight position={[0, 9, 6]} angle={0.7} intensity={25} penumbra={0.6} color="#ffffff" />

            {/* Screen frame */}
            <mesh position={[0, SCREEN.y, SCREEN.z - 0.06]}>
                <planeGeometry args={[SCREEN.w + 0.7, SCREEN.h + 0.7]} />
                <meshStandardMaterial color="#0a0a12" />
            </mesh>
            {/* Glowing screen */}
            <mesh position={[0, SCREEN.y, SCREEN.z]}>
                <planeGeometry args={[SCREEN.w, SCREEN.h]} />
                <meshStandardMaterial color="#241a3a" emissive="#c084fc" emissiveIntensity={0.7} />
            </mesh>

            {/* Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -1]}>
                <planeGeometry args={[40, 40]} />
                <meshStandardMaterial color="#0c0a12" />
            </mesh>

            {/* Seats */}
            {Array.from({ length: rows }).map((_, r) =>
                Array.from({ length: cols }).map((_, c) => {
                    const active = r === rowIndex && c === colIndex;
                    return (
                        <group key={`${r}-${c}`} position={[seatX(c), seatY(r), seatZ(r)]}>
                            {/* seat base */}
                            <mesh position={[0, 0, 0]}>
                                <boxGeometry args={[0.52, 0.18, 0.5]} />
                                <meshStandardMaterial
                                    color={active ? "#c084fc" : "#2a2336"}
                                    emissive={active ? "#c084fc" : "#000000"}
                                    emissiveIntensity={active ? 0.9 : 0}
                                />
                            </mesh>
                            {/* seat back */}
                            <mesh position={[0, 0.22, -0.2]}>
                                <boxGeometry args={[0.52, 0.42, 0.14]} />
                                <meshStandardMaterial
                                    color={active ? "#a855f7" : "#241d30"}
                                    emissive={active ? "#a855f7" : "#000000"}
                                    emissiveIntensity={active ? 0.7 : 0}
                                />
                            </mesh>
                        </group>
                    );
                })
            )}
        </>
    );
}

export default function SeatViewPreview({ rowIndex = 0, colIndex = 0, rows = 8, cols = 10 }) {
    return (
        <Canvas dpr={[1, 1.5]} gl={{ antialias: true }} style={{ width: "100%", height: "100%" }}>
            <color attach="background" args={["#08060d"]} />
            <fog attach="fog" args={["#08060d", 12, 30]} />
            <Suspense fallback={null}>
                <Scene rows={rows} cols={cols} rowIndex={rowIndex} colIndex={colIndex} />
            </Suspense>
        </Canvas>
    );
}
