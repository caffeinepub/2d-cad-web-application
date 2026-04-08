import { useActor as useCoreActor } from "@caffeineai/core-infrastructure";
import { createActor } from "../backend";

// Wrap core useActor with the project's createActor function
export function useActor() {
  return useCoreActor(createActor);
}
