import { useMemo } from "react";
import type { DotProductConfig } from "./config";
import { defaultDotProductConfig } from "./config";

interface Props {
  progress: number;
  width: number;
  height: number;
  config?: Partial<DotProductConfig>;
}

function clamp01(t: number) { return Math.max(0, Math.min(1, t)); }
function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function degToRad(d: number) { return (d * Math.PI) / 180; }

function buildPhases(p: DotProductConfig["phases"]) {
  const vals = [p.vectorsAppear, p.moveToCenter, p.projection, p.aligned, p.perpendicular, p.opposed, p.summary];
  const b: number[] = [];
  let sum = 0;
  for (const v of vals) { sum += v; b.push(sum); }
  return b;
}

export function DotProductRenderer({ progress, width, height, config: overrides }: Props) {
  const cfg = useMemo(() => ({ ...defaultDotProductConfig, ...overrides }), [overrides]);
  const ph = useMemo(() => buildPhases(cfg.phases), [cfg.phases]);
  const p = clamp01(progress);

  const cx = width / 2;
  const cy = height / 2;
  const vecLen = Math.min(width, height) * cfg.vectorLength;
  const arrowSize = 7;

  const appearP = easeOut(clamp01(p / ph[0]));
  const moveP = easeInOut(clamp01((p - ph[0]) / (ph[1] - ph[0])));
  const projP = easeOut(clamp01((p - ph[1]) / (ph[2] - ph[1])));
  const alignP = easeInOut(clamp01((p - ph[2]) / (ph[3] - ph[2])));
  const perpP = easeInOut(clamp01((p - ph[3]) / (ph[4] - ph[3])));
  const oppP = easeInOut(clamp01((p - ph[4]) / (ph[5] - ph[4])));
  const sumP = clamp01((p - ph[5]) / (ph[6] - ph[5]));

  const initB = cfg.initialAngleB;
  let angleBDeg = initB;

  const inScene = (i: number) => p >= (i > 0 ? ph[i - 1] : 0) && p < ph[i];
  const pastScene = (i: number) => p >= ph[i];

  if (inScene(3)) {
    angleBDeg = lerp(initB, 0, alignP);
  } else if (pastScene(3) && !pastScene(4)) {
    angleBDeg = lerp(0, 90, perpP);
  } else if (pastScene(4) && !pastScene(5)) {
    angleBDeg = lerp(90, 150, oppP);
  } else if (pastScene(5)) {
    const sweepT = (Math.sin(sumP * Math.PI * 4 - Math.PI / 2) + 1) / 2;
    angleBDeg = sweepT * 180;
  } else if (pastScene(3)) {
    angleBDeg = 0;
  }

  const angleBRad = degToRad(angleBDeg);

  // Start positions
  const offsetDist = width * 0.18;
  const startA = { x: cx - offsetDist, y: cy };
  const startB = { x: cx + offsetDist, y: cy - height * 0.04 };

  const originA = { x: lerp(startA.x, cx, moveP), y: lerp(startA.y, cy, moveP) };
  const originB = { x: lerp(startB.x, cx, moveP), y: lerp(startB.y, cy, moveP) };

  const endA = {
    x: originA.x + vecLen * appearP * 1, // cos(0)
    y: originA.y,
  };
  const fullEndA = { x: originA.x + vecLen, y: originA.y };

  const bOrigin = pastScene(1) ? { x: cx, y: cy } : originB;
  const endB = {
    x: bOrigin.x + vecLen * appearP * Math.cos(angleBRad),
    y: bOrigin.y - vecLen * appearP * Math.sin(angleBRad),
  };
  const fullEndB = {
    x: bOrigin.x + vecLen * Math.cos(angleBRad),
    y: bOrigin.y - vecLen * Math.sin(angleBRad),
  };

  // Projection
  const showProjection = pastScene(1) && projP > 0;
  const projLen = vecLen * Math.cos(angleBRad);
  const projIsNegative = projLen < 0;

  const colA = `hsl(${cfg.vectorColorA})`;
  const colB = `hsl(${cfg.vectorColorB})`;
  const projCol = projIsNegative ? `hsl(${cfg.negativeColor})` : `hsl(${cfg.projectionColor})`;
  const gridCol = "hsl(220 14% 22%)";

  // Area fill path for projection "shadow" (like crypto area chart)
  const projAnimLen = projLen * clamp01((projP - 0.2) / 0.6);
  const bTipX = fullEndB.x;
  const bTipY = fullEndB.y;
  const projEndX = cx + projAnimLen;

  // Build smooth area path from origin to B tip down to projection point
  const shadowPath = showProjection && projP > 0.2
    ? `M${cx},${cy} L${bTipX},${bTipY} L${projEndX},${cy} Z`
    : "";

  // Text overlays
  let overlayText = "";
  let overlaySubText = "";
  let overlayColor = "hsl(220 14% 70%)";
  let overlayOpacity = 0;

  if (inScene(2)) {
    overlayText = "The Projection";
    overlayOpacity = projP > 0.4 ? clamp01((projP - 0.4) / 0.3) : 0;
    overlayColor = colA;
  } else if (inScene(3)) {
    overlayText = "Vectors Aligned";
    overlaySubText = "Large Positive";
    overlayOpacity = alignP > 0.5 ? clamp01((alignP - 0.5) / 0.3) : 0;
    overlayColor = "hsl(150 70% 55%)";
  } else if (inScene(4)) {
    overlayText = "Perpendicular";
    overlaySubText = "Exactly Zero";
    overlayOpacity = perpP > 0.5 ? clamp01((perpP - 0.5) / 0.3) : 0;
    overlayColor = "hsl(220 14% 85%)";
  } else if (inScene(5)) {
    overlayText = "Vectors Opposed";
    overlaySubText = "Negative";
    overlayOpacity = oppP > 0.5 ? clamp01((oppP - 0.5) / 0.3) : 0;
    overlayColor = `hsl(${cfg.negativeColor})`;
  } else if (pastScene(5)) {
    overlayText = "Dot Product = Alignment Checker";
    overlayOpacity = sumP > 0.1 ? clamp01((sumP - 0.1) / 0.2) : 0;
    overlayColor = colA;
  }

  // Summary counter
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

  const showPulse = moveP > 0.8 && p < ph[2];
  const pulseOpacity = showPulse ? (Math.sin((moveP - 0.8) * 50) * 0.3 + 0.4) * clamp01((1 - moveP) * 5) : 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      style={{ overflow: "hidden", background: "hsl(220 20% 7%)" }}
    >
      <defs>
        <filter id="dp-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="dp-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="dp-shadow-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={projCol} stopOpacity="0.35" />
          <stop offset="100%" stopColor={projCol} stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="dp-shadow-grad-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={projCol} stopOpacity="0.9" />
          <stop offset="100%" stopColor={projCol} stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* Dashed grid lines - crypto chart style */}
      <g opacity={0.06}>
        {Array.from({ length: Math.floor(width / 60) + 1 }, (_, i) => (
          <line key={`gv${i}`} x1={i * 60} y1={0} x2={i * 60} y2={height} stroke={gridCol} strokeWidth={0.5} strokeDasharray="4 8" />
        ))}
        {Array.from({ length: Math.floor(height / 60) + 1 }, (_, i) => (
          <line key={`gh${i}`} x1={0} y1={i * 60} x2={width} y2={i * 60} stroke={gridCol} strokeWidth={0.5} strokeDasharray="4 8" />
        ))}
      </g>

      {/* Merge target pulse */}
      {showPulse && (
        <g opacity={pulseOpacity}>
          <circle cx={cx} cy={cy} r={14} fill="none" stroke="hsl(25 80% 50% / 0.4)" strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={8} fill="none" stroke="hsl(25 80% 50% / 0.3)" strokeWidth={1} />
        </g>
      )}

      {/* Origin dot after merge */}
      {moveP > 0.5 && (
        <g opacity={clamp01((moveP - 0.5) * 2)} filter="url(#dp-soft)">
          <circle cx={cx} cy={cy} r={3.5} fill="hsl(220 14% 45%)" />
        </g>
      )}

      {/* Extended A axis line for projection reference */}
      {showProjection && (
        <line
          x1={cx - vecLen * 0.2} y1={cy}
          x2={cx + vecLen * 1.3} y2={cy}
          stroke={colA} strokeWidth={0.5} opacity={0.1}
          strokeDasharray="3 6"
        />
      )}

      {/* Area fill shadow (crypto area-chart style) */}
      {shadowPath && (
        <g opacity={clamp01((projP - 0.2) / 0.4)}>
          <path d={shadowPath} fill="url(#dp-shadow-grad)" />
          {/* Top edge glow line from B tip to projection foot */}
          <line
            x1={bTipX} y1={bTipY}
            x2={projEndX} y2={cy}
            stroke={projCol} strokeWidth={1.5} opacity={0.5}
            strokeLinecap="round"
          />
          {/* Bottom projection line along A */}
          <line
            x1={cx} y1={cy}
            x2={projEndX} y2={cy}
            stroke={projCol} strokeWidth={3} strokeLinecap="round"
            filter="url(#dp-glow)" opacity={0.8}
          />
          <circle cx={projEndX} cy={cy} r={3} fill={projCol} opacity={0.7} />
        </g>
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
          <circle cx={originA.x} cy={originA.y} r={4} fill={colA} opacity={0.9} />
          <text
            x={fullEndA.x + 16} y={fullEndA.y - 12}
            fill={colA} fontSize={12}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={600} opacity={appearP > 0.9 ? 0.8 : 0}
          >
            A
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
          <circle cx={bOrigin.x} cy={bOrigin.y} r={4} fill={colB} opacity={0.9} />
          <text
            x={fullEndB.x + 12 * Math.cos(angleBRad)}
            y={fullEndB.y - 12 * Math.sin(angleBRad) - 6}
            fill={colB} fontSize={12}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={600} opacity={appearP > 0.9 ? 0.8 : 0}
            textAnchor="middle"
          >
            B
          </text>
        </g>
      )}

      {/* Projection label */}
      {showProjection && projP > 0.6 && Math.abs(projAnimLen) > 10 && (
        <g opacity={clamp01((projP - 0.6) / 0.3)}>
          <rect
            x={cx + projAnimLen / 2 - 42} y={cy + 14}
            width={84} height={22} rx={11}
            fill="hsl(220 20% 10%)" stroke={projCol} strokeWidth={1} opacity={0.9}
          />
          <text
            x={cx + projAnimLen / 2} y={cy + 29}
            textAnchor="middle" fill={projCol} fontSize={10}
            fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={600}
          >
            {projIsNegative ? "Negative" : "Projection"}
          </text>
        </g>
      )}

      {/* Scene overlay text */}
      {overlayOpacity > 0 && (
        <g opacity={overlayOpacity}>
          <text
            x={cx} y={height - 60}
            textAnchor="middle" fill={overlayColor}
            fontSize={16} fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={700} letterSpacing="0.03em"
          >
            {overlayText}
          </text>
          {overlaySubText && (
            <text
              x={cx} y={height - 40}
              textAnchor="middle" fill={overlayColor}
              fontSize={12} fontFamily="ui-monospace, 'SF Mono', monospace"
              fontWeight={500} opacity={0.7}
            >
              {overlaySubText}
            </text>
          )}
        </g>
      )}

      {/* Summary counter */}
      {showCounter && (
        <g opacity={clamp01(sumP / 0.15)}>
          <rect
            x={cx - 46} y={height - 100}
            width={92} height={26} rx={13}
            fill="hsl(220 20% 10%)" stroke={counterColor} strokeWidth={1.5} opacity={0.9}
          />
          <text
            x={cx} y={height - 83}
            textAnchor="middle" fill={counterColor}
            fontSize={12} fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={700}
          >
            {counterText}
          </text>
        </g>
      )}

      {/* Shared origin label */}
      {moveP > 0.8 && p < ph[2] && (
        <text
          x={cx} y={cy + 20}
          textAnchor="middle" fill="hsl(220 14% 40%)"
          fontSize={9} fontFamily="ui-monospace, 'SF Mono', monospace"
          opacity={clamp01((moveP - 0.8) / 0.15) * 0.5}
        >
          shared origin
        </text>
      )}
    </svg>
  );
}
