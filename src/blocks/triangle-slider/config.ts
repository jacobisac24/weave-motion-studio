// Triangle-Slider Explainer Block — configuration & registration
// This file is self-contained. Import it once to register the block type.

import type { BlockDescriptor } from "@/types/block";
import { blockRegistry } from "@/context/ProjectContext";

export const TRIANGLE_SLIDER_TYPE = "triangle-slider-explainer";

export interface TriangleSliderConfig {
  /** Starting point position (0-1 normalized) */
  pointX: number;
  pointY: number;
  /** Triangle size in px */
  triangleSize: number;
  /** Segment range [min, max] */
  segmentMin: number;
  segmentMax: number;
  /** Accent color (HSL string) */
  accentColor: string;
  /** Animation phase durations as fractions of total duration */
  phases: {
    pointAppear: number;   // 0–fraction
    triangleGrow: number;
    pause: number;
    sliderAppear: number;
    handAppear: number;
    drag: number;          // remaining
  };
}

export const defaultTriangleSliderConfig: TriangleSliderConfig = {
  pointX: 0.5,
  pointY: 0.55,
  triangleSize: 140,
  segmentMin: 3,
  segmentMax: 9,
  accentColor: "190 80% 60%",
  phases: {
    pointAppear: 0.08,
    triangleGrow: 0.12,
    pause: 0.05,
    sliderAppear: 0.08,
    handAppear: 0.07,
    drag: 0.6,
  },
};

const descriptor: BlockDescriptor = {
  type: TRIANGLE_SLIDER_TYPE,
  label: "Triangle Slider Explainer",
  defaultDuration: 8,
  description:
    "A tutorial-style animation: a point appears, a triangle grows, a slider appears, a hand drags the slider, and the triangle segmentation increases in sync.",
};

// Register once on import
blockRegistry.register(descriptor);
