import type { BlockRendererProps } from "@/blocks/registry";
import humanImg from "@/assets/human-topdown.png";

/* ------------------------------------------------------------------ */
/*  Math helpers                                                       */
/* ------------------------------------------------------------------ */
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4);
}
function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/* ------------------------------------------------------------------ */
/*  Heat palette — smooth HSL based                                    */
/* ------------------------------------------------------------------ */
function heatColor(d: number): string {
  // d: 0=closest (warm orange-red), 1=farthest (cool teal-blue)
  const t = clamp01(d);
  const h = lerp(10, 210, t);       // hue: warm red → cool blue
  const s = lerp(95, 75, t);        // saturation
  const l = lerp(55, 40, t);        // lightness
  return `hsl(${h},${s}%,${l}%)`;
}

/* ------------------------------------------------------------------ */
/*  S-curve path for human movement                                    */
/* ------------------------------------------------------------------ */
function sCurvePoint(p: number, cx: number, cy: number, rangeX: number, rangeY: number) {
  // p: 0→1, S-shape that covers most of the grid area
  const t = clamp01(p);
  // Horizontal: sweep left to right
  const x = cx - rangeX * 0.4 + rangeX * 0.8 * t;
  // Vertical: sine wave for S-shape (two full bends)
  const y = cy + Math.sin(t * Math.PI * 2.5) * rangeY * 0.35;
  return { x, y };
}

