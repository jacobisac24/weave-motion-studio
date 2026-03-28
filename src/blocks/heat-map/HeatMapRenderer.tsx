import type { BlockRendererProps } from "@/blocks/registry";

/* ------------------------------------------------------------------ */
/*  Easing helpers                                                     */
/* ------------------------------------------------------------------ */
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/* ------------------------------------------------------------------ */
/*  Color helpers — heat-map palette (red→yellow→blue)                */
/* ------------------------------------------------------------------ */
function heatColor(d: number): string {
  // d 0 = closest (red), 1 = farthest (blue)
  const t = clamp01(d);
  if (t < 0.5) {
    const s = t / 0.5;
    // red → yellow
    const r = 255;
    const g = Math.round(lerp(60, 220, s));
    const b = Math.round(lerp(40, 50, s));
    return `rgb(${r},${g},${b})`;
  }
  const s = (t - 0.5) / 0.5;
  // yellow → blue
  const r = Math.round(lerp(255, 60, s));
  const g = Math.round(lerp(220, 130, s));
  const b = Math.round(lerp(50, 230, s));
  return `rgb(${r},${g},${b})`;
}

/* ------------------------------------------------------------------ */
/*  Grid constants                                                     */
/* ------------------------------------------------------------------ */
const COLS = 10;
const ROWS = 7;
const GAP = 4; // px between panels

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function HeatMapRenderer({ progress, width, height }: BlockRendererProps) {
  const vw = (p: number) => (p / 100) * width;
  const vh = (p: number) => (p / 100) * height;

  /* ---- timeline phases ---- */
  const dur = 45;
  const t = progress * dur; // seconds

  // Scene 1  0-5   setup
  // Scene 2  5-12  center dots
  // Scene 3  12-22 measurement lines
  // Scene 4  22-35 heat color fill
  // Scene 5  35-45 dynamic movement

  /* ---- grid geometry ---- */
  const gridW = vw(70);
  const gridH = vh(75);
  const gridX = vw(15);
  const gridY = vh(15);
  const cellW = (gridW - GAP * (COLS - 1)) / COLS;
  const cellH = (gridH - GAP * (ROWS - 1)) / ROWS;

  const cells: { cx: number; cy: number; x: number; y: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = gridX + c * (cellW + GAP);
      const y = gridY + r * (cellH + GAP);
      cells.push({ cx: x + cellW / 2, cy: y + cellH / 2, x, y });
    }
  }

  /* ---- human figure position ---- */
  const humanRestX = vw(8);
  const humanRestY = vh(55);
  // Scene 5 movement path
  const moveP = t >= 35 ? easeInOutCubic(clamp01((t - 35) / 9)) : 0;
  const humanX = t < 35 ? humanRestX : lerp(humanRestX, vw(55), moveP);
  const humanY = t < 35 ? humanRestY : lerp(humanRestY, vh(45), moveP);
  const humanDotX = humanX;
  const humanDotY = humanY + vh(3);

  /* ---- distances ---- */
  const maxDist = Math.sqrt(gridW * gridW + gridH * gridH);
  const distances = cells.map((c) => {
    const dx = c.cx - humanDotX;
    const dy = c.cy - humanDotY;
    return Math.sqrt(dx * dx + dy * dy) / maxDist;
  });

  /* ---- scene progress values ---- */
  const setupP = clamp01(t / 5);
  const dotsP = clamp01((t - 5) / 3); // dots appear 5-8
  const zoomP = t >= 5 ? easeInOutCubic(clamp01((t - 5) / 6)) : 0;
  const linesGrowP = t >= 12 ? easeInOutCubic(clamp01((t - 12) / 4)) : 0;
  const linesShrinkP = t >= 22 ? easeInOutCubic(clamp01((t - 22) / 3)) : 0;
  const showLines = t >= 12 && t < 25;
  const heatP = t >= 25 ? easeInOutCubic(clamp01((t - 25) / 5)) : 0;
  const scaleBarP = t >= 23 ? easeInOutCubic(clamp01((t - 23) / 2)) : 0;
  const distTextP = t >= 22 && t < 28 ? easeInOutCubic(clamp01((t - 22) / 2)) : t >= 28 ? Math.max(0, 1 - easeInOutCubic(clamp01((t - 28) / 2))) : 0;

  /* subtle zoom for scene 2-3 */
  const scale = 1 + zoomP * 0.08;

  /* ---- human figure (top-down stick figure) ---- */
  const headR = vw(1.2);
  const bodyLen = vh(4);
  const humanOpacity = easeInOutCubic(clamp01(t / 2));

  /* ---- line effective length ---- */
  const lineLen = showLines ? linesGrowP * (1 - linesShrinkP) : 0;

  /* scene 3 dim */
  const dimOverlay = showLines ? 0.3 * linesGrowP * (1 - linesShrinkP) : 0;

  /* text overlays */
  const centerTextOp = t >= 6 && t < 11 ? easeInOutCubic(clamp01((t - 6) / 1.5)) * (1 - clamp01((t - 10) / 1)) : 0;
  const measureTextOp = t >= 14 && t < 21 ? easeInOutCubic(clamp01((t - 14) / 1.5)) * (1 - clamp01((t - 20) / 1)) : 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      style={{ background: "#0a0a0f" }}
    >
      {/* Background grid (60px dashed) */}
      <defs>
        <pattern id="hm-grid" width={60} height={60} patternUnits="userSpaceOnUse">
          <path
            d="M 60 0 L 0 0 0 60"
            fill="none"
            stroke="hsl(220,15%,25%)"
            strokeWidth="0.5"
            strokeDasharray="4 4"
            opacity="0.06"
          />
        </pattern>
        {/* Heat scale gradient */}
        <linearGradient id="hm-scale-grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="rgb(60,130,230)" />
          <stop offset="50%" stopColor="rgb(255,220,50)" />
          <stop offset="100%" stopColor="rgb(255,60,40)" />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill="url(#hm-grid)" />

      {/* Transform group for subtle zoom */}
      <g transform={`translate(${width / 2},${height / 2}) scale(${scale}) translate(${-width / 2},${-height / 2})`}>
        {/* Dim overlay */}
        {dimOverlay > 0 && (
          <rect width={width} height={height} fill="#0a0a0f" opacity={dimOverlay} />
        )}

        {/* Grid panels */}
        {cells.map((cell, i) => {
          const d = distances[i];
          const colored = heatP > 0;
          // wave: color spreads from human position
          const waveDist = d;
          const waveP = clamp01((heatP - waveDist * 0.6) / 0.4);
          const fillColor = colored && waveP > 0 ? heatColor(d) : "hsl(220,10%,14%)";
          const fillOpacity = colored ? lerp(0.7, 1, waveP) : setupP * 0.9;

          return (
            <g key={i}>
              <rect
                x={cell.x}
                y={cell.y}
                width={cellW}
                height={cellH}
                rx={2}
                fill={fillColor}
                opacity={fillOpacity}
                stroke="hsl(220,15%,22%)"
                strokeWidth={0.5}
              />
              {/* Distance text on panels */}
              {distTextP > 0 && (
                <text
                  x={cell.cx}
                  y={cell.cy + 4}
                  textAnchor="middle"
                  fontSize={Math.min(cellW, cellH) * 0.28}
                  fill="white"
                  opacity={distTextP * 0.8}
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
          cells.map((cell, i) => (
            <circle
              key={`dot-${i}`}
              cx={cell.cx}
              cy={cell.cy}
              r={2.5 * easeInOutCubic(dotsP)}
              fill="white"
              opacity={0.9 * dotsP}
            />
          ))}

        {/* Measurement lines (scene 3) */}
        {lineLen > 0 &&
          cells.map((cell, i) => {
            const dx = cell.cx - humanDotX;
            const dy = cell.cy - humanDotY;
            const endX = humanDotX + dx * lineLen;
            const endY = humanDotY + dy * lineLen;
            return (
              <line
                key={`line-${i}`}
                x1={humanDotX}
                y1={humanDotY}
                x2={endX}
                y2={endY}
                stroke="hsl(45,90%,60%)"
                strokeWidth={0.8}
                opacity={0.6}
              />
            );
          })}

        {/* Human figure (top-down) */}
        <g opacity={humanOpacity}>
          {/* body */}
          <line
            x1={humanX}
            y1={humanY - bodyLen / 2}
            x2={humanX}
            y2={humanY + bodyLen / 2}
            stroke="hsl(0,0%,75%)"
            strokeWidth={2}
            strokeLinecap="round"
          />
          {/* arms */}
          <line
            x1={humanX - vw(1.5)}
            y1={humanY - bodyLen * 0.1}
            x2={humanX + vw(1.5)}
            y2={humanY - bodyLen * 0.1}
            stroke="hsl(0,0%,75%)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          {/* legs */}
          <line
            x1={humanX}
            y1={humanY + bodyLen / 2}
            x2={humanX - vw(0.8)}
            y2={humanY + bodyLen / 2 + vh(2)}
            stroke="hsl(0,0%,75%)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <line
            x1={humanX}
            y1={humanY + bodyLen / 2}
            x2={humanX + vw(0.8)}
            y2={humanY + bodyLen / 2 + vh(2)}
            stroke="hsl(0,0%,75%)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          {/* head */}
          <circle cx={humanX} cy={humanY - bodyLen / 2 - headR} r={headR} fill="hsl(0,0%,75%)" />
          {/* glowing dot at feet */}
          <circle cx={humanDotX} cy={humanDotY} r={4} fill="white">
            {setupP > 0.5 && (
              <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
            )}
          </circle>
          <circle cx={humanDotX} cy={humanDotY} r={8} fill="white" opacity={0.15}>
            {setupP > 0.5 && (
              <animate attributeName="r" values="8;14;8" dur="2s" repeatCount="indefinite" />
            )}
          </circle>
        </g>
      </g>

      {/* Heat scale bar (right side) */}
      {scaleBarP > 0 && (
        <g opacity={scaleBarP} transform={`translate(${vw(90)},${vh(20)})`}>
          <rect
            x={0}
            y={0}
            width={vw(2.5)}
            height={vh(55)}
            rx={4}
            fill="url(#hm-scale-grad)"
            stroke="hsl(220,15%,30%)"
            strokeWidth={0.5}
          />
          <text x={vw(1.25)} y={-8} textAnchor="middle" fontSize={10} fill="hsl(0,0%,60%)" fontFamily="monospace">
            Close
          </text>
          <text x={vw(1.25)} y={vh(55) + 16} textAnchor="middle" fontSize={10} fill="hsl(0,0%,60%)" fontFamily="monospace">
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
          fontSize={14}
          fill="white"
          opacity={centerTextOp * 0.7}
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
          fontSize={13}
          fill="hsl(45,90%,60%)"
          opacity={measureTextOp * 0.7}
          fontFamily="monospace"
          letterSpacing={1.5}
        >
          Measure the relationship to the human figure
        </text>
      )}
    </svg>
  );
}
