import type { BlockDescriptor } from "@/types/block";
import { blockRegistry } from "@/context/ProjectContext";

export const HEAT_MAP_TYPE = "heat-map";

export const HEAT_MAP_DESCRIPTOR: BlockDescriptor = {
  type: HEAT_MAP_TYPE,
  label: "Heat Map / Distance Attractor",
  defaultDuration: 45,
  description:
    "A grid of panels colored by distance from a moving human figure, demonstrating heat-map data visualization.",
};

blockRegistry.register(HEAT_MAP_DESCRIPTOR);
