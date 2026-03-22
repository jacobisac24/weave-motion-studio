import { useMemo } from "react";
import type { AngleMeasureConfig } from "./config";
import { defaultAngleMeasureConfig } from "./config";

interface Props {
  progress: number;
  width: number;
  height: number;
  config?: Partial<AngleMeasureConfig>;
}

// ---- Helpers ----

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function degToRad(d: number) {
  return (d * Math.PI) / 180;
}

function radToDeg(r: number) {
  return (r * 180) / Math.PI;
}

/** Normalise angle to [0, 360) */
function normDeg(a: number) {
  return ((a % 360) + 360) % 360;
}

function buildPhases(p: AngleMeasureConfig["phases"]) {
  const vals = [
    p.vectorsAppear,
    p.vectorsMove,
    p.interiorArc,
    p.holdInterior,
    p.reflexArc,
    p.settle,
  ];
  const boundaries: number[] = [];
  let sum = 0;
  for (const v of vals) {
    sum += v;
    boundaries.push(sum);
  }
  return boundaries;
}

/** Describe an SVG arc path */
function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
  sweep: "cw" | "ccw" = "cw"
): string {
  const s = degToRad(startDeg);
  const e = degToRad(endDeg);
  const x1 = cx + r * Math.cos(s);
  const y1 = cy - r * Math.sin(s);
  const x2 = cx + r * Math.cos(e);
  const y2 = cy - r * Math.sin(e);

  let angleDiff = normDeg(endDeg - startDeg);
  if (sweep === "ccw") angleDiff = 360 - angleDiff;
  const largeArc = angleDiff > 180 ? 1 : 0;
  const sweepFlag = sweep === "cw" ? 0 : 1;

  return `M${x1},${y1} A${r},${r} 0 ${largeArc} ${sweepFlag} ${x2},${y2}`;
}

// ---- Component ----

