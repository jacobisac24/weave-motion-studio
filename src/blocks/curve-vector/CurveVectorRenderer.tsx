import { useMemo } from "react";
import type { CurveVectorConfig } from "./config";
import { defaultCurveVectorConfig } from "./config";

interface Props {
  progress: number;
  width: number;
  height: number;
  config?: Partial<CurveVectorConfig>;
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

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Evaluate a cubic bezier at parameter t */
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

/** Build SVG path data for a cubic bezier */
function bezierPath(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number]
): string {
  return `M${p0[0]},${p0[1]} C${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`;
}

/** Approximate the total length of a cubic bezier */
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

function dist(a: [number, number], b: [number, number]) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// ---- Phase boundary builder ----

function buildPhases(p: CurveVectorConfig["phases"]) {
  const vals = [p.curveDraw, p.pointsAppear, p.vectorAppear, p.converge, p.settle];
  const boundaries: number[] = [];
  let sum = 0;
  for (const v of vals) {
    sum += v;
    boundaries.push(sum);
  }
  return boundaries;
}

// ---- Component ----

export function CurveVectorRenderer({ progress, width, height, config: overrides }: Props) {
  const cfg = useMemo(
    () => ({ ...defaultCurveVectorConfig, ...overrides }),
    [overrides]
  );

  const phases = useMemo(() => buildPhases(cfg.phases), [cfg.phases]);
  const p = clamp01(progress);

  // Define a graceful S-curve across the canvas
  const pad = width * 0.1;
  const p0: [number, number] = [pad, height * 0.62];
  const p1: [number, number] = [width * 0.3, height * 0.12];
  const p2: [number, number] = [width * 0.7, height * 0.88];
  const p3: [number, number] = [width - pad, height * 0.38];

  const fullPath = bezierPath(p0, p1, p2, p3);
  const totalLength = useMemo(() => bezierLength(p0, p1, p2, p3), [width, height]);

  // ---- Phase progress ----
  const curveDrawP = clamp01(p / phases[0]);
  const pointsP = clamp01((p - phases[0]) / (phases[1] - phases[0]));
  const vectorP = clamp01((p - phases[1]) / (phases[2] - phases[1]));
  // Hold: pause after vector creation before convergence
  const holdEnd = phases[2] + cfg.phases.settle * 0.6;
  const convergeP = clamp01((p - holdEnd) / (phases[3] - holdEnd));

  // ---- Curve draw animation ----
  const drawProgress = easeInOutCubic(curveDrawP);
  const dashOffset = totalLength * (1 - drawProgress);

  // ---- Point positions along the curve ----
  const startA = 0.2;
  const startB = 0.8;
  const meetPoint = 0.5;

  const easedConverge = easeInOutQuad(convergeP);
  const tA = lerp(startA, meetPoint, easedConverge);
  const tB = lerp(startB, meetPoint, easedConverge);

  const posA = cubicBezier(p0, p1, p2, p3, tA);
  const posB = cubicBezier(p0, p1, p2, p3, tB);

  const showPoints = p >= phases[0];
  const showVector = p >= phases[1];

  const pointScale = easeOutQuart(pointsP);
  const vectorOpacity = easeOutQuart(vectorP);

  // Distance for label
  const distance = dist(posA, posB);
  const midX = (posA[0] + posB[0]) / 2;
  const midY = (posA[1] + posB[1]) / 2;

  // Vector direction (A → B) — FIXED length, only direction changes
  const angle = Math.atan2(posB[1] - posA[1], posB[0] - posA[0]);
  const dxDir = Math.cos(angle);
  const dyDir = Math.sin(angle);

  // Fixed extension beyond each point — consistent length
  const extLen = Math.min(width, height) * 0.15;
  const margin = 20;
  const clampX = (v: number) => Math.max(margin, Math.min(width - margin, v));
  const clampY = (v: number) => Math.max(margin, Math.min(height - margin, v));

  // Vector extends beyond A (tail) and beyond B (head/arrow)
  const vecTail: [number, number] = [
    clampX(posA[0] - dxDir * extLen),
    clampY(posA[1] - dyDir * extLen),
  ];
  const vecHead: [number, number] = [
    clampX(posB[0] + dxDir * extLen),
    clampY(posB[1] + dyDir * extLen),
  ];

  // Animate vector creation: sweeps outward from midpoint of A-B
  const vectorDrawP = easeInOutCubic(vectorP);
  // Tail grows from midpoint toward vecTail
  const drawnTailX = lerp(midX, vecTail[0], vectorDrawP);
  const drawnTailY = lerp(midY, vecTail[1], vectorDrawP);
  // Head grows from midpoint toward vecHead
  const drawnHeadX = lerp(midX, vecHead[0], vectorDrawP);
  const drawnHeadY = lerp(midY, vecHead[1], vectorDrawP);

  const accentHsl = `hsl(${cfg.accentColor})`;
  const pointHsl = `hsl(${cfg.pointColor})`;
  const vectorHsl = `hsl(${cfg.vectorColor})`;
  const dimVectorHsl = `hsl(${cfg.vectorColor} / 0.25)`;

  const arrowSize = 8;

  // Distance label
  const maxDist = useMemo(() => dist(
    cubicBezier(p0, p1, p2, p3, startA),
    cubicBezier(p0, p1, p2, p3, startB)
  ), [width, height]);
  const distRatio = distance / maxDist;

  // Glow intensity increases as distance shrinks
  const glowIntensity = showVector ? (1 - distRatio) * 0.7 : 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      style={{ overflow: "hidden", background: "hsl(220 16% 6%)" }}
    >
      <defs>
        {/* Glow filter for convergence emphasis */}
        <filter id="cv-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="cv-point-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Subtle grid */}
      <g opacity={0.04}>
        {Array.from({ length: Math.floor(width / 60) }, (_, i) => (
          <line
            key={`gv${i}`}
            x1={(i + 1) * 60}
            y1={0}
            x2={(i + 1) * 60}
            y2={height}
            stroke={pointHsl}
            strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: Math.floor(height / 60) }, (_, i) => (
          <line
            key={`gh${i}`}
            x1={0}
            y1={(i + 1) * 60}
            x2={width}
            y2={(i + 1) * 60}
            stroke={pointHsl}
            strokeWidth={0.5}
          />
        ))}
      </g>

      {/* Curve — drawn with stroke-dashoffset */}
      <path
        d={fullPath}
        fill="none"
        stroke={accentHsl}
        strokeWidth={cfg.strokeWeight}
        strokeLinecap="round"
        strokeDasharray={totalLength}
        strokeDashoffset={dashOffset}
        opacity={0.9}
      />

      {/* Ghost of full curve (very dim, appears after draw) */}
      {curveDrawP >= 1 && (
        <path
          d={fullPath}
          fill="none"
          stroke={accentHsl}
          strokeWidth={cfg.strokeWeight * 0.4}
          strokeLinecap="round"
          opacity={0.08}
        />
      )}

      {/* Vector line between points */}
      {showVector && (
        <g opacity={vectorOpacity}>
          {/* Extended tangent line (dim, shows full direction) */}
          {vectorDrawP >= 1 && (
            <line
              x1={tangentStart[0]}
              y1={tangentStart[1]}
              x2={tangentEnd[0]}
              y2={tangentEnd[1]}
              stroke={dimVectorHsl}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}
          {/* Animated vector sweep: grows from tangentStart → tangentEnd */}
          <line
            x1={tangentStart[0]}
            y1={tangentStart[1]}
            x2={drawnTipX}
            y2={drawnTipY}
            stroke={vectorHsl}
            strokeWidth={2}
            strokeLinecap="round"
            filter={glowIntensity > 0.2 ? "url(#cv-glow)" : undefined}
          />
          {/* Solid segment A→B on top */}
          {vectorDrawP >= 1 && (
            <line
              x1={posA[0]}
              y1={posA[1]}
              x2={posB[0]}
              y2={posB[1]}
              stroke={vectorHsl}
              strokeWidth={2.5}
              strokeLinecap="round"
              filter={glowIntensity > 0.2 ? "url(#cv-glow)" : undefined}
            />
          )}
          {/* Arrowhead at the extended tip */}
          {distance > 12 && vectorDrawP >= 1 && (
            <polygon
              points={`0,0 ${-arrowSize * 2},${-arrowSize} ${-arrowSize * 2},${arrowSize}`}
              fill={vectorHsl}
              transform={`translate(${tangentEnd[0]},${tangentEnd[1]}) rotate(${(angle * 180) / Math.PI})`}
            />
          )}
        </g>
      )}

      {/* Distance label */}
      {showVector && (
        <g opacity={vectorOpacity * 0.9}>
          {/* Background pill */}
          <rect
            x={midX - 32}
            y={midY - 26}
            width={64}
            height={20}
            rx={10}
            fill="hsl(220 16% 10%)"
            stroke={`hsl(${cfg.vectorColor} / ${0.15 + glowIntensity * 0.4})`}
            strokeWidth={1}
          />
          <text
            x={midX}
            y={midY - 12}
            textAnchor="middle"
            fill={vectorHsl}
            fontSize={11}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={600}
            letterSpacing="0.02em"
          >
            {distance < 8 ? "≈ 0" : `d=${Math.round(distance)}`}
          </text>
        </g>
      )}

      {/* Points */}
      {showPoints && (
        <>
          {/* Point A */}
          <g filter="url(#cv-point-glow)">
            <circle
              cx={posA[0]}
              cy={posA[1]}
              r={cfg.pointRadius * pointScale}
              fill={pointHsl}
              opacity={pointScale}
            />
            {/* Outer ring */}
            <circle
              cx={posA[0]}
              cy={posA[1]}
              r={cfg.pointRadius * 1.8 * pointScale}
              fill="none"
              stroke={pointHsl}
              strokeWidth={1}
              opacity={pointScale * 0.3}
            />
          </g>
          {/* Label A */}
          <text
            x={posA[0]}
            y={posA[1] - cfg.pointRadius * 2.5}
            textAnchor="middle"
            fill={pointHsl}
            fontSize={10}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={500}
            opacity={pointScale * 0.7}
          >
            A
          </text>

          {/* Point B */}
          <g filter="url(#cv-point-glow)">
            <circle
              cx={posB[0]}
              cy={posB[1]}
              r={cfg.pointRadius * pointScale}
              fill={pointHsl}
              opacity={pointScale}
            />
            <circle
              cx={posB[0]}
              cy={posB[1]}
              r={cfg.pointRadius * 1.8 * pointScale}
              fill="none"
              stroke={pointHsl}
              strokeWidth={1}
              opacity={pointScale * 0.3}
            />
          </g>
          <text
            x={posB[0]}
            y={posB[1] - cfg.pointRadius * 2.5}
            textAnchor="middle"
            fill={pointHsl}
            fontSize={10}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={500}
            opacity={pointScale * 0.7}
          >
            B
          </text>

          {/* Convergence pulse ring — appears when close */}
          {convergeP > 0.7 && distance < maxDist * 0.25 && (
            <circle
              cx={midX}
              cy={midY}
              r={12 + (1 - distRatio) * 8}
              fill="none"
              stroke={vectorHsl}
              strokeWidth={1.5}
              opacity={(1 - distRatio) * 0.4 * Math.sin(convergeP * Math.PI * 4) * 0.5 + 0.3}
              filter="url(#cv-glow)"
            />
          )}
        </>
      )}
    </svg>
  );
}
