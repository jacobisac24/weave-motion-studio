// Block renderer registry — maps block types to their React renderers.
// The editor preview queries this to find the right renderer for any block.
// Each block module registers itself here on import.

import type { ComponentType } from "react";

export interface BlockRendererProps {
  /** 0-1 normalised progress within this block */
  progress: number;
  /** Canvas pixel width */
  width: number;
  /** Canvas pixel height */
  height: number;
  /** Block-specific config payload */
  config?: Record<string, unknown>;
}

type RendererEntry = ComponentType<BlockRendererProps>;

const renderers = new Map<string, RendererEntry>();

export function registerBlockRenderer(type: string, renderer: RendererEntry) {
  renderers.set(type, renderer);
}

export function getBlockRenderer(type: string): RendererEntry | undefined {
  return renderers.get(type);
}

// --- Register known block renderers ---
import { TriangleSliderRenderer } from "./triangle-slider/TriangleSliderRenderer";
import { TRIANGLE_SLIDER_TYPE } from "./triangle-slider/config";
import { CurveVectorRenderer } from "./curve-vector/CurveVectorRenderer";
import { CURVE_VECTOR_TYPE } from "./curve-vector/config";
import { TangentBoxesRenderer } from "./tangent-boxes/TangentBoxesRenderer";
import { TANGENT_BOXES_TYPE } from "./tangent-boxes/config";
import { AngleMeasureRenderer } from "./angle-measure/AngleMeasureRenderer";
import { ANGLE_MEASURE_TYPE } from "./angle-measure/config";

registerBlockRenderer(TRIANGLE_SLIDER_TYPE, TriangleSliderRenderer as RendererEntry);
registerBlockRenderer(CURVE_VECTOR_TYPE, CurveVectorRenderer as RendererEntry);
registerBlockRenderer(TANGENT_BOXES_TYPE, TangentBoxesRenderer as RendererEntry);
registerBlockRenderer(ANGLE_MEASURE_TYPE, AngleMeasureRenderer as RendererEntry);
