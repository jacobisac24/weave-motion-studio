// Public API for the triangle-slider explainer block.
// Import this file to register the block type and access its renderer.

export { TRIANGLE_SLIDER_TYPE, defaultTriangleSliderConfig } from "./config";
export type { TriangleSliderConfig } from "./config";
export { TriangleSliderRenderer } from "./TriangleSliderRenderer";

// Side-effect: registers the block descriptor
import "./config";
