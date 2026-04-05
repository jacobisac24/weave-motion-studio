import { useMemo } from "react";
import type { SunStudyConfig } from "./config";
import { defaultSunStudyConfig } from "./config";

interface Props {
  progress: number;
  width: number;
  height: number;
  config?: Partial<SunStudyConfig>;
}

/* ── math helpers ─────────────────────────────── */
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const degRad = (d: number) => (d * Math.PI) / 180;
const radDeg = (r: number) => (r * 180) / Math.PI;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4);
}
function easeOutBack(t: number) {
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

/* ── curve geometry ───────────────────────────── */
interface Panel {
  idx: number;
  x1: number; y1: number;
  x2: number; y2: number;
  cx: number; cy: number;
  nx: number; ny: number;       // unit normal (outward)
  normalAngleDeg: number;       // angle of normal vs right (degrees)
  tangentAngleDeg: number;
}

function buildCurve(
  panelCount: number,
  cx: number, cy: number,
  curveW: number, curveH: number,
): Panel[] {
  // parametric curve: a smooth arch/wave
  const pts: { x: number; y: number }[] = [];
  const N = panelCount;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = cx - curveW / 2 + t * curveW;
    // wavy arch shape
    const y = cy - curveH * Math.sin(t * Math.PI) * (0.7 + 0.3 * Math.sin(t * Math.PI * 2.5));
    pts.push({ x, y });
  }

  const panels: Panel[] = [];
  for (let i = 0; i < N; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // tangent
    const tx = dx / len;
    const ty = dy / len;
    // outward normal (pointing "up" / away from interior)
    // for an arch, outward = left-hand normal of tangent
    let nx = -ty;
    let ny = tx;
    // ensure outward (pointing up on average)
    if (ny > 0) { nx = -nx; ny = -ny; }

    panels.push({
      idx: i,
      x1: p1.x, y1: p1.y,
      x2: p2.x, y2: p2.y,
      cx: (p1.x + p2.x) / 2,
      cy: (p1.y + p2.y) / 2,
      nx, ny,
      normalAngleDeg: radDeg(Math.atan2(ny, nx)),
      tangentAngleDeg: radDeg(Math.atan2(ty, tx)),
    });
  }
  return panels;
}

/* ── dot product for sun alignment ────────────── */
function sunDot(panel: Panel, sdx: number, sdy: number) {
  // how aligned is sun direction with the panel normal?
  // sun shines "into" surface, so dot with -sunDir and normal
  return clamp01(panel.nx * -sdx + panel.ny * -sdy);
}

/* ── heat color ───────────────────────────────── */
function heatColor(t: number): string {
  // t: 0=shade(blue), 1=sun(red)
  if (t < 0.33) {
    const s = t / 0.33;
    return `hsl(${lerp(210, 140, s)} ${lerp(70, 60, s)}% ${lerp(48, 50, s)}%)`;
  } else if (t < 0.66) {
    const s = (t - 0.33) / 0.33;
    return `hsl(${lerp(140, 50, s)} ${lerp(60, 80, s)}% ${lerp(50, 50, s)}%)`;
  } else {
    const s = (t - 0.66) / 0.34;
    return `hsl(${lerp(50, 5, s)} ${lerp(80, 85, s)}% ${lerp(50, 52, s)}%)`;
  }
}

/* ── pick highlight panels ────────────────────── */
function pickHighlights(panels: Panel[], sdx: number, sdy: number) {
  const sorted = [...panels].sort((a, b) => sunDot(b, sdx, sdy) - sunDot(a, sdx, sdy));
  return {
    best: sorted[0],
    mid: sorted[Math.floor(sorted.length * 0.5)],
    worst: sorted[sorted.length - 1],
  };
}

