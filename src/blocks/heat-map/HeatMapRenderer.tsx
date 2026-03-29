import type { BlockRendererProps } from "@/blocks/registry";

/* ------------------------------------------------------------------ */
/*  Easing & Math                                                      */
/* ------------------------------------------------------------------ */
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
function easeOutElastic(t: number) {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
}
function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/* ------------------------------------------------------------------ */
/*  Heat palette — crypto amber → teal                                 */
/* ------------------------------------------------------------------ */
function heatColor(d: number): string {
  const t = clamp01(d);
  const h = lerp(25, 195, t);
  const s = lerp(92, 78, t);
  const l = lerp(60, 38, t);
  return `hsl(${h},${s}%,${l}%)`;
}

/* ------------------------------------------------------------------ */
/*  Spiral index — maps cell index to spiral order                     */
/* ------------------------------------------------------------------ */
function buildSpiralOrder(cols: number, rows: number): number[] {
  const order = new Array(cols * rows).fill(0);
  let top = 0, bottom = rows - 1, left = 0, right = cols - 1;
  let idx = 0;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) { order[top * cols + c] = idx++; }
    top++;
    for (let r = top; r <= bottom; r++) { order[r * cols + right] = idx++; }
    right--;
    if (top <= bottom) {
      for (let c = right; c >= left; c--) { order[bottom * cols + c] = idx++; }
      bottom--;
    }
    if (left <= right) {
      for (let r = bottom; r >= top; r--) { order[r * cols + left] = idx++; }
      left++;
    }
  }
  return order;
}

/* ------------------------------------------------------------------ */
/*  S-curve path                                                       */
/* ------------------------------------------------------------------ */
function sCurvePoint(p: number, cx: number, cy: number, rx: number, ry: number) {
  const t = clamp01(p);
  return {
    x: cx - rx * 0.4 + rx * 0.8 * t,
    y: cy + Math.sin(t * Math.PI * 2.5) * ry * 0.32,
  };
}

