import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DrawingObject,
  Layer,
  ProjectPublic,
  UnitSystem,
} from "../backend.d";
import { useActor } from "./useActor";
import type { UnitType } from "./useUnits";

export function useProjectQueries() {
  const { actor, isFetching } = useActor();
  const queryClient = useQueryClient();

  const listProjectsQuery = useQuery<ProjectPublic[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listProjects();
    },
    enabled: !!actor && !isFetching,
  });

  const saveProjectMutation = useMutation({
    mutationFn: async ({
      id,
      name,
      objects,
      layers,
      activeLayerId,
      unitSystem,
    }: {
      id: string;
      name: string;
      objects: DrawingObject[];
      layers?: Array<[bigint, Layer]>;
      activeLayerId?: number;
      unitSystem?: UnitType;
    }) => {
      if (!actor) throw new Error("Actor not initialized");

      const layersArray: Array<[bigint, Layer]> = layers ?? [];

      // Convert unit system to backend enum value
      let backendUnit: UnitSystem = "pixels" as UnitSystem;
      if (unitSystem === "inches") backendUnit = "inches" as UnitSystem;
      else if (unitSystem === "cm") backendUnit = "centimeters" as UnitSystem;

      return actor.saveProject(
        id,
        name,
        objects,
        layersArray,
        BigInt(activeLayerId ?? 0),
        backendUnit,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const loadProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.loadProject(id);
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.deleteProject(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return {
    listProjectsQuery,
    saveProjectMutation,
    loadProjectMutation,
    deleteProjectMutation,
  };
}
