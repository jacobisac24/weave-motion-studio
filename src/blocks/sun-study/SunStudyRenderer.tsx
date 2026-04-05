import { useMemo } from "react";
import type { SunStudyConfig } from "./config";
import { defaultSunStudyConfig } from "./config";

interface Props {
  progress: number;
  width: number;
  height: number;
  config?: Partial<SunStudyConfig>;
}

/* ── math helpers ────────────────────────────────── */
function clamp01(t: number) { return Math.max(0, Math.min(1, t)); }
function easeInOutCubic(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t: number) { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function degToRad(d: number) { return (d * Math.PI) / 180; }

/* ── wavy roof geometry ──────────────────────────── */
interface Panel {
  idx: number;
  col: number;
  row: number;
  cx: number; cy: number;   // isometric centre
  nx: number; ny: number;   // normal unit vector (screen space)
  normalAngle: number;      // angle of normal vs up (degrees)
  corners: { x: number; y: number }[];
}

function buildRoof(
  cols: number, rows: number,
  ox: number, oy: number,
  cellW: number, cellH: number,
): Panel[] {
  // heightfield – smooth wave
  const H = (c: number, r: number) => {
    const u = c / cols;
    const v = r / rows;
    return Math.sin(u * Math.PI * 2.2) * Math.cos(v * Math.PI * 1.3) * 0.45
      + Math.sin(u * Math.PI * 1.1 + 0.7) * 0.25;
  };

  // iso projection helpers
  const isoX = (c: number, r: number, h: number) =>
    ox + (c - r) * cellW * 0.5 + cols * cellW * 0.25;
  const isoY = (c: number, r: number, h: number) =>
    oy + (c + r) * cellH * 0.28 - h * cellH * 1.8;

  const panels: Panel[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h00 = H(c, r), h10 = H(c + 1, r), h01 = H(c, r + 1), h11 = H(c + 1, r + 1);
      const corners = [
        { x: isoX(c, r, h00), y: isoY(c, r, h00) },
        { x: isoX(c + 1, r, h10), y: isoY(c + 1, r, h10) },
        { x: isoX(c + 1, r + 1, h11), y: isoY(c + 1, r + 1, h11) },
        { x: isoX(c, r + 1, h01), y: isoY(c, r + 1, h01) },
      ];
      const cx = (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
      const cy = (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;

      // surface normal via cross product of two diagonals
      const d1x = corners[2].x - corners[0].x;
      const d1y = corners[2].y - corners[0].y;
      const d2x = corners[3].x - corners[1].x;
      const d2y = corners[3].y - corners[1].y;
      // 2D cross → perpendicular direction
      let nxRaw = -(d1y - d2y);
      let nyRaw = (d1x - d2x);
      // approximate normal: average of height gradients
      const dhdx = ((h10 - h00) + (h11 - h01)) / 2;
      const dhdr = ((h01 - h00) + (h11 - h10)) / 2;
      nxRaw = -dhdx * 0.5;
      nyRaw = -1; // mostly upward
      const nzRaw = -dhdr * 0.5;
      // project into iso screen space
      let snx = (nxRaw - nzRaw) * 0.5;
      let sny = (nxRaw + nzRaw) * 0.28 + nyRaw * -1;
      const len = Math.sqrt(snx * snx + sny * sny) || 1;
      snx /= len;
      sny /= len;

      const normalAngle = Math.atan2(-sny, snx) * 180 / Math.PI;

      panels.push({ idx: panels.length, col: c, row: r, cx, cy, nx: snx, ny: sny, normalAngle, corners });
    }
  }
  return panels;
}

/* ── dot product between sun dir and panel normal ── */
function sunDot(panel: Panel, sunDx: number, sunDy: number) {
  return clamp01(panel.nx * sunDx + panel.ny * sunDy);
}

/* ── heat color interpolation ────────────────────── */
function heatColor(t: number, cfg: SunStudyConfig): string {
  // t: 0 = shade (cold blue), 1 = direct sun (hot red)
  if (t < 0.33) {
    const s = t / 0.33;
    return `hsl(${lerp(210, 130, s)} ${lerp(70, 65, s)}% ${lerp(50, 52, s)}%)`;
  } else if (t < 0.66) {
    const s = (t - 0.33) / 0.33;
    return `hsl(${lerp(130, 55, s)} ${lerp(65, 80, s)}% ${lerp(52, 52, s)}%)`;
  } else {
    const s = (t - 0.66) / 0.34;
    return `hsl(${lerp(55, 5, s)} ${lerp(80, 85, s)}% ${lerp(52, 55, s)}%)`;
  }
}

/* ── three highlight panels (facing sun, sideways, away) ── */
function pickHighlightPanels(panels: Panel[], sunDx: number, sunDy: number) {
  const sorted = [...panels].sort((a, b) => sunDot(b, sunDx, sunDy) - sunDot(a, sunDx, sunDy));
  const facing = sorted[0];
  const mid = sorted[Math.floor(sorted.length / 2)];
  const away = sorted[sorted.length - 1];
  return [facing, mid, away] as const;
}

export function SunStudyRenderer({ progress, width, height, config: overrides }: Props) {
  const cfg = useMemo(() => ({ ...defaultSunStudyConfig, ...overrides }), [overrides]);
  const p = clamp01(progress);

  const { setup, coreQuestion, alignment, finalEffect } = cfg.phases;

  // phase progress
  const setupP = easeOut(clamp01(p / setup));
  const coreP = easeInOutCubic(clamp01((p - setup) / (coreQuestion - setup)));
  const alignP = clamp01((p - coreQuestion) / (alignment - coreQuestion));
  const finalP = clamp01((p - alignment) / (finalEffect - alignment));

  const inPhase = (start: number, end: number) => p >= start && p < end;
  const past = (t: number) => p >= t;

  // layout
  const cx = width / 2;
  const cy = height * 0.42;
  const cellW = width * 0.065;
  const cellH = width * 0.065;
  const roofOx = cx - cfg.gridCols * cellW * 0.25;
  const roofOy = cy - cfg.gridRows * cellH * 0.14;

  const panels = useMemo(
    () => buildRoof(cfg.gridCols, cfg.gridRows, roofOx, roofOy, cellW, cellH),
    [cfg.gridCols, cfg.gridRows, roofOx, roofOy, cellW, cellH]
  );

  // Sun direction — initially top-right, rotates in scene 4
  const baseSunAngle = -135; // degrees, pointing down-left
  let sunAngleDeg = baseSunAngle;
  if (past(alignment)) {
    sunAngleDeg = baseSunAngle + finalP * 160; // sweeps across
  }
  const sunRad = degToRad(sunAngleDeg);
  const sunDx = Math.cos(sunRad);
  const sunDy = Math.sin(sunRad);

  // Sun arrow position
  const sunArrowLen = Math.min(width, height) * 0.18;
  const sunOriginX = width * 0.82;
  const sunOriginY = height * 0.1;
  const sunEndX = sunOriginX + sunArrowLen * Math.cos(sunRad);
  const sunEndY = sunOriginY + sunArrowLen * Math.sin(sunRad);

  // In scene 4, sun orbits more centrally
  let finalSunOX = sunOriginX;
  let finalSunOY = sunOriginY;
  if (past(alignment)) {
    const orbitCx = cx;
    const orbitCy = height * 0.08;
    const orbitR = width * 0.35;
    const orbitAngle = degToRad(-180 + finalP * 160);
    finalSunOX = orbitCx + orbitR * Math.cos(orbitAngle);
    finalSunOY = orbitCy + orbitR * 0.3 * Math.sin(orbitAngle);
  }
  const activeSunOX = past(alignment) ? finalSunOX : sunOriginX;
  const activeSunOY = past(alignment) ? finalSunOY : sunOriginY;
  const activeSunEX = activeSunOX + sunArrowLen * Math.cos(sunRad);
  const activeSunEY = activeSunOY + sunArrowLen * Math.sin(sunRad);

  // Normal vectors
  const normalLen = cellW * 1.1;

  // Three highlighted panels for scene 2-3
  const initSunRad = degToRad(baseSunAngle);
  const initSunDx = Math.cos(initSunRad);
  const initSunDy = Math.sin(initSunRad);
  const [facingPanel, midPanel, awayPanel] = useMemo(
    () => pickHighlightPanels(panels, initSunDx, initSunDy),
    [panels, initSunDx, initSunDy]
  );

  // Colors
  const sunCol = `hsl(${cfg.sunColor})`;
  const normCol = `hsl(${cfg.normalColor})`;
  const gridStroke = "hsl(220 14% 30%)";
  const arrowSize = 6;

  // alignment sub-phases (within alignP 0-1)
  const align1P = easeInOutCubic(clamp01(alignP / 0.3)); // facing panel
  const align2P = easeInOutCubic(clamp01((alignP - 0.33) / 0.3)); // mid panel
  const align3P = easeInOutCubic(clamp01((alignP - 0.66) / 0.3)); // away panel

  // Show heat colors
  const showHeat = past(coreQuestion);
  const heatRevealP = past(alignment) ? 1 : easeInOutCubic(clamp01((alignP - 0.1) / 0.3));

  // text overlays
  let titleText = "";
  let titleOpacity = 0;
  if (inPhase(0, setup)) {
    titleText = "The Goal: Solar Radiation Study";
    titleOpacity = clamp01(setupP / 0.3);
  } else if (inPhase(setup, coreQuestion)) {
    titleText = "Which panels get the most sun?";
    titleOpacity = clamp01(coreP / 0.3);
  } else if (past(alignment)) {
    titleText = "Map Alignment to Gradient";
    titleOpacity = easeInOutCubic(clamp01(finalP / 0.2));
  }

  // alignment labels
  const alignLabels = [
    { panel: facingPanel, text: "Maximum Alignment", sub: "High Radiation", p: align1P, col: `hsl(${cfg.hotColor})` },
    { panel: midPanel, text: "Perpendicular", sub: "Medium Radiation", p: align2P, col: `hsl(${cfg.midColor})` },
    { panel: awayPanel, text: "Opposed", sub: "Shade", p: align3P, col: `hsl(${cfg.coldColor})` },
  ];

  // Sun vector slides to each panel during alignment
  const alignTarget =
    alignP < 0.33 ? facingPanel :
    alignP < 0.66 ? midPanel : awayPanel;
  const alignSubP =
    alignP < 0.33 ? align1P :
    alignP < 0.66 ? align2P : align3P;

  // Interpolate sun arrow to panel during alignment scenes
  let sunDrawOX = activeSunOX;
  let sunDrawOY = activeSunOY;
  if (inPhase(coreQuestion, alignment) && alignSubP > 0) {
    sunDrawOX = lerp(sunOriginX, alignTarget.cx, alignSubP);
    sunDrawOY = lerp(sunOriginY, alignTarget.cy - normalLen, alignSubP);
  }
  const sunDrawEX = sunDrawOX + sunArrowLen * Math.cos(past(alignment) ? sunRad : initSunRad);
  const sunDrawEY = sunDrawOY + sunArrowLen * Math.sin(past(alignment) ? sunRad : initSunRad);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      style={{ overflow: "hidden", background: "hsl(222 25% 6%)" }}
    >
      <defs>
        <radialGradient id="ss-sun-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={sunCol} stopOpacity="0.4" />
          <stop offset="100%" stopColor={sunCol} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ss-heat-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`hsl(${cfg.hotColor})`} />
          <stop offset="35%" stopColor={`hsl(${cfg.midColor})`} />
          <stop offset="70%" stopColor="hsl(130 65% 45%)" />
          <stop offset="100%" stopColor={`hsl(${cfg.coldColor})`} />
        </linearGradient>
      </defs>

      {/* Dashed grid background */}
      <g opacity={0.05}>
        {Array.from({ length: Math.floor(width / 60) + 1 }, (_, i) => (
          <line key={`gv${i}`} x1={i * 60} y1={0} x2={i * 60} y2={height}
            stroke="hsl(220 14% 40%)" strokeWidth={0.5} strokeDasharray="4 8" />
        ))}
        {Array.from({ length: Math.floor(height / 60) + 1 }, (_, i) => (
          <line key={`gh${i}`} x1={0} y1={i * 60} x2={width} y2={i * 60}
            stroke="hsl(220 14% 40%)" strokeWidth={0.5} strokeDasharray="4 8" />
        ))}
      </g>

      {/* Roof panels */}
      {panels.map((panel) => {
        const stagger = (panel.col + panel.row * cfg.gridCols) / (cfg.gridCols * cfg.gridRows);
        const panelAppearP = easeOutBack(clamp01((setupP - stagger * 0.6) / 0.4));
        if (panelAppearP <= 0) return null;

        const dot = sunDot(panel, sunDx, sunDy);
        const fillCol = showHeat && heatRevealP > 0
          ? heatColor(dot * heatRevealP, cfg)
          : "hsl(220 15% 18%)";

        const pts = panel.corners.map(c => `${c.x},${c.y}`).join(" ");

        return (
          <g key={panel.idx} opacity={panelAppearP}>
            <polygon
              points={pts}
              fill={fillCol}
              stroke={gridStroke}
              strokeWidth={0.8}
              opacity={0.9}
            />
          </g>
        );
      })}

      {/* Normal vectors on highlighted panels (scene 2+) */}
      {past(setup) && [facingPanel, midPanel, awayPanel].map((panel, i) => {
        const normalAppearP = easeOut(clamp01((coreP - i * 0.2) / 0.3));
        if (normalAppearP <= 0) return null;

        const endX = panel.cx + panel.nx * normalLen * normalAppearP;
        const endY = panel.cy + panel.ny * normalLen * normalAppearP;
        const fullEndX = panel.cx + panel.nx * normalLen;
        const fullEndY = panel.cy + panel.ny * normalLen;

        return (
          <g key={`norm-${i}`} opacity={normalAppearP}>
            {/* Normal line */}
            <line
              x1={panel.cx} y1={panel.cy}
              x2={endX} y2={endY}
              stroke={normCol} strokeWidth={1.8} strokeLinecap="round"
            />
            {/* Arrowhead */}
            {normalAppearP >= 0.99 && (
              <polygon
                points={`0,0 ${-arrowSize * 2},${-arrowSize * 0.8} ${-arrowSize * 2},${arrowSize * 0.8}`}
                fill={normCol}
                transform={`translate(${fullEndX},${fullEndY}) rotate(${-panel.normalAngle})`}
              />
            )}
            {/* Dot at base */}
            <circle cx={panel.cx} cy={panel.cy} r={3} fill={normCol} opacity={0.7} />
            {/* Label */}
            <text
              x={fullEndX + panel.nx * 12} y={fullEndY + panel.ny * 12}
              fill={normCol} fontSize={9}
              fontFamily="ui-monospace, 'SF Mono', monospace"
              fontWeight={600} textAnchor="middle" opacity={0.7}
            >
              n
            </text>
          </g>
        );
      })}

      {/* Alignment labels (scene 3) */}
      {inPhase(coreQuestion, alignment) && alignLabels.map((al, i) => {
        if (al.p <= 0.3) return null;
        const labelOpacity = clamp01((al.p - 0.3) / 0.4);
        const boxW = 150;
        const boxH = 36;
        const bx = al.panel.cx - boxW / 2;
        const by = al.panel.cy + normalLen * 0.6;

        return (
          <g key={`label-${i}`} opacity={labelOpacity}>
            <rect
              x={bx} y={by}
              width={boxW} height={boxH} rx={6}
              fill="hsl(222 25% 10%)" stroke={al.col} strokeWidth={1}
              opacity={0.9}
            />
            <text
              x={al.panel.cx} y={by + 14}
              textAnchor="middle" fill={al.col}
              fontSize={10} fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={700}
            >
              {al.text}
            </text>
            <text
              x={al.panel.cx} y={by + 28}
              textAnchor="middle" fill={al.col}
              fontSize={8} fontFamily="ui-monospace, 'SF Mono', monospace"
              fontWeight={500} opacity={0.7}
            >
              {al.sub}
            </text>
          </g>
        );
      })}

      {/* Sun glow */}
      {setupP > 0 && (
        <circle
          cx={sunDrawOX}
          cy={sunDrawOY}
          r={40}
          fill="url(#ss-sun-glow)"
          opacity={setupP * 0.7}
        />
      )}

      {/* Sun vector */}
      {setupP > 0 && (
        <g opacity={setupP}>
          <line
            x1={sunDrawOX} y1={sunDrawOY}
            x2={sunDrawEX} y2={sunDrawEY}
            stroke={sunCol}
            strokeWidth={cfg.strokeWeight}
            strokeLinecap="round"
          />
          {setupP >= 0.99 && (
            <polygon
              points={`0,0 ${-arrowSize * 2.2},${-arrowSize} ${-arrowSize * 2.2},${arrowSize}`}
              fill={sunCol}
              transform={`translate(${sunDrawEX},${sunDrawEY}) rotate(${past(alignment) ? sunAngleDeg : baseSunAngle})`}
            />
          )}
          {/* Sun icon circle */}
          <circle cx={sunDrawOX} cy={sunDrawOY} r={8} fill={sunCol} opacity={0.9} />
          {/* Rays */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = degToRad(angle);
            return (
              <line
                key={`ray${angle}`}
                x1={sunDrawOX + 11 * Math.cos(rad)}
                y1={sunDrawOY + 11 * Math.sin(rad)}
                x2={sunDrawOX + 16 * Math.cos(rad)}
                y2={sunDrawOY + 16 * Math.sin(rad)}
                stroke={sunCol} strokeWidth={1.5} strokeLinecap="round" opacity={0.5}
              />
            );
          })}
          {/* Label */}
          <text
            x={sunDrawOX} y={sunDrawOY - 22}
            textAnchor="middle" fill={sunCol}
            fontSize={11} fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={700} opacity={0.8}
          >
            ☀ Sun
          </text>
        </g>
      )}

      {/* Heat gradient scale bar (scene 4) */}
      {past(alignment) && (
        <g opacity={easeInOutCubic(clamp01(finalP / 0.2))}>
          <rect
            x={width * 0.92} y={height * 0.25}
            width={14} height={height * 0.35} rx={7}
            fill="url(#ss-heat-bar)" opacity={0.85}
          />
          <text
            x={width * 0.92 + 7} y={height * 0.23}
            textAnchor="middle" fill={`hsl(${cfg.hotColor})`}
            fontSize={8} fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={700} opacity={0.6} letterSpacing="0.1em"
          >
            HOT
          </text>
          <text
            x={width * 0.92 + 7} y={height * 0.62 + 12}
            textAnchor="middle" fill={`hsl(${cfg.coldColor})`}
            fontSize={8} fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={700} opacity={0.6} letterSpacing="0.1em"
          >
            COLD
          </text>
        </g>
      )}

      {/* Title overlay */}
      {titleOpacity > 0 && (
        <text
          x={cx} y={height * 0.88}
          textAnchor="middle" fill="hsl(220 14% 75%)"
          fontSize={15} fontFamily="ui-monospace, 'SF Mono', monospace"
          fontWeight={700} opacity={titleOpacity} letterSpacing="0.04em"
        >
          {titleText}
        </text>
      )}

      {/* "Your Turn" subtitle in scene 4 */}
      {past(alignment) && finalP > 0.3 && (
        <text
          x={cx} y={height * 0.93}
          textAnchor="middle" fill={sunCol}
          fontSize={11} fontFamily="ui-monospace, 'SF Mono', monospace"
          fontWeight={600} opacity={easeInOutCubic(clamp01((finalP - 0.3) / 0.2)) * 0.6}
          letterSpacing="0.08em"
        >
          YOUR TURN
        </text>
      )}
    </svg>
  );
}
