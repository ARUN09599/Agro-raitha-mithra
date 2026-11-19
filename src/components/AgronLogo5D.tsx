import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

export type LogoMood = 'idle' | 'listening' | 'thinking' | 'speaking';

interface AgronLogo5DProps {
  size?: number;
  mood?: LogoMood;
  micLevel?: number;
  interactive?: boolean;
  className?: string;
}

interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

// 4D Tesseract (Hypercube) vertices projected for the outer protective lattice
const TESSERACT_VERTS: Vec4[] = [];
for (let i = 0; i < 16; i++) {
  TESSERACT_VERTS.push({
    x: i & 1 ? 1 : -1,
    y: i & 2 ? 1 : -1,
    z: i & 4 ? 1 : -1,
    w: i & 8 ? 1 : -1,
  });
}

const TESSERACT_EDGES: Array<[number, number]> = [];
for (let i = 0; i < 16; i++) {
  for (let bit = 0; bit < 4; bit++) {
    const j = i ^ (1 << bit);
    if (i < j) TESSERACT_EDGES.push([i, j]);
  }
}

// Inner 16-cell (Cross-Polytope / Harvest Grain Octa-Diamond in 4D)
const CROSS_VERTS: Vec4[] = [
  { x: 1.25, y: 0, z: 0, w: 0 },
  { x: -1.25, y: 0, z: 0, w: 0 },
  { x: 0, y: 1.25, z: 0, w: 0 },
  { x: 0, y: -1.25, z: 0, w: 0 },
  { x: 0, y: 0, z: 1.25, w: 0 },
  { x: 0, y: 0, z: -1.25, w: 0 },
  { x: 0, y: 0, z: 0, w: 1.25 },
  { x: 0, y: 0, z: 0, w: -1.25 },
];

const CROSS_EDGES: Array<[number, number]> = [];
for (let i = 0; i < CROSS_VERTS.length; i++) {
  for (let j = i + 1; j < CROSS_VERTS.length; j++) {
    // Connect all non-opposite vertices to form 24 triangular 4D crystal edges
    if (Math.floor(i / 2) !== Math.floor(j / 2)) {
      CROSS_EDGES.push([i, j]);
    }
  }
}