/* ── arc path (clamped between two angle bounds) ── */
function arcPath(
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number,
): string {
  // always draw shortest arc from startDeg to endDeg
  let s = startDeg;
  let e = endDeg;
  // normalize
  while (e - s > 360) e -= 360;
  while (e - s < -360) e += 360;

  const sweep = e - s;
  const largeArc = Math.abs(sweep) > 180 ? 1 : 0;
  const sweepFlag = sweep > 0 ? 1 : 0;

  const sx = cx + r * Math.cos(degRad(s));
  const sy = cy + r * Math.sin(degRad(s));
  const ex = cx + r * Math.cos(degRad(e));
  const ey = cy + r * Math.sin(degRad(e));

  return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${ex} ${ey}`;
}

export function SunStudyRenderer({ progress, width, height, config: overrides }: Props) {
  const cfg = useMemo(() => ({ ...defaultSunStudyConfig, ...overrides }), [overrides]);
  const p = clamp01(progress);
  const { setup, panel1, panel2, panel3, dynamic } = cfg.phases;

  // phase progress with easing
  const setupP = easeOutQuart(clamp01(p / setup));
  const p1P = easeInOutCubic(clamp01((p - setup) / (panel1 - setup)));
  const p2P = easeInOutCubic(clamp01((p - panel1) / (panel2 - panel1)));
  const p3P = easeInOutCubic(clamp01((p - panel2) / (panel3 - panel2)));
  const dynP = easeInOutCubic(clamp01((p - panel3) / (dynamic - panel3)));

  const past = (t: number) => p >= t;
  const inPhase = (a: number, b: number) => p >= a && p < b;

  // layout
  const cx = width * 0.5;
  const cy = height * 0.55;
  const curveW = width * 0.7;
  const curveH = height * 0.32;
  const normalLen = Math.min(width, height) * 0.1;
  const sunArrowLen = Math.min(width, height) * 0.18;
  const arcR = normalLen * 0.45;
  const arrowSz = 6;

  const panels = useMemo(
    () => buildCurve(cfg.panelCount, cx, cy, curveW, curveH),
    [cfg.panelCount, cx, cy, curveW, curveH],
  );

  // static sun direction (pointing down-left towards curve)
  const baseSunDeg = 240; // degrees from +x axis
  const baseSunRad = degRad(baseSunDeg);
  const baseSdx = Math.cos(baseSunRad);
  const baseSdy = Math.sin(baseSunRad);

  // dynamic sun angle in scene 5
  let activeSunDeg = baseSunDeg;
  if (past(panel3)) {
    activeSunDeg = baseSunDeg + dynP * 140; // sweeps 140°
  }
  const sunRad = degRad(activeSunDeg);
  const sdx = Math.cos(sunRad);
  const sdy = Math.sin(sunRad);

  // highlighted panels
  const { best, mid, worst } = useMemo(
    () => pickHighlights(panels, baseSdx, baseSdy),
    [panels, baseSdx, baseSdy],
  );

  // sun origin position
  const sunOX = width * 0.82;
  const sunOY = height * 0.12;

  // colors
  const sunCol = `hsl(${cfg.sunColor})`;
  const normCol = `hsl(${cfg.normalColor})`;
  const gridStroke = "hsl(220 14% 22%)";

  // scene-specific focus panel & sun copy position
  const focusPanels = [
    { panel: best, p: p1P, label: "Maximum Alignment", sub: "High Radiation", col: `hsl(${cfg.hotColor})`, phase: [setup, panel1] as const },
    { panel: mid, p: p2P, label: "Glancing Angle", sub: "Medium Radiation", col: `hsl(${cfg.midColor})`, phase: [panel1, panel2] as const },
    { panel: worst, p: p3P, label: "Opposed", sub: "Shade (Minimum)", col: `hsl(${cfg.coldColor})`, phase: [panel2, panel3] as const },
  ];

  // curve path string
  const curvePath = useMemo(() => {
    if (panels.length === 0) return "";
    let d = `M ${panels[0].x1} ${panels[0].y1}`;
    for (const pan of panels) {
      d += ` L ${pan.x2} ${pan.y2}`;
    }
    return d;
  }, [panels]);

  // should show all normals (scene 5)
  const showAllNormals = past(panel3);
  // should color all panels
  const showAllColors = past(panel3);

  // title text
  let titleText = "";
  let titleOpacity = 0;
  if (inPhase(0, setup)) {
    titleText = "The Goal: Solar Radiation Study";
    titleOpacity = clamp01(setupP / 0.4);
  } else if (past(panel3) && dynP > 0.05) {
    titleText = "Check Alignment · Drive the Gradient · Your Turn";
    titleOpacity = easeInOutCubic(clamp01((dynP - 0.05) / 0.15));
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      style={{ overflow: "hidden", background: "hsl(220 20% 7%)" }}
    >
      <defs>
        <marker id="ss2-sun-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill={sunCol} />
        </marker>
        <marker id="ss2-norm-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill={normCol} />
        </marker>
      </defs>

      {/* Background grid */}
      <g opacity={0.06}>
        {Array.from({ length: Math.floor(width / 60) + 1 }, (_, i) => (
          <line key={`gv${i}`} x1={i * 60} y1={0} x2={i * 60} y2={height}
            stroke="hsl(220 14% 50%)" strokeWidth={0.5} strokeDasharray="4 8" />
        ))}
        {Array.from({ length: Math.floor(height / 60) + 1 }, (_, i) => (
          <line key={`gh${i}`} x1={0} y1={i * 60} x2={width} y2={i * 60}
            stroke="hsl(220 14% 50%)" strokeWidth={0.5} strokeDasharray="4 8" />
        ))}
      </g>

      {/* ── Scene 1: Curve draws in ────────────── */}
      {setupP > 0 && (
        <g>
          {/* Curve stroke animated draw-on */}
          <path
            d={curvePath}
            fill="none"
            stroke="hsl(220 10% 55%)"
            strokeWidth={2}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - setupP}
          />

          {/* Panel segment endpoints */}
          {panels.map((pan, i) => {
            const segP = clamp01((setupP - (i / panels.length) * 0.6) / 0.4);
            if (segP <= 0) return null;
            return (
              <g key={`seg-${i}`} opacity={segP}>
                <circle cx={pan.x1} cy={pan.y1} r={2} fill="hsl(220 10% 65%)" />
                {i === panels.length - 1 && (
                  <circle cx={pan.x2} cy={pan.y2} r={2} fill="hsl(220 10% 65%)" />
                )}
              </g>
            );
          })}
        </g>
      )}

      {/* Panel color fills (scenes 2-4 individual, scene 5 all) */}
      {panels.map((pan) => {
        let fillOpacity = 0;
        let fill = "transparent";

        if (showAllColors) {
          const dot = sunDot(pan, sdx, sdy);
          fill = heatColor(dot);
          fillOpacity = dynP * 0.85;
        } else {
          // individual panel highlights
          for (const fp of focusPanels) {
            if (pan.idx === fp.panel.idx && fp.p > 0.4) {
              const dot = sunDot(pan, baseSdx, baseSdy);
              fill = heatColor(dot);
              fillOpacity = clamp01((fp.p - 0.4) / 0.2) * 0.85;
            }
          }
        }

        if (fillOpacity <= 0) return null;

        // draw a thick line segment as the "panel"
        return (
          <line
            key={`pf-${pan.idx}`}
            x1={pan.x1} y1={pan.y1}
            x2={pan.x2} y2={pan.y2}
            stroke={fill}
            strokeWidth={6}
            strokeLinecap="round"
            opacity={fillOpacity}
          />
        );
      })}

      {/* ── Normals: per-scene highlights ──────── */}
      {focusPanels.map((fp, fi) => {
        if (!inPhase(fp.phase[0], fp.phase[1]) && !(showAllNormals && fp.p > 0)) return null;
        const normalP = showAllNormals ? 1 : easeOutQuart(clamp01((fp.p - 0.05) / 0.25));
        if (normalP <= 0) return null;

        const pan = fp.panel;
        const ex = pan.cx + pan.nx * normalLen * normalP;
        const ey = pan.cy + pan.ny * normalLen * normalP;
        const fullEx = pan.cx + pan.nx * normalLen;
        const fullEy = pan.cy + pan.ny * normalLen;

        // sun copy slides to this panel
        const sunSlideP = showAllNormals ? 0 : easeInOutCubic(clamp01((fp.p - 0.3) / 0.25));
        const sunCopyOX = lerp(sunOX, pan.cx, sunSlideP);
        const sunCopyOY = lerp(sunOY, pan.cy, sunSlideP);
        const sunCopyEX = sunCopyOX + sunArrowLen * baseSdx;
        const sunCopyEY = sunCopyOY + sunArrowLen * baseSdy;

        // arc between normal and sun direction
        const arcP = showAllNormals ? 0 : easeOutQuart(clamp01((fp.p - 0.55) / 0.2));
        const normalDeg = pan.normalAngleDeg;
        const sunDirDeg = radDeg(Math.atan2(-baseSdy, -baseSdx)); // incoming direction reversed
        let angleDiff = sunDirDeg - normalDeg;
        while (angleDiff > 180) angleDiff -= 360;
        while (angleDiff < -180) angleDiff += 360;

        return (
          <g key={`focus-${fi}`}>
            {/* Normal vector */}
            <line
              x1={pan.cx} y1={pan.cy}
              x2={ex} y2={ey}
              stroke={normCol} strokeWidth={1.8} strokeLinecap="round"
              opacity={normalP}
            />
            {normalP >= 0.99 && (
              <polygon
                points={`0,0 ${-arrowSz * 2},${-arrowSz * 0.8} ${-arrowSz * 2},${arrowSz * 0.8}`}
                fill={normCol}
                transform={`translate(${fullEx},${fullEy}) rotate(${-pan.normalAngleDeg})`}
              />
            )}
            <circle cx={pan.cx} cy={pan.cy} r={2.5} fill={normCol} opacity={0.6 * normalP} />

            {/* Normal label */}
            {normalP >= 0.99 && !showAllNormals && (
              <text
                x={fullEx + pan.nx * 14} y={fullEy + pan.ny * 14}
                fill={normCol} fontSize={9}
                fontFamily="ui-monospace, 'SF Mono', monospace"
                fontWeight={600} textAnchor="middle" opacity={0.6}
              >
                n̂
              </text>
            )}

            {/* Sun copy arrow sliding to panel */}
            {sunSlideP > 0.01 && !showAllNormals && (
              <g opacity={clamp01(sunSlideP / 0.3)}>
                <line
                  x1={sunCopyOX} y1={sunCopyOY}
                  x2={sunCopyEX} y2={sunCopyEY}
                  stroke={sunCol} strokeWidth={1.6} strokeLinecap="round"
                  strokeDasharray="4 3" opacity={0.7}
                />
                {sunSlideP >= 0.99 && (
                  <polygon
                    points={`0,0 ${-arrowSz * 2},${-arrowSz * 0.7} ${-arrowSz * 2},${arrowSz * 0.7}`}
                    fill={sunCol} opacity={0.7}
                    transform={`translate(${sunCopyEX},${sunCopyEY}) rotate(${baseSunDeg})`}
                  />
                )}
              </g>
            )}

            {/* Angle arc */}
            {arcP > 0 && !showAllNormals && (
              <path
                d={arcPath(pan.cx, pan.cy, arcR, normalDeg, normalDeg + angleDiff * arcP)}
                fill="none"
                stroke={fp.col}
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={arcP * 0.8}
              />
            )}

            {/* Label box */}
            {fp.p > 0.6 && !showAllNormals && (
              <g opacity={easeInOutCubic(clamp01((fp.p - 0.6) / 0.15))}>
                <rect
                  x={pan.cx - 80} y={pan.cy + normalLen * 0.5 + 8}
                  width={160} height={34} rx={5}
                  fill="hsl(222 20% 10%)" stroke={fp.col} strokeWidth={0.8}
                  opacity={0.92}
                />
                <text
                  x={pan.cx} y={pan.cy + normalLen * 0.5 + 24}
                  textAnchor="middle" fill={fp.col}
                  fontSize={9.5} fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={700}
                >
                  {fp.label}
                </text>
                <text
                  x={pan.cx} y={pan.cy + normalLen * 0.5 + 36}
                  textAnchor="middle" fill={fp.col}
                  fontSize={7.5} fontFamily="ui-monospace, 'SF Mono', monospace"
                  fontWeight={500} opacity={0.65}
                >
                  {fp.sub}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* ── Scene 5: All normals ──────────────── */}
      {showAllNormals && panels.map((pan) => {
        // skip the 3 highlight panels (already drawn)
        if (pan.idx === best.idx || pan.idx === mid.idx || pan.idx === worst.idx) return null;
        const stagger = pan.idx / panels.length;
        const nP = easeOutQuart(clamp01((dynP - stagger * 0.15) / 0.2));
        if (nP <= 0) return null;

        const ex = pan.cx + pan.nx * normalLen * 0.7 * nP;
        const ey = pan.cy + pan.ny * normalLen * 0.7 * nP;

        return (
          <g key={`norm-all-${pan.idx}`} opacity={nP * 0.5}>
            <line
              x1={pan.cx} y1={pan.cy}
              x2={ex} y2={ey}
              stroke={normCol} strokeWidth={1} strokeLinecap="round"
            />
            <circle cx={pan.cx} cy={pan.cy} r={1.5} fill={normCol} opacity={0.4} />
          </g>
        );
      })}

      {/* ── Sun icon & main vector ────────────── */}
      {setupP > 0 && (
        <g opacity={setupP}>
          {/* sun glow */}
          <circle cx={sunOX} cy={sunOY} r={28} fill={sunCol} opacity={0.08} />
          <circle cx={sunOX} cy={sunOY} r={16} fill={sunCol} opacity={0.12} />

          {/* sun circle */}
          <circle cx={sunOX} cy={sunOY} r={7} fill={sunCol} opacity={0.9} />

          {/* rays */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = degRad(a);
            return (
              <line
                key={`ray${a}`}
                x1={sunOX + 10 * Math.cos(r)} y1={sunOY + 10 * Math.sin(r)}
                x2={sunOX + 15 * Math.cos(r)} y2={sunOY + 15 * Math.sin(r)}
                stroke={sunCol} strokeWidth={1.3} strokeLinecap="round" opacity={0.4}
              />
            );
          })}

          {/* main sun vector */}
          {(() => {
            const eX = sunOX + sunArrowLen * sdx;
            const eY = sunOY + sunArrowLen * sdy;
            return (
              <>
                <line
                  x1={sunOX} y1={sunOY}
                  x2={eX} y2={eY}
                  stroke={sunCol} strokeWidth={cfg.strokeWeight} strokeLinecap="round"
                />
                {setupP >= 0.99 && (
                  <polygon
                    points={`0,0 ${-arrowSz * 2.2},${-arrowSz} ${-arrowSz * 2.2},${arrowSz}`}
                    fill={sunCol}
                    transform={`translate(${eX},${eY}) rotate(${activeSunDeg})`}
                  />
                )}
              </>
            );
          })()}

          {/* Sun label */}
          <text
            x={sunOX} y={sunOY - 20}
            textAnchor="middle" fill={sunCol}
            fontSize={10} fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={700} opacity={0.7}
          >
            ☀ Sun
          </text>
        </g>
      )}

      {/* ── Scene 5: Heat gradient bar ────────── */}
      {past(panel3) && dynP > 0.1 && (
        <g opacity={easeInOutCubic(clamp01((dynP - 0.1) / 0.15))}>
          <defs>
            <linearGradient id="ss2-heat-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`hsl(${cfg.hotColor})`} />
              <stop offset="35%" stopColor={`hsl(${cfg.midColor})`} />
              <stop offset="70%" stopColor="hsl(140 60% 45%)" />
              <stop offset="100%" stopColor={`hsl(${cfg.coldColor})`} />
            </linearGradient>
          </defs>
          <rect
            x={width * 0.04} y={height * 0.2}
            width={12} height={height * 0.3} rx={6}
            fill="url(#ss2-heat-bar)" opacity={0.8}
          />
          <text
            x={width * 0.04 + 6} y={height * 0.18}
            textAnchor="middle" fill={`hsl(${cfg.hotColor})`}
            fontSize={7} fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={700} opacity={0.5} letterSpacing="0.1em"
          >
            HOT
          </text>
          <text
            x={width * 0.04 + 6} y={height * 0.52 + 10}
            textAnchor="middle" fill={`hsl(${cfg.coldColor})`}
            fontSize={7} fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={700} opacity={0.5} letterSpacing="0.1em"
          >
            COLD
          </text>
        </g>
      )}

      {/* ── Title overlay ─────────────────────── */}
      {titleOpacity > 0 && (
        <text
          x={cx} y={height * 0.9}
          textAnchor="middle" fill="hsl(220 14% 70%)"
          fontSize={14} fontFamily="ui-monospace, 'SF Mono', monospace"
          fontWeight={700} opacity={titleOpacity} letterSpacing="0.04em"
        >
          {titleText}
        </text>
      )}
    </svg>
  );
}
