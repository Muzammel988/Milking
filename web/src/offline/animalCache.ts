import type { Animal } from "../api/types";

function key(farmId: string) {
  return `milking.animalCache.${farmId}`;
}

export function cacheAnimals(farmId: string, animals: Animal[]) {
  localStorage.setItem(key(farmId), JSON.stringify(animals));
}

export function getCachedAnimals(farmId: string): Animal[] {
  try {
    return JSON.parse(localStorage.getItem(key(farmId)) ?? "[]");
  } catch {
    return [];
  }
}
