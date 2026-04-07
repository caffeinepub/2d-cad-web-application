import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { DrawingObject, Project, Layer, Map_ } from '../backend';
import { UnitSystem } from '../backend';
import type { UnitType } from './useUnits';

interface LayerState {
  id: number;
  name: string;
  color: string;
  visible: boolean;
}

export function useProjectQueries() {
  const { actor, isFetching } = useActor();
  const queryClient = useQueryClient();

  const listProjectsQuery = useQuery<Project[]>({
    queryKey: ['projects'],
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
      layers?: LayerState[];
      activeLayerId?: number;
      unitSystem?: UnitType;
    }) => {
      if (!actor) throw new Error('Actor not initialized');
      
      // Convert layers to backend Map format
      const layersMap: Map_ = {
        root: { __kind__: 'leaf', leaf: null },
        size: BigInt(0),
      };
      
      // Convert unit system to backend enum
      let backendUnit: UnitSystem = UnitSystem.pixels;
      if (unitSystem === 'inches') {
        backendUnit = UnitSystem.inches;
      } else if (unitSystem === 'cm') {
        backendUnit = UnitSystem.centimeters;
      }
      
      return actor.saveProject(
        id, 
        name, 
        objects, 
        layersMap, 
        BigInt(activeLayerId || 0),
        backendUnit
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const loadProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error('Actor not initialized');
      return actor.loadProject(id);
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error('Actor not initialized');
      return actor.deleteProject(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return {
    listProjectsQuery,
    saveProjectMutation,
    loadProjectMutation,
    deleteProjectMutation,
  };
}
