import { useMemo } from "react";
import type { TangentBoxesConfig } from "./config";
import { defaultTangentBoxesConfig } from "./config";

interface Props {
  progress: number;
  width: number;
  height: number;
  config?: Partial<TangentBoxesConfig>;
}

// ---- Math helpers ----

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

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function cubicBezier(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number], t: number
): [number, number] {
  const u = 1 - t, uu = u * u, uuu = uu * u, tt = t * t, ttt = tt * t;
  return [
    uuu * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + ttt * p3[0],
    uuu * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + ttt * p3[1],
  ];
}

function cubicBezierTangent(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number], t: number
): [number, number] {
  const u = 1 - t;
  return [
    3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
    3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]),
  ];
}

function bezierPath(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number]
): string {
  return `M${p0[0]},${p0[1]} C${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`;
}

function bezierLength(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number], steps = 64
): number {
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= steps; i++) {
    const pt = cubicBezier(p0, p1, p2, p3, i / steps);
    const dx = pt[0] - prev[0], dy = pt[1] - prev[1];
    length += Math.sqrt(dx * dx + dy * dy);
    prev = pt;
  }
  return length;
}

// ---- Arc-length reparametrization ----

function buildArcLengthTable(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number], samples = 200
): { t: number; len: number }[] {
  const table: { t: number; len: number }[] = [{ t: 0, len: 0 }];
  let totalLen = 0;
  let prev = p0;
  for (let i = 1; i <= samples; i++) {
    const param = i / samples;
    const pt = cubicBezier(p0, p1, p2, p3, param);
    const dx = pt[0] - prev[0], dy = pt[1] - prev[1];
    totalLen += Math.sqrt(dx * dx + dy * dy);
    table.push({ t: param, len: totalLen });
    prev = pt;
  }
  return table;
}

function paramAtArcLength(table: { t: number; len: number }[], targetLen: number): number {
  const total = table[table.length - 1].len;
  const target = Math.max(0, Math.min(total, targetLen));
  let lo = 0, hi = table.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid].len < target) lo = mid; else hi = mid;
  }
  const segLen = table[hi].len - table[lo].len;
  const frac = segLen > 0 ? (target - table[lo].len) / segLen : 0;
  return lerp(table[lo].t, table[hi].t, frac);
}

// ---- Phase boundary builder ----

function buildPhases(p: TangentBoxesConfig["phases"]) {
  const vals = [p.curveDraw, p.sliderAppear, p.handAppear, p.pointsGrow, p.boxesFly, p.boxesRotate, p.settle];
  const boundaries: number[] = [];
  let sum = 0;
  for (const v of vals) { sum += v; boundaries.push(sum); }
  return boundaries;
}

// ---- Stroke-only Slider SVG component ----

function StrokeSlider({
  x, y, w, value, min, max, color, opacity,
}: {
  x: number; y: number; w: number;
  value: number; min: number; max: number;
  color: string; opacity: number;
}) {
  const h = 26;
  const trackY = y;
  const frac = (value - min) / (max - min);
  const handleX = x + frac * w;
  const tickCount = max - min + 1;
  const labelW = 52;
  const labelH = 22;

  return (
    <g opacity={opacity}>
      {/* Outer frame — rounded pill, stroke only */}
      <rect
        x={x - 10}
        y={trackY - h / 2}
        width={w + 20}
        height={h}
        rx={h / 2}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        opacity={0.5}
      />

      {/* Track line */}
      <line
        x1={x} y1={trackY}
        x2={x + w} y2={trackY}
        stroke={color} strokeWidth={1} opacity={0.35}
        strokeLinecap="round"
      />

      {/* Tick marks */}
      {Array.from({ length: tickCount }, (_, i) => {
        const tx = x + (i / (tickCount - 1)) * w;
        return (
          <line
            key={`tick${i}`}
            x1={tx} y1={trackY - 4}
            x2={tx} y2={trackY + 4}
            stroke={color} strokeWidth={0.8} opacity={0.3}
          />
        );
      })}

      {/* Active fill portion — stroke line */}
      <line
        x1={x} y1={trackY}
        x2={handleX} y2={trackY}
        stroke={color} strokeWidth={1.8} opacity={0.7}
        strokeLinecap="round"
      />

      {/* Handle — diamond shape, stroke only */}
      <g transform={`translate(${handleX}, ${trackY})`}>
        <polygon
          points="0,-7 7,0 0,7 -7,0"
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {/* Small inner dot */}
        <circle cx={0} cy={0} r={1.5} fill={color} opacity={0.6} />
      </g>

      {/* Label pill — stroke only, at left */}
      <rect
        x={x - labelW - 16}
        y={trackY - labelH / 2}
        width={labelW}
        height={labelH}
        rx={4}
        fill="none"
        stroke={color}
        strokeWidth={1}
        opacity={0.6}
      />
      <text
        x={x - labelW / 2 - 16}
        y={trackY + 4}
        textAnchor="middle"
        fill={color}
        fontSize={11}
        fontFamily="ui-monospace, 'SF Mono', monospace"
        fontWeight={500}
        opacity={0.8}
      >
        Slider
      </text>

      {/* Value display — next to handle */}
      <text
        x={handleX + 14}
        y={trackY + 4}
        fill={color}
        fontSize={13}
        fontFamily="ui-monospace, 'SF Mono', monospace"
        fontWeight={600}
        opacity={0.9}
      >
        {Math.round(value)}
      </text>
    </g>
  );
}

