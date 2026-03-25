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
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
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
  // Move join point to lower half for better space usage
  const cy = height * 0.55;
  const vecLen = Math.min(width, height) * cfg.vectorLength;
  const arrowSize = 7;

  // Phase progress
  const appearP = easeOut(clamp01(p / ph[0]));
  const moveP = easeInOutCubic(clamp01((p - ph[0]) / (ph[1] - ph[0])));
  const projP = easeInOutCubic(clamp01((p - ph[1]) / (ph[2] - ph[1])));
  const alignP = easeInOutCubic(clamp01((p - ph[2]) / (ph[3] - ph[2])));
  const perpP = easeInOutCubic(clamp01((p - ph[3]) / (ph[4] - ph[3])));
  const oppP = easeInOutCubic(clamp01((p - ph[4]) / (ph[5] - ph[4])));
  const sumP = clamp01((p - ph[5]) / (ph[6] - ph[5]));

  const inScene = (i: number) => p >= (i > 0 ? ph[i - 1] : 0) && p < ph[i];
  const pastScene = (i: number) => p >= ph[i];

  // Vector A starts inclined down by ~15 degrees
  const initialAngleA = -15;
  // After join (moveP complete), rotate both so A aligns to x-axis
  // This rotation applies to the whole system
  const systemRotation = pastScene(1) ? lerp(initialAngleA, 0, easeInOutCubic(clamp01((moveP - 0.95) / 0.05) + (pastScene(1) ? projP * 0.3 : 0))) : initialAngleA;
  // Actually: during moveToCenter, rotate system. After move complete, A should be at 0.
  // Let's make the system rotation happen during the move phase
  const systemAngleDeg = lerp(initialAngleA, 0, moveP);
  const systemAngleRad = degToRad(systemAngleDeg);

  // Vector B angle relative to system
  const initB = cfg.initialAngleB;
  let angleBRelDeg = initB; // relative to A

  if (inScene(3)) {
    angleBRelDeg = lerp(initB, 0, alignP);
  } else if (pastScene(3) && !pastScene(4)) {
    angleBRelDeg = lerp(0, 90, perpP);
  } else if (pastScene(4) && !pastScene(5)) {
    angleBRelDeg = lerp(90, 150, oppP);
  } else if (pastScene(5)) {
    const sweepT = (Math.sin(sumP * Math.PI * 4 - Math.PI / 2) + 1) / 2;
    angleBRelDeg = sweepT * 180;
  } else if (pastScene(3)) {
    angleBRelDeg = 0;
  }

  // Absolute angles
  const angleADeg = systemAngleDeg;
  const angleARad = degToRad(angleADeg);
  const angleBAbsDeg = systemAngleDeg + angleBRelDeg;
  const angleBAbsRad = degToRad(angleBAbsDeg);

  // Start positions (well separated)
  const offsetDist = width * 0.18;
  const startA = { x: cx - offsetDist, y: cy + height * 0.04 };
  const startB = { x: cx + offsetDist * 0.6, y: cy - height * 0.12 };

  const originA = { x: lerp(startA.x, cx, moveP), y: lerp(startA.y, cy, moveP) };
  const originB = { x: lerp(startB.x, cx, moveP), y: lerp(startB.y, cy, moveP) };

  // Vector A end (inclined, then straightens)
  const endA = {
    x: originA.x + vecLen * appearP * Math.cos(angleARad),
    y: originA.y - vecLen * appearP * Math.sin(angleARad),
  };
  const fullEndA = {
    x: originA.x + vecLen * Math.cos(angleARad),
    y: originA.y - vecLen * Math.sin(angleARad),
  };

  // Vector B
  const bOrigin = pastScene(1) ? { x: cx, y: cy } : originB;
  const endB = {
    x: bOrigin.x + vecLen * appearP * Math.cos(angleBAbsRad),
    y: bOrigin.y - vecLen * appearP * Math.sin(angleBAbsRad),
  };
  const fullEndB = {
    x: bOrigin.x + vecLen * Math.cos(angleBAbsRad),
    y: bOrigin.y - vecLen * Math.sin(angleBAbsRad),
  };

  // After system is aligned (pastScene(1)), A points along x-axis
  // Projection math uses relative angle
  const angleBRelRad = degToRad(angleBRelDeg);
  const showProjection = pastScene(1) && projP > 0;
  const projLen = vecLen * Math.cos(angleBRelRad);
  const projIsNegative = projLen < 0;

  const colA = `hsl(${cfg.vectorColorA})`;
  const colB = `hsl(${cfg.vectorColorB})`;
  const projCol = projIsNegative ? `hsl(${cfg.negativeColor})` : `hsl(${cfg.projectionColor})`;
  const gridCol = "hsl(220 14% 22%)";

  // Sun: appears and shadow drops simultaneously
  const sunP = clamp01(projP / 0.3);
  const sunFadeP = clamp01((projP - 0.5) / 0.2);
  const sunOpacity = sunP * (1 - sunFadeP);

  // Shadow drops from top simultaneously with sun
  const shadowDropP = easeInOutCubic(clamp01(projP / 0.5));

  // Projection line along A (after shadow drops)
  const projLineP = easeInOutCubic(clamp01((projP - 0.3) / 0.5));
  const projAnimLen = projLen * projLineP;

  // B tip position (after system aligned, use cx/cy as origin)
  const bTipX = pastScene(1) ? cx + vecLen * Math.cos(angleBRelRad) : fullEndB.x;
  const bTipY = pastScene(1) ? cy - vecLen * Math.sin(angleBRelRad) : fullEndB.y;
  // Projection end on A axis (horizontal after alignment)
  const projEndX = cx + projAnimLen;

  // Dotted lines drop from B tip down to A axis (cy)
  const dropLineEndY = lerp(bTipY, cy, shadowDropP);

  // Shadow fill - gradient goes top to bottom (from B tip down to axis)
  const showShadowFill = showProjection && shadowDropP > 0.05;

  // Shadow path: triangle from origin to B tip to projection point
  const shadowPath = showShadowFill
    ? `M${cx},${cy} L${bTipX},${lerp(cy, bTipY, shadowDropP)} L${cx + projLen * shadowDropP},${cy} Z`
    : "";

  // Dimension-style length marker
  const showDimension = showProjection && projLineP > 0.1 && Math.abs(projAnimLen) > 10;
  const dimY = cy + 28; // below the axis
  const dimStartX = cx;
  const dimEndX = projEndX;
  const projLenDisplay = Math.abs(projAnimLen).toFixed(0);

  // Text overlays
  let overlayText = "";
  let overlaySubText = "";
  let overlayColor = "hsl(220 14% 70%)";
  let overlayOpacity = 0;

  if (inScene(2)) {
    overlayText = "The Projection";
    overlayOpacity = projP > 0.6 ? clamp01((projP - 0.6) / 0.2) : 0;
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
    const val = Math.cos(degToRad(angleBRelDeg));
    if (Math.abs(val) < 0.05) {
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

  // Join bubble: only after vectors have fully met
  const showJoinBubble = moveP >= 0.95 && p < ph[2];
  const bubbleOpacity = showJoinBubble ? clamp01((moveP - 0.95) / 0.05) : 0;

  // Sun position above B tip
  const sunX = bTipX;
  const sunY = bTipY - height * 0.12;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      style={{ overflow: "hidden", background: "hsl(220 20% 7%)" }}
    >
      <defs>
        <linearGradient id="dp-shadow-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={projCol} stopOpacity="0.35" />
          <stop offset="100%" stopColor={projCol} stopOpacity="0.03" />
        </linearGradient>
        <radialGradient id="dp-sun-radial" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(45 100% 70%)" stopOpacity="1" />
          <stop offset="40%" stopColor="hsl(40 95% 60%)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="hsl(35 90% 50%)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Dashed grid */}
      <g opacity={0.06}>
        {Array.from({ length: Math.floor(width / 60) + 1 }, (_, i) => (
          <line key={`gv${i}`} x1={i * 60} y1={0} x2={i * 60} y2={height} stroke={gridCol} strokeWidth={0.5} strokeDasharray="4 8" />
        ))}
        {Array.from({ length: Math.floor(height / 60) + 1 }, (_, i) => (
          <line key={`gh${i}`} x1={0} y1={i * 60} x2={width} y2={i * 60} stroke={gridCol} strokeWidth={0.5} strokeDasharray="4 8" />
        ))}
      </g>

      {/* Join bubble - ONLY after vectors fully meet */}
      {bubbleOpacity > 0 && (
        <g opacity={bubbleOpacity}>
          <circle cx={cx} cy={cy} r={14} fill="none" stroke="hsl(25 80% 50% / 0.5)" strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={8} fill="none" stroke="hsl(25 80% 50% / 0.3)" strokeWidth={1} />
          <circle cx={cx} cy={cy} r={3.5} fill="hsl(220 14% 45%)" />
        </g>
      )}

      {/* Origin dot after merge */}
      {pastScene(1) && !showJoinBubble && (
        <g opacity={0.7}>
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

      {/* Sun icon - appears during projection, shadow drops at same time */}
      {showProjection && sunOpacity > 0.01 && (
        <g opacity={sunOpacity}>
          <circle cx={sunX} cy={sunY} r={16} fill="url(#dp-sun-radial)" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = degToRad(angle);
            const r1 = 20;
            const r2 = 28;
            return (
              <line
                key={`ray${angle}`}
                x1={sunX + r1 * Math.cos(rad)} y1={sunY + r1 * Math.sin(rad)}
                x2={sunX + r2 * Math.cos(rad)} y2={sunY + r2 * Math.sin(rad)}
                stroke="hsl(45 100% 65%)" strokeWidth={1.5} strokeLinecap="round"
                opacity={0.6}
              />
            );
          })}
        </g>
      )}

      {/* Dotted lines dropping from B tip to A axis */}
      {showProjection && shadowDropP > 0 && (
        <g opacity={clamp01(shadowDropP / 0.3) * 0.6}>
          <line
            x1={bTipX} y1={bTipY}
            x2={bTipX} y2={dropLineEndY}
            stroke={projCol} strokeWidth={1} strokeDasharray="3 4"
            strokeLinecap="round"
          />
          {shadowDropP > 0.9 && (
            <g opacity={clamp01((shadowDropP - 0.9) / 0.1)}>
              <polyline
                points={`${bTipX - 8},${cy} ${bTipX - 8},${cy - 8} ${bTipX},${cy - 8}`}
                fill="none" stroke={projCol} strokeWidth={0.8} opacity={0.5}
              />
            </g>
          )}
        </g>
      )}

      {/* Shadow fill - animates top to bottom */}
      {shadowPath && (
        <g opacity={clamp01(shadowDropP / 0.3) * 0.7}>
          <path d={shadowPath} fill="url(#dp-shadow-grad)" />
        </g>
      )}

      {/* Projection line along A */}
      {showProjection && projLineP > 0 && (
        <g opacity={clamp01(projLineP / 0.2)}>
          <line
            x1={cx} y1={cy}
            x2={projEndX} y2={cy}
            stroke={projCol} strokeWidth={3} strokeLinecap="round"
            opacity={0.8}
          />
          <circle cx={projEndX} cy={cy} r={3} fill={projCol} opacity={0.7} />
        </g>
      )}

      {/* Dimension-style length marker */}
      {showDimension && (
        <g opacity={clamp01((projLineP - 0.1) / 0.3)}>
          {/* Vertical ticks at start and end */}
          <line x1={dimStartX} y1={cy + 8} x2={dimStartX} y2={dimY + 8} stroke={projCol} strokeWidth={0.8} opacity={0.5} />
          <line x1={dimEndX} y1={cy + 8} x2={dimEndX} y2={dimY + 8} stroke={projCol} strokeWidth={0.8} opacity={0.5} />
          {/* Horizontal dimension line with arrows */}
          <line x1={dimStartX + 4} y1={dimY} x2={dimEndX - 4} y2={dimY} stroke={projCol} strokeWidth={0.8} opacity={0.6} />
          {/* Left arrow */}
          <polygon
            points={`${dimStartX},${dimY} ${dimStartX + 6},${dimY - 3} ${dimStartX + 6},${dimY + 3}`}
            fill={projCol} opacity={0.6}
          />
          {/* Right arrow */}
          <polygon
            points={`${dimEndX},${dimY} ${dimEndX - 6},${dimY - 3} ${dimEndX - 6},${dimY + 3}`}
            fill={projCol} opacity={0.6}
          />
          {/* Length label */}
          <rect
            x={(dimStartX + dimEndX) / 2 - 22} y={dimY + 4}
            width={44} height={18} rx={9}
            fill="hsl(220 20% 10%)" stroke={projCol} strokeWidth={0.8} opacity={0.9}
          />
          <text
            x={(dimStartX + dimEndX) / 2} y={dimY + 17}
            textAnchor="middle" fill={projCol} fontSize={10}
            fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={600}
          >
            {projIsNegative ? `−${projLenDisplay}` : projLenDisplay}
          </text>
        </g>
      )}

      {/* Vector A - solid, no glow */}
      {appearP > 0 && (
        <g>
          <line
            x1={originA.x} y1={originA.y}
            x2={endA.x} y2={endA.y}
            stroke={colA} strokeWidth={cfg.strokeWeight} strokeLinecap="round"
            opacity={appearP}
          />
          {appearP >= 0.99 && (
            <polygon
              points={`0,0 ${-arrowSize * 2.2},${-arrowSize} ${-arrowSize * 2.2},${arrowSize}`}
              fill={colA}
              transform={`translate(${fullEndA.x},${fullEndA.y}) rotate(${-angleADeg})`}
            />
          )}
          <circle cx={originA.x} cy={originA.y} r={4} fill={colA} opacity={0.9} />
          <text
            x={fullEndA.x + 14 * Math.cos(angleARad)}
            y={fullEndA.y - 14 * Math.sin(angleARad) - 6}
            fill={colA} fontSize={13}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={700} opacity={appearP > 0.9 ? 0.9 : 0}
            textAnchor="middle"
          >
            A
          </text>
        </g>
      )}

      {/* Vector B - solid, no glow */}
      {appearP > 0 && (
        <g>
          <line
            x1={bOrigin.x} y1={bOrigin.y}
            x2={endB.x} y2={endB.y}
            stroke={colB} strokeWidth={cfg.strokeWeight} strokeLinecap="round"
            opacity={appearP}
          />
          {appearP >= 0.99 && (
            <polygon
              points={`0,0 ${-arrowSize * 2.2},${-arrowSize} ${-arrowSize * 2.2},${arrowSize}`}
              fill={colB}
              transform={`translate(${fullEndB.x},${fullEndB.y}) rotate(${-angleBAbsDeg})`}
            />
          )}
          <circle cx={bOrigin.x} cy={bOrigin.y} r={4} fill={colB} opacity={0.9} />
          <text
            x={fullEndB.x + 12 * Math.cos(angleBAbsRad)}
            y={fullEndB.y - 12 * Math.sin(angleBAbsRad) - 6}
            fill={colB} fontSize={13}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={700} opacity={appearP > 0.9 ? 0.9 : 0}
            textAnchor="middle"
          >
            B
          </text>
        </g>
      )}

      {/* Scene overlay text */}
      {overlayOpacity > 0 && (
        <g opacity={overlayOpacity}>
          <text
            x={cx} y={height - 50}
            textAnchor="middle" fill={overlayColor}
            fontSize={16} fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={700} letterSpacing="0.03em"
          >
            {overlayText}
          </text>
          {overlaySubText && (
            <text
              x={cx} y={height - 30}
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
            x={cx - 46} y={height - 90}
            width={92} height={26} rx={13}
            fill="hsl(220 20% 10%)" stroke={counterColor} strokeWidth={1.5} opacity={0.9}
          />
          <text
            x={cx} y={height - 73}
            textAnchor="middle" fill={counterColor}
            fontSize={12} fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={700}
          >
            {counterText}
          </text>
        </g>
      )}

      {/* Shared origin label */}
      {showJoinBubble && (
        <text
          x={cx} y={cy + 24}
          textAnchor="middle" fill="hsl(220 14% 40%)"
          fontSize={9} fontFamily="ui-monospace, 'SF Mono', monospace"
          opacity={bubbleOpacity * 0.5}
        >
          shared origin
        </text>
      )}
    </svg>
  );
}
