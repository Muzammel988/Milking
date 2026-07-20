import type { Alert, Animal, BreedingEventType, BreedingEventResult, DashboardData, Farm, TimelineEntry } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listFarms: () => request<Farm[]>("/api/farms"),

  listAnimals: (farmId: string) => request<Animal[]>(`/api/animals?farmId=${farmId}`),
  getAnimal: (id: string) => request<Animal>(`/api/animals/${id}`),
  getTimeline: (id: string) => request<{ animal: Animal; timeline: TimelineEntry[] }>(`/api/animals/${id}/timeline`),
  createAnimal: (data: Partial<Animal> & { farmId: string; earTag: string; breed: string; sex: string; birthDate: string; origin: string }) =>
    request<Animal>("/api/animals", { method: "POST", body: JSON.stringify(data) }),

  createBreedingEvent: (data: {
    animalId: string;
    type: BreedingEventType;
    eventDate: string;
    result?: BreedingEventResult;
    notes?: string;
    semenOrSireRef?: string;
    calvingDetail?: {
      calvingType: "NORMAL" | "ASSISTED" | "CAESAREAN";
      problems?: string[];
      birthWeightKg?: number;
      isTwin?: boolean;
    };
  }) => request("/api/breeding-events", { method: "POST", body: JSON.stringify(data) }),

  getDashboard: (farmId: string) => request<DashboardData>(`/api/farms/${farmId}/dashboard`),

  resolveAlert: (id: string, status: "DONE" | "DISMISSED") =>
    request<Alert>(`/api/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  runReproductionJob: () => request("/api/jobs/reproduction", { method: "POST", body: JSON.stringify({}) }),
};