// ---- Hand icon (stroke-only pointer) ----

function HandIcon({ x, y, color, opacity }: { x: number; y: number; color: string; opacity: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} opacity={opacity}>
      <g transform="scale(0.8) translate(-14, -2)">
        <path
          d="M10 2 C10 0.9 10.9 0 12 0 C13.1 0 14 0.9 14 2 L14 10 L15.5 10 C15.5 8.9 16.4 8 17.5 8 C18.6 8 19.5 8.9 19.5 10 L19.5 12 C19.5 10.9 20.4 10 21.5 10 C22.6 10 23.5 10.9 23.5 12 L23.5 14 C23.5 12.9 24.4 12 25.5 12 C26.6 12 27.5 12.9 27.5 14 L27.5 22 C27.5 27 24 30 19 30 L17 30 C13 30 10 27 10 23 Z"
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}

// ---- Component ----

export function TangentBoxesRenderer({ progress, width, height, config: overrides }: Props) {
  const cfg = useMemo(
    () => ({ ...defaultTangentBoxesConfig, ...overrides }),
    [overrides]
  );

  const phases = useMemo(() => buildPhases(cfg.phases), [cfg.phases]);
  const p = clamp01(progress);

  // Define an elegant S-curve
  const pad = width * 0.1;
  const p0: [number, number] = [pad, height * 0.7];
  const p1: [number, number] = [width * 0.35, height * 0.08];
  const p2: [number, number] = [width * 0.65, height * 0.92];
  const p3: [number, number] = [width - pad, height * 0.3];

  const fullPath = bezierPath(p0, p1, p2, p3);
  const totalLength = useMemo(() => bezierLength(p0, p1, p2, p3), [width, height]);

  const arcTable = useMemo(
    () => buildArcLengthTable(p0, p1, p2, p3),
    [width, height]
  );

  // ---- Phase progress ----
  const curveDrawP = clamp01(p / phases[0]);
  const sliderAppP = clamp01((p - phases[0]) / (phases[1] - phases[0]));
  const handAppP = clamp01((p - phases[1]) / (phases[2] - phases[1]));
  const pointsGrowP = clamp01((p - phases[2]) / (phases[3] - phases[2]));
  const boxesFlyP = clamp01((p - phases[3]) / (phases[4] - phases[3]));
  const boxesRotateP = clamp01((p - phases[4]) / (phases[5] - phases[4]));

  // ---- Curve draw ----
  const drawEased = easeInOutCubic(curveDrawP);
  const dashOffset = totalLength * (1 - drawEased);

  // ---- Points along curve ----
  const maxPoints = cfg.pointCount;
  const sliderDragP = easeInOutQuad(pointsGrowP);
  const currentPointCount = Math.max(1, Math.round(lerp(1, maxPoints, sliderDragP)));
  const sliderValue = lerp(1, maxPoints, sliderDragP);
  const showSlider = p >= phases[0];
  const showHand = p >= phases[1];
  const showPoints = pointsGrowP > 0;

  // Compute point positions & tangent angles for current count
  const pointData = useMemo(() => {
    const totalArcLen = arcTable[arcTable.length - 1].len;
    const data: { pos: [number, number]; angle: number; t: number }[] = [];
    for (let i = 0; i < maxPoints; i++) {
      const frac = maxPoints > 1 ? i / (maxPoints - 1) : 0.5;
      const mappedFrac = 0.05 + frac * 0.9;
      const arcLen = mappedFrac * totalArcLen;
      const t = paramAtArcLength(arcTable, arcLen);
      const pos = cubicBezier(p0, p1, p2, p3, t);
      const tan = cubicBezierTangent(p0, p1, p2, p3, t);
      const angle = Math.atan2(tan[1], tan[0]);
      data.push({ pos, angle, t });
    }
    return data;
  }, [width, height, maxPoints]);

  // Compute visible points for current slider count
  const visiblePointData = useMemo(() => {
    if (currentPointCount <= 0) return [];
    const totalArcLen = arcTable[arcTable.length - 1].len;
    const data: { pos: [number, number]; angle: number; t: number }[] = [];
    for (let i = 0; i < currentPointCount; i++) {
      const frac = currentPointCount > 1 ? i / (currentPointCount - 1) : 0.5;
      const mappedFrac = 0.05 + frac * 0.9;
      const arcLen = mappedFrac * totalArcLen;
      const t = paramAtArcLength(arcTable, arcLen);
      const pos = cubicBezier(p0, p1, p2, p3, t);
      const tan = cubicBezierTangent(p0, p1, p2, p3, t);
      const angle = Math.atan2(tan[1], tan[0]);
      data.push({ pos, angle, t });
    }
    return data;
  }, [width, height, currentPointCount]);

  // ---- Slider layout ----
  const sliderW = Math.min(width * 0.4, 220);
  const sliderX = width / 2 - sliderW / 2;
  const sliderY = height - pad * 0.8;
  const sliderHandleX = sliderX + ((sliderValue - 1) / (maxPoints - 1)) * sliderW;

  // ---- Corner box position ----
  const boxSize = cfg.boxSize;
  const cornerX = width - pad * 0.6;
  const cornerY = pad * 0.6;

  // ---- Colors ----
  const curveHsl = `hsl(${cfg.curveColor})`;
  const boxHsl = `hsl(${cfg.boxColor})`;
  const indicatorHsl = `hsl(${cfg.indicatorColor})`;
  const pointHsl = `hsl(${cfg.pointColor})`;
  const sliderHsl = `hsl(${cfg.sliderColor})`;

  // ---- Render helper: a single box with direction indicator ----
  const renderBox = (
    cx: number, cy: number, rotation: number, opacity: number,
    _scale: number, key: string, showGlow = false
  ) => {
    const half = boxSize / 2;
    const angleDeg = (rotation * 180) / Math.PI;
    const arrowLen = half * 0.6;
    return (
      <g
        key={key}
        transform={`translate(${cx},${cy}) rotate(${angleDeg})`}
        opacity={opacity}
        filter={showGlow ? "url(#tb-glow)" : undefined}
      >
        <rect
          x={-half} y={-half} width={boxSize} height={boxSize}
          rx={3} fill="none" stroke={boxHsl} strokeWidth={1.5}
        />
        <line
          x1={0} y1={arrowLen * 0.4} x2={0} y2={-arrowLen}
          stroke={indicatorHsl} strokeWidth={1.5} strokeLinecap="round"
        />
        <polyline
          points={`${-arrowLen * 0.4},${-arrowLen * 0.45} 0,${-arrowLen} ${arrowLen * 0.4},${-arrowLen * 0.45}`}
          fill="none" stroke={indicatorHsl} strokeWidth={1.5}
          strokeLinecap="round" strokeLinejoin="round"
        />
        <circle cx={0} cy={0} r={1.5} fill={indicatorHsl} opacity={0.5} />
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%" height="100%"
      style={{ overflow: "hidden", background: "hsl(220 16% 6%)" }}
    >
      <defs>
        <filter id="tb-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor={boxHsl} floodOpacity="0.3" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="colorBlur" />
          <feMerge>
            <feMergeNode in="colorBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="tb-point-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Subtle grid */}
      <g opacity={0.035}>
        {Array.from({ length: Math.floor(width / 60) }, (_, i) => (
          <line key={`gv${i}`}
            x1={(i + 1) * 60} y1={0} x2={(i + 1) * 60} y2={height}
            stroke={curveHsl} strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: Math.floor(height / 60) }, (_, i) => (
          <line key={`gh${i}`}
            x1={0} y1={(i + 1) * 60} x2={width} y2={(i + 1) * 60}
            stroke={curveHsl} strokeWidth={0.5}
          />
        ))}
      </g>

      {/* Curve — stroke-dashoffset draw */}
      <path
        d={fullPath} fill="none" stroke={curveHsl}
        strokeWidth={cfg.strokeWeight} strokeLinecap="round"
        strokeDasharray={totalLength} strokeDashoffset={dashOffset}
        opacity={0.85}
      />

      {/* Points along curve — curve-vector style with glow + outer ring */}
      {showPoints &&
        visiblePointData.map((pt, i) => {
          const stagger = visiblePointData.length > 1 ? i / (visiblePointData.length - 1) : 0;
          const dotOpacity = clamp01((pointsGrowP - stagger * 0.15) / 0.4);
          const dotScale = easeOutCubic(clamp01(dotOpacity));
          return (
            <g key={`dot${i}`} filter="url(#tb-point-glow)">
              {/* Filled dot */}
              <circle
                cx={pt.pos[0]} cy={pt.pos[1]}
                r={cfg.pointRadius * dotScale}
                fill={pointHsl} opacity={dotOpacity}
              />
              {/* Outer ring */}
              <circle
                cx={pt.pos[0]} cy={pt.pos[1]}
                r={cfg.pointRadius * 1.8 * dotScale}
                fill="none" stroke={pointHsl} strokeWidth={1}
                opacity={dotOpacity * 0.3}
              />
            </g>
          );
        })}

      {/* Stroke-only Slider */}
      {showSlider && (
        <StrokeSlider
          x={sliderX} y={sliderY} w={sliderW}
          value={showPoints ? sliderValue : 1}
          min={1} max={maxPoints}
          color={sliderHsl}
          opacity={easeOutCubic(sliderAppP)}
        />
      )}

      {/* Hand icon */}
      {showHand && (
        <HandIcon
          x={sliderHandleX}
          y={sliderY + 26}
          color={sliderHsl}
          opacity={easeOutCubic(handAppP)}
        />
      )}

      {/* Origin box in corner (fades out as copies leave) */}
      {renderBox(
        cornerX, cornerY, -Math.PI / 2,
        Math.max(0, 1 - boxesFlyP * 0.7), 1, "origin-box"
      )}

      {/* Flying box copies */}
      {boxesFlyP > 0 &&
        pointData.slice(0, maxPoints).map((pt, i) => {
          const stagger = maxPoints > 1 ? i / (maxPoints - 1) : 0;
          const flyLocal = clamp01((boxesFlyP - stagger * 0.4) / 0.6);
          if (flyLocal <= 0) return null;

          const easedFly = easeOutBack(clamp01(flyLocal));
          const cx = lerp(cornerX, pt.pos[0], easedFly);
          const cy = lerp(cornerY, pt.pos[1], easedFly);

          const baseAngle = -Math.PI / 2;
          const targetAngle = pt.angle - Math.PI / 2;
          const rotateLocal = clamp01((boxesRotateP - stagger * 0.3) / 0.7);
          const easedRotate = easeInOutCubic(rotateLocal);

          let angleDiff = targetAngle - baseAngle;
          while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
          while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

          const currentAngle = baseAngle + angleDiff * easedRotate;
          const opacity = clamp01(flyLocal * 3);
          const showGlow = boxesRotateP > 0.5;

          return renderBox(cx, cy, currentAngle, opacity, 1, `box${i}`, showGlow);
        })}
    </svg>
  );
}
