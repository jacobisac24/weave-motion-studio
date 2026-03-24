import type { BlockDescriptor } from "@/types/block";
import { blockRegistry } from "@/context/ProjectContext";

export const DOT_PRODUCT_TYPE = "dot-product";

export interface DotProductConfig {
  vectorColorA: string;
  vectorColorB: string;
  projectionColor: string;
  negativeColor: string;
  lightColor: string;
  strokeWeight: number;
  vectorLength: number;
  /** Initial angle of Vector B in degrees (A is always 0°) */
  initialAngleB: number;
  phases: {
    vectorsAppear: number;
    moveToCenter: number;
    projection: number;
    aligned: number;
    perpendicular: number;
    opposed: number;
    summary: number;
  };
}

export const defaultDotProductConfig: DotProductConfig = {
  vectorColorA: "200 90% 60%",
  vectorColorB: "280 70% 65%",
  projectionColor: "45 95% 58%",
  negativeColor: "0 75% 55%",
  lightColor: "45 90% 70%",
  strokeWeight: 2.5,
  vectorLength: 0.28,
  initialAngleB: 45,
  phases: {
    vectorsAppear: 0.083,
    moveToCenter: 0.083,
    projection: 0.167,
    aligned: 0.167,
    perpendicular: 0.167,
    opposed: 0.167,
    summary: 0.167,
  },
};

const descriptor: BlockDescriptor = {
  type: DOT_PRODUCT_TYPE,
  label: "Dot Product",
  defaultDuration: 60,
  description:
    "Teaches the dot product as an alignment checker: projection, aligned (positive), perpendicular (zero), and opposed (negative) cases with a dynamic sweep summary.",
};

blockRegistry.register(descriptor);
