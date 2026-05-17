import { useMemo } from "react";
import type { SpiralStaircaseConfig } from "./config";
import { defaultSpiralStaircaseConfig } from "./config";

interface Props {
  progress: number;
  width: number;
  height: number;
  config?: Partial<SpiralStaircaseConfig>;
}

// ---------- math helpers ----------
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// 3D point
type V3 = { x: number; y: number; z: number };
const v = (x: number, y: number, z: number): V3 => ({ x, y, z });

// Isometric-ish projection with adjustable tilt (0 = top-down, 1 = iso)
function project(p: V3, tilt: number, cx: number, cy: number, scale: number) {
  // angle: 0 -> pure top-down (z ignored), 1 -> iso ~30deg
  const a = tilt * (Math.PI / 6);   // x-axis tilt
  const b = tilt * (Math.PI / 6);   // y-axis tilt
  const cosA = Math.cos(a), sinA = Math.sin(a);
  const cosB = Math.cos(b), sinB = Math.sin(b);
  // Rotate around x then project, with z lifted up
  const x1 = p.x * cosB + p.z * sinB;
  const y1 = p.y * cosA - (-p.x * sinB + p.z * cosB) * sinA;
  return { x: cx + x1 * scale, y: cy - y1 * scale };
}

interface Frame {
  /** world position on the curve */
  pos: V3;
  /** tangent (unit, world) */
  tan: V3;
  /** side (perpendicular, in horizontal plane) */
  side: V3;
  /** spiral param 0..1 */
  t: number;
}

function buildSpiral(stepCount: number, turns: number, radius: number, height: number): Frame[] {
  const frames: Frame[] = [];
  for (let i = 0; i < stepCount; i++) {
    const t = i / (stepCount - 1);
    const ang = t * turns * Math.PI * 2;
    const x = Math.cos(ang) * radius;
    const y = Math.sin(ang) * radius;
    const z = t * height;
    // tangent: derivative of (cos, sin, t*h)
    const tx = -Math.sin(ang);
    const ty = Math.cos(ang);
    const tz = 0; // horizontal frames
    const tl = Math.hypot(tx, ty, tz) || 1;
    const tan = v(tx / tl, ty / tl, tz / tl);
    // side = horizontal perpendicular = pointing outward radially
    const side = v(Math.cos(ang), Math.sin(ang), 0);
    frames.push({ pos: v(x, y, z), tan, side, t });
  }
  return frames;
}

// Build a stair tread rectangle (in world space) at a frame
function treadCorners(f: Frame, depth: number, width: number, lift = 0): V3[] {
  // local axes: tan (depth direction), side (width direction)
  const d = depth / 2, w = width / 2;
  const cx = f.pos.x, cy = f.pos.y, cz = f.pos.z + lift;
  return [
    v(cx + f.tan.x * d + f.side.x * w, cy + f.tan.y * d + f.side.y * w, cz),
    v(cx + f.tan.x * d - f.side.x * w, cy + f.tan.y * d - f.side.y * w, cz),
    v(cx - f.tan.x * d - f.side.x * w, cy - f.tan.y * d - f.side.y * w, cz),
    v(cx - f.tan.x * d + f.side.x * w, cy - f.tan.y * d + f.side.y * w, cz),
  ];
}

// Edge-offset frame (left = -1, right = +1)
function offsetFrame(f: Frame, dir: -1 | 1, distance: number): Frame {
  return {
    pos: v(f.pos.x + f.side.x * dir * distance, f.pos.y + f.side.y * dir * distance, f.pos.z),
    tan: f.tan,
    side: f.side,
    t: f.t,
  };
}

