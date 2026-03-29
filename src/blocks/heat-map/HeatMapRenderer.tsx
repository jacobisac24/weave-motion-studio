import type { BlockRendererProps } from "@/blocks/registry";

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
/*  Heat palette — crypto-style warm→cool                              */
/* ------------------------------------------------------------------ */
function heatColor(d: number): string {
  const t = clamp01(d);
  // Near: warm amber-orange, Far: deep teal-blue (matching dot product palette)
  const h = lerp(25, 195, t);
  const s = lerp(90, 80, t);
  const l = lerp(58, 38, t);
  return `hsl(${h},${s}%,${l}%)`;
}

/* ------------------------------------------------------------------ */
/*  S-curve path                                                       */
/* ------------------------------------------------------------------ */
function sCurvePoint(p: number, cx: number, cy: number, rangeX: number, rangeY: number) {
  const t = clamp01(p);
  const x = cx - rangeX * 0.4 + rangeX * 0.8 * t;
  const y = cy + Math.sin(t * Math.PI * 2.5) * rangeY * 0.32;
  return { x, y };
}

/* ------------------------------------------------------------------ */
/*  Grid config                                                        */
/* ------------------------------------------------------------------ */
const COLS = 14;
const ROWS = 14;
const GAP = 2;

/* ------------------------------------------------------------------ */
/*  Attractor icon — clean SVG crosshair/target                        */
/* ------------------------------------------------------------------ */
function AttractorIcon({ x, y, size, opacity }: { x: number; y: number; size: number; opacity: number }) {
  const r = size / 2;
  const inner = r * 0.35;
  const tick = r * 0.2;
  return (
    <g opacity={opacity}>
      {/* Outer ring */}
      <circle cx={x} cy={y} r={r} fill="none" stroke="hsl(25,85%,58%)" strokeWidth={1.5} opacity={0.8} />
      {/* Inner ring */}
      <circle cx={x} cy={y} r={inner} fill="hsl(25,85%,58%)" opacity={0.9} />
      {/* Crosshair ticks */}
      {[0, 90, 180, 270].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1={x + (r + tick * 0.3) * Math.cos(rad)}
            y1={y + (r + tick * 0.3) * Math.sin(rad)}
            x2={x + (r + tick * 1.8) * Math.cos(rad)}
            y2={y + (r + tick * 1.8) * Math.sin(rad)}
            stroke="hsl(25,85%,58%)"
            strokeWidth={1.2}
            strokeLinecap="round"
            opacity={0.7}
          />
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function HeatMapRenderer({ progress, width, height }: BlockRendererProps) {
  const vw = (p: number) => (p / 100) * width;
  const vh = (p: number) => (p / 100) * height;

  const dur = 45;
  const t = progress * dur;

  // Scene timing:
  // 1: 0-5    Grid construction (cells draw on)
  // 2: 5-11   Center points + attractor icon appear
  // 3: 11-20  Measurement lines (starburst)
  // 4: 20-33  Heat color wave + scale bar
  // 5: 33-45  S-curve movement with live update

  /* ---- Square grid geometry ---- */
  const gridSize = Math.min(width, height) * 0.52;
  const gridX = (width - gridSize) / 2;
  const gridY = (height - gridSize) / 2 + vh(1);
  const cellSize = (gridSize - GAP * (COLS - 1)) / COLS;

  const gridCenterX = gridX + gridSize / 2;
  const gridCenterY = gridY + gridSize / 2;

  const cells: { cx: number; cy: number; x: number; y: number; distFromCenter: number }[] = [];
  const maxCenterDist = gridSize * 0.72;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = gridX + c * (cellSize + GAP);
      const y = gridY + r * (cellSize + GAP);
      const cx2 = x + cellSize / 2;
      const cy2 = y + cellSize / 2;
      const distFromCenter = Math.sqrt(
        Math.pow(cx2 - gridCenterX, 2) + Math.pow(cy2 - gridCenterY, 2)
      );
      cells.push({ cx: cx2, cy: cy2, x, y, distFromCenter });
    }
  }

  /* ---- Attractor position ---- */
  const attractorRestX = gridX - vw(6);
  const attractorRestY = gridCenterY;

  // Attractor enters scene during scene 2
  const enterP = t >= 5 ? easeInOutCubic(clamp01((t - 5) / 3)) : 0;
  const attractorSize = Math.min(width, height) * 0.028;

  // Scene 5: S-curve movement
  const moveP = t >= 33 ? easeInOutCubic(clamp01((t - 33) / 11)) : 0;
  const sPoint = sCurvePoint(moveP, gridCenterX, gridCenterY, gridSize * 0.85, gridSize * 0.4);

  // Attractor glides from rest → grid center → S-curve
  let attractorX: number, attractorY: number;
  if (t < 5) {
    attractorX = attractorRestX;
    attractorY = attractorRestY;
  } else if (t < 33) {
    // Enter: rest → left side of grid
    const targetX = gridX + gridSize * 0.2;
    const targetY = gridCenterY + gridSize * 0.15;
    attractorX = lerp(attractorRestX, targetX, enterP);
    attractorY = lerp(attractorRestY, targetY, enterP);
  } else {
    attractorX = sPoint.x;
    attractorY = sPoint.y;
  }

  /* ---- Distances from attractor ---- */
  const maxDist = gridSize * 1.05;
  const distances = cells.map((c) => {
    const dx = c.cx - attractorX;
    const dy = c.cy - attractorY;
    return clamp01(Math.sqrt(dx * dx + dy * dy) / maxDist);
  });

  /* ---- Scene progress values ---- */
  // Scene 1: Grid cells draw on (staggered from center)
  const gridAppearP = easeOutQuart(clamp01(t / 4.5));

  // Scene 2: Center dots
  const dotsP = t >= 5.5 ? easeInOutCubic(clamp01((t - 5.5) / 3)) : 0;

  // Scene 3: Measurement lines
  const linesGrowP = t >= 11 ? easeInOutCubic(clamp01((t - 11) / 3.5)) : 0;
  const linesShrinkP = t >= 18 ? easeInOutCubic(clamp01((t - 18) / 2)) : 0;
  const showLines = t >= 11 && t < 20;
  const lineLen = showLines ? linesGrowP * (1 - linesShrinkP) : 0;

  // Scene 4: Heat color wave
  const heatP = t >= 21 ? easeInOutCubic(clamp01((t - 21) / 7)) : 0;

  // Scale bar
  const scaleBarP = t >= 23 ? easeInOutCubic(clamp01((t - 23) / 2.5)) : 0;

  // Distance text on panels (brief flash)
  const distTextP =
    t >= 20.5 && t < 26
      ? easeInOutCubic(clamp01((t - 20.5) / 1.5))
      : t >= 26 && t < 29
        ? Math.max(0, 1 - easeInOutCubic(clamp01((t - 26) / 2)))
        : 0;

  // Attractor opacity
  const attractorOpacity = t < 5 ? easeInOutCubic(clamp01(t / 2)) : 1;

  // Dim overlay during measurement
  const dimOverlay = showLines ? 0.2 * linesGrowP * (1 - linesShrinkP) : 0;

  // Text overlays
  const labelOpacity1 =
    t >= 6 && t < 10.5
      ? easeInOutCubic(clamp01((t - 6) / 1)) * (1 - clamp01((t - 9.5) / 1))
      : 0;
  const labelOpacity2 =
    t >= 13 && t < 19
      ? easeInOutCubic(clamp01((t - 13) / 1)) * (1 - clamp01((t - 18) / 1))
      : 0;
  const labelOpacity3 =
    t >= 22 && t < 32
      ? easeInOutCubic(clamp01((t - 22) / 1.5)) * (1 - clamp01((t - 31) / 1))
      : 0;
  const labelOpacity4 =
    t >= 34 && t < 44
      ? easeInOutCubic(clamp01((t - 34) / 1.5)) * (1 - clamp01((t - 43) / 1))
      : 0;

  // Color references
  const gridCol = "hsl(220,14%,22%)";
  const accentOrange = "hsl(25,85%,58%)";
  const accentTeal = "hsl(195,80%,45%)";
  const lineCol = "hsl(40,88%,58%)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      style={{ overflow: "hidden", background: "hsl(220,20%,7%)" }}
    >
      <defs>
        {/* Heat scale gradient (vertical) */}
        <linearGradient id="hm-scale-grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="hsl(195,80%,38%)" />
          <stop offset="50%" stopColor="hsl(45,90%,55%)" />
          <stop offset="100%" stopColor="hsl(25,90%,58%)" />
        </linearGradient>
      </defs>

      {/* Background dashed grid — matching dot product style */}
      <g opacity={0.06}>
        {Array.from({ length: Math.floor(width / 60) + 1 }, (_, i) => (
          <line key={`gv${i}`} x1={i * 60} y1={0} x2={i * 60} y2={height} stroke={gridCol} strokeWidth={0.5} strokeDasharray="4 8" />
        ))}
        {Array.from({ length: Math.floor(height / 60) + 1 }, (_, i) => (
          <line key={`gh${i}`} x1={0} y1={i * 60} x2={width} y2={i * 60} stroke={gridCol} strokeWidth={0.5} strokeDasharray="4 8" />
        ))}
      </g>

      {/* Dim overlay during measurement */}
      {dimOverlay > 0 && (
        <rect width={width} height={height} fill="hsl(220,20%,7%)" opacity={dimOverlay} />
      )}

      {/* Grid cells — staggered draw-on from center */}
      {cells.map((cell, i) => {
        const d = distances[i];
        const stagger = clamp01(cell.distFromCenter / maxCenterDist);
        const cellAppear = clamp01((gridAppearP - stagger * 0.55) / 0.45);

        // Heat wave: radial spread from attractor
        const waveP = clamp01((heatP - d * 0.45) / 0.55);
        const hasHeat = heatP > 0 && waveP > 0;
        const fillColor = hasHeat ? heatColor(d) : "transparent";
        const fillOpacity = hasHeat ? waveP * 0.82 : 0;

        // Stroke draw-on
        const perim = cellSize * 4;
        const strokeDraw = easeOutQuart(cellAppear);

        return (
          <g key={i} opacity={cellAppear > 0.01 ? 1 : 0}>
            <rect
              x={cell.x}
              y={cell.y}
              width={cellSize}
              height={cellSize}
              rx={1.2}
              fill={fillColor}
              fillOpacity={fillOpacity}
              stroke={hasHeat ? heatColor(d) : "hsl(220,15%,28%)"}
              strokeWidth={hasHeat ? 0.4 : 0.7}
              strokeOpacity={hasHeat ? 0.5 : cellAppear * 0.8}
              strokeDasharray={perim}
              strokeDashoffset={perim * (1 - strokeDraw)}
            />
            {/* Distance text */}
            {distTextP > 0 && cellSize > 8 && (
              <text
                x={cell.cx}
                y={cell.cy + cellSize * 0.12}
                textAnchor="middle"
                fontSize={cellSize * 0.32}
                fill="white"
                opacity={distTextP * 0.65}
                fontFamily="ui-monospace, 'SF Mono', monospace"
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
          const stagger = clamp01(cell.distFromCenter / maxCenterDist);
          const dotAppear = easeInOutCubic(clamp01((dotsP - stagger * 0.4) / 0.6));
          if (dotAppear < 0.01) return null;
          return (
            <circle
              key={`dot-${i}`}
              cx={cell.cx}
              cy={cell.cy}
              r={1.2 * dotAppear}
              fill="white"
              opacity={0.7 * dotAppear}
            />
          );
        })}

      {/* Measurement lines (scene 3) — starburst from attractor */}
      {lineLen > 0 &&
        cells.map((cell, i) => {
          const dx = cell.cx - attractorX;
          const dy = cell.cy - attractorY;
          const endX = attractorX + dx * lineLen;
          const endY = attractorY + dy * lineLen;
          return (
            <line
              key={`line-${i}`}
              x1={attractorX}
              y1={attractorY}
              x2={endX}
              y2={endY}
              stroke={lineCol}
              strokeWidth={0.5}
              opacity={0.35}
              strokeLinecap="round"
            />
          );
        })}

      {/* Attractor icon */}
      <AttractorIcon
        x={attractorX}
        y={attractorY}
        size={attractorSize}
        opacity={attractorOpacity}
      />

      {/* Pulsing dot at attractor center */}
      <circle cx={attractorX} cy={attractorY} r={2} fill={accentOrange} opacity={attractorOpacity * 0.9}>
        {gridAppearP > 0.5 && (
          <animate attributeName="r" values="2;3.5;2" dur="2s" repeatCount="indefinite" />
        )}
      </circle>

      {/* Heat scale bar (right side) */}
      {scaleBarP > 0 && (
        <g opacity={scaleBarP}>
          {/* Bar background */}
          <rect
            x={vw(89)} y={vh(22)}
            width={vw(1.6)} height={vh(50)}
            rx={vw(0.8)}
            fill="url(#hm-scale-grad)"
            stroke="hsl(220,15%,25%)"
            strokeWidth={0.6}
          />
          {/* Near label */}
          <text
            x={vw(89.8)} y={vh(19)}
            textAnchor="middle" fontSize={9}
            fill={accentOrange}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={600} letterSpacing="0.05em"
          >
            NEAR
          </text>
          {/* Far label */}
          <text
            x={vw(89.8)} y={vh(76)}
            textAnchor="middle" fontSize={9}
            fill={accentTeal}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={600} letterSpacing="0.05em"
          >
            FAR
          </text>
          {/* Tick marks along the bar */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
            <line
              key={`tick-${frac}`}
              x1={vw(89) - 3}
              y1={vh(22) + vh(50) * frac}
              x2={vw(89)}
              y2={vh(22) + vh(50) * frac}
              stroke="hsl(220,14%,40%)"
              strokeWidth={0.6}
              opacity={0.6}
            />
          ))}
        </g>
      )}

      {/* Scene labels — monospace, subtle */}
      {labelOpacity1 > 0 && (
        <text
          x={vw(50)} y={vh(10)}
          textAnchor="middle" fontSize={12}
          fill="hsl(220,14%,65%)"
          opacity={labelOpacity1 * 0.7}
          fontFamily="ui-monospace, 'SF Mono', monospace"
          letterSpacing="0.08em"
        >
          PANEL CENTER POINTS
        </text>
      )}
      {labelOpacity2 > 0 && (
        <text
          x={vw(50)} y={vh(10)}
          textAnchor="middle" fontSize={12}
          fill={lineCol}
          opacity={labelOpacity2 * 0.7}
          fontFamily="ui-monospace, 'SF Mono', monospace"
          letterSpacing="0.06em"
        >
          MEASURING DISTANCES
        </text>
      )}
      {labelOpacity3 > 0 && (
        <text
          x={vw(50)} y={vh(10)}
          textAnchor="middle" fontSize={12}
          fill={accentOrange}
          opacity={labelOpacity3 * 0.7}
          fontFamily="ui-monospace, 'SF Mono', monospace"
          letterSpacing="0.06em"
        >
          DISTANCE → COLOR MAPPING
        </text>
      )}
      {labelOpacity4 > 0 && (
        <g opacity={labelOpacity4 * 0.7}>
          <text
            x={vw(50)} y={vh(10)}
            textAnchor="middle" fontSize={12}
            fill="hsl(220,14%,70%)"
            fontFamily="ui-monospace, 'SF Mono', monospace"
            letterSpacing="0.06em"
          >
            DYNAMIC ATTRACTOR
          </text>
          {/* Movement trail hint — dotted S-curve */}
          {moveP > 0.05 && (
            <path
              d={(() => {
                const pts: string[] = [];
                for (let i = 0; i <= 40; i++) {
                  const frac = i / 40;
                  const sp = sCurvePoint(frac, gridCenterX, gridCenterY, gridSize * 0.85, gridSize * 0.4);
                  pts.push(`${i === 0 ? "M" : "L"}${sp.x},${sp.y}`);
                }
                return pts.join(" ");
              })()}
              fill="none"
              stroke={accentOrange}
              strokeWidth={0.6}
              strokeDasharray="2 6"
              opacity={0.2}
            />
          )}
        </g>
      )}

      {/* Bottom-right: live distance readout during scene 5 */}
      {t >= 34 && (
        <g opacity={easeInOutCubic(clamp01((t - 34) / 1.5))}>
          <rect
            x={vw(78)} y={vh(85)}
            width={vw(18)} height={vh(8)}
            rx={4}
            fill="hsl(220,20%,10%)"
            stroke="hsl(220,14%,25%)"
            strokeWidth={0.8}
          />
          <text
            x={vw(87)} y={vh(90.5)}
            textAnchor="middle" fontSize={10}
            fill={accentOrange}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={600}
          >
            {`x: ${attractorX.toFixed(0)}  y: ${attractorY.toFixed(0)}`}
          </text>
        </g>
      )}
    </svg>
  );
}
