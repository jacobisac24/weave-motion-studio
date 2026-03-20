import { useMemo } from "react";
import type { TangentBoxesConfig } from "./config";
import { defaultTangentBoxesConfig } from "./config";

interface Props {
  progress: number;
  width: number;
  height: number;
  config?: Partial<TangentBoxesConfig>;
}

// ---- Math helpers ----

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4);
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Evaluate cubic bezier at parameter t */
function cubicBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number
): [number, number] {
  const u = 1 - t;
  const uu = u * u;
  const uuu = uu * u;
  const tt = t * t;
  const ttt = tt * t;
  return [
    uuu * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + ttt * p3[0],
    uuu * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + ttt * p3[1],
  ];
}

/** Tangent (derivative) of cubic bezier at parameter t */
function cubicBezierTangent(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number
): [number, number] {
  const u = 1 - t;
  return [
    3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
    3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]),
  ];
}

/** SVG path for a cubic bezier */
function bezierPath(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number]
): string {
  return `M${p0[0]},${p0[1]} C${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`;
}

/** Approximate total length of a cubic bezier */
function bezierLength(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  steps = 64
): number {
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= steps; i++) {
    const pt = cubicBezier(p0, p1, p2, p3, i / steps);
    const dx = pt[0] - prev[0];
    const dy = pt[1] - prev[1];
    length += Math.sqrt(dx * dx + dy * dy);
    prev = pt;
  }
  return length;
}

// ---- Phase boundary builder ----

function buildPhases(p: TangentBoxesConfig["phases"]) {
  const vals = [p.curveDraw, p.pointsGrow, p.boxesFly, p.boxesRotate, p.settle];
  const boundaries: number[] = [];
  let sum = 0;
  for (const v of vals) {
    sum += v;
    boundaries.push(sum);
  }
  return boundaries;
}

// ---- Equally-spaced parameter lookup (arc-length reparametrization) ----

function buildArcLengthTable(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  samples = 200
): { t: number; len: number }[] {
  const table: { t: number; len: number }[] = [{ t: 0, len: 0 }];
  let totalLen = 0;
  let prev = p0;
  for (let i = 1; i <= samples; i++) {
    const param = i / samples;
    const pt = cubicBezier(p0, p1, p2, p3, param);
    const dx = pt[0] - prev[0];
    const dy = pt[1] - prev[1];
    totalLen += Math.sqrt(dx * dx + dy * dy);
    table.push({ t: param, len: totalLen });
    prev = pt;
  }
  return table;
}

function paramAtArcLength(table: { t: number; len: number }[], targetLen: number): number {
  const total = table[table.length - 1].len;
  const target = Math.max(0, Math.min(total, targetLen));
  // Binary search
  let lo = 0;
  let hi = table.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid].len < target) lo = mid;
    else hi = mid;
  }
  const segLen = table[hi].len - table[lo].len;
  const frac = segLen > 0 ? (target - table[lo].len) / segLen : 0;
  return lerp(table[lo].t, table[hi].t, frac);
}

// ---- Component ----