/* ------------------------------------------------------------------ */
/*  Config                                                              */
/* ------------------------------------------------------------------ */
const COLS = 14;
const ROWS = 14;
const GAP = 2;
const TOTAL = COLS * ROWS;
const spiralOrder = buildSpiralOrder(COLS, ROWS);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function HeatMapRenderer({ progress, width, height }: BlockRendererProps) {
  const vw = (p: number) => (p / 100) * width;
  const vh = (p: number) => (p / 100) * height;

  const dur = 45;
  const t = progress * dur;

  // --- Grid geometry ---
  const gridSize = Math.min(width, height) * 0.54;
  const gridX = (width - gridSize) / 2;
  const gridY = (height - gridSize) / 2 + vh(1);
  const cellSize = (gridSize - GAP * (COLS - 1)) / COLS;
  const gridCX = gridX + gridSize / 2;
  const gridCY = gridY + gridSize / 2;

  // --- Build cells ---
  const cells: { cx: number; cy: number; x: number; y: number; distC: number; col: number; row: number }[] = [];
  const maxCDist = gridSize * 0.72;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = gridX + c * (cellSize + GAP);
      const y = gridY + r * (cellSize + GAP);
      const cx2 = x + cellSize / 2;
      const cy2 = y + cellSize / 2;
      const distC = Math.sqrt((cx2 - gridCX) ** 2 + (cy2 - gridCY) ** 2);
      cells.push({ cx: cx2, cy: cy2, x, y, distC, col: c, row: r });
    }
  }

  /* =================================================================
     TIMELINE — 45s
     Scene 1: 0-6    Cells born (scale from 0 with overshoot)
     Scene 2: 6-12   Radar sweep reveals center dots
     Scene 3: 12-19  Pulse rings + attractor enter
     Scene 4: 19-32  Spiral cascade coloring + scale bar
     Scene 5: 32-45  Dynamic movement + breathing + trail
  ================================================================= */

  // --- Attractor position ---
  const enterP = t >= 12 ? easeInOutCubic(clamp01((t - 12) / 3)) : 0;
  const attractorSize = Math.min(width, height) * 0.026;

  const moveP = t >= 32 ? easeInOutCubic(clamp01((t - 32) / 12)) : 0;
  const sPoint = sCurvePoint(moveP, gridCX, gridCY, gridSize * 0.85, gridSize * 0.4);

  let atX: number, atY: number;
  if (t < 12) {
    atX = gridX - vw(8);
    atY = gridCY;
  } else if (t < 32) {
    const tgtX = gridX + gridSize * 0.22;
    const tgtY = gridCY + gridSize * 0.12;
    atX = lerp(gridX - vw(8), tgtX, enterP);
    atY = lerp(gridCY, tgtY, enterP);
  } else {
    atX = sPoint.x;
    atY = sPoint.y;
  }

  // --- Distances from attractor ---
  const maxDist = gridSize * 1.05;
  const distances = cells.map((c) => {
    return clamp01(Math.sqrt((c.cx - atX) ** 2 + (c.cy - atY) ** 2) / maxDist);
  });

  // ============ SCENE 1: CELL BIRTH (scale from 0 with easeOutBack) ============
  const birthDur = 5.5;
  const birthGlobalP = clamp01(t / birthDur);

  // ============ SCENE 2: RADAR SWEEP (rotating line reveals dots) ============
  const radarActive = t >= 6 && t < 12;
  const radarP = radarActive ? clamp01((t - 6) / 5) : t >= 12 ? 1 : 0;
  const radarAngle = radarP * Math.PI * 2.2; // slightly more than full rotation
  const radarLen = gridSize * 0.58;

  // ============ SCENE 3: PULSE RINGS ============
  const pulseActive = t >= 13 && t < 19;
  const pulseGlobalP = pulseActive ? clamp01((t - 13) / 5) : 0;

  // ============ SCENE 4: SPIRAL CASCADE COLORING ============
  const cascadeP = t >= 19 ? easeInOutCubic(clamp01((t - 19) / 8)) : 0;
  const scaleBarP = t >= 22 ? easeInOutCubic(clamp01((t - 22) / 2)) : 0;

  // ============ SCENE 5: BREATHING + TRAIL ============
  const breatheActive = t >= 33;
  const trailPoints: { x: number; y: number; opacity: number }[] = [];
  if (moveP > 0.02) {
    const trailCount = 12;
    for (let i = 0; i < trailCount; i++) {
      const tp = clamp01(moveP - (i + 1) * 0.025);
      if (tp <= 0) continue;
      const sp = sCurvePoint(tp, gridCX, gridCY, gridSize * 0.85, gridSize * 0.4);
      trailPoints.push({ x: sp.x, y: sp.y, opacity: 0.5 * (1 - i / trailCount) });
    }
  }

  // --- Labels ---
  const label1Op = t >= 1 && t < 5.5 ? easeInOutCubic(clamp01((t - 1) / 1)) * (1 - clamp01((t - 4.5) / 1)) : 0;
  const label2Op = t >= 7 && t < 11.5 ? easeInOutCubic(clamp01((t - 7) / 1)) * (1 - clamp01((t - 10.5) / 1)) : 0;
  const label3Op = t >= 14 && t < 18.5 ? easeInOutCubic(clamp01((t - 14) / 1)) * (1 - clamp01((t - 17.5) / 1)) : 0;
  const label4Op = t >= 20 && t < 30 ? easeInOutCubic(clamp01((t - 20) / 1.5)) * (1 - clamp01((t - 29) / 1)) : 0;
  const label5Op = t >= 34 && t < 44 ? easeInOutCubic(clamp01((t - 34) / 1.5)) * (1 - clamp01((t - 43) / 1)) : 0;

  // Colors
  const accentOrange = "hsl(25,85%,58%)";
  const accentTeal = "hsl(195,78%,45%)";
  const gridStroke = "hsl(220,15%,28%)";
  const bgColor = "hsl(220,20%,7%)";
  const labelColor = "hsl(220,14%,60%)";
  const radarColor = "hsl(40,90%,60%)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      style={{ overflow: "hidden", background: bgColor }}
    >
      <defs>
        {/* Radar glow */}
        <radialGradient id="hm-radar-glow" cx="50%" cy="50%">
          <stop offset="0%" stopColor={radarColor} stopOpacity={0.15} />
          <stop offset="100%" stopColor={radarColor} stopOpacity={0} />
        </radialGradient>
        {/* Heat scale gradient */}
        <linearGradient id="hm-scale" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="hsl(195,78%,38%)" />
          <stop offset="50%" stopColor="hsl(45,90%,55%)" />
          <stop offset="100%" stopColor="hsl(25,90%,58%)" />
        </linearGradient>
        {/* Pulse ring gradient */}
        <radialGradient id="hm-pulse-ring">
          <stop offset="85%" stopColor={accentOrange} stopOpacity={0.3} />
          <stop offset="100%" stopColor={accentOrange} stopOpacity={0} />
        </radialGradient>
        {/* Attractor glow */}
        <radialGradient id="hm-att-glow" cx="50%" cy="50%">
          <stop offset="0%" stopColor={accentOrange} stopOpacity={0.25} />
          <stop offset="60%" stopColor={accentOrange} stopOpacity={0.05} />
          <stop offset="100%" stopColor={accentOrange} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Background subtle dashed grid */}
      <g opacity={0.05}>
        {Array.from({ length: Math.floor(width / 60) + 1 }, (_, i) => (
          <line key={`gv${i}`} x1={i * 60} y1={0} x2={i * 60} y2={height} stroke={gridStroke} strokeWidth={0.5} strokeDasharray="3 9" />
        ))}
        {Array.from({ length: Math.floor(height / 60) + 1 }, (_, i) => (
          <line key={`gh${i}`} x1={0} y1={i * 60} x2={width} y2={i * 60} stroke={gridStroke} strokeWidth={0.5} strokeDasharray="3 9" />
        ))}
      </g>

      {/* ============ SCENE 1: CELLS BORN ============ */}
      {cells.map((cell, i) => {
        const d = distances[i];
        // Column-based stagger: left to right, then row within column
        const colDelay = cell.col / COLS;
        const rowJitter = cell.row / ROWS * 0.15;
        const cellBirthP = easeOutBack(clamp01((birthGlobalP - (colDelay * 0.55 + rowJitter)) / 0.42));
        const scale = cellBirthP;

        // Spiral cascade coloring
        const spiralIdx = spiralOrder[i];
        const spiralFrac = spiralIdx / TOTAL;
        const cellColorP = clamp01((cascadeP - spiralFrac * 0.7) / 0.3);
        const hasColor = cascadeP > 0 && cellColorP > 0;
        const fillColor = hasColor ? heatColor(d) : "transparent";
        const fillOpacity = hasColor ? cellColorP * 0.85 : 0;

        // Breathing in scene 5
        let breatheScale = 1;
        if (breatheActive && hasColor) {
          const proximity = 1 - d;
          breatheScale = 1 + proximity * 0.06 * Math.sin(t * 3 + i * 0.3);
        }

        const finalScale = scale * breatheScale;

        return (
          <g key={i}>
            {finalScale > 0.01 && (
              <rect
                x={cell.cx - (cellSize / 2) * finalScale}
                y={cell.cy - (cellSize / 2) * finalScale}
                width={cellSize * finalScale}
                height={cellSize * finalScale}
                rx={1.2}
                fill={fillColor}
                fillOpacity={fillOpacity}
                stroke={hasColor ? heatColor(d) : gridStroke}
                strokeWidth={hasColor ? 0.4 : 0.6}
                strokeOpacity={hasColor ? 0.6 + cellColorP * 0.3 : clamp01(cellBirthP) * 0.7}
              />
            )}
          </g>
        );
      })}

      {/* ============ SCENE 2: RADAR SWEEP ============ */}
      {radarActive && (
        <g>
          {/* Radar line */}
          <line
            x1={gridCX}
            y1={gridCY}
            x2={gridCX + Math.cos(radarAngle) * radarLen}
            y2={gridCY + Math.sin(radarAngle) * radarLen}
            stroke={radarColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.7}
          />
          {/* Radar trailing wedge */}
          {(() => {
            const wedgeAngle = 0.4;
            const r = radarLen;
            const a1 = radarAngle - wedgeAngle;
            const a2 = radarAngle;
            const x1 = gridCX + Math.cos(a1) * r;
            const y1 = gridCY + Math.sin(a1) * r;
            const x2 = gridCX + Math.cos(a2) * r;
            const y2 = gridCY + Math.sin(a2) * r;
            return (
              <path
                d={`M${gridCX},${gridCY} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`}
                fill={radarColor}
                opacity={0.06}
              />
            );
          })()}
          {/* Glow at radar tip */}
          <circle
            cx={gridCX + Math.cos(radarAngle) * radarLen * 0.95}
            cy={gridCY + Math.sin(radarAngle) * radarLen * 0.95}
            r={8}
            fill={radarColor}
            opacity={0.3}
            filter="blur(4px)"
          />
        </g>
      )}

      {/* Center dots revealed by radar */}
      {radarP > 0 && cells.map((cell, i) => {
        // Dot appears when radar angle passes the cell's angle
        const cellAngle = Math.atan2(cell.cy - gridCY, cell.cx - gridCX);
        let normalAngle = ((cellAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        let sweepAngle = ((radarAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        // Simple: use distance from center as a radial reveal
        const radialP = clamp01(cell.distC / maxCDist);
        const dotReveal = clamp01((radarP - radialP * 0.5) / 0.5);
        const dotAppear = easeOutElastic(clamp01(dotReveal));
        if (dotAppear < 0.01) return null;
        return (
          <circle
            key={`dot-${i}`}
            cx={cell.cx}
            cy={cell.cy}
            r={1.8 * dotAppear}
            fill="white"
            opacity={0.65 * clamp01(dotAppear)}
          />
        );
      })}

      {/* ============ SCENE 3: PULSE RINGS ============ */}
      {pulseActive && (() => {
        const rings = 3;
        return Array.from({ length: rings }, (_, ri) => {
          const ringDelay = ri * 0.28;
          const ringP = clamp01((pulseGlobalP - ringDelay) / 0.65);
          const ringR = easeOutQuart(ringP) * gridSize * 0.55;
          const ringOp = (1 - ringP) * 0.35;
          if (ringP <= 0 || ringP >= 1) return null;
          return (
            <circle
              key={`ring-${ri}`}
              cx={atX}
              cy={atY}
              r={ringR}
              fill="none"
              stroke={accentOrange}
              strokeWidth={1.5 * (1 - ringP)}
              opacity={ringOp}
            />
          );
        });
      })()}

      {/* ============ ATTRACTOR ============ */}
      {enterP > 0 && (
        <g opacity={easeInOutCubic(clamp01(enterP))}>
          {/* Soft glow */}
          <circle cx={atX} cy={atY} r={attractorSize * 2.5} fill="url(#hm-att-glow)" />
          {/* Outer ring */}
          <circle cx={atX} cy={atY} r={attractorSize * 0.5} fill="none" stroke={accentOrange} strokeWidth={1.2} opacity={0.75} />
          {/* Inner dot */}
          <circle cx={atX} cy={atY} r={attractorSize * 0.18} fill={accentOrange} opacity={0.9} />
          {/* Crosshair ticks */}
          {[0, 90, 180, 270].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const r1 = attractorSize * 0.55;
            const r2 = attractorSize * 0.9;
            return (
              <line
                key={angle}
                x1={atX + r1 * Math.cos(rad)}
                y1={atY + r1 * Math.sin(rad)}
                x2={atX + r2 * Math.cos(rad)}
                y2={atY + r2 * Math.sin(rad)}
                stroke={accentOrange}
                strokeWidth={1}
                strokeLinecap="round"
                opacity={0.6}
              />
            );
          })}
          {/* Pulsing ring */}
          <circle cx={atX} cy={atY} r={attractorSize * 0.5} fill="none" stroke={accentOrange} strokeWidth={0.6} opacity={0.3}>
            <animate attributeName="r" values={`${attractorSize * 0.5};${attractorSize * 0.85};${attractorSize * 0.5}`} dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.08;0.3" dur="2.5s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* ============ SCENE 5: TRAIL ============ */}
      {trailPoints.map((tp, i) => (
        <circle
          key={`trail-${i}`}
          cx={tp.x}
          cy={tp.y}
          r={2.5 * tp.opacity}
          fill={accentOrange}
          opacity={tp.opacity * 0.6}
        />
      ))}
      {/* S-curve path hint */}
      {moveP > 0.03 && (
        <path
          d={(() => {
            const pts: string[] = [];
            for (let i = 0; i <= 50; i++) {
              const f = i / 50;
              const sp = sCurvePoint(f, gridCX, gridCY, gridSize * 0.85, gridSize * 0.4);
              pts.push(`${i === 0 ? "M" : "L"}${sp.x},${sp.y}`);
            }
            return pts.join(" ");
          })()}
          fill="none"
          stroke={accentOrange}
          strokeWidth={0.5}
          strokeDasharray="2 8"
          opacity={0.12}
        />
      )}

      {/* ============ SCALE BAR ============ */}
      {scaleBarP > 0 && (
        <g opacity={scaleBarP}>
          <rect
            x={vw(89)} y={vh(22)}
            width={vw(1.4)} height={vh(50)}
            rx={vw(0.7)}
            fill="url(#hm-scale)"
            stroke="hsl(220,15%,22%)"
            strokeWidth={0.5}
          />
          <text x={vw(89.7)} y={vh(19)} textAnchor="middle" fontSize={8.5} fill={accentOrange}
            fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={600} letterSpacing="0.06em">
            NEAR
          </text>
          <text x={vw(89.7)} y={vh(76)} textAnchor="middle" fontSize={8.5} fill={accentTeal}
            fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={600} letterSpacing="0.06em">
            FAR
          </text>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={vw(89) - 2} y1={vh(22) + vh(50) * f} x2={vw(89)} y2={vh(22) + vh(50) * f}
              stroke="hsl(220,14%,38%)" strokeWidth={0.5} opacity={0.5} />
          ))}
        </g>
      )}

      {/* ============ LABELS ============ */}
      {label1Op > 0 && (
        <text x={vw(50)} y={vh(9)} textAnchor="middle" fontSize={11} fill={labelColor} opacity={label1Op * 0.7}
          fontFamily="ui-monospace, 'SF Mono', monospace" letterSpacing="0.1em">
          CONSTRUCTING GRID
        </text>
      )}
      {label2Op > 0 && (
        <text x={vw(50)} y={vh(9)} textAnchor="middle" fontSize={11} fill={radarColor} opacity={label2Op * 0.7}
          fontFamily="ui-monospace, 'SF Mono', monospace" letterSpacing="0.08em">
          SCANNING PANEL CENTERS
        </text>
      )}
      {label3Op > 0 && (
        <text x={vw(50)} y={vh(9)} textAnchor="middle" fontSize={11} fill={accentOrange} opacity={label3Op * 0.7}
          fontFamily="ui-monospace, 'SF Mono', monospace" letterSpacing="0.08em">
          ATTRACTOR CONNECTED
        </text>
      )}
      {label4Op > 0 && (
        <text x={vw(50)} y={vh(9)} textAnchor="middle" fontSize={11} fill={accentOrange} opacity={label4Op * 0.7}
          fontFamily="ui-monospace, 'SF Mono', monospace" letterSpacing="0.06em">
          DISTANCE → COLOR MAPPING
        </text>
      )}
      {label5Op > 0 && (
        <g opacity={label5Op * 0.7}>
          <text x={vw(50)} y={vh(9)} textAnchor="middle" fontSize={11} fill="hsl(220,14%,68%)"
            fontFamily="ui-monospace, 'SF Mono', monospace" letterSpacing="0.06em">
            DYNAMIC ATTRACTOR
          </text>
        </g>
      )}

      {/* Live coordinate readout — scene 5 */}
      {t >= 34 && (
        <g opacity={easeInOutCubic(clamp01((t - 34) / 1.5))}>
          <rect x={vw(78)} y={vh(86)} width={vw(17)} height={vh(7)} rx={3}
            fill="hsl(220,20%,9%)" stroke="hsl(220,14%,22%)" strokeWidth={0.6} />
          <text x={vw(86.5)} y={vh(90.8)} textAnchor="middle" fontSize={9.5} fill={accentOrange}
            fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={600}>
            {`x: ${atX.toFixed(0)}  y: ${atY.toFixed(0)}`}
          </text>
        </g>
      )}
    </svg>
  );
}
