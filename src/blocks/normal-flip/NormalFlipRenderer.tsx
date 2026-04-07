import { useMemo } from "react";
import type { NormalFlipConfig } from "./config";
import { defaultNormalFlipConfig } from "./config";

interface Props {
  progress: number;
  width: number;
  height: number;
  config?: Partial<NormalFlipConfig>;
}

function clamp01(t: number) { return Math.max(0, Math.min(1, t)); }
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutQuart(t: number) { return 1 - Math.pow(1 - t, 4); }
function easeOutBack(t: number) {
  const c1 = 1.70158; const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

interface Panel {
  /** Panel center x on the arc curve */
  cx: number;
  cy: number;
  /** Panel segment start/end */
  x1: number; y1: number; x2: number; y2: number;
  /** Normal direction: 1 = outward (up), -1 = inward (down) */
  normalDir: 1 | -1;
  /** Normal angle in radians (perpendicular to segment, pointing outward) */
  outAngle: number;
}

function buildArcGeometry(
  width: number, height: number, panelCount: number, curvature: number
): { arcPoints: { x: number; y: number }[]; panels: Panel[] } {
  const margin = width * 0.12;
  const arcY = height * 0.55;
  const samples = 200;
  const arcPoints: { x: number; y: number }[] = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = margin + t * (width - 2 * margin);
    const y = arcY - Math.sin(t * Math.PI) * height * curvature;
    arcPoints.push({ x, y });
  }

  // Alternating normal directions: 1=up, -1=down
  const flipPattern = [1, -1, 1, -1, 1, -1] as const;
  const panels: Panel[] = [];
  const panelGap = 0.04;
  const segWidth = (1 - panelGap * (panelCount + 1)) / panelCount;

  for (let i = 0; i < panelCount; i++) {
    const tStart = panelGap * (i + 1) + segWidth * i;
    const tEnd = tStart + segWidth;
    const tMid = (tStart + tEnd) / 2;

    const iStart = Math.round(tStart * samples);
    const iEnd = Math.round(tEnd * samples);
    const iMid = Math.round(tMid * samples);

    const p1 = arcPoints[iStart];
    const p2 = arcPoints[iEnd];
    const pm = arcPoints[iMid];

    // Offset panels slightly above the arc
    const offset = -18;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    const ny = dx / len;
    const outAngle = Math.atan2(-ny, nx); // outward normal angle

    panels.push({
      cx: pm.x + nx * offset,
      cy: pm.y + ny * offset,
      x1: p1.x + nx * offset,
      y1: p1.y + ny * offset,
      x2: p2.x + nx * offset,
      y2: p2.y + ny * offset,
      normalDir: (flipPattern[i % flipPattern.length] || 1) as 1 | -1,
      outAngle,
    });
  }

  return { arcPoints, panels };
}

