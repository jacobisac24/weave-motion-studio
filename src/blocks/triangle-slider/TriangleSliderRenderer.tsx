// Triangle-Slider Explainer Block — self-contained renderer
// Receives normalised progress (0-1) and config. No dependency on editor internals.

import { useMemo } from "react";
import type { TriangleSliderConfig } from "./config";
import { defaultTriangleSliderConfig } from "./config";

interface Props {
  /** 0-1 normalised progress within this block */
  progress: number;
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Block-specific config (merged with defaults) */
  config?: Partial<TriangleSliderConfig>;
}

// ---- Helpers ----

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Build cumulative phase boundaries from fractional durations */
function buildPhases(p: TriangleSliderConfig["phases"]) {
  const vals = [p.pointAppear, p.triangleGrow, p.pause, p.sliderAppear, p.handAppear, p.drag];
  const boundaries: number[] = [];
  let sum = 0;
  for (const v of vals) {
    sum += v;
    boundaries.push(sum);
  }
  return boundaries;
}

/** Generate points for a subdivided triangle (equilateral) */
function triangleSegments(
  cx: number,
  cy: number,
  size: number,
  segments: number
): { lines: [number, number, number, number][]; vertices: [number, number][] } {
  // Equilateral triangle vertices (top, bottom-left, bottom-right)
  const h = size * (Math.sqrt(3) / 2);
  const A: [number, number] = [cx, cy - h * 0.6];
  const B: [number, number] = [cx - size / 2, cy + h * 0.4];
  const C: [number, number] = [cx + size / 2, cy + h * 0.4];

  const lines: [number, number, number, number][] = [];
  const vertices: [number, number][] = [A, B, C];

  // Outline
  lines.push([A[0], A[1], B[0], B[1]]);
  lines.push([B[0], B[1], C[0], C[1]]);
  lines.push([C[0], C[1], A[0], A[1]]);

  // Inner subdivision lines
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    // Lines parallel to each edge
    const ab1: [number, number] = [lerp(A[0], B[0], t), lerp(A[1], B[1], t)];
    const ac1: [number, number] = [lerp(A[0], C[0], t), lerp(A[1], C[1], t)];
    lines.push([ab1[0], ab1[1], ac1[0], ac1[1]]);

    const ba1: [number, number] = [lerp(B[0], A[0], t), lerp(B[1], A[1], t)];
    const bc1: [number, number] = [lerp(B[0], C[0], t), lerp(B[1], C[1], t)];
    lines.push([ba1[0], ba1[1], bc1[0], bc1[1]]);

    const ca1: [number, number] = [lerp(C[0], A[0], t), lerp(C[1], A[1], t)];
    const cb1: [number, number] = [lerp(C[0], B[0], t), lerp(C[1], B[1], t)];
    lines.push([ca1[0], ca1[1], cb1[0], cb1[1]]);
  }

  return { lines, vertices };
}

// ---- Component ----

