import type { BlockDescriptor } from "@/types/block";
import { blockRegistry } from "@/context/ProjectContext";

export const NORMAL_FLIP_TYPE = "normal-flip";

export interface NormalFlipConfig {
  panelCount: number;
  arcCurvature: number;
  strokeWeight: number;
  panelColor: string;
  normalCyanColor: string;
  normalYellowColor: string;
  questionColor: string;
  negativeColor: string;
  extrudeColor: string;
  phases: {
    setup: number;
    panel1: number;
    panel2: number;
    applyAll: number;
  };
}

export const defaultNormalFlipConfig: NormalFlipConfig = {
  panelCount: 6,
  arcCurvature: 0.18,
  strokeWeight: 2.5,
  panelColor: "220 10% 75%",
  normalCyanColor: "185 85% 55%",
  normalYellowColor: "45 95% 60%",
  questionColor: "25 90% 58%",
  negativeColor: "0 75% 55%",
  extrudeColor: "200 30% 80%",
  phases: {
    setup: 0.22,
    panel1: 0.44,
    panel2: 0.71,
    applyAll: 1.0,
  },
};

export const NORMAL_FLIP_DESCRIPTOR: BlockDescriptor = {
  type: NORMAL_FLIP_TYPE,
  label: "Normal Flipping",
  defaultDuration: 45,
  description:
    "2D animation explaining how panel normals are checked against a base surface normal and flipped when opposed, then extruded uniformly.",
};

blockRegistry.register(NORMAL_FLIP_DESCRIPTOR);
