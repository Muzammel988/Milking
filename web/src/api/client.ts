import type {
  Alert,
  Animal,
  BreedingEventType,
  BreedingEventResult,
  DashboardData,
  Farm,
  FeedConsumptionRecord,
  FeedIngredient,
  FinancialTransaction,
  HealthEvent,
  HealthEventType,
  Location,
  Medicine,
  MilkRecord,
  MilkSession,
  ProfitabilityRow,
  RationFormula,
  RationTargetGroup,
  Role,
  SemenStraw,
  SystemParameters,
  TimelineEntry,
  TransactionCategory,
  TransactionType,
  User,
  Vaccine,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const USER_STORAGE_KEY = "milking.currentUserId";

let currentUserId: string | null = localStorage.getItem(USER_STORAGE_KEY);

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function setCurrentUserId(id: string | null) {
  currentUserId = id;
  if (id) localStorage.setItem(USER_STORAGE_KEY, id);
  else localStorage.removeItem(USER_STORAGE_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init?.headers as Record<string, string>) };
  if (currentUserId) headers["x-user-id"] = currentUserId;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | undefined>): string {
  const usable = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  return usable.length ? `?${new URLSearchParams(usable).toString()}` : "";
}

export const api = {
  listFarms: () => request<Farm[]>("/api/farms"),

  listUsers: (farmId: string) => request<User[]>(`/api/users${qs({ farmId })}`),
  createUser: (data: { farmId: string; name: string; email: string; role: Role; phone?: string }) =>
    request<User>("/api/users", { method: "POST", body: JSON.stringify(data) }),

  listLocations: (farmId: string) => request<Location[]>(`/api/locations${qs({ farmId })}`),
  createLocation: (data: { farmId: string; barnName: string; stallName?: string; capacity?: number }) =>
    request<Location>("/api/locations", { method: "POST", body: JSON.stringify(data) }),

  getSystemParameters: (farmId: string) => request<SystemParameters>(`/api/farms/${farmId}/system-parameters`),
  updateSystemParameters: (farmId: string, data: Partial<SystemParameters>) =>
    request<SystemParameters>(`/api/farms/${farmId}/system-parameters`, { method: "PUT", body: JSON.stringify(data) }),

  listAnimals: (farmId: string, filters?: { status?: string; breedingState?: string }) =>
    request<Animal[]>(`/api/animals${qs({ farmId, ...filters })}`),
  getAnimal: (id: string) => request<Animal>(`/api/animals/${id}`),
  getTimeline: (id: string) =>
    request<{ animal: Animal; timeline: TimelineEntry[]; activeWithdrawalUntil: string | null }>(`/api/animals/${id}/timeline`),
  createAnimal: (data: Partial<Animal> & { farmId: string; earTag: string; breed: string; sex: string; birthDate: string; origin: string }) =>
    request<Animal>("/api/animals", { method: "POST", body: JSON.stringify(data) }),
  exitAnimal: (id: string, data: { exitReason: "SALE" | "DEATH" | "SLAUGHTER"; exitDate?: string }) =>
    request<Animal>(`/api/animals/${id}/exit`, { method: "POST", body: JSON.stringify(data) }),

  createBreedingEvent: (data: {
    animalId: string;
    type: BreedingEventType;
    eventDate: string;
    result?: BreedingEventResult;
    notes?: string;
    semenOrSireRef?: string;
    semenStrawId?: string;
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
  runLactationJob: () => request("/api/jobs/lactation", { method: "POST", body: JSON.stringify({}) }),
  runAllJobs: () => request("/api/jobs/run-all", { method: "POST", body: JSON.stringify({}) }),

  listMilkRecords: (params: { farmId: string; animalId?: string; from?: string; to?: string }) =>
    request<MilkRecord[]>(`/api/milk-records${qs(params)}`),
  createMilkRecord: (data: {
    farmId: string;
    animalId?: string;
    recordDate: string;
    session: MilkSession;
    yieldLiters: number;
    fatPct?: number;
    proteinPct?: number;
    somaticCellCount?: number;
  }) => request<MilkRecord>("/api/milk-records", { method: "POST", body: JSON.stringify(data) }),

  listHealthEvents: (animalId: string) => request<HealthEvent[]>(`/api/health-events${qs({ animalId })}`),
  createHealthEvent: (data: {
    animalId: string;
    type: HealthEventType;
    eventDate: string;
    medicineId?: string;
    vaccineId?: string;
    dosage?: string;
    cost?: number;
    notes?: string;
    withdrawalPeriodDaysOverride?: number;
  }) => request<HealthEvent>("/api/health-events", { method: "POST", body: JSON.stringify(data) }),

  listMedicines: (farmId: string) => request<Medicine[]>(`/api/medicines${qs({ farmId })}`),
  createMedicine: (data: { farmId: string; name: string; type: string; defaultWithdrawalPeriodDays: number; unitCost: number }) =>
    request<Medicine>("/api/medicines", { method: "POST", body: JSON.stringify(data) }),

  listVaccines: (farmId: string) => request<Vaccine[]>(`/api/vaccines${qs({ farmId })}`),
  createVaccine: (data: { farmId: string; name: string; type: string; defaultWithdrawalPeriodDays: number; unitCost: number }) =>
    request<Vaccine>("/api/vaccines", { method: "POST", body: JSON.stringify(data) }),

  listFeedIngredients: (farmId: string) => request<FeedIngredient[]>(`/api/feed-ingredients${qs({ farmId })}`),
  createFeedIngredient: (data: { farmId: string; name: string; unitOfMeasure: string; costPerUnit: number; stockQuantity?: number }) =>
    request<FeedIngredient>("/api/feed-ingredients", { method: "POST", body: JSON.stringify(data) }),
  restockFeedIngredient: (id: string, quantity: number) =>
    request<FeedIngredient>(`/api/feed-ingredients/${id}/restock`, { method: "POST", body: JSON.stringify({ quantity }) }),

  listRationFormulas: (farmId: string) => request<RationFormula[]>(`/api/ration-formulas${qs({ farmId })}`),
  createRationFormula: (data: {
    farmId: string;
    name: string;
    targetGroup: RationTargetGroup;
    ingredients: { feedIngredientId: string; quantityPerHeadPerDay: number }[];
  }) => request<RationFormula>("/api/ration-formulas", { method: "POST", body: JSON.stringify(data) }),

  listFeedConsumption: (params: { farmId: string; animalId?: string }) =>
    request<FeedConsumptionRecord[]>(`/api/feed-consumption${qs(params)}`),
  createFeedConsumption: (data: {
    farmId: string;
    rationFormulaId: string;
    animalId?: string;
    groupLabel?: string;
    headCount?: number;
    date: string;
  }) => request<FeedConsumptionRecord>("/api/feed-consumption", { method: "POST", body: JSON.stringify(data) }),

  listFinancialTransactions: (params: { farmId: string; animalId?: string; category?: string; from?: string; to?: string }) =>
    request<FinancialTransaction[]>(`/api/financial-transactions${qs(params)}`),
  createFinancialTransaction: (data: {
    farmId: string;
    date: string;
    type: TransactionType;
    category: TransactionCategory;
    amount: number;
    currency?: string;
    animalId?: string;
    animalGroupLabel?: string;
    notes?: string;
  }) => request<FinancialTransaction>("/api/financial-transactions", { method: "POST", body: JSON.stringify(data) }),

  listSemenStraws: (farmId: string) => request<SemenStraw[]>(`/api/semen-straws${qs({ farmId })}`),
  createSemenStraw: (data: {
    farmId: string;
    sireName: string;
    breed: string;
    strawIdentifier: string;
    quantityOnHand?: number;
    costPerStraw?: number;
  }) => request<SemenStraw>("/api/semen-straws", { method: "POST", body: JSON.stringify(data) }),

  getFarmProfitability: (farmId: string) => request<ProfitabilityRow[]>(`/api/reports/farms/${farmId}/profitability`),
  getAnimalProfitability: (animalId: string) => request<ProfitabilityRow>(`/api/reports/animals/${animalId}/profitability`),

  getStatusDistribution: (farmId: string) => request<{ status: string; count: number }[]>(`/api/reports/farms/${farmId}/status-distribution`),
  getExitReasons: (farmId: string) => request<{ exitReason: string; count: number }[]>(`/api/reports/farms/${farmId}/exit-reasons`),
  getLactationCurve: (farmId: string) =>
    request<{ dimBucketStart: number; avgYieldLiters: number; sampleDays: number }[]>(`/api/reports/farms/${farmId}/lactation-curve`),
  getBreedingHistory: (farmId: string, filters?: { type?: string; from?: string; to?: string }) =>
    request<
      {
        id: string;
        animalId: string;
        type: BreedingEventType;
        eventDate: string;
        result: BreedingEventResult | null;
        notes: string | null;
        animal: { id: string; earTag: string; name: string | null };
      }[]
    >(`/api/reports/farms/${farmId}/breeding-history${qs({ ...filters })}`),
};
