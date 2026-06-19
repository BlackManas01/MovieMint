// components/SeatViewPreview.jsx
// First-person "what you'd actually see from this seat" 3D preview (lazy-loaded).
// - Camera sits at the seat at real eye height and only looks around like a head turn.
// - Stadium tiers: every row is raised so back seats see over the front ones.
// - Realistic seats (cushion + backrest + armrests), coloured by zone.
// - Click any seat to instantly move your viewpoint there (and pick it).
import React, { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, useTexture } from "@react-three/drei";
import ErrorBoundary from "./ErrorBoundary";

const SEAT_DX = 0.78;   // horizontal spacing between seats
const ROW_DZ = 1.25;    // depth between rows (legroom)
const RISE = 0.34;      // stadium rise per row — back rows sit higher
const FRONT_Z = -6.5;   // z of the front row
const EYE = 1.02;       // seated eye height above the seat base
const SCREEN = { z: -13, y: 4.4, w: 19, h: 8 };

const seatX = (c, cols) => (c - (cols - 1) / 2) * SEAT_DX;
const seatZ = (r) => FRONT_Z + r * ROW_DZ;
const seatBaseY = (r) => 0.5 + r * RISE;

// Movie still shown on the screen (real, lit). Falls back to a glowing panel.
function ImageScreen({ url }) {
    const tex = useTexture(url);
    return (
        <mesh position={[0, SCREEN.y, SCREEN.z]}>
            <planeGeometry args={[SCREEN.w, SCREEN.h]} />
            <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
    );
}
function PlainScreen() {
    return (
        <mesh position={[0, SCREEN.y, SCREEN.z]}>
            <planeGeometry args={[SCREEN.w, SCREEN.h]} />
            <meshStandardMaterial color="#241a3a" emissive="#c084fc" emissiveIntensity={0.8} />
        </mesh>
    );
}

function Seat({ position, color, status, onSelect }) {
    const selected = status === "selected";
    const occupied = status === "occupied";
    const base = occupied ? "#43434f" : color;
    const emissive = selected ? "#c084fc" : "#000000";
    const emissiveIntensity = selected ? 0.9 : 0;

    const over = (e) => { e.stopPropagation(); if (!occupied) document.body.style.cursor = "pointer"; };
    const out = () => { document.body.style.cursor = "auto"; };
    const click = (e) => { e.stopPropagation(); if (!occupied && onSelect) onSelect(); };

    // Seats face the screen (-z): backrest sits on the +z (back) side and reclines backward.
    return (
        <group position={position} onPointerOver={over} onPointerOut={out} onClick={click}>
            {/* seat cushion */}
            <mesh position={[0, 0.08, -0.04]}>
                <boxGeometry args={[0.62, 0.18, 0.56]} />
                <meshStandardMaterial color={base} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.75} />
            </mesh>
            {/* backrest (behind the sitter, reclined backward) */}
            <mesh position={[0, 0.46, 0.24]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.62, 0.7, 0.15]} />
                <meshStandardMaterial color={base} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.75} />
            </mesh>
            {/* armrests */}
            <mesh position={[-0.33, 0.22, 0.0]}>
                <boxGeometry args={[0.09, 0.16, 0.52]} />
                <meshStandardMaterial color="#15121d" roughness={0.6} />
            </mesh>
            <mesh position={[0.33, 0.22, 0.0]}>
                <boxGeometry args={[0.09, 0.16, 0.52]} />
                <meshStandardMaterial color="#15121d" roughness={0.6} />
            </mesh>
        </group>
    );
}