export function TangentBoxesRenderer({ progress, width, height, config: overrides }: Props) {
  const cfg = useMemo(
    () => ({ ...defaultTangentBoxesConfig, ...overrides }),
    [overrides]
  );

  const phases = useMemo(() => buildPhases(cfg.phases), [cfg.phases]);
  const p = clamp01(progress);

  // Define an elegant S-curve
  const pad = width * 0.1;
  const p0: [number, number] = [pad, height * 0.7];
  const p1: [number, number] = [width * 0.35, height * 0.08];
  const p2: [number, number] = [width * 0.65, height * 0.92];
  const p3: [number, number] = [width - pad, height * 0.3];

  const fullPath = bezierPath(p0, p1, p2, p3);
  const totalLength = useMemo(() => bezierLength(p0, p1, p2, p3), [width, height]);

  const arcTable = useMemo(
    () => buildArcLengthTable(p0, p1, p2, p3),
    [width, height]
  );

  // ---- Phase progress ----
  const curveDrawP = clamp01(p / phases[0]);
  const pointsGrowP = clamp01((p - phases[0]) / (phases[1] - phases[0]));
  const boxesFlyP = clamp01((p - phases[1]) / (phases[2] - phases[1]));
  const boxesRotateP = clamp01((p - phases[2]) / (phases[3] - phases[2]));

  // ---- Curve draw ----
  const drawEased = easeInOutCubic(curveDrawP);
  const dashOffset = totalLength * (1 - drawEased);

  // ---- Points along curve (equally distributed) ----
  // Number of visible points grows during pointsGrow phase
  const maxPoints = cfg.pointCount;
  const visibleCount = pointsGrowP > 0
    ? Math.max(1, Math.round(lerp(1, maxPoints, easeOutQuart(pointsGrowP))))
    : 0;

  // Compute point positions & tangent angles
  const pointData = useMemo(() => {
    const totalArcLen = arcTable[arcTable.length - 1].len;
    const data: { pos: [number, number]; angle: number; t: number }[] = [];
    for (let i = 0; i < maxPoints; i++) {
      const frac = maxPoints > 1 ? i / (maxPoints - 1) : 0.5;
      // slight inset so points aren't at the very tips
      const mappedFrac = 0.05 + frac * 0.9;
      const arcLen = mappedFrac * totalArcLen;
      const t = paramAtArcLength(arcTable, arcLen);
      const pos = cubicBezier(p0, p1, p2, p3, t);
      const tan = cubicBezierTangent(p0, p1, p2, p3, t);
      const angle = Math.atan2(tan[1], tan[0]);
      data.push({ pos, angle, t });
    }
    return data;
  }, [width, height, maxPoints]);

  // ---- Corner box position ----
  const boxSize = cfg.boxSize;
  const cornerX = width - pad * 0.6;
  const cornerY = pad * 0.6;

  // ---- Colors ----
  const curveHsl = `hsl(${cfg.curveColor})`;
  const boxHsl = `hsl(${cfg.boxColor})`;
  const indicatorHsl = `hsl(${cfg.indicatorColor})`;

  // ---- Render helper: a single box with direction indicator ----
  const renderBox = (
    cx: number,
    cy: number,
    rotation: number, // radians
    opacity: number,
    scale: number,
    key: string,
    showGlow = false
  ) => {
    const half = boxSize / 2;
    const angleDeg = (rotation * 180) / Math.PI;
    const arrowLen = half * 0.6;
    return (
      <g
        key={key}
        transform={`translate(${cx},${cy}) rotate(${angleDeg})`}
        opacity={opacity}
        filter={showGlow ? "url(#tb-glow)" : undefined}
      >
        {/* Box */}
        <rect
          x={-half}
          y={-half}
          width={boxSize}
          height={boxSize}
          rx={3}
          fill="none"
          stroke={boxHsl}
          strokeWidth={1.5}
        />
        {/* Direction indicator: small arrow pointing up (local up = -Y before rotation) */}
        <line
          x1={0}
          y1={arrowLen * 0.4}
          x2={0}
          y2={-arrowLen}
          stroke={indicatorHsl}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <polyline
          points={`${-arrowLen * 0.4},${-arrowLen * 0.45} 0,${-arrowLen} ${arrowLen * 0.4},${-arrowLen * 0.45}`}
          fill="none"
          stroke={indicatorHsl}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Small center dot */}
        <circle cx={0} cy={0} r={1.5} fill={indicatorHsl} opacity={0.5} />
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      style={{ overflow: "hidden", background: "hsl(220 16% 6%)" }}
    >
      <defs>
        <filter id="tb-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor={boxHsl} floodOpacity="0.3" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="colorBlur" />
          <feMerge>
            <feMergeNode in="colorBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Subtle grid */}
      <g opacity={0.035}>
        {Array.from({ length: Math.floor(width / 60) }, (_, i) => (
          <line
            key={`gv${i}`}
            x1={(i + 1) * 60} y1={0}
            x2={(i + 1) * 60} y2={height}
            stroke={curveHsl} strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: Math.floor(height / 60) }, (_, i) => (
          <line
            key={`gh${i}`}
            x1={0} y1={(i + 1) * 60}
            x2={width} y2={(i + 1) * 60}
            stroke={curveHsl} strokeWidth={0.5}
          />
        ))}
      </g>

      {/* Curve — stroke-dashoffset draw */}
      <path
        d={fullPath}
        fill="none"
        stroke={curveHsl}
        strokeWidth={cfg.strokeWeight}
        strokeLinecap="round"
        strokeDasharray={totalLength}
        strokeDashoffset={dashOffset}
        opacity={0.85}
      />

      {/* Points along curve (small dots) */}
      {pointsGrowP > 0 &&
        pointData.slice(0, visibleCount).map((pt, i) => {
          // staggered fade-in
          const stagger = visibleCount > 1 ? i / (visibleCount - 1) : 0;
          const dotOpacity = clamp01((pointsGrowP - stagger * 0.3) / 0.5);
          return (
            <circle
              key={`dot${i}`}
              cx={pt.pos[0]}
              cy={pt.pos[1]}
              r={3}
              fill={curveHsl}
              opacity={dotOpacity * 0.6}
            />
          );
        })}

      {/* Origin box in corner (fades out as copies leave) */}
      {renderBox(
        cornerX,
        cornerY,
        -Math.PI / 2, // pointing up
        Math.max(0, 1 - boxesFlyP * 0.7),
        1,
        "origin-box"
      )}

      {/* Flying box copies */}
      {boxesFlyP > 0 &&
        pointData.slice(0, maxPoints).map((pt, i) => {
          // Staggered departure
          const stagger = maxPoints > 1 ? i / (maxPoints - 1) : 0;
          const flyLocal = clamp01((boxesFlyP - stagger * 0.4) / 0.6);
          if (flyLocal <= 0) return null;

          const easedFly = easeOutBack(clamp01(flyLocal));

          // Position: lerp from corner to target point
          const cx = lerp(cornerX, pt.pos[0], easedFly);
          const cy = lerp(cornerY, pt.pos[1], easedFly);

          // Rotation: start pointing up (-π/2), rotate to tangent during rotate phase
          const baseAngle = -Math.PI / 2;
          const targetAngle = pt.angle - Math.PI / 2; // tangent direction (adjust so "up" aligns with tangent)

          // Smoothly rotate during the rotate phase (staggered too)
          const rotateLocal = clamp01((boxesRotateP - stagger * 0.3) / 0.7);
          const easedRotate = easeInOutCubic(rotateLocal);

          // Find shortest rotation path
          let angleDiff = targetAngle - baseAngle;
          while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
          while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

          const currentAngle = baseAngle + angleDiff * easedRotate;

          const opacity = clamp01(flyLocal * 3); // quick fade in
          const showGlow = boxesRotateP > 0.5;

          return renderBox(cx, cy, currentAngle, opacity, 1, `box${i}`, showGlow);
        })}
    </svg>
  );
}
