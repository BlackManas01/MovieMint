// components/StarfieldBackground.jsx
// A polished, GPU-light night sky rendered on a single canvas behind the whole app.
// - The star sphere rotates very slowly (like the real night sky / a turning Earth).
// - Stars twinkle; a faint purple Milky Way band drifts with the rotation.
// - Occasional shooting stars streak across.
// - Respects prefers-reduced-motion (renders one static frame).
import { useEffect, useRef } from "react";

export default function StarfieldBackground() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const DPR = Math.min(window.devicePixelRatio || 1, 2);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        let w = 0, h = 0, cx = 0, cy = 0, R = 0;
        let stars = [];
        let meteors = [];
        let raf = 0, angle = 0, t = 0;

        const build = () => {
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = Math.floor(w * DPR);
            canvas.height = Math.floor(h * DPR);
            canvas.style.width = w + "px";
            canvas.style.height = h + "px";
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            cx = w / 2;
            cy = h / 2;
            R = (Math.hypot(w, h) / 2) * 1.15; // overscan so corners stay covered while rotating

            const count = Math.min(460, Math.max(140, Math.floor((w * h) / 2600)));
            stars = Array.from({ length: count }).map(() => {
                const rad = Math.sqrt(Math.random()) * R; // uniform disk distribution
                const ang = Math.random() * Math.PI * 2;
                const tint = Math.random();
                return {
                    rad,
                    ang,
                    size: Math.random() * 1.25 + 0.3,
                    base: Math.random() * 0.5 + 0.35,
                    twPhase: Math.random() * Math.PI * 2,
                    twSpeed: Math.random() * 1.4 + 0.4,
                    color: tint < 0.16 ? "216,180,254" : tint < 0.42 ? "191,219,254" : "255,255,255",
                };
            });
        };

        const spawnMeteor = () => {
            meteors.push({
                x: Math.random() * w * 0.85 + w * 0.08,
                y: Math.random() * h * 0.28,
                len: Math.random() * 130 + 80,
                speed: Math.random() * 5 + 7,
                ang: Math.PI * (0.16 + Math.random() * 0.14), // heads down-right
                life: 0,
                max: 60,
            });
        };

        const drawMilkyWay = () => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle * 0.7);
            ctx.scale(1, 0.34);
            const g = ctx.createLinearGradient(-R, 0, R, 0);
            g.addColorStop(0, "rgba(124,58,237,0)");
            g.addColorStop(0.4, "rgba(168,85,247,0.10)");
            g.addColorStop(0.5, "rgba(216,180,254,0.17)");
            g.addColorStop(0.6, "rgba(168,85,247,0.10)");
            g.addColorStop(1, "rgba(124,58,237,0)");
            ctx.globalCompositeOperation = "screen";
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(0, 0, R, R, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        };

        const draw = () => {
            ctx.clearRect(0, 0, w, h);
            drawMilkyWay();

            // Rotating star sphere
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            for (const s of stars) {
                const tw = 0.6 + 0.4 * Math.sin(t * s.twSpeed + s.twPhase);
                const a = s.base * tw;
                const x = Math.cos(s.ang) * s.rad;
                const y = Math.sin(s.ang) * s.rad;
                if (s.size > 1.05) {
                    ctx.beginPath();
                    ctx.fillStyle = `rgba(${s.color},${a * 0.22})`;
                    ctx.arc(x, y, s.size * 2.6, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.beginPath();
                ctx.fillStyle = `rgba(${s.color},${a})`;
                ctx.arc(x, y, s.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // Shooting stars (screen-space)
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            ctx.lineCap = "round";
            for (const m of meteors) {
                const dx = Math.cos(m.ang), dy = Math.sin(m.ang);
                const x1 = m.x - dx * m.len, y1 = m.y - dy * m.len;
                const fade = 1 - m.life / m.max;
                const grad = ctx.createLinearGradient(x1, y1, m.x, m.y);
                grad.addColorStop(0, "rgba(216,180,254,0)");
                grad.addColorStop(1, `rgba(255,255,255,${0.85 * fade})`);
                ctx.strokeStyle = grad;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(m.x, m.y);
                ctx.stroke();
                ctx.beginPath();
                ctx.fillStyle = `rgba(255,255,255,${0.9 * fade})`;
                ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        };

        const tick = () => {
            t += 0.016;
            angle += 0.00025; // slow celestial rotation (~7 min per turn)
            for (const m of meteors) {
                m.x += Math.cos(m.ang) * m.speed;
                m.y += Math.sin(m.ang) * m.speed;
                m.life++;
            }
            meteors = meteors.filter((m) => m.life < m.max && m.x < w + 200 && m.y < h + 200);
            if (Math.random() < 0.011 && meteors.length < 3) spawnMeteor();
            draw();
            raf = requestAnimationFrame(tick);
        };

        build();
        if (reduce) draw();
        else raf = requestAnimationFrame(tick);

        const onResize = () => { build(); if (reduce) draw(); };
        window.addEventListener("resize", onResize);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
        };
    }, []);

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
            style={{ background: "radial-gradient(ellipse at 50% 28%, #150f24 0%, #0c0a14 46%, #070509 100%)" }}
        >
            <canvas ref={canvasRef} className="block h-full w-full" />
        </div>
    );
}