/* ------------------------------------------------------------------ */
/*  Grid config — dense square grid                                    */
/* ------------------------------------------------------------------ */
const COLS = 16;
const ROWS = 16;
const GAP = 1.5;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function HeatMapRenderer({ progress, width, height }: BlockRendererProps) {
  const vw = (p: number) => (p / 100) * width;
  const vh = (p: number) => (p / 100) * height;

  const dur = 45;
  const t = progress * dur;

  // Scene 1: 0-5    Setup — grid appears with stroke animation
  // Scene 2: 5-12   Center dots + zoom
  // Scene 3: 12-22  Measurement lines
  // Scene 4: 22-35  Heat color fill
  // Scene 5: 35-45  S-curve movement

  /* ---- Square grid geometry (centered, smaller coverage) ---- */
  const gridSize = Math.min(vw(55), vh(55)); // square grid, 55% of smaller dim
  const gridX = (width - gridSize) / 2;
  const gridY = (height - gridSize) / 2 + vh(2); // slightly below center
  const cellSize = (gridSize - GAP * (COLS - 1)) / COLS;

  const cells: { cx: number; cy: number; x: number; y: number; row: number; col: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = gridX + c * (cellSize + GAP);
      const y = gridY + r * (cellSize + GAP);
      cells.push({ cx: x + cellSize / 2, cy: y + cellSize / 2, x, y, row: r, col: c });
    }
  }

  /* ---- Human figure position ---- */
  const humanSize = vw(4);
  const gridCenterX = gridX + gridSize / 2;
  const gridCenterY = gridY + gridSize / 2;

  // Before scene 5: positioned to the left of grid
  const humanRestX = gridX - vw(8);
  const humanRestY = gridCenterY;

  // Scene 5: S-curve movement
  const moveP = t >= 35 ? easeInOutCubic(clamp01((t - 35) / 9.5)) : 0;
  const sPoint = sCurvePoint(moveP, gridCenterX, gridCenterY, gridSize * 0.9, gridSize * 0.4);

  const humanX = t < 35 ? humanRestX : sPoint.x;
  const humanY = t < 35 ? humanRestY : sPoint.y;
  const dotX = humanX;
  const dotY = humanY;

  /* ---- Distances ---- */
  const maxDist = gridSize * 1.1;
  const distances = cells.map((c) => {
    const dx = c.cx - dotX;
    const dy = c.cy - dotY;
    return Math.sqrt(dx * dx + dy * dy) / maxDist;
  });

  /* ---- Scene progress ---- */
  // Grid cells appear with staggered animation
  const gridAppearP = easeOutQuart(clamp01(t / 4));

  // Center dots
  const dotsP = clamp01((t - 5) / 3);

  // Subtle zoom
  const zoomP = t >= 5 ? easeInOutCubic(clamp01((t - 5) / 6)) : 0;

  // Measurement lines
  const linesGrowP = t >= 12 ? easeInOutCubic(clamp01((t - 12) / 4)) : 0;
  const linesShrinkP = t >= 20 ? easeInOutCubic(clamp01((t - 20) / 2)) : 0;
  const showLines = t >= 12 && t < 22;
  const lineLen = showLines ? linesGrowP * (1 - linesShrinkP) : 0;

  // Heat color wave
  const heatP = t >= 23 ? easeInOutCubic(clamp01((t - 23) / 6)) : 0;

  // Scale bar
  const scaleBarP = t >= 24 ? easeInOutCubic(clamp01((t - 24) / 2)) : 0;

  // Distance text on panels
  const distTextP =
    t >= 22 && t < 28
      ? easeInOutCubic(clamp01((t - 22) / 2))
      : t >= 28
        ? Math.max(0, 1 - easeInOutCubic(clamp01((t - 28) / 2)))
        : 0;

  // Human figure opacity
  const humanOpacity = easeInOutCubic(clamp01(t / 2));

  // Dim overlay for measurement scene
  const dimOverlay = showLines ? 0.25 * linesGrowP * (1 - linesShrinkP) : 0;

  // Text overlays
  const centerTextOp =
    t >= 6 && t < 11
      ? easeInOutCubic(clamp01((t - 6) / 1.5)) * (1 - clamp01((t - 10) / 1))
      : 0;
  const measureTextOp =
    t >= 14 && t < 21
      ? easeInOutCubic(clamp01((t - 14) / 1.5)) * (1 - clamp01((t - 20) / 1))
      : 0;

  const scale = 1 + zoomP * 0.06;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      style={{ background: "#08080d" }}
    >
      <defs>
        {/* Subtle dot grid background */}
        <pattern id="hm-dot-grid" width={24} height={24} patternUnits="userSpaceOnUse">
          <circle cx={12} cy={12} r={0.6} fill="hsl(220,20%,25%)" opacity={0.3} />
        </pattern>
        {/* Heat scale gradient */}
        <linearGradient id="hm-scale-grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="hsl(210,75%,40%)" />
          <stop offset="50%" stopColor="hsl(45,95%,55%)" />
          <stop offset="100%" stopColor="hsl(10,95%,55%)" />
        </linearGradient>
        {/* Glow for human dot */}
        <radialGradient id="hm-dot-glow">
          <stop offset="0%" stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={width} height={height} fill="url(#hm-dot-grid)" />

      {/* Zoom transform group */}
      <g transform={`translate(${width / 2},${height / 2}) scale(${scale}) translate(${-width / 2},${-height / 2})`}>

        {/* Dim overlay */}
        {dimOverlay > 0 && (
          <rect width={width} height={height} fill="#08080d" opacity={dimOverlay} />
        )}

        {/* Grid panels — staggered appearance with white stroke */}
        {cells.map((cell, i) => {
          const d = distances[i];
          // Stagger: cells appear from center outward
          const distFromCenter = Math.sqrt(
            Math.pow(cell.cx - gridCenterX, 2) + Math.pow(cell.cy - gridCenterY, 2)
          );
          const maxCenterDist = gridSize * 0.72;
          const stagger = clamp01(distFromCenter / maxCenterDist);
          const cellAppear = clamp01((gridAppearP - stagger * 0.6) / 0.4);

          // Heat wave: radial spread from human
          const waveDist = d;
          const waveP = clamp01((heatP - waveDist * 0.5) / 0.5);

          const hasHeat = heatP > 0 && waveP > 0;
          const fillColor = hasHeat ? heatColor(d) : "transparent";
          const fillOpacity = hasHeat ? waveP * 0.85 : 0;

          // Stroke animation: draw-on effect
          const perim = cellSize * 4;
          const strokeDraw = cellAppear;

          return (
            <g key={i} opacity={cellAppear}>
              <rect
                x={cell.x}
                y={cell.y}
                width={cellSize}
                height={cellSize}
                rx={1}
                fill={fillColor}
                fillOpacity={fillOpacity}
                stroke="hsl(220,15%,35%)"
                strokeWidth={0.6}
                strokeDasharray={perim}
                strokeDashoffset={perim * (1 - strokeDraw)}
              />
              {/* Distance text */}
              {distTextP > 0 && (
                <text
                  x={cell.cx}
                  y={cell.cy + 3}
                  textAnchor="middle"
                  fontSize={cellSize * 0.35}
                  fill="white"
                  opacity={distTextP * 0.7}
                  fontFamily="monospace"
                >
                  {(d * 100).toFixed(0)}
                </text>
              )}
            </g>
          );
        })}

        {/* Center dots (scene 2) */}
        {dotsP > 0 &&
          cells.map((cell, i) => {
            const dotAppear = easeInOutCubic(clamp01(dotsP - (i / cells.length) * 0.5) / 0.5);
            return (
              <circle
                key={`dot-${i}`}
                cx={cell.cx}
                cy={cell.cy}
                r={1.5 * dotAppear}
                fill="white"
                opacity={0.8 * dotAppear}
              />
            );
          })}

        {/* Measurement lines (scene 3) */}
        {lineLen > 0 &&
          cells.map((cell, i) => {
            const dx = cell.cx - dotX;
            const dy = cell.cy - dotY;
            const endX = dotX + dx * lineLen;
            const endY = dotY + dy * lineLen;
            return (
              <line
                key={`line-${i}`}
                x1={dotX}
                y1={dotY}
                x2={endX}
                y2={endY}
                stroke="hsl(40,90%,60%)"
                strokeWidth={0.5}
                opacity={0.45}
              />
            );
          })}

        {/* Human figure using PNG */}
        <g opacity={humanOpacity}>
          <image
            href={humanImg}
            x={humanX - humanSize / 2}
            y={humanY - humanSize / 2}
            width={humanSize}
            height={humanSize}
            style={{ filter: "brightness(1.2)" }}
          />
          {/* Glowing dot at center of human */}
          <circle cx={dotX} cy={dotY} r={3} fill="white" opacity={0.9}>
            {gridAppearP > 0.5 && (
              <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
            )}
          </circle>
          <circle cx={dotX} cy={dotY} r={12} fill="url(#hm-dot-glow)" />
        </g>
      </g>

      {/* Heat scale bar (right side) */}
      {scaleBarP > 0 && (
        <g opacity={scaleBarP} transform={`translate(${vw(88)},${vh(25)})`}>
          <rect
            x={0}
            y={0}
            width={vw(1.8)}
            height={vh(45)}
            rx={vw(0.9)}
            fill="url(#hm-scale-grad)"
            stroke="hsl(220,15%,30%)"
            strokeWidth={0.5}
          />
          <text x={vw(0.9)} y={-8} textAnchor="middle" fontSize={9} fill="hsl(0,0%,55%)" fontFamily="monospace">
            Near
          </text>
          <text x={vw(0.9)} y={vh(45) + 14} textAnchor="middle" fontSize={9} fill="hsl(0,0%,55%)" fontFamily="monospace">
            Far
          </text>
        </g>
      )}

      {/* Text overlays */}
      {centerTextOp > 0 && (
        <text
          x={vw(50)}
          y={vh(8)}
          textAnchor="middle"
          fontSize={13}
          fill="white"
          opacity={centerTextOp * 0.6}
          fontFamily="monospace"
          letterSpacing={2}
        >
          Panel center points
        </text>
      )}
      {measureTextOp > 0 && (
        <text
          x={vw(50)}
          y={vh(8)}
          textAnchor="middle"
          fontSize={12}
          fill="hsl(40,90%,60%)"
          opacity={measureTextOp * 0.6}
          fontFamily="monospace"
          letterSpacing={1.5}
        >
          Measure the relationship to the human figure
        </text>
      )}
    </svg>
  );
}
