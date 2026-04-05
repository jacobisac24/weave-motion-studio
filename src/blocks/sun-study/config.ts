import type { BlockDescriptor } from "@/types/block";
import { blockRegistry } from "@/context/ProjectContext";

export const SUN_STUDY_TYPE = "sun-study";

export interface SunStudyConfig {
  gridCols: number;
  gridRows: number;
  sunColor: string;
  normalColor: string;
  hotColor: string;
  midColor: string;
  coldColor: string;
  strokeWeight: number;
  phases: {
    setup: number;
    coreQuestion: number;
    alignment: number;
    finalEffect: number;
  };
}

export const defaultSunStudyConfig: SunStudyConfig = {
  gridCols: 10,
  gridRows: 6,
  sunColor: "40 95% 58%",
  normalColor: "0 0% 85%",
  hotColor: "5 85% 55%",
  midColor: "55 80% 52%",
  coldColor: "210 70% 50%",
  strokeWeight: 2.2,
  phases: {
    setup: 0.12,
    coreQuestion: 0.25,
    alignment: 0.6,
    finalEffect: 1.0,
  },
};

export const SUN_STUDY_DESCRIPTOR: BlockDescriptor = {
  type: SUN_STUDY_TYPE,
  label: "Sun Study",
  defaultDuration: 35,
  description:
    "Architectural solar radiation study showing how panel normals interact with sun direction to produce a heat map.",
};

blockRegistry.register(SUN_STUDY_DESCRIPTOR);
