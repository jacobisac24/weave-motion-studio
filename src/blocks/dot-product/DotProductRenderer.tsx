import { useMemo } from "react";
import type { DotProductConfig } from "./config";
import { defaultDotProductConfig } from "./config";

interface Props {
  progress: number;
  width: number;
  height: number;
  config?: Partial<DotProductConfig>;
}

/* ── helpers ── */
function clamp01(t: number) { return Math.max(0, Math.min(1, t)); }
function easeInOutCubic(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeOutQuart(t: number) { return 1 - Math.pow(1 - t, 4); }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function degToRad(d: number) { return (d * Math.PI) / 180; }

function buildPhases(p: DotProductConfig["phases"]) {
  const vals = [
    p.vectorsAppear, p.moveToCenter, p.projection,
    p.aligned, p.perpendicular, p.opposed, p.summary,
  ];
  const b: number[] = [];
  let sum = 0;
  for (const v of vals) { sum += v; b.push(sum); }
  return b;
}

/* ── renderer ── */
export function DotProductRenderer({ progress, width, height, config: overrides }: Props) {
  const cfg = useMemo(() => ({ ...defaultDotProductConfig, ...overrides }), [overrides]);
  const ph = useMemo(() => buildPhases(cfg.phases), [cfg.phases]);
  const p = clamp01(progress);

  const cx = width / 2;
  const cy = height / 2;
  const vecLen = Math.min(width, height) * cfg.vectorLength;
  const arrowSize = 7;

  /* ── phase progress ── */
  const appearP = easeOutQuart(clamp01(p / ph[0]));
  const moveP = easeInOutCubic(clamp01((p - ph[0]) / (ph[1] - ph[0])));
  const projP = easeOutCubic(clamp01((p - ph[1]) / (ph[2] - ph[1])));
  const alignP = easeInOutCubic(clamp01((p - ph[2]) / (ph[3] - ph[2])));
  const perpP = easeInOutCubic(clamp01((p - ph[3]) / (ph[4] - ph[3])));
  const oppP = easeInOutCubic(clamp01((p - ph[4]) / (ph[5] - ph[4])));
  const sumP = clamp01((p - ph[5]) / (ph[6] - ph[5]));

  /* ── angle of B across scenes ── */
  const initB = cfg.initialAngleB; // 45°
  let angleBDeg = initB;

  const inScene = (i: number) => p >= (i > 0 ? ph[i - 1] : 0) && p < ph[i];
  const pastScene = (i: number) => p >= ph[i];

  // Scene 3 (projection): stays at initB
  // Scene 4 (aligned): rotate from initB → 0
  if (inScene(3)) {
    angleBDeg = lerp(initB, 0, alignP);
  } else if (pastScene(3) && !pastScene(4)) {
    // Scene 5 (perpendicular): rotate from 0 → 90
    angleBDeg = lerp(0, 90, perpP);
  } else if (pastScene(4) && !pastScene(5)) {
    // Scene 6 (opposed): rotate from 90 → 150
    angleBDeg = lerp(90, 150, oppP);
  } else if (pastScene(5)) {
    // Scene 7 (summary): sweep 0 → 180 → 0 continuously
    const sweepT = (Math.sin(sumP * Math.PI * 4 - Math.PI / 2) + 1) / 2;
    angleBDeg = sweepT * 180;
  } else if (pastScene(3)) {
    angleBDeg = 0;
  }

  const angleARad = 0; // always horizontal right
  const angleBRad = degToRad(angleBDeg);

  /* ── start positions (before merging) ── */
  const offsetDist = width * 0.22;
  const startA = { x: cx - offsetDist, y: cy + height * 0.05 };
  const startB = { x: cx + offsetDist, y: cy - height * 0.05 };

  const originA = { x: lerp(startA.x, cx, moveP), y: lerp(startA.y, cy, moveP) };
  const originB = { x: lerp(startB.x, cx, moveP), y: lerp(startB.y, cy, moveP) };

  /* ── vector endpoints ── */
  const endA = {
    x: originA.x + vecLen * appearP * Math.cos(angleARad),
    y: originA.y - vecLen * appearP * Math.sin(angleARad),
  };
  const fullEndA = {
    x: originA.x + vecLen * Math.cos(angleARad),
    y: originA.y - vecLen * Math.sin(angleARad),
  };

  // After merging, B starts from center
  const bOrigin = pastScene(1) ? { x: cx, y: cy } : originB;
  const endB = {
    x: bOrigin.x + vecLen * appearP * Math.cos(angleBRad),
    y: bOrigin.y - vecLen * appearP * Math.sin(angleBRad),
  };
  const fullEndB = {
    x: bOrigin.x + vecLen * Math.cos(angleBRad),
    y: bOrigin.y - vecLen * Math.sin(angleBRad),
  };

  /* ── projection geometry (after merge) ── */
  const showProjection = pastScene(1) && projP > 0;
  // Projection of B onto A (horizontal axis): |B|cos(θ) along x
  const projLen = vecLen * Math.cos(angleBRad);
  const projEndX = cx + projLen;
  const projEndY = cy;

  // Dotted perpendicular from B's tip down to A's axis
  const bTipX = fullEndB.x;
  const bTipY = fullEndB.y;
  const footX = projEndX;
  const footY = cy;

  /* ── dot product value for display ── */
  const dotVal = Math.cos(angleBRad);
  const dotDisplay = (dotVal * vecLen * vecLen / (Math.min(width, height) * 0.28) / (Math.min(width, height) * 0.28)).toFixed(2);
  const cosDisplay = Math.cos(angleBRad).toFixed(2);

  /* ── projection color: yellow when positive, red when negative ── */
  const projIsNegative = projLen < 0;
  const projCol = projIsNegative ? `hsl(${cfg.negativeColor})` : `hsl(${cfg.projectionColor})`;

  /* ── colors ── */
  const colA = `hsl(${cfg.vectorColorA})`;
  const colB = `hsl(${cfg.vectorColorB})`;
  const colLight = `hsl(${cfg.lightColor})`;
  const gridCol = "hsl(220 14% 20%)";

  /* ── text overlays per scene ── */
  let overlayText = "";
  let overlaySubText = "";
  let overlayColor = "hsl(220 14% 70%)";
  let overlayOpacity = 0;

  if (inScene(2)) {
    overlayText = 'The Projection (The "Shadow")';
    overlayOpacity = projP > 0.4 ? clamp01((projP - 0.4) / 0.3) : 0;
    overlayColor = `hsl(${cfg.projectionColor})`;
  } else if (inScene(3)) {
    overlayText = "Vectors Aligned";
    overlaySubText = "Result: Large Positive Number";
    overlayOpacity = alignP > 0.5 ? clamp01((alignP - 0.5) / 0.3) : 0;
    overlayColor = "hsl(150 70% 55%)";
  } else if (inScene(4)) {
    overlayText = "90° (Perpendicular)";
    overlaySubText = "Result: EXACTLY ZERO";
    overlayOpacity = perpP > 0.5 ? clamp01((perpP - 0.5) / 0.3) : 0;
    overlayColor = "hsl(220 14% 85%)";
  } else if (inScene(5)) {
    overlayText = "Vectors Opposed";
    overlaySubText = "Result: Negative Number";
    overlayOpacity = oppP > 0.5 ? clamp01((oppP - 0.5) / 0.3) : 0;
    overlayColor = `hsl(${cfg.negativeColor})`;
  } else if (pastScene(5)) {
    overlayText = "Dot Product = Alignment Checker";
    overlayOpacity = sumP > 0.1 ? clamp01((sumP - 0.1) / 0.2) : 0;
    overlayColor = `hsl(${cfg.projectionColor})`;
  }

  /* ── dynamic counter in summary ── */
  const showCounter = pastScene(5);
  let counterText = "";
  let counterColor = "hsl(220 14% 70%)";
  if (showCounter) {
    const val = Math.cos(degToRad(angleBDeg));
    if (Math.abs(val) < 0.02) {
      counterText = "Zero";
      counterColor = "hsl(220 14% 85%)";
    } else if (val > 0) {
      counterText = "Positive";
      counterColor = "hsl(150 70% 55%)";
    } else {
      counterText = "Negative";
      counterColor = `hsl(${cfg.negativeColor})`;
    }
  }

  /* ── light source (sun) ── */
  const showLight = pastScene(1) && projP > 0;
  const sunX = pastScene(1) ? fullEndB.x : bTipX;
  const sunY = pastScene(1) ? fullEndB.y - vecLen * 0.6 : bTipY - vecLen * 0.6;
  const lightOpacity = clamp01(projP * 2);

  /* ── target pulse on merge ── */
  const showPulse = moveP > 0.8 && p < ph[2];
  const pulseOpacity = showPulse ? (Math.sin((moveP - 0.8) * 50) * 0.3 + 0.4) * clamp01((1 - moveP) * 5) : 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      style={{ overflow: "hidden", background: "hsl(220 16% 6%)" }}
    >
      <defs>
        <filter id="dp-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="dp-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="dp-sun-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Grid */}
      <g opacity={0.04}>
        {Array.from({ length: Math.floor(width / 60) }, (_, i) => (
          <line key={`gv${i}`} x1={(i + 1) * 60} y1={0} x2={(i + 1) * 60} y2={height} stroke={gridCol} strokeWidth={0.5} />
        ))}
        {Array.from({ length: Math.floor(height / 60) }, (_, i) => (
          <line key={`gh${i}`} x1={0} y1={(i + 1) * 60} x2={width} y2={(i + 1) * 60} stroke={gridCol} strokeWidth={0.5} />
        ))}
      </g>

      {/* Merge target pulse */}
      {showPulse && (
        <g opacity={pulseOpacity}>
          <circle cx={cx} cy={cy} r={14} fill="none" stroke="hsl(220 14% 50%)" strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={8} fill="none" stroke="hsl(220 14% 50%)" strokeWidth={1} />
        </g>
      )}

      {/* Origin dot after merge */}
      {moveP > 0.5 && (
        <g opacity={clamp01((moveP - 0.5) * 2)} filter="url(#dp-soft)">
          <circle cx={cx} cy={cy} r={4} fill="hsl(220 14% 55%)" />
          <circle cx={cx} cy={cy} r={8} fill="none" stroke="hsl(220 14% 40%)" strokeWidth={1} opacity={0.3} />
        </g>
      )}

      {/* Light source / sun icon */}
      {showLight && (
        <g opacity={lightOpacity * 0.7} filter="url(#dp-sun-glow)">
          <circle cx={sunX} cy={sunY} r={10} fill={colLight} opacity={0.3} />
          <circle cx={sunX} cy={sunY} r={5} fill={colLight} opacity={0.6} />
          {/* Rays */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1={sunX + 14 * Math.cos(degToRad(deg))}
              y1={sunY - 14 * Math.sin(degToRad(deg))}
              x2={sunX + 20 * Math.cos(degToRad(deg))}
              y2={sunY - 20 * Math.sin(degToRad(deg))}
              stroke={colLight}
              strokeWidth={1}
              opacity={0.4}
              strokeLinecap="round"
            />
          ))}
        </g>
      )}

      {/* Dotted perpendicular lines from B tip to A axis */}
      {showProjection && projP > 0.2 && (
        <g opacity={clamp01((projP - 0.2) / 0.3)}>
          <line
            x1={bTipX}
            y1={bTipY}
            x2={footX}
            y2={footY}
            stroke={colLight}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeLinecap="round"
            opacity={0.6}
          />
          {/* Small right-angle indicator */}
          {Math.abs(angleBDeg) > 5 && Math.abs(angleBDeg) < 175 && (
            <polyline
              points={`${footX},${footY - 8} ${footX + (projLen >= 0 ? -8 : 8)},${footY - 8} ${footX + (projLen >= 0 ? -8 : 8)},${footY}`}
              fill="none"
              stroke={colLight}
              strokeWidth={1}
              opacity={0.4}
            />
          )}
        </g>
      )}

      {/* Projection / shadow line along A */}
      {showProjection && projP > 0.3 && (
        <g opacity={clamp01((projP - 0.3) / 0.4)}>
          <line
            x1={cx}
            y1={cy}
            x2={cx + projLen * clamp01((projP - 0.3) / 0.5)}
            y2={cy}
            stroke={projCol}
            strokeWidth={4}
            strokeLinecap="round"
            filter="url(#dp-glow)"
          />
          {/* Projection endpoint dot */}
          <circle
            cx={cx + projLen * clamp01((projP - 0.3) / 0.5)}
            cy={cy}
            r={3}
            fill={projCol}
          />
        </g>
      )}

      {/* Extended A axis line (dim) for projection reference */}
      {showProjection && (
        <line
          x1={cx - vecLen * 0.3}
          y1={cy}
          x2={cx + vecLen * 1.3}
          y2={cy}
          stroke={colA}
          strokeWidth={0.5}
          opacity={0.15}
          strokeDasharray="3 6"
        />
      )}

      {/* Vector A */}
      {appearP > 0 && (
        <g opacity={appearP}>
          <line
            x1={originA.x} y1={originA.y}
            x2={endA.x} y2={endA.y}
            stroke={colA} strokeWidth={cfg.strokeWeight} strokeLinecap="round"
            filter="url(#dp-glow)"
          />
          {appearP >= 0.99 && (
            <polygon
              points={`0,0 ${-arrowSize * 2.2},${-arrowSize} ${-arrowSize * 2.2},${arrowSize}`}
              fill={colA}
              transform={`translate(${fullEndA.x},${fullEndA.y}) rotate(0)`}
            />
          )}
          <circle cx={originA.x} cy={originA.y} r={4} fill={colA} opacity={0.8} />
          <circle cx={originA.x} cy={originA.y} r={7} fill="none" stroke={colA} strokeWidth={1} opacity={0.3} />
          {/* Label */}
          <text
            x={fullEndA.x + 16}
            y={fullEndA.y - 10}
            fill={colA}
            fontSize={13}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={600}
            opacity={appearP > 0.9 ? 0.85 : 0}
          >
            Vector A
          </text>
        </g>
      )}

      {/* Vector B */}
      {appearP > 0 && (
        <g opacity={appearP}>
          <line
            x1={bOrigin.x} y1={bOrigin.y}
            x2={endB.x} y2={endB.y}
            stroke={colB} strokeWidth={cfg.strokeWeight} strokeLinecap="round"
            filter="url(#dp-glow)"
          />
          {appearP >= 0.99 && (
            <polygon
              points={`0,0 ${-arrowSize * 2.2},${-arrowSize} ${-arrowSize * 2.2},${arrowSize}`}
              fill={colB}
              transform={`translate(${fullEndB.x},${fullEndB.y}) rotate(${-angleBDeg})`}
            />
          )}
          <circle cx={bOrigin.x} cy={bOrigin.y} r={4} fill={colB} opacity={0.8} />
          <circle cx={bOrigin.x} cy={bOrigin.y} r={7} fill="none" stroke={colB} strokeWidth={1} opacity={0.3} />
          {/* Label */}
          <text
            x={fullEndB.x + 14 * Math.cos(angleBRad)}
            y={fullEndB.y - 14 * Math.sin(angleBRad) - 6}
            fill={colB}
            fontSize={13}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={600}
            opacity={appearP > 0.9 ? 0.85 : 0}
            textAnchor="middle"
          >
            Vector B
          </text>
        </g>
      )}

      {/* Angle arc indicator (small) after merge */}
      {pastScene(1) && angleBDeg > 2 && angleBDeg < 178 && (
        <path
          d={(() => {
            const r = vecLen * 0.18;
            const endAngle = degToRad(angleBDeg);
            const x1 = cx + r;
            const y1 = cy;
            const x2 = cx + r * Math.cos(endAngle);
            const y2 = cy - r * Math.sin(endAngle);
            const large = angleBDeg > 180 ? 1 : 0;
            return `M${x1},${y1} A${r},${r} 0 ${large} 0 ${x2},${y2}`;
          })()}
          fill="none"
          stroke="hsl(220 14% 50%)"
          strokeWidth={1.5}
          opacity={0.5}
          strokeLinecap="round"
        />
      )}

      {/* Angle value badge */}
      {pastScene(1) && (
        <g opacity={0.7}>
          <text
            x={cx + vecLen * 0.24 * Math.cos(degToRad(angleBDeg / 2))}
            y={cy - vecLen * 0.24 * Math.sin(degToRad(angleBDeg / 2)) + 4}
            textAnchor="middle"
            fill="hsl(220 14% 65%)"
            fontSize={10}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={500}
          >
            {Math.round(angleBDeg)}°
          </text>
        </g>
      )}

      {/* Projection label */}
      {showProjection && projP > 0.6 && Math.abs(projLen) > 5 && (
        <g opacity={clamp01((projP - 0.6) / 0.3)}>
          <rect
            x={cx + projLen / 2 - 52}
            y={cy + 14}
            width={104}
            height={22}
            rx={11}
            fill="hsl(220 16% 10%)"
            stroke={projCol}
            strokeWidth={1}
            opacity={0.9}
          />
          <text
            x={cx + projLen / 2}
            y={cy + 29}
            textAnchor="middle"
            fill={projCol}
            fontSize={10}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={600}
          >
            {projIsNegative ? "Negative Shadow" : "Projection"}
          </text>
        </g>
      )}

      {/* Scene overlay text */}
      {overlayOpacity > 0 && (
        <g opacity={overlayOpacity}>
          <text
            x={cx}
            y={height - 70}
            textAnchor="middle"
            fill={overlayColor}
            fontSize={18}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={700}
            letterSpacing="0.02em"
          >
            {overlayText}
          </text>
          {overlaySubText && (
            <text
              x={cx}
              y={height - 46}
              textAnchor="middle"
              fill={overlayColor}
              fontSize={13}
              fontFamily="ui-monospace, 'SF Mono', monospace"
              fontWeight={500}
              opacity={0.7}
            >
              {overlaySubText}
            </text>
          )}
        </g>
      )}

      {/* Dynamic counter in summary */}
      {showCounter && (
        <g opacity={clamp01(sumP / 0.15)}>
          <rect
            x={cx - 50}
            y={height - 110}
            width={100}
            height={28}
            rx={14}
            fill="hsl(220 16% 10%)"
            stroke={counterColor}
            strokeWidth={1.5}
            opacity={0.9}
          />
          <text
            x={cx}
            y={height - 92}
            textAnchor="middle"
            fill={counterColor}
            fontSize={13}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={700}
          >
            {counterText}
          </text>
        </g>
      )}

      {/* Shared origin label */}
      {moveP > 0.8 && p < ph[2] && (
        <text
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          fill="hsl(220 14% 50%)"
          fontSize={10}
          fontFamily="ui-monospace, 'SF Mono', monospace"
          opacity={clamp01((moveP - 0.8) / 0.15) * 0.6}
        >
          shared origin
        </text>
      )}
    </svg>
  );
}