export function SpiralStaircaseRenderer({ progress, width, height, config }: Props) {
  const cfg = { ...defaultSpiralStaircaseConfig, ...(config ?? {}) };
  const p = clamp01(progress);

  // ---------- phase mapping ----------
  const ph = cfg.phases;
  const breaks = [
    ph.foundation,
    ph.foundation + ph.treads,
    ph.foundation + ph.treads + ph.extrude,
    ph.foundation + ph.treads + ph.extrude + ph.offset,
    ph.foundation + ph.treads + ph.extrude + ph.offset + ph.railing,
    1,
  ];
  const inPhase = (idx: number) => {
    const start = idx === 0 ? 0 : breaks[idx - 1];
    const end = breaks[idx];
    return clamp01((p - start) / Math.max(0.0001, end - start));
  };
  const s1 = inPhase(0);
  const s2 = inPhase(1);
  const s3 = inPhase(2);
  const s4 = inPhase(3);
  const s5 = inPhase(4);
  const s6 = inPhase(5);

  // ---------- geometry ----------
  const data = useMemo(() => {
    const radius = 1.0;
    // height grows from flat (S1/S2) to full during S3 onward
    const heightWorld = 1.6;
    const frames = buildSpiral(cfg.stepCount, cfg.turns, radius, 1); // unit z; scale later
    return { frames, radius, heightWorld };
  }, [cfg.stepCount, cfg.turns]);

  // Camera tilt: top-down for S1/S2; iso for S3+
  const tilt = easeInOutCubic(clamp01((p - breaks[1]) / Math.max(0.0001, breaks[2] - breaks[1])));
  // Vertical scaling (the spiral "gains height")
  const zScale = data.heightWorld * tilt;

  // World->view scale
  const baseScale = Math.min(width, height) * 0.28;

  // For S4 the camera looks "almost straight down" again — interpolate back
  const camSquash =
    s4 > 0 && s4 < 1 ? easeInOutCubic(s4) * 0.45 : (p >= breaks[3] ? 0.45 : 0);
  const effTilt = Math.max(0, tilt - camSquash * 0.6);
  const effScale = baseScale * (1 + 0.05 * tilt);

  const cx = width * 0.5;
  const cy = height * 0.58;

  // Project helper bound to camera
  const proj = (pt: V3) => {
    const pp = v(pt.x, pt.y, pt.z * zScale);
    return project(pp, effTilt, cx, cy, effScale);
  };

  // ---------- spiral curve drawing ----------
  const curvePts: V3[] = [];
  const curveSamples = 220;
  for (let i = 0; i <= curveSamples; i++) {
    const t = i / curveSamples;
    const ang = t * cfg.turns * Math.PI * 2;
    curvePts.push(v(Math.cos(ang) * data.radius, Math.sin(ang) * data.radius, t));
  }
  // S1: progressive drawing 0..1
  const curveDraw = easeOutQuart(s1);
  const lastVisibleIdx = Math.floor(curveDraw * curveSamples);
  const curvePath = (() => {
    let d = "";
    for (let i = 0; i <= lastVisibleIdx; i++) {
      const pr = proj(curvePts[i]);
      d += (i === 0 ? "M" : "L") + pr.x.toFixed(2) + "," + pr.y.toFixed(2);
    }
    return d;
  })();

  // ---------- frames pop-in along curve (S1 second half) ----------
  const frames = data.frames;
  const framesAppear = frames.map((_, i) => {
    // appear after curve reaches each frame's t
    const target = (i + 0.5) / frames.length;
    const local = clamp01((s1 - target * 0.7) / 0.25);
    return easeOutBack(local);
  });

  // Tread profile growth (S2): rectangles draw centered, width then depth
  const treadDepth = 0.18;
  const treadWidth = 0.42;
  const treadGrow = easeOutQuart(s2);

  // S3 extrusion: tread becomes box (height)
  const treadH = 0.06;
  const extrude = easeOutQuart(s3);

  // S4 focus stair index
  const focusIdx = Math.floor(frames.length * 0.5);
  const offsetDist = treadWidth / 2;
  // arrow growth
  const arrowGrow = easeOutQuart(s4);

  // S5 railing posts
  const postH = 0.32;
  const postProfile = 0.06;
  const railingDraw = easeOutQuart(s5);

  // S6 parametric wiggle
  const wiggle = Math.sin(s6 * Math.PI * 2) * 0.04 * (1 - s6 * 0.5);

  // ---------- color helpers ----------
  const hsl = (token: string, a = 1) => `hsl(${token} / ${a})`;

  // ---------- render frame helper ----------
  // tiny coordinate plane glyph (similar style to twisted torus planes — small disc + crosshair axes)
  const renderPlane = (f: Frame, key: string, opacity: number, scale = 1) => {
    if (opacity <= 0.01) return null;
    const c = proj(f.pos);
    const tipTan = proj(v(f.pos.x + f.tan.x * 0.12 * scale, f.pos.y + f.tan.y * 0.12 * scale, f.pos.z));
    const tipSide = proj(v(f.pos.x + f.side.x * 0.12 * scale, f.pos.y + f.side.y * 0.12 * scale, f.pos.z));
    // small horizontal plane quad
    const corners = treadCorners(f, 0.18 * scale, 0.18 * scale);
    const cp = corners.map(proj);
    const quad = `M${cp[0].x},${cp[0].y} L${cp[1].x},${cp[1].y} L${cp[2].x},${cp[2].y} L${cp[3].x},${cp[3].y} Z`;
    return (
      <g key={key} opacity={opacity}>
        <path d={quad} fill={hsl(cfg.planeColor, 0.08)} stroke={hsl(cfg.planeColor, 0.55)} strokeWidth={1} />
        {/* X axis (tangent) - red-ish but using accent palette */}
        <line x1={c.x} y1={c.y} x2={tipTan.x} y2={tipTan.y} stroke={hsl(cfg.treadColor, 0.9)} strokeWidth={1.5} />
        {/* Y axis (side) */}
        <line x1={c.x} y1={c.y} x2={tipSide.x} y2={tipSide.y} stroke={hsl(cfg.vectorColor, 0.9)} strokeWidth={1.5} />
        <circle cx={c.x} cy={c.y} r={2.2} fill={hsl(cfg.planeColor, 1)} />
      </g>
    );
  };

  const renderTreadFlat = (f: Frame, grow: number, key: string, alpha = 1) => {
    if (grow <= 0.01) return null;
    const w = treadWidth * Math.min(1, grow * 1.4);
    const d = treadDepth * Math.max(0, Math.min(1, (grow - 0.4) / 0.6));
    if (w <= 0) return null;
    const corners = treadCorners(f, Math.max(0.01, d), w).map(proj);
    return (
      <path
        key={key}
        d={`M${corners[0].x},${corners[0].y} L${corners[1].x},${corners[1].y} L${corners[2].x},${corners[2].y} L${corners[3].x},${corners[3].y} Z`}
        fill={hsl(cfg.treadColor, 0.22 * alpha)}
        stroke={hsl(cfg.treadColor, 0.95 * alpha)}
        strokeWidth={1.6}
      />
    );
  };

  const renderBox = (
    f: Frame,
    depth: number,
    widthW: number,
    h: number,
    fillToken: string,
    strokeAlpha: number,
    key: string,
    wire = false,
  ) => {
    if (h <= 0) return null;
    const bottom = treadCorners(f, depth, widthW, 0).map(proj);
    const top = treadCorners({ ...f, pos: v(f.pos.x, f.pos.y, f.pos.z) }, depth, widthW, h).map(proj);
    const sideQuads = [0, 1, 2, 3].map((i) => {
      const j = (i + 1) % 4;
      return `M${bottom[i].x},${bottom[i].y} L${bottom[j].x},${bottom[j].y} L${top[j].x},${top[j].y} L${top[i].x},${top[i].y} Z`;
    });
    const topPath = `M${top[0].x},${top[0].y} L${top[1].x},${top[1].y} L${top[2].x},${top[2].y} L${top[3].x},${top[3].y} Z`;
    if (wire) {
      return (
        <g key={key} opacity={0.85}>
          {sideQuads.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={hsl(fillToken, 0.55)} strokeWidth={1} strokeDasharray="3 3" />
          ))}
          <path d={topPath} fill="none" stroke={hsl(fillToken, 0.7)} strokeWidth={1.2} />
        </g>
      );
    }
    return (
      <g key={key}>
        {sideQuads.map((d, i) => (
          <path key={i} d={d} fill={hsl(fillToken, 0.18)} stroke={hsl(fillToken, strokeAlpha)} strokeWidth={1.2} />
        ))}
        <path d={topPath} fill={hsl(fillToken, 0.32)} stroke={hsl(fillToken, strokeAlpha)} strokeWidth={1.5} />
      </g>
    );
  };

  // Determine current scene label
  const labels: { text: string; visible: number }[] = [
    { text: "Step 1 · Horizontal Frames along the Path", visible: s1 > 0.05 && s1 < 1 ? 1 : 0 },
    { text: "Step 2 · Profile (The Treads)", visible: s2 > 0.05 && s2 < 1 ? 1 : 0 },
    { text: "Step 3 · Extrude to Solid", visible: s3 > 0.05 && s3 < 1 ? 1 : 0 },
    { text: "Step 4 · Shift the Planes (Left & Right)", visible: s4 > 0.05 && s4 < 1 ? 1 : 0 },
    { text: "Step 5 · Vertical Posts (Railing)", visible: s5 > 0.05 && s5 < 1 ? 1 : 0 },
    { text: "Combine Logic & Vectors · Your Turn", visible: s6 > 0.05 ? 1 : 0 },
  ];

  // ---------- rendering order: back-to-front by projected z, simple depth via frame index when iso ----------
  const orderedIdx = frames.map((_, i) => i).sort((a, b) => frames[a].pos.z - frames[b].pos.z);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: "hsl(220 30% 8%)", display: "block" }}
    >
      <defs>
        <pattern id="ss-grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M60 0H0V60" fill="none" stroke="hsl(220 25% 30%)" strokeWidth="1" strokeDasharray="2 4" opacity="0.06" />
        </pattern>
        <radialGradient id="ss-vignette" cx="50%" cy="55%" r="70%">
          <stop offset="60%" stopColor="hsl(220 30% 8%)" stopOpacity="0" />
          <stop offset="100%" stopColor="hsl(220 40% 4%)" stopOpacity="0.7" />
        </radialGradient>
      </defs>
      <rect width={width} height={height} fill="url(#ss-grid)" />

      {/* Spiral curve */}
      <path
        d={curvePath}
        fill="none"
        stroke={hsl(cfg.curveColor, 0.95)}
        strokeWidth={cfg.strokeWeight}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* === Stairs / boxes === */}
      {orderedIdx.map((i) => {
        const f = { ...frames[i], pos: { ...frames[i].pos, z: frames[i].pos.z + wiggle * 0.2 } };
        const appear = framesAppear[i];
        // plane visibility
        const planeOpacity = clamp01(appear) * (s6 < 0.4 ? 1 : 1 - (s6 - 0.4) / 0.6);
        const isFocus = i === focusIdx;
        const showWireForFocus = s4 > 0.1 && s4 < 1 && isFocus;

        // Tread state
        let treadGrowI = 0;
        if (p < breaks[1]) treadGrowI = 0;
        else if (p < breaks[2]) treadGrowI = treadGrow;
        else treadGrowI = 1;

        // Extrusion height
        let h = 0;
        if (p >= breaks[2]) h = treadH * extrude;
        if (p >= breaks[3]) h = treadH;
        // s6 wiggle width
        const widthFactor = 1 + (s6 > 0 ? wiggle : 0);

        return (
          <g key={`stair-${i}`}>
            {planeOpacity > 0.01 && renderPlane(f, `plane-${i}`, planeOpacity)}
            {/* flat tread (before extrude) */}
            {p < breaks[2] && renderTreadFlat(f, treadGrowI, `flat-${i}`)}
            {/* extruded box */}
            {h > 0 && !showWireForFocus &&
              renderBox(f, treadDepth, treadWidth * widthFactor, h, cfg.treadColor, 0.9, `box-${i}`)}
            {h > 0 && showWireForFocus &&
              renderBox(f, treadDepth, treadWidth * widthFactor, h, cfg.treadColor, 0.9, `boxW-${i}`, true)}
          </g>
        );
      })}

      {/* === Scene 4: offset arrows + new edge planes on focus stair === */}
      {s4 > 0.02 && (() => {
        const f = frames[focusIdx];
        const center = proj(f.pos);
        const left = proj(v(f.pos.x - f.side.x * offsetDist * arrowGrow, f.pos.y - f.side.y * offsetDist * arrowGrow, f.pos.z));
        const right = proj(v(f.pos.x + f.side.x * offsetDist * arrowGrow, f.pos.y + f.side.y * offsetDist * arrowGrow, f.pos.z));
        const arrowHead = (from: { x: number; y: number }, to: { x: number; y: number }, k: string) => {
          if (arrowGrow < 0.99) return null;
          const ang = Math.atan2(to.y - from.y, to.x - from.x);
          const sz = 7;
          const a1x = to.x - Math.cos(ang - Math.PI / 7) * sz;
          const a1y = to.y - Math.sin(ang - Math.PI / 7) * sz;
          const a2x = to.x - Math.cos(ang + Math.PI / 7) * sz;
          const a2y = to.y - Math.sin(ang + Math.PI / 7) * sz;
          return <path key={k} d={`M${to.x},${to.y} L${a1x},${a1y} L${a2x},${a2y} Z`} fill={hsl(cfg.vectorColor, 1)} />;
        };
        const leftFrame = offsetFrame(f, -1, offsetDist * arrowGrow);
        const rightFrame = offsetFrame(f, 1, offsetDist * arrowGrow);
        return (
          <g>
            <line x1={center.x} y1={center.y} x2={left.x} y2={left.y} stroke={hsl(cfg.vectorColor, 1)} strokeWidth={2.5} />
            <line x1={center.x} y1={center.y} x2={right.x} y2={right.y} stroke={hsl(cfg.vectorColor, 1)} strokeWidth={2.5} />
            {arrowHead(center, left, "ah-l")}
            {arrowHead(center, right, "ah-r")}
            {arrowGrow > 0.4 && renderPlane(leftFrame, "lp", clamp01((arrowGrow - 0.4) / 0.6) * (1 - (s5 > 0.4 ? clamp01((s5 - 0.4) / 0.6) : 0)), 0.7)}
            {arrowGrow > 0.4 && renderPlane(rightFrame, "rp", clamp01((arrowGrow - 0.4) / 0.6) * (1 - (s5 > 0.4 ? clamp01((s5 - 0.4) / 0.6) : 0)), 0.7)}
          </g>
        );
      })()}

      {/* === Scene 5 & beyond: railing posts at every stair edge === */}
      {p >= breaks[3] && frames.map((f, i) => {
        const startReveal = i / frames.length;
        const local = clamp01((railingDraw - startReveal * 0.6) / 0.4);
        const h = postH * (p >= breaks[4] ? 1 : local);
        if (h <= 0.001) return null;
        const lf = offsetFrame(f, -1, offsetDist);
        const rf = offsetFrame(f, 1, offsetDist);
        return (
          <g key={`rail-${i}`}>
            {renderBox(lf, postProfile, postProfile, h, cfg.postColor, 0.85, `lp-${i}`)}
            {renderBox(rf, postProfile, postProfile, h, cfg.postColor, 0.85, `rp-${i}`)}
          </g>
        );
      })}

      {/* Vignette */}
      <rect width={width} height={height} fill="url(#ss-vignette)" pointerEvents="none" />

      {/* === Text overlays === */}
      {labels.map((l, i) =>
        l.visible > 0 ? (
          <g key={`lbl-${i}`} opacity={0.95}>
            <text
              x={width / 2}
              y={height * 0.08}
              textAnchor="middle"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fontSize={Math.max(13, width * 0.014)}
              fill={hsl(cfg.curveColor, 0.95)}
              letterSpacing="0.08em"
            >
              {l.text.toUpperCase()}
            </text>
          </g>
        ) : null
      )}

      {/* Final central headline during S6 */}
      {s6 > 0.15 && (
        <g opacity={easeInOutCubic(clamp01((s6 - 0.15) / 0.5))}>
          <text
            x={width / 2}
            y={height * 0.5}
            textAnchor="middle"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize={Math.max(22, width * 0.028)}
            fontWeight={600}
            fill={hsl(cfg.curveColor, 0.98)}
            letterSpacing="0.04em"
          >
            COMBINE LOGIC &amp; VECTORS
          </text>
          <text
            x={width / 2}
            y={height * 0.5 + Math.max(28, width * 0.034)}
            textAnchor="middle"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize={Math.max(13, width * 0.016)}
            fill={hsl(cfg.treadColor, 0.95)}
            letterSpacing="0.3em"
          >
            YOUR TURN
          </text>
        </g>
      )}
    </svg>
  );
}