export function TriangleSliderRenderer({ progress, width, height, config: configOverrides }: Props) {
  const cfg: TriangleSliderConfig = useMemo(
    () => ({ ...defaultTriangleSliderConfig, ...configOverrides }),
    [configOverrides]
  );

  const phases = useMemo(() => buildPhases(cfg.phases), [cfg.phases]);
  const p = clamp01(progress);

  // Phase progress values (0-1 within each phase)
  const pointP = clamp01(p / phases[0]);
  const triP = clamp01((p - phases[0]) / (phases[1] - phases[0]));
  const sliderAppP = clamp01((p - phases[2]) / (phases[3] - phases[2]));
  const handP = clamp01((p - phases[3]) / (phases[4] - phases[3]));
  const dragP = clamp01((p - phases[4]) / (phases[5] - phases[4]));

  // Derived values
  const cx = cfg.pointX * width;
  const cy = cfg.pointY * height;
  const triScale = easeOutCubic(triP);
  const currentSegments = Math.round(lerp(cfg.segmentMin, cfg.segmentMax, easeInOutQuad(dragP)));
  const sliderValue = lerp(cfg.segmentMin, cfg.segmentMax, easeInOutQuad(dragP));
  const showSlider = p >= phases[2];
  const showHand = p >= phases[3];

  // Triangle geometry
  const triData = useMemo(
    () => triangleSegments(cx, cy, cfg.triangleSize * triScale, currentSegments),
    [cx, cy, cfg.triangleSize, triScale, currentSegments]
  );

  // Slider layout
  const sliderW = Math.min(width * 0.5, 260);
  const sliderX = cx - sliderW / 2;
  const sliderY = cy + cfg.triangleSize * 0.55 + 40;
  const sliderHandleX = sliderX + ((sliderValue - cfg.segmentMin) / (cfg.segmentMax - cfg.segmentMin)) * sliderW;

  // Hand position
  const handX = sliderHandleX;
  const handY = sliderY + 28;

  const accentHsl = `hsl(${cfg.accentColor})`;
  const dimHsl = `hsl(${cfg.accentColor} / 0.35)`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      className="block"
      style={{ overflow: "hidden" }}
    >
      {/* Point */}
      {pointP > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={4 * easeOutCubic(pointP)}
          fill={accentHsl}
          opacity={easeOutCubic(pointP)}
        />
      )}

      {/* Triangle */}
      {triP > 0 && (
        <g opacity={triScale}>
          {triData.lines.map((l, i) => (
            <line
              key={i}
              x1={l[0]}
              y1={l[1]}
              x2={l[2]}
              y2={l[3]}
              stroke={i < 3 ? accentHsl : dimHsl}
              strokeWidth={i < 3 ? 2 : 1}
              strokeLinecap="round"
            />
          ))}
          {triData.vertices.map((v, i) => (
            <circle key={`v${i}`} cx={v[0]} cy={v[1]} r={3} fill={accentHsl} />
          ))}
        </g>
      )}

      {/* Segment count label */}
      {showSlider && (
        <text
          x={cx}
          y={cy + cfg.triangleSize * 0.55 + 20}
          textAnchor="middle"
          fill={accentHsl}
          fontSize={14}
          fontFamily="ui-monospace, monospace"
          fontWeight={600}
          opacity={easeOutCubic(sliderAppP)}
        >
          segments: {currentSegments}
        </text>
      )}

      {/* Slider track */}
      {showSlider && (
        <g opacity={easeOutCubic(sliderAppP)}>
          {/* Track bg */}
          <rect
            x={sliderX}
            y={sliderY - 3}
            width={sliderW}
            height={6}
            rx={3}
            fill="hsl(var(--editor-surface))"
            stroke="hsl(var(--editor-border))"
            strokeWidth={1}
          />
          {/* Track fill */}
          <rect
            x={sliderX}
            y={sliderY - 3}
            width={Math.max(0, sliderHandleX - sliderX)}
            height={6}
            rx={3}
            fill={accentHsl}
            opacity={0.7}
          />
          {/* Handle */}
          <circle
            cx={sliderHandleX}
            cy={sliderY}
            r={8}
            fill={accentHsl}
            stroke="hsl(var(--background))"
            strokeWidth={2}
          />
          {/* Value label */}
          <text
            x={sliderHandleX}
            y={sliderY - 16}
            textAnchor="middle"
            fill="hsl(var(--foreground))"
            fontSize={11}
            fontFamily="ui-monospace, monospace"
            fontWeight={500}
          >
            {currentSegments}
          </text>
          {/* Min / Max labels */}
          <text x={sliderX} y={sliderY + 20} fill="hsl(var(--muted-foreground))" fontSize={10} fontFamily="ui-monospace, monospace">
            {cfg.segmentMin}
          </text>
          <text x={sliderX + sliderW} y={sliderY + 20} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize={10} fontFamily="ui-monospace, monospace">
            {cfg.segmentMax}
          </text>
        </g>
      )}

      {/* Hand icon */}
      {showHand && (
        <g
          transform={`translate(${handX}, ${handY})`}
          opacity={easeOutCubic(handP)}
        >
          {/* Simple hand/pointer icon drawn as SVG path */}
          <g transform="scale(0.9) translate(-10, -4)">
            <path
              d="M10 2 C10 0.9 10.9 0 12 0 C13.1 0 14 0.9 14 2 L14 10 L15.5 10 C15.5 8.9 16.4 8 17.5 8 C18.6 8 19.5 8.9 19.5 10 L19.5 12 C19.5 10.9 20.4 10 21.5 10 C22.6 10 23.5 10.9 23.5 12 L23.5 14 C23.5 12.9 24.4 12 25.5 12 C26.6 12 27.5 12.9 27.5 14 L27.5 22 C27.5 27 24 30 19 30 L17 30 C13 30 10 27 10 23 Z"
              fill={accentHsl}
              opacity={0.85}
              stroke="hsl(var(--background))"
              strokeWidth={1}
            />
          </g>
        </g>
      )}
    </svg>
  );
}