/** Arc path for base surface */
function arcSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L${points[i].x},${points[i].y}`;
  }
  return d;
}

/** Curved dashed question arrow from tip to base surface */
function questionArcPath(
  fromX: number, fromY: number, toX: number, toY: number
): string {
  const midX = (fromX + toX) / 2 + 30;
  const midY = (fromY + toY) / 2;
  return `M${fromX},${fromY} Q${midX},${midY} ${toX},${toY}`;
}

export function NormalFlipRenderer({ progress, width, height, config: overrides }: Props) {
  const cfg = useMemo(() => ({ ...defaultNormalFlipConfig, ...overrides }), [overrides]);
  const p = clamp01(progress);

  const { arcPoints, panels } = useMemo(
    () => buildArcGeometry(width, height, cfg.panelCount, cfg.arcCurvature),
    [width, height, cfg.panelCount, cfg.arcCurvature]
  );

  const ph = cfg.phases;
  // Scene progress values
  const setupP = clamp01(p / ph.setup);
  const panel1P = clamp01((p - ph.setup) / (ph.panel1 - ph.setup));
  const panel2P = clamp01((p - ph.panel1) / (ph.panel2 - ph.panel1));
  const applyP = clamp01((p - ph.panel2) / (ph.applyAll - ph.panel2));

  const inScene = (s: number) => {
    if (s === 0) return p < ph.setup;
    if (s === 1) return p >= ph.setup && p < ph.panel1;
    if (s === 2) return p >= ph.panel1 && p < ph.panel2;
    return p >= ph.panel2;
  };
  const pastScene = (s: number) => {
    if (s === 0) return p >= ph.setup;
    if (s === 1) return p >= ph.panel1;
    if (s === 2) return p >= ph.panel2;
    return false;
  };

  const colPanel = `hsl(${cfg.panelColor})`;
  const colCyan = `hsl(${cfg.normalCyanColor})`;
  const colYellow = `hsl(${cfg.normalYellowColor})`;
  const colQuestion = `hsl(${cfg.questionColor})`;
  const colNeg = `hsl(${cfg.negativeColor})`;
  const colExtrude = `hsl(${cfg.extrudeColor})`;
  const gridCol = "hsl(220 14% 22%)";

  const normalLen = Math.min(width, height) * 0.09;
  const arrowSize = 5;
  const extrudeH = 16;

  // For focused panels
  const focusPanel1 = panels[0]; // first = UP
  const focusPanel2 = panels[1]; // second = DOWN

  // Dimming for scenes 2 & 3
  const dimOthers = (inScene(1) || inScene(2)) ? 0.2 : 1;

  // Panel 1 sub-phases (within panel1P)
  const p1NormalP = easeOutQuart(clamp01(panel1P / 0.15));
  const p1QuestionP = easeInOutCubic(clamp01((panel1P - 0.15) / 0.2));
  const p1BaseNormalP = easeOutBack(clamp01((panel1P - 0.35) / 0.15));
  const p1LabelP = easeInOutCubic(clamp01((panel1P - 0.5) / 0.15));
  const p1ExtrudeP = easeInOutCubic(clamp01((panel1P - 0.7) / 0.3));

  // Panel 2 sub-phases
  const p2NormalP = easeOutQuart(clamp01(panel2P / 0.12));
  const p2QuestionP = easeInOutCubic(clamp01((panel2P - 0.12) / 0.15));
  const p2BaseNormalP = easeOutBack(clamp01((panel2P - 0.27) / 0.12));
  const p2LabelP = easeInOutCubic(clamp01((panel2P - 0.4) / 0.12));
  const p2FlipP = easeInOutCubic(clamp01((panel2P - 0.55) / 0.15));
  const p2ExtrudeP = easeInOutCubic(clamp01((panel2P - 0.72) / 0.28));

  // Apply-all sub-phases
  const allCheckP = easeInOutCubic(clamp01(applyP / 0.3));
  const allFlipP = easeInOutCubic(clamp01((applyP - 0.3) / 0.25));
  const allExtrudeP = easeInOutCubic(clamp01((applyP - 0.55) / 0.45));

  // Helper: draw a normal arrow from panel center
  function renderNormal(
    panel: Panel, normalProgress: number, color: string,
    dirOverride?: number, opacity?: number
  ) {
    if (normalProgress <= 0) return null;
    const dir = dirOverride ?? panel.normalDir;
    const angle = panel.outAngle;
    const nx = Math.cos(angle) * dir;
    const ny = Math.sin(angle) * dir;
    const tipX = panel.cx + nx * normalLen * normalProgress;
    const tipY = panel.cy + ny * normalLen * normalProgress;
    const fullTipX = panel.cx + nx * normalLen;
    const fullTipY = panel.cy + ny * normalLen;
    const showArrow = normalProgress >= 0.99;

    return (
      <g opacity={opacity ?? 1}>
        <line
          x1={panel.cx} y1={panel.cy}
          x2={tipX} y2={tipY}
          stroke={color} strokeWidth={cfg.strokeWeight} strokeLinecap="round"
        />
        {showArrow && (
          <polygon
            points={`0,0 ${-arrowSize * 2.2},${-arrowSize} ${-arrowSize * 2.2},${arrowSize}`}
            fill={color}
            transform={`translate(${fullTipX},${fullTipY}) rotate(${-Math.atan2(-ny, nx) * 180 / Math.PI})`}
          />
        )}
        <circle cx={panel.cx} cy={panel.cy} r={3} fill={color} opacity={0.7} />
      </g>
    );
  }

  // Helper: base surface normal (always outward/up)
  function renderBaseNormal(panel: Panel, prog: number) {
    if (prog <= 0) return null;
    // Find the closest arc point below the panel
    const baseX = panel.cx;
    // Base Y on the arc at this x
    const arcIdx = arcPoints.findIndex((pt, i) =>
      i < arcPoints.length - 1 && pt.x <= baseX && arcPoints[i + 1].x > baseX
    );
    const baseY = arcIdx >= 0
      ? lerp(arcPoints[arcIdx].y, arcPoints[arcIdx + 1].y,
        (baseX - arcPoints[arcIdx].x) / (arcPoints[arcIdx + 1].x - arcPoints[arcIdx].x))
      : panel.cy + 18;

    const tipY = baseY - normalLen * prog;
    const fullTipY = baseY - normalLen;
    const showArrow = prog >= 0.99;

    return (
      <g>
        <line
          x1={baseX} y1={baseY} x2={baseX} y2={tipY}
          stroke={colYellow} strokeWidth={cfg.strokeWeight} strokeLinecap="round"
        />
        {showArrow && (
          <polygon
            points={`0,0 ${-arrowSize * 2.2},${-arrowSize} ${-arrowSize * 2.2},${arrowSize}`}
            fill={colYellow}
            transform={`translate(${baseX},${fullTipY}) rotate(-90)`}
          />
        )}
        <circle cx={baseX} cy={baseY} r={3} fill={colYellow} opacity={0.7} />
      </g>
    );
  }

  function getBaseY(panel: Panel): number {
    const baseX = panel.cx;
    const arcIdx = arcPoints.findIndex((pt, i) =>
      i < arcPoints.length - 1 && pt.x <= baseX && arcPoints[i + 1].x > baseX
    );
    return arcIdx >= 0
      ? lerp(arcPoints[arcIdx].y, arcPoints[arcIdx + 1].y,
        (baseX - arcPoints[arcIdx].x) / (arcPoints[arcIdx + 1].x - arcPoints[arcIdx].x))
      : panel.cy + 18;
  }

  // Setup scene animations
  const arcDrawP = easeInOutCubic(clamp01(setupP / 0.4));
  const panelsAppearP = easeOutBack(clamp01((setupP - 0.3) / 0.3));
  const normalsShootP = easeOutQuart(clamp01((setupP - 0.6) / 0.4));

  // Visible arc points count
  const visibleArcCount = Math.round(arcDrawP * arcPoints.length);

  // Extrusion box for a panel
  function renderExtrusion(panel: Panel, prog: number, dir: number) {
    if (prog <= 0) return null;
    const dx = panel.x2 - panel.x1;
    const dy = panel.y2 - panel.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / len;
    const uy = dy / len;
    // Normal direction (always extrude outward after correction)
    const nx = -uy * dir;
    const ny = ux * dir;
    const h = extrudeH * prog;

    const points = [
      `${panel.x1},${panel.y1}`,
      `${panel.x2},${panel.y2}`,
      `${panel.x2 + nx * h},${panel.y2 + ny * h}`,
      `${panel.x1 + nx * h},${panel.y1 + ny * h}`,
    ].join(" ");

    return (
      <polygon
        points={points}
        fill={colExtrude}
        fillOpacity={0.15 * prog}
        stroke={colExtrude}
        strokeWidth={1}
        strokeOpacity={0.4 * prog}
      />
    );
  }

  // Determine which panels have been "resolved"
  // Panel 0 resolved after scene 1, panel 1 after scene 2, rest after scene 3
  function getPanelState(i: number): {
    normalColor: string;
    normalDir: number;
    extrudeP: number;
    dimmed: boolean;
    showNormal: boolean;
  } {
    const panel = panels[i];
    if (i === 0) {
      if (inScene(1)) {
        return {
          normalColor: colCyan,
          normalDir: panel.normalDir,
          extrudeP: p1ExtrudeP,
          dimmed: false,
          showNormal: true,
        };
      }
      if (pastScene(1)) {
        return {
          normalColor: colCyan,
          normalDir: 1,
          extrudeP: 1,
          dimmed: inScene(2),
          showNormal: true,
        };
      }
    }
    if (i === 1) {
      if (inScene(2)) {
        // During flip
        const flipped = p2FlipP >= 1;
        return {
          normalColor: flipped ? colNeg : colCyan,
          normalDir: flipped ? 1 : panel.normalDir,
          extrudeP: p2ExtrudeP,
          dimmed: false,
          showNormal: true,
        };
      }
      if (pastScene(2)) {
        return {
          normalColor: colNeg,
          normalDir: 1,
          extrudeP: allExtrudeP > 0 ? 1 : 0,
          dimmed: false,
          showNormal: true,
        };
      }
    }
    // Remaining panels in scene 4
    if (i >= 2 && pastScene(2)) {
      const flipped = panel.normalDir === -1;
      const resolved = allFlipP >= 1;
      return {
        normalColor: flipped ? (resolved ? colNeg : colCyan) : colCyan,
        normalDir: resolved ? 1 : panel.normalDir,
        extrudeP: allExtrudeP,
        dimmed: false,
        showNormal: true,
      };
    }
    // Default: show in setup
    return {
      normalColor: colCyan,
      normalDir: panel.normalDir,
      extrudeP: 0,
      dimmed: (inScene(1) && i !== 0) || (inScene(2) && i !== 1),
      showNormal: pastScene(0),
    };
  }

  // Text overlay
  let overlayText = "";
  let overlaySubText = "";
  let overlayColor = "hsl(220 14% 70%)";
  let overlayOpacity = 0;

  if (inScene(0)) {
    overlayText = "Cross-Section View";
    overlaySubText = "Panel normals point in random directions";
    overlayOpacity = easeInOutCubic(clamp01((setupP - 0.7) / 0.3));
    overlayColor = colPanel;
  } else if (inScene(1)) {
    if (p1LabelP > 0) {
      overlayText = "Response: POSITIVE (+)";
      overlaySubText = "Extrude in normal direction";
      overlayOpacity = p1LabelP;
      overlayColor = "hsl(150 70% 55%)";
    }
  } else if (inScene(2)) {
    if (p2LabelP > 0 && p2FlipP < 0.5) {
      overlayText = "Response: NEGATIVE (−)";
      overlaySubText = "Normals are opposed";
      overlayOpacity = p2LabelP;
      overlayColor = colNeg;
    } else if (p2FlipP >= 0.5) {
      overlayText = "Flip Normal × (−1)";
      overlaySubText = "Extrude in corrected direction";
      overlayOpacity = easeInOutCubic(clamp01((p2FlipP - 0.5) / 0.5));
      overlayColor = colNeg;
    }
  } else if (inScene(3)) {
    if (allFlipP < 1) {
      overlayText = "Checking All Panels…";
      overlayOpacity = allCheckP;
      overlayColor = colCyan;
    } else {
      overlayText = "Uniform Extrusion Complete";
      overlaySubText = "All normals corrected";
      overlayOpacity = easeInOutCubic(clamp01((allExtrudeP - 0.3) / 0.3));
      overlayColor = "hsl(150 70% 55%)";
    }
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%" height="100%"
      style={{ overflow: "hidden", background: "hsl(220 20% 7%)" }}
    >
      {/* Grid */}
      <g opacity={0.05}>
        {Array.from({ length: Math.floor(width / 60) + 1 }, (_, i) => (
          <line key={`gv${i}`} x1={i * 60} y1={0} x2={i * 60} y2={height}
            stroke={gridCol} strokeWidth={0.5} strokeDasharray="4 8" />
        ))}
        {Array.from({ length: Math.floor(height / 60) + 1 }, (_, i) => (
          <line key={`gh${i}`} x1={0} y1={i * 60} x2={width} y2={i * 60}
            stroke={gridCol} strokeWidth={0.5} strokeDasharray="4 8" />
        ))}
      </g>

      {/* Base arc surface */}
      {visibleArcCount > 1 && (
        <path
          d={arcSvgPath(arcPoints.slice(0, visibleArcCount))}
          fill="none"
          stroke="hsl(0 0% 95%)"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.9}
        />
      )}

      {/* Label on arc */}
      {arcDrawP > 0.8 && (
        <text
          x={arcPoints[0].x - 4}
          y={arcPoints[0].y + 20}
          fill="hsl(0 0% 70%)" fontSize={9}
          fontFamily="ui-monospace, 'SF Mono', monospace"
          opacity={clamp01((arcDrawP - 0.8) / 0.2) * 0.6}
        >
          Base Surface
        </text>
      )}

      {/* Panels + normals + extrusions */}
      {panels.map((panel, i) => {
        const state = getPanelState(i);
        const panelOpacity = panelsAppearP * (state.dimmed ? dimOthers : 1);
        const normalP = state.showNormal ? normalsShootP : 0;

        // During scene 2, panel 2 flip animation
        let currentDir = state.normalDir;
        let currentColor = state.normalColor;
        if (i === 1 && inScene(2) && p2FlipP > 0 && p2FlipP < 1) {
          // Animate rotation: normalDir goes from -1 to 1
          currentDir = lerp(-1, 1, p2FlipP);
          currentColor = p2FlipP > 0.5 ? colNeg : colCyan;
        }

        return (
          <g key={i} opacity={panelOpacity}>
            {/* Extrusion (behind panel) */}
            {state.extrudeP > 0 && renderExtrusion(panel, state.extrudeP, 1)}

            {/* Panel segment */}
            <line
              x1={panel.x1} y1={panel.y1}
              x2={panel.x2} y2={panel.y2}
              stroke={colPanel}
              strokeWidth={cfg.strokeWeight}
              strokeLinecap="round"
            />

            {/* Normal arrow */}
            {normalP > 0 && renderNormal(
              panel, normalP, currentColor, currentDir, panelOpacity > 0.5 ? 1 : panelOpacity
            )}

            {/* Panel index label */}
            {panelsAppearP > 0.8 && (
              <text
                x={panel.cx} y={panel.cy + (panel.normalDir === 1 ? 16 : -10)}
                textAnchor="middle" fill={colPanel} fontSize={8}
                fontFamily="ui-monospace, 'SF Mono', monospace"
                opacity={0.4}
              >
                P{i + 1}
              </text>
            )}
          </g>
        );
      })}

      {/* Scene 2: Panel 1 question arc + base normal */}
      {inScene(1) && focusPanel1 && (
        <g>
          {/* Question arc */}
          {p1QuestionP > 0 && (() => {
            const tipX = focusPanel1.cx + Math.cos(focusPanel1.outAngle) * normalLen;
            const tipY = focusPanel1.cy + Math.sin(focusPanel1.outAngle) * normalLen;
            const baseY = getBaseY(focusPanel1);
            const path = questionArcPath(tipX, tipY, focusPanel1.cx, baseY);
            return (
              <g opacity={p1QuestionP}>
                <path
                  d={path} fill="none" stroke={colQuestion}
                  strokeWidth={1.5} strokeDasharray="6 4" strokeLinecap="round"
                />
                {/* Question text along the arc */}
                {p1QuestionP > 0.5 && (
                  <text
                    x={tipX + 36} y={(tipY + baseY) / 2}
                    fill={colQuestion} fontSize={9}
                    fontFamily="ui-monospace, 'SF Mono', monospace"
                    fontWeight={500} opacity={clamp01((p1QuestionP - 0.5) / 0.3)}
                  >
                    Is my normal similar?
                  </text>
                )}
              </g>
            );
          })()}

          {/* Base surface normal (yellow, always up) */}
          {renderBaseNormal(focusPanel1, p1BaseNormalP)}

          {/* POSITIVE label badge */}
          {p1LabelP > 0 && (
            <g opacity={p1LabelP}>
              <rect
                x={focusPanel1.cx - 50} y={getBaseY(focusPanel1) + 24}
                width={100} height={22} rx={11}
                fill="hsl(220 20% 10%)" stroke="hsl(150 70% 55%)" strokeWidth={1.2}
              />
              <text
                x={focusPanel1.cx} y={getBaseY(focusPanel1) + 39}
                textAnchor="middle" fill="hsl(150 70% 55%)" fontSize={10}
                fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={700}
              >
                POSITIVE (+)
              </text>
            </g>
          )}
        </g>
      )}

      {/* Scene 3: Panel 2 question arc + base normal + flip */}
      {inScene(2) && focusPanel2 && (
        <g>
          {/* Question arc */}
          {p2QuestionP > 0 && (() => {
            const dir = p2FlipP < 0.5 ? focusPanel2.normalDir : 1;
            const tipX = focusPanel2.cx + Math.cos(focusPanel2.outAngle) * dir * normalLen;
            const tipY = focusPanel2.cy + Math.sin(focusPanel2.outAngle) * dir * normalLen;
            const baseY = getBaseY(focusPanel2);
            const path = questionArcPath(tipX, tipY, focusPanel2.cx, baseY);
            return (
              <g opacity={p2QuestionP * (p2FlipP > 0.3 ? clamp01(1 - (p2FlipP - 0.3) / 0.3) : 1)}>
                <path
                  d={path} fill="none" stroke={colQuestion}
                  strokeWidth={1.5} strokeDasharray="6 4" strokeLinecap="round"
                />
                {p2QuestionP > 0.5 && (
                  <text
                    x={tipX + 36} y={(tipY + baseY) / 2}
                    fill={colQuestion} fontSize={9}
                    fontFamily="ui-monospace, 'SF Mono', monospace"
                    fontWeight={500} opacity={clamp01((p2QuestionP - 0.5) / 0.3)}
                  >
                    Is my normal similar?
                  </text>
                )}
              </g>
            );
          })()}

          {/* Base surface normal */}
          {renderBaseNormal(focusPanel2, p2BaseNormalP)}

          {/* NEGATIVE label badge */}
          {p2LabelP > 0 && p2FlipP < 0.5 && (
            <g opacity={p2LabelP}>
              <rect
                x={focusPanel2.cx - 50} y={getBaseY(focusPanel2) + 24}
                width={100} height={22} rx={11}
                fill="hsl(220 20% 10%)" stroke={colNeg} strokeWidth={1.2}
              />
              <text
                x={focusPanel2.cx} y={getBaseY(focusPanel2) + 39}
                textAnchor="middle" fill={colNeg} fontSize={10}
                fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={700}
              >
                NEGATIVE (−)
              </text>
            </g>
          )}

          {/* (−1) indicator after flip */}
          {p2FlipP > 0.5 && (
            <g opacity={clamp01((p2FlipP - 0.5) / 0.3)}>
              <text
                x={focusPanel2.cx + 18}
                y={focusPanel2.cy - Math.abs(Math.sin(focusPanel2.outAngle)) * normalLen * 0.5}
                fill={colNeg} fontSize={10}
                fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={700}
              >
                ×(−1)
              </text>
            </g>
          )}
        </g>
      )}

      {/* Scene 4: simultaneous check arcs for remaining panels */}
      {inScene(3) && allCheckP > 0 && panels.slice(2).map((panel, i) => {
        const baseY = getBaseY(panel);
        const stagger = clamp01((allCheckP - i * 0.05) / 0.5);
        if (stagger <= 0) return null;
        const tipX = panel.cx + Math.cos(panel.outAngle) * panel.normalDir * normalLen;
        const tipY = panel.cy + Math.sin(panel.outAngle) * panel.normalDir * normalLen;

        return (
          <g key={`check${i}`} opacity={stagger * clamp01(1 - allFlipP)}>
            <path
              d={questionArcPath(tipX, tipY, panel.cx, baseY)}
              fill="none" stroke={colQuestion}
              strokeWidth={1} strokeDasharray="4 3" strokeLinecap="round"
            />
            {renderBaseNormal(panel, stagger)}
          </g>
        );
      })}

      {/* Overlay text */}
      {overlayOpacity > 0 && (
        <g opacity={overlayOpacity}>
          <text
            x={width / 2} y={height - 45}
            textAnchor="middle" fill={overlayColor}
            fontSize={14} fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={700} letterSpacing="0.03em"
          >
            {overlayText}
          </text>
          {overlaySubText && (
            <text
              x={width / 2} y={height - 26}
              textAnchor="middle" fill={overlayColor}
              fontSize={10} fontFamily="ui-monospace, 'SF Mono', monospace"
              fontWeight={500} opacity={0.65}
            >
              {overlaySubText}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
