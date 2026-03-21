import type { BlockDescriptor } from "@/types/block";
import { blockRegistry } from "@/context/ProjectContext";

export const TANGENT_BOXES_TYPE = "tangent-boxes";

export interface TangentBoxesConfig {
  curveColor: string;
  boxColor: string;
  indicatorColor: string;
  pointColor: string;
  sliderColor: string;
  boxSize: number;
  pointCount: number;
  pointRadius: number;
  strokeWeight: number;
  phases: {
    curveDraw: number;
    sliderAppear: number;
    handAppear: number;
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
  pointColor: "200 90% 65%",
  sliderColor: "220 14% 55%",
  boxSize: 28,
  pointCount: 9,
  pointRadius: 4.5,
  strokeWeight: 2,
  phases: {
    curveDraw: 0.12,
    sliderAppear: 0.06,
    handAppear: 0.04,
    pointsGrow: 0.22,
    boxesFly: 0.24,
    boxesRotate: 0.22,
    settle: 0.10,
  },
};

const descriptor: BlockDescriptor = {
  type: TANGENT_BOXES_TYPE,
  label: "Tangent Boxes",
  defaultDuration: 7,
  description:
    "A curve appears, a slider controls point distribution, then boxes fly to each point and rotate to match the local tangent.",
};

blockRegistry.register(descriptor);
