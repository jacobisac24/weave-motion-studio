import type { BlockDescriptor } from "@/types/block";
import { blockRegistry } from "@/context/ProjectContext";

export const SUN_STUDY_TYPE = "sun-study";

export interface SunStudyConfig {
  panelCount: number;
  sunColor: string;
  normalColor: string;
  hotColor: string;
  midColor: string;
  coldColor: string;
  strokeWeight: number;
  phases: {
    setup: number;
    panel1: number;
    panel2: number;
    panel3: number;
    dynamic: number;
  };
}

export const defaultSunStudyConfig: SunStudyConfig = {
  panelCount: 12,
  sunColor: "32 95% 55%",
  normalColor: "0 0% 85%",
  hotColor: "5 85% 55%",
  midColor: "55 80% 52%",
  coldColor: "210 70% 50%",
  strokeWeight: 2,
  phases: {
    setup: 0.14,
    panel1: 0.34,
    panel2: 0.51,
    panel3: 0.68,
    dynamic: 1.0,
  },
};

export const SUN_STUDY_DESCRIPTOR: BlockDescriptor = {
  type: SUN_STUDY_TYPE,
  label: "Sun Study",
  defaultDuration: 35,
  description:
    "2D architectural solar radiation study showing how panel normals interact with sun direction to produce a heat map.",
};

blockRegistry.register(SUN_STUDY_DESCRIPTOR);
