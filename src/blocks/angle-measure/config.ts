import type { BlockDescriptor } from "@/types/block";
import { blockRegistry } from "@/context/ProjectContext";

export const ANGLE_MEASURE_TYPE = "angle-measure";

export interface AngleMeasureConfig {
  vectorColorA: string;
  vectorColorB: string;
  arcColorInterior: string;
  arcColorReflex: string;
  bgDotColor: string;
  strokeWeight: number;
  vectorLength: number;
  phases: {
    vectorsAppear: number;
    vectorsMove: number;
    interiorArc: number;
    holdInterior: number;
    reflexArc: number;
    settle: number;
  };
  /** Angle of vector A in degrees (from positive x-axis) */
  angleA: number;
  /** Angle of vector B in degrees */
  angleB: number;
}

export const defaultAngleMeasureConfig: AngleMeasureConfig = {
  vectorColorA: "200 90% 65%",
  vectorColorB: "340 85% 65%",
  arcColorInterior: "160 70% 55%",
  arcColorReflex: "45 90% 60%",
  bgDotColor: "220 14% 25%",
  strokeWeight: 2.5,
  vectorLength: 0.32,
  phases: {
    vectorsAppear: 0.14,
    vectorsMove: 0.20,
    interiorArc: 0.18,
    holdInterior: 0.06,
    reflexArc: 0.18,
    settle: 0.24,
  },
  angleA: 35,
  angleB: 155,
};

const descriptor: BlockDescriptor = {
  type: ANGLE_MEASURE_TYPE,
  label: "Angle Measure",
  defaultDuration: 8,
  description:
    "Two vectors appear, move to share an origin, then the interior and reflex angles are measured and labelled.",
};

blockRegistry.register(descriptor);
