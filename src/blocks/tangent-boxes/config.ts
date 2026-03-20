import type { BlockDescriptor } from "@/types/block";
import { blockRegistry } from "@/context/ProjectContext";

export const TANGENT_BOXES_TYPE = "tangent-boxes";

export interface TangentBoxesConfig {
  curveColor: string;
  boxColor: string;
  indicatorColor: string;
  boxSize: number;
  pointCount: number;
  strokeWeight: number;
  phases: {
    curveDraw: number;
    pointsGrow: number;
    boxesFly: number;
    boxesRotate: number;
    settle: number;
  };
}

export const defaultTangentBoxesConfig: TangentBoxesConfig = {
  curveColor: "220 14% 70%",
  boxColor: "200 90% 65%",
  indicatorColor: "0 0% 96%",
  boxSize: 28,
  pointCount: 9,
  strokeWeight: 2,
  phases: {
    curveDraw: 0.18,
    pointsGrow: 0.18,
    boxesFly: 0.30,
    boxesRotate: 0.24,
    settle: 0.10,
  },
};

const descriptor: BlockDescriptor = {
  type: TANGENT_BOXES_TYPE,
  label: "Tangent Boxes",
  defaultDuration: 7,
  description:
    "A curve appears, points distribute along it, then a corner box clones itself to each point and rotates to match the local tangent.",
};

blockRegistry.register(descriptor);