export const AgronLogo5D: React.FC<AgronLogo5DProps> = ({
  size = 38,
  mood = 'idle',
  micLevel = 0,
  interactive = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prefersReduced = useReducedMotion();

  const stateRef = useRef({
    mood,
    micLevel,
    pointerX: 0,
    pointerY: 0,
    hovering: false,
    burst: 0,
  });

  stateRef.current.mood = mood;
  stateRef.current.micLevel = micLevel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let phase = 0;
    let lastTs = performance.now();

    const project4Dto2D = (
      v: Vec4,
      axw: number,
      azw: number,
      axy: number,
      ayz: number,
      scale: number,
      cx: number,
      cy: number
    ) => {
      // 4D Rotation XW
      const cXW = Math.cos(axw);
      const sXW = Math.sin(axw);
      const x1 = v.x * cXW - v.w * sXW;
      const w1 = v.x * sXW + v.w * cXW;

      // 4D Rotation ZW
      const cZW = Math.cos(azw);
      const sZW = Math.sin(azw);
      const z1 = v.z * cZW - w1 * sZW;
      const w2 = v.z * sZW + w1 * cZW;

      // Stereographic 4D -> 3D projection
      const wDist = 2.8;
      const factor4 = wDist / Math.max(0.7, wDist - w2 * 0.72);
      const x3 = x1 * factor4;
      const y3 = v.y * factor4;
      const z3 = z1 * factor4;

      // 3D Rotation YZ (pointer pitch)
      const cYZ = Math.cos(ayz);
      const sYZ = Math.sin(ayz);
      const y4 = y3 * cYZ - z3 * sYZ;
      const z4 = y3 * sYZ + z3 * cYZ;

      // 3D Rotation XY (pointer yaw + subtle roll)
      const cXY = Math.cos(axy);
      const sXY = Math.sin(axy);
      const x5 = x3 * cXY - y4 * sXY;
      const y5 = x3 * sXY + y4 * cXY;

      // Perspective 3D -> 2D projection
      const camZ = 4.0;
      const persp = camZ / Math.max(1.0, camZ - z4 * 0.55);
      return {
        x: cx + x5 * scale * persp,
        y: cy + y5 * scale * persp,
        depth: z4 + w2 * 0.35,
        persp,
      };
    };

    const drawFrame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const targetPx = Math.round(size * dpr);
      if (canvas.width !== targetPx || canvas.height !== targetPx) {
        canvas.width = targetPx;
        canvas.height = targetPx;
      }

      const st = stateRef.current;
      st.burst = Math.max(0, st.burst - dt * 1.8);
      const energy =
        st.mood === 'listening'
          ? 0.45 + Math.min(1, st.micLevel / 100) * 1.4
          : st.mood === 'thinking'
          ? 1.5
          : st.mood === 'speaking'
          ? 1.15
          : st.hovering
          ? 0.85
          : 0.42;

      if (!prefersReduced) {
        phase += dt * (0.75 + energy * 0.85 + st.burst * 2.5);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const baseRadius = size * 0.42;

      // 5th Dimension: Ambient Harmonic Aura Disc
      const auraGrad = ctx.createRadialGradient(
        cx + st.pointerX * 4,
        cy + st.pointerY * 4,
        size * 0.04,
        cx,
        cy,
        size * 0.49
      );
      auraGrad.addColorStop(0, 'rgba(22, 101, 52, 0.16)');
      auraGrad.addColorStop(0.58, 'rgba(217, 119, 6, 0.08)');
      auraGrad.addColorStop(1, 'rgba(22, 101, 52, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.49, 0, Math.PI * 2);
      ctx.fill();

      // 5D Acoustic / Energy Ripple Ring when active or triggered
      if (!prefersReduced && (st.mood !== 'idle' || st.burst > 0.05)) {
        const rippleProgress = (phase * 0.55) % 1;
        const rippleR = baseRadius * (0.68 + rippleProgress * 0.42);
        const rippleAlpha = (1 - rippleProgress) * (st.mood === 'idle' ? st.burst * 0.5 : 0.45);
        ctx.strokeStyle =
          st.mood === 'thinking'
            ? `rgba(217, 119, 6, ${rippleAlpha.toFixed(3)})`
            : `rgba(22, 101, 52, ${rippleAlpha.toFixed(3)})`;
        ctx.lineWidth = Math.max(1, size * 0.028);
        ctx.beginPath();
        ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
        ctx.stroke();
      }

      const axw = phase * 0.72 + st.pointerX * 0.9;
      const azw = phase * 0.54 + st.pointerY * 0.9;
      const axy = phase * 0.38 + st.pointerX * 0.5;
      const ayz = 0.48 + Math.sin(phase * 0.6) * 0.25 + st.pointerY * 0.75;

      const scaleOuter = baseRadius * (0.42 + st.burst * 0.06);
      const outerPts = TESSERACT_VERTS.map((v) =>
        project4Dto2D(v, axw, azw, axy, ayz, scaleOuter, cx, cy)
      );

      // Draw outer 4D Tesseract protective field sorted slightly by depth
      const lineBase = Math.max(0.75, size * 0.022);
      for (const [i, j] of TESSERACT_EDGES) {
        const a = outerPts[i];
        const b = outerPts[j];
        const avgDepth = (a.depth + b.depth) * 0.5;
        const alpha = Math.min(0.88, Math.max(0.16, 0.44 + avgDepth * 0.22));
        ctx.strokeStyle = `rgba(22, 101, 52, ${alpha.toFixed(3)})`;
        ctx.lineWidth = lineBase * Math.max(0.65, (a.persp + b.persp) * 0.45);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Draw inner 4D Harvest-Gold 16-Cell Crystal (counter-rotating in 4D!)
      const scaleInner =
        baseRadius *
        (0.32 +
          (st.mood === 'listening'
            ? Math.min(1, st.micLevel / 100) * 0.09
            : Math.sin(phase * 1.8) * 0.02));
      const innerPts = CROSS_VERTS.map((v) =>
        project4Dto2D(v, -axw * 1.25, azw * 1.15, -axy * 0.8, ayz + 0.3, scaleInner, cx, cy)
      );

      for (const [i, j] of CROSS_EDGES) {
        const a = innerPts[i];
        const b = innerPts[j];
        const avgDepth = (a.depth + b.depth) * 0.5;
        const alpha = Math.min(0.9, Math.max(0.22, 0.55 + avgDepth * 0.2));
        ctx.strokeStyle = `rgba(217, 119, 6, ${alpha.toFixed(3)})`;
        ctx.lineWidth = Math.max(0.65, lineBase * 0.85);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Luminous Fibonacci Seed Nodes on Cross-Polytope Vertices
      for (const pt of innerPts) {
        const r = Math.max(1.2, size * 0.034 * pt.persp);
        ctx.fillStyle = pt.depth >= 0 ? '#D97706' : 'rgba(217, 119, 6, 0.55)';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Center Sculpted Sprouting Leaf-Prism Core (Anchored Agronomy Heart)
      const leafBreath = prefersReduced ? 1 : 1 + Math.sin(phase * 2.2) * 0.045 + st.burst * 0.08;
      const leafTilt = prefersReduced ? 0 : Math.sin(phase * 1.1) * 0.08 + st.pointerX * 0.25;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(leafTilt);
      ctx.scale(leafBreath, leafBreath);

      const L = size * 0.19;
      // Left sprouting leaf
      ctx.fillStyle = '#14532D';
      ctx.beginPath();
      ctx.moveTo(0, L * 0.85);
      ctx.quadraticCurveTo(-L * 1.05, L * 0.15, -L * 0.58, -L * 0.72);
      ctx.quadraticCurveTo(0, -L * 0.25, 0, L * 0.85);
      ctx.fill();

      // Right sunlit leaf
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.moveTo(0, L * 0.85);
      ctx.quadraticCurveTo(L * 1.05, L * 0.05, L * 0.68, -L * 0.82);
      ctx.quadraticCurveTo(0, -L * 0.3, 0, L * 0.85);
      ctx.fill();

      // Golden central grain drop / meridian vein
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(0, -L * 0.55);
      ctx.lineTo(L * 0.22, L * 0.12);
      ctx.lineTo(0, L * 0.58);
      ctx.lineTo(-L * 0.22, L * 0.12);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      if (!prefersReduced) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    if (prefersReduced) {
      drawFrame(performance.now());
    } else {
      rafId = requestAnimationFrame(drawFrame);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [size, prefersReduced]);

  return (
    <span
      onPointerMove={(e) => {
        if (!interactive) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        stateRef.current.hovering = true;
        stateRef.current.pointerX = (e.clientX - rect.left) / rect.width - 0.5;
        stateRef.current.pointerY = (e.clientY - rect.top) / rect.height - 0.5;
      }}
      onPointerLeave={() => {
        stateRef.current.hovering = false;
        stateRef.current.pointerX = 0;
        stateRef.current.pointerY = 0;
      }}
      onClick={() => {
        if (interactive) stateRef.current.burst = 1;
      }}
      className={`inline-flex items-center justify-center shrink-0 select-none ${
        interactive ? 'cursor-pointer' : ''
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    </span>
  );
};