export function AngleMeasureRenderer({
  progress,
  width,
  height,
  config: overrides,
}: Props) {
  const cfg = useMemo(
    () => ({ ...defaultAngleMeasureConfig, ...overrides }),
    [overrides]
  );

  const phases = useMemo(() => buildPhases(cfg.phases), [cfg.phases]);
  const p = clamp01(progress);

  // Centre of canvas
  const cx = width / 2;
  const cy = height / 2;
  const vecLen = Math.min(width, height) * cfg.vectorLength;

  // Angles
  const aDeg = normDeg(cfg.angleA); // vector A
  const bDeg = normDeg(cfg.angleB); // vector B

  // Interior angle (smaller)
  const rawInterior = normDeg(bDeg - aDeg);
  const interiorDeg = rawInterior <= 180 ? rawInterior : 360 - rawInterior;
  const reflexDeg = 360 - interiorDeg;

  // Start positions (vectors appear at separate locations)
  const offsetDist = width * 0.22;
  const startA = { x: cx - offsetDist, y: cy + height * 0.08 };
  const startB = { x: cx + offsetDist, y: cy - height * 0.08 };

  // ---- Phase progress ----
  const appearP = easeOutQuart(clamp01(p / phases[0]));
  const moveP = easeInOutCubic(clamp01((p - phases[0]) / (phases[1] - phases[0])));
  const interiorP = easeOutBack(clamp01((p - phases[1]) / (phases[2] - phases[1])));
  const reflexP = easeOutBack(
    clamp01((p - phases[3]) / (phases[4] - phases[3]))
  );

  // Current origins (lerp from separate to center)
  const originA = {
    x: lerp(startA.x, cx, moveP),
    y: lerp(startA.y, cy, moveP),
  };
  const originB = {
    x: lerp(startB.x, cx, moveP),
    y: lerp(startB.y, cy, moveP),
  };

  // Vector endpoints
  const aRad = degToRad(aDeg);
  const bRad = degToRad(bDeg);
  const endA = {
    x: originA.x + vecLen * Math.cos(aRad),
    y: originA.y - vecLen * Math.sin(aRad),
  };
  const endB = {
    x: originB.x + vecLen * Math.cos(bRad),
    y: originB.y - vecLen * Math.sin(bRad),
  };

  // Arc radii
  const arcRadiusInterior = vecLen * 0.32;
  const arcRadiusReflex = vecLen * 0.22;

  // Determine sweep direction for interior
  const interiorStartDeg = rawInterior <= 180 ? aDeg : bDeg;
  const interiorEndDeg = rawInterior <= 180 ? bDeg : aDeg;

  // Reflex goes the other way
  const reflexStartDeg = interiorEndDeg;
  const reflexEndDeg = interiorStartDeg;

  // Draw the arcs with animated sweep
  const interiorSweepEnd = lerp(interiorStartDeg, interiorEndDeg, interiorP);
  const reflexSweepEnd = lerp(reflexStartDeg, reflexEndDeg, reflexP);

  // Label positions
  const interiorMidRad = degToRad((interiorStartDeg + interiorEndDeg) / 2);
  const labelDistInterior = arcRadiusInterior + 22;
  const interiorLabelPos = {
    x: cx + labelDistInterior * Math.cos(interiorMidRad),
    y: cy - labelDistInterior * Math.sin(interiorMidRad),
  };

  // For reflex label, go the opposite direction
  const reflexMidDeg = normDeg(
    reflexStartDeg + (normDeg(reflexEndDeg - reflexStartDeg + 360) % 360) / 2
  );
  const reflexMidRad = degToRad(reflexMidDeg);
  const labelDistReflex = arcRadiusReflex + 22;
  const reflexLabelPos = {
    x: cx + labelDistReflex * Math.cos(reflexMidRad),
    y: cy - labelDistReflex * Math.sin(reflexMidRad),
  };

  // Colors
  const colA = `hsl(${cfg.vectorColorA})`;
  const colB = `hsl(${cfg.vectorColorB})`;
  const colInterior = `hsl(${cfg.arcColorInterior})`;
  const colReflex = `hsl(${cfg.arcColorReflex})`;
  const colDot = `hsl(${cfg.bgDotColor})`;

  const showInterior = p >= phases[1];
  const showReflex = p >= phases[3];

  const arrowSize = 7;

  // Angle values for display
  const interiorVal = Math.round(interiorDeg);
  const reflexVal = Math.round(reflexDeg);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      style={{ overflow: "hidden", background: "hsl(220 16% 6%)" }}
    >
      <defs>
        <filter id="am-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="am-arc-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodOpacity="0.3" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="cb" />
          <feMerge>
            <feMergeNode in="cb" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Subtle dot grid */}
      <g opacity={0.12}>
        {Array.from({ length: Math.floor(width / 40) }, (_, i) =>
          Array.from({ length: Math.floor(height / 40) }, (_, j) => (
            <circle
              key={`d${i}-${j}`}
              cx={(i + 1) * 40}
              cy={(j + 1) * 40}
              r={1}
              fill={colDot}
            />
          ))
        )}
      </g>

      {/* Origin dot when merged */}
      {moveP > 0.5 && (
        <g opacity={moveP} filter="url(#am-glow)">
          <circle cx={cx} cy={cy} r={5} fill="hsl(220 14% 50%)" opacity={0.6} />
          <circle
            cx={cx}
            cy={cy}
            r={9}
            fill="none"
            stroke="hsl(220 14% 40%)"
            strokeWidth={1}
            opacity={0.25}
          />
        </g>
      )}

      {/* Interior arc */}
      {showInterior && interiorP > 0.01 && (
        <g opacity={Math.min(1, interiorP)} filter="url(#am-arc-glow)">
          <path
            d={arcPath(cx, cy, arcRadiusInterior, interiorStartDeg, interiorSweepEnd, "cw")}
            fill="none"
            stroke={colInterior}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          {/* Tick marks at ends */}
          {interiorP > 0.9 && (
            <>
              {/* Small tick at start */}
              <line
                x1={cx + (arcRadiusInterior - 5) * Math.cos(degToRad(interiorStartDeg))}
                y1={cy - (arcRadiusInterior - 5) * Math.sin(degToRad(interiorStartDeg))}
                x2={cx + (arcRadiusInterior + 5) * Math.cos(degToRad(interiorStartDeg))}
                y2={cy - (arcRadiusInterior + 5) * Math.sin(degToRad(interiorStartDeg))}
                stroke={colInterior}
                strokeWidth={1.5}
                opacity={0.5}
              />
              <line
                x1={cx + (arcRadiusInterior - 5) * Math.cos(degToRad(interiorEndDeg))}
                y1={cy - (arcRadiusInterior - 5) * Math.sin(degToRad(interiorEndDeg))}
                x2={cx + (arcRadiusInterior + 5) * Math.cos(degToRad(interiorEndDeg))}
                y2={cy - (arcRadiusInterior + 5) * Math.sin(degToRad(interiorEndDeg))}
                stroke={colInterior}
                strokeWidth={1.5}
                opacity={0.5}
              />
            </>
          )}
          {/* Label */}
          {interiorP > 0.6 && (
            <g opacity={clamp01((interiorP - 0.6) / 0.3)}>
              <rect
                x={interiorLabelPos.x - 30}
                y={interiorLabelPos.y - 12}
                width={60}
                height={24}
                rx={12}
                fill="hsl(220 16% 10%)"
                stroke={colInterior}
                strokeWidth={1}
                opacity={0.9}
              />
              <text
                x={interiorLabelPos.x}
                y={interiorLabelPos.y + 4}
                textAnchor="middle"
                fill={colInterior}
                fontSize={11}
                fontFamily="ui-monospace, 'SF Mono', monospace"
                fontWeight={600}
              >
                A {interiorVal}°
              </text>
            </g>
          )}
        </g>
      )}

      {/* Reflex arc */}
      {showReflex && reflexP > 0.01 && (
        <g opacity={Math.min(1, reflexP)} filter="url(#am-arc-glow)">
          <path
            d={arcPath(cx, cy, arcRadiusReflex, reflexStartDeg, reflexSweepEnd, "ccw")}
            fill="none"
            stroke={colReflex}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="6 3"
          />
          {/* Label */}
          {reflexP > 0.6 && (
            <g opacity={clamp01((reflexP - 0.6) / 0.3)}>
              <rect
                x={reflexLabelPos.x - 30}
                y={reflexLabelPos.y - 12}
                width={60}
                height={24}
                rx={12}
                fill="hsl(220 16% 10%)"
                stroke={colReflex}
                strokeWidth={1}
                opacity={0.9}
              />
              <text
                x={reflexLabelPos.x}
                y={reflexLabelPos.y + 4}
                textAnchor="middle"
                fill={colReflex}
                fontSize={11}
                fontFamily="ui-monospace, 'SF Mono', monospace"
                fontWeight={600}
              >
                R {reflexVal}°
              </text>
            </g>
          )}
        </g>
      )}

      {/* Vector A */}
      {appearP > 0 && (
        <g opacity={appearP}>
          {/* Shaft */}
          <line
            x1={originA.x}
            y1={originA.y}
            x2={lerp(originA.x, endA.x, appearP)}
            y2={lerp(originA.y, endA.y, appearP)}
            stroke={colA}
            strokeWidth={cfg.strokeWeight}
            strokeLinecap="round"
            filter="url(#am-glow)"
          />
          {/* Arrowhead */}
          {appearP > 0.85 && (
            <polygon
              points={`0,0 ${-arrowSize * 2.2},${-arrowSize} ${-arrowSize * 2.2},${arrowSize}`}
              fill={colA}
              transform={`translate(${endA.x},${endA.y}) rotate(${-aDeg})`}
              opacity={appearP}
            />
          )}
          {/* Origin dot */}
          <circle cx={originA.x} cy={originA.y} r={4} fill={colA} opacity={0.8} />
          <circle
            cx={originA.x}
            cy={originA.y}
            r={7}
            fill="none"
            stroke={colA}
            strokeWidth={1}
            opacity={0.3}
          />
          {/* Label */}
          <text
            x={endA.x + 10 * Math.cos(aRad)}
            y={endA.y - 10 * Math.sin(aRad)}
            textAnchor="middle"
            fill={colA}
            fontSize={12}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={600}
            opacity={appearP * 0.8}
          >
            a
          </text>
        </g>
      )}

      {/* Vector B */}
      {appearP > 0 && (
        <g opacity={appearP}>
          <line
            x1={originB.x}
            y1={originB.y}
            x2={lerp(originB.x, endB.x, appearP)}
            y2={lerp(originB.y, endB.y, appearP)}
            stroke={colB}
            strokeWidth={cfg.strokeWeight}
            strokeLinecap="round"
            filter="url(#am-glow)"
          />
          {appearP > 0.85 && (
            <polygon
              points={`0,0 ${-arrowSize * 2.2},${-arrowSize} ${-arrowSize * 2.2},${arrowSize}`}
              fill={colB}
              transform={`translate(${endB.x},${endB.y}) rotate(${-bDeg})`}
              opacity={appearP}
            />
          )}
          <circle cx={originB.x} cy={originB.y} r={4} fill={colB} opacity={0.8} />
          <circle
            cx={originB.x}
            cy={originB.y}
            r={7}
            fill="none"
            stroke={colB}
            strokeWidth={1}
            opacity={0.3}
          />
          <text
            x={endB.x + 10 * Math.cos(bRad)}
            y={endB.y - 10 * Math.sin(bRad)}
            textAnchor="middle"
            fill={colB}
            fontSize={12}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={600}
            opacity={appearP * 0.8}
          >
            b
          </text>
        </g>
      )}

      {/* "shared origin" label when vectors merge */}
      {moveP > 0.8 && moveP <= 1 && (
        <text
          x={cx}
          y={cy + 24}
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
