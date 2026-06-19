// components/StarfieldBackground.jsx
// A realistic, slowly-rotating night sky rendered on a single canvas behind the whole app.
// - Deep navy-to-black space (no purple wash).
// - Hundreds of white / blue-white / faint-warm stars that twinkle.
// - A subtle Milky Way "star river": a denser band of faint stars + a soft dusty haze,
//   which turns slowly with the sky (like the real celestial sphere / a spinning Earth).
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

        // Realistic star tints: mostly white, some blue-white, a few warm.
        const TINTS = [
            "255,255,255", "255,255,255", "255,255,255",
            "201,214,255", "182,201,255", "220,230,255",
            "255,244,224", "255,236,210",
        ];

        let w = 0, h = 0, cx = 0, cy = 0, R = 0;
        let stars = [];
        let meteors = [];
        let raf = 0, angle = 0, t = 0;

        // Gaussian-ish helper for clustering the Milky Way band.
        const randn = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;

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
            R = (Math.hypot(w, h) / 2) * 1.18; // overscan so corners stay covered while rotating

            const area = w * h;
            const fieldCount = Math.min(900, Math.max(280, Math.floor(area / 1500)));
            const bandCount = Math.floor(fieldCount * 0.7); // dense star-river

            const mkStar = (rad, ang, sizeMax, brightMax) => ({
                rad, ang,
                size: Math.random() * sizeMax + 0.25,
                base: Math.random() * brightMax + 0.18,
                twPhase: Math.random() * Math.PI * 2,
                twSpeed: Math.random() * 1.3 + 0.35,
                color: TINTS[(Math.random() * TINTS.length) | 0],
            });

            // Uniform background star field.
            const field = Array.from({ length: fieldCount }).map(() => {
                const rad = Math.sqrt(Math.random()) * R;
                const ang = Math.random() * Math.PI * 2;
                return mkStar(rad, ang, 1.1, 0.6);
            });

            // Milky Way band: a diagonal river of faint, tightly-clustered tiny stars.
            const BAND_ANGLE = -0.62; // tilt of the band (radians)
            const ca = Math.cos(BAND_ANGLE), sa = Math.sin(BAND_ANGLE);
            const band = Array.from({ length: bandCount }).map(() => {
                const along = (Math.random() - 0.5) * 2 * R;      // position along the band
                const across = randn() * (R * 0.16);              // tight perpendicular spread
                const x = along * ca - across * sa;
                const y = along * sa + across * ca;
                const rad = Math.hypot(x, y);
                const ang = Math.atan2(y, x);
                return mkStar(rad, ang, 0.7, 0.42);
            });

            stars = field.concat(band);
        };

        const spawnMeteor = () => {
            meteors.push({
                x: Math.random() * w * 0.85 + w * 0.08,
                y: Math.random() * h * 0.3,
                len: Math.random() * 140 + 80,
                speed: Math.random() * 5 + 7,
                ang: Math.PI * (0.16 + Math.random() * 0.14), // heads down-right
                life: 0,
                max: 64,
            });
        };

        // Soft neutral haze along the Milky Way band (very subtle, no purple).
        const drawHaze = () => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle - 0.62);
            ctx.scale(1, 0.22);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
            g.addColorStop(0, "rgba(214,224,255,0.10)");
            g.addColorStop(0.45, "rgba(200,210,235,0.05)");
            g.addColorStop(1, "rgba(180,195,230,0)");
            ctx.globalCompositeOperation = "screen";
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(0, 0, R, R, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        };

        const draw = () => {
            ctx.clearRect(0, 0, w, h);
            drawHaze();

            // Rotating star sphere.
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            for (const s of stars) {
                const tw = 0.62 + 0.38 * Math.sin(t * s.twSpeed + s.twPhase);
                const a = s.base * tw;
                const x = Math.cos(s.ang) * s.rad;
                const y = Math.sin(s.ang) * s.rad;
                if (s.size > 0.95) {
                    ctx.beginPath();
                    ctx.fillStyle = `rgba(${s.color},${a * 0.2})`;
                    ctx.arc(x, y, s.size * 2.4, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.beginPath();
                ctx.fillStyle = `rgba(${s.color},${a})`;
                ctx.arc(x, y, s.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // Shooting stars (screen-space).
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            ctx.lineCap = "round";
            for (const m of meteors) {
                const dx = Math.cos(m.ang), dy = Math.sin(m.ang);
                const x1 = m.x - dx * m.len, y1 = m.y - dy * m.len;
                const fade = 1 - m.life / m.max;
                const grad = ctx.createLinearGradient(x1, y1, m.x, m.y);
                grad.addColorStop(0, "rgba(214,224,255,0)");
                grad.addColorStop(1, `rgba(255,255,255,${0.85 * fade})`);
                ctx.strokeStyle = grad;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(m.x, m.y);
                ctx.stroke();
                ctx.beginPath();
                ctx.fillStyle = `rgba(255,255,255,${0.9 * fade})`;
                ctx.arc(m.x, m.y, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        };

        const tick = () => {
            t += 0.016;
            angle += 0.00022; // slow celestial rotation
            for (const m of meteors) {
                m.x += Math.cos(m.ang) * m.speed;
                m.y += Math.sin(m.ang) * m.speed;
                m.life++;
            }
            meteors = meteors.filter((m) => m.life < m.max && m.x < w + 220 && m.y < h + 220);
            if (Math.random() < 0.012 && meteors.length < 3) spawnMeteor();
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
            style={{ background: "radial-gradient(ellipse at 50% 18%, #0b0f1a 0%, #070a12 45%, #020307 100%)" }}
        >
            <canvas ref={canvasRef} className="block h-full w-full" />
        </div>
    );
}
