import type { BlockDescriptor } from "@/types/block";
import { blockRegistry } from "@/context/ProjectContext";

export const CURVE_VECTOR_TYPE = "curve-vector";

export interface CurveVectorConfig {
  accentColor: string;
  pointColor: string;
  vectorColor: string;
  strokeWeight: number;
  pointRadius: number;
  /** Phase durations as fractions of total (must sum ≤ 1) */
  phases: {
    curveDraw: number;
    pointsAppear: number;
    vectorAppear: number;
    converge: number;
    settle: number;
  };
}

export const defaultCurveVectorConfig: CurveVectorConfig = {
  accentColor: "220 14% 76%",
  pointColor: "0 0% 96%",
  vectorColor: "43 100% 65%",
  strokeWeight: 2.5,
  pointRadius: 5,
  phases: {
    curveDraw: 0.25,
    pointsAppear: 0.08,
    vectorAppear: 0.07,
    converge: 0.5,
    settle: 0.1,
  },
};

const descriptor: BlockDescriptor = {
  type: CURVE_VECTOR_TYPE,
  label: "Curve Vector",
  defaultDuration: 6,
  description:
    "A curve draws on-screen, two points appear, a vector connects them, and the points converge along the curve.",
};

blockRegistry.register(descriptor);
