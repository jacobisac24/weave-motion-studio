import type { BlockDescriptor } from "@/types/block";
import { blockRegistry } from "@/context/ProjectContext";

export const SPIRAL_STAIRCASE_TYPE = "spiral-staircase";

export interface SpiralStaircaseConfig {
  stepCount: number;
  turns: number;
  curveColor: string;     // HSL
  planeColor: string;     // HSL — coordinate frames
  treadColor: string;     // HSL — orange
  postColor: string;      // HSL — light grey
  vectorColor: string;    // HSL — green offset arrows
  dashColor: string;      // HSL — dashed movement
  strokeWeight: number;
  phases: {
    foundation: number; // S1
    treads: number;     // S2
    extrude: number;    // S3
    offset: number;     // S4
    railing: number;    // S5
    assembly: number;   // S6
  };
}

export const defaultSpiralStaircaseConfig: SpiralStaircaseConfig = {
  stepCount: 14,
  turns: 1.25,
  curveColor: "0 0% 96%",
  planeColor: "200 30% 70%",
  treadColor: "22 92% 56%",
  postColor: "0 0% 78%",
  vectorColor: "150 75% 55%",
  dashColor: "0 0% 55%",
  strokeWeight: 2,
  phases: {
    foundation: 0.18,
    treads: 0.18,
    extrude: 0.12,
    offset: 0.18,
    railing: 0.18,
    assembly: 0.16,
  },
};

export const SPIRAL_STAIRCASE_DESCRIPTOR: BlockDescriptor = {
  type: SPIRAL_STAIRCASE_TYPE,
  label: "Spiral Staircase",
  defaultDuration: 50,
  description:
    "Plane logic walkthrough: horizontal frames along a spiral, tread profiles, extrusion, edge-offset planes, and railing posts.",
};

blockRegistry.register(SPIRAL_STAIRCASE_DESCRIPTOR);