function Scene({ rows, cols, rowIndex, colIndex, screenImage, rowColors, seatStatus, onPickSeat }) {
    // Eye position at the chosen seat.
    const eye = useMemo(
        () => [seatX(colIndex, cols), seatBaseY(rowIndex) + EYE, seatZ(rowIndex)],
        [colIndex, cols, rowIndex]
    );

    // Look toward the centre of the screen.
    const cam = useMemo(() => {
        const [ex, ey, ez] = eye;
        let dx = 0 - ex, dy = SCREEN.y - ey, dz = SCREEN.z - ez;
        const len = Math.hypot(dx, dy, dz) || 1;
        dx /= len; dy /= len; dz /= len;
        const D = 1.2; // pivot just in front of the eyes → feels like turning your head
        const target = [ex + dx * D, ey + dy * D, ez + dz * D];
        // Natural look angles, so we can clamp the head movement around them.
        const azimuth = Math.atan2(-dx, -dz);
        const polar = Math.acos(Math.min(1, Math.max(-1, -dy)));
        return { target, D, azimuth, polar };
    }, [eye]);

    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    return (
        <>
            <PerspectiveCamera makeDefault position={eye} fov={62} near={0.1} far={120} />
            <OrbitControls
                target={cam.target}
                enablePan={false}
                enableZoom={false}
                enableDamping
                dampingFactor={0.12}
                rotateSpeed={0.32}
                minDistance={cam.D}
                maxDistance={cam.D}
                minPolarAngle={clamp(cam.polar - 0.32, 0.05, Math.PI - 0.05)}
                maxPolarAngle={clamp(cam.polar + 0.3, 0.05, Math.PI - 0.05)}
                minAzimuthAngle={cam.azimuth - 1.15}
                maxAzimuthAngle={cam.azimuth + 1.15}
            />

            <ambientLight intensity={0.32} />
            <pointLight position={[0, 7, SCREEN.z + 2]} intensity={60} color="#c084fc" distance={50} />
            <spotLight position={[0, 11, 4]} angle={0.8} intensity={30} penumbra={0.7} color="#ffffff" />

            {/* Screen frame + screen */}
            <mesh position={[0, SCREEN.y, SCREEN.z - 0.08]}>
                <planeGeometry args={[SCREEN.w + 0.9, SCREEN.h + 0.9]} />
                <meshStandardMaterial color="#07070d" />
            </mesh>
            {/* If the movie still fails to load as a texture, fall back to the
                glowing plain screen instead of crashing the whole preview. */}
            <ErrorBoundary fallback={<PlainScreen />}>
                <Suspense fallback={<PlainScreen />}>
                    {screenImage ? <ImageScreen url={screenImage} /> : <PlainScreen />}
                </Suspense>
            </ErrorBoundary>

            {/* Room shell (floor / ceiling / walls) for an enclosed-hall feel */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -2]}>
                <planeGeometry args={[60, 80]} />
                <meshStandardMaterial color="#0b0911" />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 13, -2]}>
                <planeGeometry args={[60, 80]} />
                <meshStandardMaterial color="#08060d" />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]} position={[-12, 6, -2]}>
                <planeGeometry args={[80, 26]} />
                <meshStandardMaterial color="#0a0812" />
            </mesh>
            <mesh rotation={[0, -Math.PI / 2, 0]} position={[12, 6, -2]}>
                <planeGeometry args={[80, 26]} />
                <meshStandardMaterial color="#0a0812" />
            </mesh>

            {/* Seats (stadium-tiered, zone-coloured, clickable). The seat you're on is omitted. */}
            {Array.from({ length: rows }).map((_, r) =>
                Array.from({ length: cols }).map((_, c) => {
                    if (r === rowIndex && c === colIndex) return null;
                    const status = seatStatus?.[r]?.[c] || "available";
                    const zoneColor = (rowColors && rowColors[r]) || "#2a2336";
                    return (
                        <Seat
                            key={`${r}-${c}`}
                            position={[seatX(c, cols), seatBaseY(r), seatZ(r)]}
                            color={zoneColor}
                            status={status}
                            onSelect={onPickSeat ? () => onPickSeat(r, c) : undefined}
                        />
                    );
                })
            )}
        </>
    );
}

export default function SeatViewPreview({
    rowIndex = 0,
    colIndex = 0,
    rows = 8,
    cols = 10,
    screenImage = null,
    rowColors = null,
    seatStatus = null,
    onPickSeat = null,
}) {
    return (
        <Canvas dpr={[1, 1.5]} gl={{ antialias: true }} style={{ width: "100%", height: "100%" }}>
            <color attach="background" args={["#070510"]} />
            <fog attach="fog" args={["#070510", 16, 42]} />
            <Suspense fallback={null}>
                <Scene
                    rows={rows}
                    cols={cols}
                    rowIndex={rowIndex}
                    colIndex={colIndex}
                    screenImage={screenImage}
                    rowColors={rowColors}
                    seatStatus={seatStatus}
                    onPickSeat={onPickSeat}
                />
            </Suspense>
        </Canvas>
    );
}
