import type { BlockDescriptor } from "@/types/block";
import { blockRegistry } from "@/context/ProjectContext";

export const ANGLE_MEASURE_TYPE = "angle-measure";

export interface AngleMeasureConfig {
  vectorColorA: string;
  vectorColorB: string;
  arcColorInterior: string;
  arcColorReflex: string;
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
  angleA: number;
  angleB: number;
}

export const defaultAngleMeasureConfig: AngleMeasureConfig = {
  vectorColorA: "210 95% 60%",
  vectorColorB: "350 80% 62%",
  arcColorInterior: "150 65% 50%",
  arcColorReflex: "38 85% 58%",
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
