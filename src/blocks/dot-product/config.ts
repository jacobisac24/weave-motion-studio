import type { BlockDescriptor } from "@/types/block";
import { blockRegistry } from "@/context/ProjectContext";

export const DOT_PRODUCT_TYPE = "dot-product";

export interface DotProductConfig {
  vectorColorA: string;
  vectorColorB: string;
  projectionColor: string;
  negativeColor: string;
  strokeWeight: number;
  vectorLength: number;
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
  vectorColorA: "25 95% 55%",       // Bybit orange
  vectorColorB: "170 65% 50%",      // Teal/cyan
  projectionColor: "25 95% 55%",    // Orange glow for projection
  negativeColor: "0 75% 55%",
  strokeWeight: 2.5,
  vectorLength: 0.32,
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
