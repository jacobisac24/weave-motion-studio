import { useMemo } from "react";
import type { AngleMeasureConfig } from "./config";
import { defaultAngleMeasureConfig } from "./config";

interface Props {
  progress: number;
  width: number;
  height: number;
  config?: Partial<AngleMeasureConfig>;
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4);
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function degToRad(d: number) {
  return (d * Math.PI) / 180;
}
function normDeg(a: number) {
  return ((a % 360) + 360) % 360;
}

function buildPhases(p: AngleMeasureConfig["phases"]) {
  const vals = [
    p.vectorsAppear, p.vectorsMove, p.interiorArc,
    p.holdInterior, p.reflexArc, p.settle,
  ];
  const boundaries: number[] = [];
  let sum = 0;
  for (const v of vals) { sum += v; boundaries.push(sum); }
  return boundaries;
}

/** SVG arc path that sweeps exactly from startDeg to endDeg */
function arcPath(
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number,
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

export function AngleMeasureRenderer({ progress, width, height, config: overrides }: Props) {
  const cfg = useMemo(() => ({ ...defaultAngleMeasureConfig, ...overrides }), [overrides]);
  const phases = useMemo(() => buildPhases(cfg.phases), [cfg.phases]);
  const p = clamp01(progress);

  const cx = width / 2;
  const cy = height / 2;
  const vecLen = Math.min(width, height) * cfg.vectorLength;

  const aDeg = normDeg(cfg.angleA);
  const bDeg = normDeg(cfg.angleB);

  // Interior = smaller angle between the two vectors
  const rawInterior = normDeg(bDeg - aDeg);
  const interiorDeg = rawInterior <= 180 ? rawInterior : 360 - rawInterior;
  const reflexDeg = 360 - interiorDeg;

  // Start positions
  const offsetDist = width * 0.22;
  const startA = { x: cx - offsetDist, y: cy + height * 0.08 };
  const startB = { x: cx + offsetDist, y: cy - height * 0.08 };

  // Phase progress — use easeOutQuart for arcs (no overshoot!)
  const appearP = easeOutQuart(clamp01(p / phases[0]));
  const moveP = easeInOutCubic(clamp01((p - phases[0]) / (phases[1] - phases[0])));
  const interiorP = easeOutQuart(clamp01((p - phases[1]) / (phases[2] - phases[1])));
  const reflexP = easeOutQuart(clamp01((p - phases[3]) / (phases[4] - phases[3])));

  // Current origins
  const originA = { x: lerp(startA.x, cx, moveP), y: lerp(startA.y, cy, moveP) };
  const originB = { x: lerp(startB.x, cx, moveP), y: lerp(startB.y, cy, moveP) };

  const aRad = degToRad(aDeg);
  const bRad = degToRad(bDeg);

  // Vector endpoints scale with appearP so arrow only exists at tip when fully drawn
  const endA = {
    x: originA.x + vecLen * appearP * Math.cos(aRad),
    y: originA.y - vecLen * appearP * Math.sin(aRad),
  };
  const endB = {
    x: originB.x + vecLen * appearP * Math.cos(bRad),
    y: originB.y - vecLen * appearP * Math.sin(bRad),
  };
  // Full endpoints (for arrow placement after full draw)
  const fullEndA = { x: originA.x + vecLen * Math.cos(aRad), y: originA.y - vecLen * Math.sin(aRad) };
  const fullEndB = { x: originB.x + vecLen * Math.cos(bRad), y: originB.y - vecLen * Math.sin(bRad) };

  const arcRadiusInterior = vecLen * 0.32;
  const arcRadiusReflex = vecLen * 0.22;

  // Interior: sweep CW from A to B (the short way)
  const interiorStartDeg = rawInterior <= 180 ? aDeg : bDeg;
  const interiorEndDeg = rawInterior <= 180 ? bDeg : aDeg;

  // Reflex: sweep the OPPOSITE direction (CCW) covering the big angle
  const reflexStartDeg = interiorStartDeg;
  const reflexEndDeg = interiorEndDeg;

  // Animated sweep — arc grows from start toward end, clamped by progress
  const interiorSweepEnd = lerp(interiorStartDeg, interiorEndDeg, interiorP);
  const reflexSweepEnd = lerp(reflexStartDeg, reflexEndDeg, reflexP);

  // Label positions
  const interiorMidDeg = (interiorStartDeg + interiorEndDeg) / 2;
  const interiorMidRad = degToRad(interiorMidDeg);
  const labelDistInterior = arcRadiusInterior + 24;
  const interiorLabelPos = {
    x: cx + labelDistInterior * Math.cos(interiorMidRad),
    y: cy - labelDistInterior * Math.sin(interiorMidRad),
  };

  // Reflex label — on the opposite side
  const reflexMidDeg = normDeg(interiorStartDeg + (normDeg(interiorStartDeg - interiorEndDeg + 360) % 360) / 2 + 180);
  const reflexMidRad = degToRad(reflexMidDeg);
  const labelDistReflex = arcRadiusReflex + 24;
  const reflexLabelPos = {
    x: cx + labelDistReflex * Math.cos(reflexMidRad),
    y: cy - labelDistReflex * Math.sin(reflexMidRad),
  };

  // Colors — warmer, more vibrant palette
  const colA = `hsl(${cfg.vectorColorA})`;
  const colB = `hsl(${cfg.vectorColorB})`;
  const colInterior = `hsl(${cfg.arcColorInterior})`;
  const colReflex = `hsl(${cfg.arcColorReflex})`;
  const gridCol = "hsl(220 14% 20%)";

  const showInterior = p >= phases[1];
  const showReflex = p >= phases[3];

  const arrowSize = 7;
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

      {/* Line grid — curve-vector style */}
      <g opacity={0.04}>
        {Array.from({ length: Math.floor(width / 60) }, (_, i) => (
          <line key={`gv${i}`} x1={(i + 1) * 60} y1={0} x2={(i + 1) * 60} y2={height} stroke={gridCol} strokeWidth={0.5} />
        ))}
        {Array.from({ length: Math.floor(height / 60) }, (_, i) => (
          <line key={`gh${i}`} x1={0} y1={(i + 1) * 60} x2={width} y2={(i + 1) * 60} stroke={gridCol} strokeWidth={0.5} />
        ))}
      </g>

      {/* Origin dot when merged */}
      {moveP > 0.5 && (
        <g opacity={moveP} filter="url(#am-glow)">
          <circle cx={cx} cy={cy} r={5} fill="hsl(220 14% 50%)" opacity={0.6} />
          <circle cx={cx} cy={cy} r={9} fill="none" stroke="hsl(220 14% 40%)" strokeWidth={1} opacity={0.25} />
        </g>
      )}

      {/* Interior arc — sweeps CW */}
      {showInterior && interiorP > 0.01 && (
        <g opacity={Math.min(1, interiorP)} filter="url(#am-arc-glow)">
          <path
            d={arcPath(cx, cy, arcRadiusInterior, interiorStartDeg, interiorSweepEnd, "cw")}
            fill="none" stroke={colInterior} strokeWidth={2.5} strokeLinecap="round"
          />
          {interiorP > 0.9 && (
            <>
              <line
                x1={cx + (arcRadiusInterior - 5) * Math.cos(degToRad(interiorStartDeg))}
                y1={cy - (arcRadiusInterior - 5) * Math.sin(degToRad(interiorStartDeg))}
                x2={cx + (arcRadiusInterior + 5) * Math.cos(degToRad(interiorStartDeg))}
                y2={cy - (arcRadiusInterior + 5) * Math.sin(degToRad(interiorStartDeg))}
                stroke={colInterior} strokeWidth={1.5} opacity={0.5}
              />
              <line
                x1={cx + (arcRadiusInterior - 5) * Math.cos(degToRad(interiorEndDeg))}
                y1={cy - (arcRadiusInterior - 5) * Math.sin(degToRad(interiorEndDeg))}
                x2={cx + (arcRadiusInterior + 5) * Math.cos(degToRad(interiorEndDeg))}
                y2={cy - (arcRadiusInterior + 5) * Math.sin(degToRad(interiorEndDeg))}
                stroke={colInterior} strokeWidth={1.5} opacity={0.5}
              />
            </>
          )}
          {interiorP > 0.6 && (
            <g opacity={clamp01((interiorP - 0.6) / 0.3)}>
              <rect x={interiorLabelPos.x - 30} y={interiorLabelPos.y - 12} width={60} height={24} rx={12}
                fill="hsl(220 16% 10%)" stroke={colInterior} strokeWidth={1} opacity={0.9} />
              <text x={interiorLabelPos.x} y={interiorLabelPos.y + 4} textAnchor="middle"
                fill={colInterior} fontSize={11} fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={600}>
                A {interiorVal}°
              </text>
            </g>
          )}
        </g>
      )}

      {/* Reflex arc — sweeps CCW (opposite direction) */}
      {showReflex && reflexP > 0.01 && (
        <g opacity={Math.min(1, reflexP)} filter="url(#am-arc-glow)">
          <path
            d={arcPath(cx, cy, arcRadiusReflex, reflexStartDeg, reflexSweepEnd, "ccw")}
            fill="none" stroke={colReflex} strokeWidth={2} strokeLinecap="round" strokeDasharray="6 3"
          />
          {reflexP > 0.6 && (
            <g opacity={clamp01((reflexP - 0.6) / 0.3)}>
              <rect x={reflexLabelPos.x - 30} y={reflexLabelPos.y - 12} width={60} height={24} rx={12}
                fill="hsl(220 16% 10%)" stroke={colReflex} strokeWidth={1} opacity={0.9} />
              <text x={reflexLabelPos.x} y={reflexLabelPos.y + 4} textAnchor="middle"
                fill={colReflex} fontSize={11} fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={600}>
                R {reflexVal}°
              </text>
            </g>
          )}
        </g>
      )}

      {/* Vector A */}
      {appearP > 0 && (
        <g opacity={appearP}>
          <line x1={originA.x} y1={originA.y} x2={endA.x} y2={endA.y}
            stroke={colA} strokeWidth={cfg.strokeWeight} strokeLinecap="round" filter="url(#am-glow)" />
          {/* Arrowhead only after vector is fully drawn */}
          {appearP >= 0.99 && (
            <polygon
              points={`0,0 ${-arrowSize * 2.2},${-arrowSize} ${-arrowSize * 2.2},${arrowSize}`}
              fill={colA}
              transform={`translate(${fullEndA.x},${fullEndA.y}) rotate(${-aDeg})`}
            />
          )}
          <circle cx={originA.x} cy={originA.y} r={4} fill={colA} opacity={0.8} />
          <circle cx={originA.x} cy={originA.y} r={7} fill="none" stroke={colA} strokeWidth={1} opacity={0.3} />
          <text x={fullEndA.x + 14 * Math.cos(aRad)} y={fullEndA.y - 14 * Math.sin(aRad)}
            textAnchor="middle" fill={colA} fontSize={12}
            fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={600} opacity={appearP > 0.9 ? 0.8 : 0}>
            a
          </text>
        </g>
      )}

      {/* Vector B */}
      {appearP > 0 && (
        <g opacity={appearP}>
          <line x1={originB.x} y1={originB.y} x2={endB.x} y2={endB.y}
            stroke={colB} strokeWidth={cfg.strokeWeight} strokeLinecap="round" filter="url(#am-glow)" />
          {appearP >= 0.99 && (
            <polygon
              points={`0,0 ${-arrowSize * 2.2},${-arrowSize} ${-arrowSize * 2.2},${arrowSize}`}
              fill={colB}
              transform={`translate(${fullEndB.x},${fullEndB.y}) rotate(${-bDeg})`}
            />
          )}
          <circle cx={originB.x} cy={originB.y} r={4} fill={colB} opacity={0.8} />
          <circle cx={originB.x} cy={originB.y} r={7} fill="none" stroke={colB} strokeWidth={1} opacity={0.3} />
          <text x={fullEndB.x + 14 * Math.cos(bRad)} y={fullEndB.y - 14 * Math.sin(bRad)}
            textAnchor="middle" fill={colB} fontSize={12}
            fontFamily="ui-monospace, 'SF Mono', monospace" fontWeight={600} opacity={appearP > 0.9 ? 0.8 : 0}>
            b
          </text>
        </g>
      )}

      {/* "shared origin" label */}
      {moveP > 0.8 && moveP <= 1 && (
        <text x={cx} y={cy + 24} textAnchor="middle" fill="hsl(220 14% 50%)" fontSize={10}
          fontFamily="ui-monospace, 'SF Mono', monospace" opacity={clamp01((moveP - 0.8) / 0.15) * 0.6}>
          shared origin
        </text>
      )}
    </svg>
  );
}
