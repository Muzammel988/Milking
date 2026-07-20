export type BreedingState =
  | "FRESH"
  | "VOLUNTARY_WAIT"
  | "OPEN"
  | "IN_HEAT"
  | "INSEMINATED"
  | "PREGNANT"
  | "CLOSE_TO_CALVING"
  | "DRY"
  | "CULLED"
  | "NOT_APPLICABLE";

export type LactationCycleState = "FRESH" | "PEAK" | "MID_LACTATION" | "LATE_LACTATION" | "DRY";

export type AnimalStatus = "CALF" | "HEIFER" | "COW" | "DRY" | "SOLD" | "DEAD" | "SLAUGHTERED";
export type Sex = "MALE" | "FEMALE";
export type AnimalOrigin = "BORN_ON_FARM" | "PURCHASED";
export type ExitReason = "SALE" | "DEATH" | "SLAUGHTER";

export type BreedingEventType =
  | "HEAT_OBSERVED"
  | "SYNCHRONIZATION_STEP"
  | "INSEMINATION"
  | "PREGNANCY_CHECK"
  | "CALVING"
  | "DRY_OFF"
  | "ABORTION";

export type BreedingEventResult = "POSITIVE" | "NEGATIVE" | "INCONCLUSIVE";

export type AlertType =
  | "POSTPARTUM_CHECK"
  | "READY_TO_BREED"
  | "OPEN_TOO_LONG"
  | "IN_HEAT"
  | "MISSED_HEAT"
  | "PREGNANCY_CHECK_DUE"
  | "PREGNANCY_CHECK_OVERDUE"
  | "DRY_OFF_DUE"
  | "CLOSE_TO_CALVING"
  | "YIELD_DROP"
  | "MISSING_MILK_DATA"
  | "LOW_FEED_STOCK";

export type AlertUrgency = "URGENT" | "HIGH" | "NORMAL" | "LOW";
export type AlertStatus = "PENDING" | "DONE" | "DISMISSED";

export type MilkSession = "MORNING" | "MIDDAY" | "EVENING";
export type HealthEventType = "EXAMINATION" | "DIAGNOSIS" | "TREATMENT" | "VACCINATION";
export type RationTargetGroup = "LACTATING" | "DRY" | "HEIFER" | "CALF";
export type TransactionType = "INCOME" | "EXPENSE";
export type TransactionCategory =
  | "MILK_SALE"
  | "FEED_PURCHASE"
  | "VET_COST"
  | "INSEMINATION_COST"
  | "ANIMAL_PURCHASE"
  | "ANIMAL_SALE"
  | "LABOR"
  | "OTHER";

export type Role = "OWNER" | "MANAGER" | "VET" | "HERDSMAN" | "MILKER";

export interface Farm {
  id: string;
  name: string;
  ownerName: string;
  baseCurrency: string;
}

export interface User {
  id: string;
  farmId: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface Location {
  id: string;
  farmId: string;
  barnName: string;
  stallName: string | null;
  capacity: number | null;
}

export interface Animal {
  id: string;
  farmId: string;
  earTag: string;
  transponderId: string | null;
  name: string | null;
  breed: string;
  sex: Sex;
  birthDate: string;
  origin: AnimalOrigin;
  status: AnimalStatus;
  locationId: string | null;
  exitDate: string | null;
  exitReason: ExitReason | null;
  breedingState: BreedingState;
  breedingStateSince: string | null;
  lactationState: LactationCycleState | null;
  lactationNumber: number;
  lastCalvingDate: string | null;
  lastInseminationDate: string | null;
  expectedCalvingDate: string | null;
  heatWindowExpiresAt: string | null;
}

export interface BreedingEvent {
  id: string;
  animalId: string;
  type: BreedingEventType;
  eventDate: string;
  result: BreedingEventResult | null;
  notes: string | null;
  operator?: string | null;
}

export type TimelineEntry =
  | {
      kind: "breeding";
      id: string;
      date: string;
      type: BreedingEventType;
      result: BreedingEventResult | null;
      notes: string | null;
      operator: string | null;
    }
  | {
      kind: "milk";
      id: string;
      date: string;
      session: MilkSession;
      yieldLiters: number;
      fatPct: number | null;
      proteinPct: number | null;
    }
  | {
      kind: "health";
      id: string;
      date: string;
      type: HealthEventType;
      medicine: string | null;
      vaccine: string | null;
      dosage: string | null;
      cost: number | null;
      notes: string | null;
      operator: string | null;
      withdrawalEndDate: string | null;
    }
  | {
      kind: "financial";
      id: string;
      date: string;
      type: TransactionType;
      category: TransactionCategory;
      amount: number;
      currency: string;
      notes: string | null;
    };

export interface Alert {
  id: string;
  animalId: string | null;
  type: AlertType;
  urgency: AlertUrgency;
  dueDate: string;
  status: AlertStatus;
  message: string;
  animal?: { id: string; earTag: string; name: string | null } | null;
}

export interface DashboardData {
  herdCountsByBreedingState: { breedingState: BreedingState; count: number }[];
  alertsByUrgency: Record<AlertUrgency, Alert[]>;
  totalPendingAlerts: number;
}

export interface MilkRecord {
  id: string;
  farmId: string;
  animalId: string | null;
  recordDate: string;
  session: MilkSession;
  yieldLiters: number;
  fatPct: number | null;
  proteinPct: number | null;
  somaticCellCount: number | null;
}

export interface Medicine {
  id: string;
  farmId: string;
  name: string;
  type: string;
  defaultWithdrawalPeriodDays: number;
  unitCost: number;
}

export interface Vaccine {
  id: string;
  farmId: string;
  name: string;
  type: string;
  defaultWithdrawalPeriodDays: number;
  unitCost: number;
}

export interface HealthEvent {
  id: string;
  animalId: string;
  type: HealthEventType;
  eventDate: string;
  medicineId: string | null;
  vaccineId: string | null;
  dosage: string | null;
  cost: number | null;
  notes: string | null;
  withdrawalPeriodDays: number | null;
  withdrawalEndDate: string | null;
}

export interface FeedIngredient {
  id: string;
  farmId: string;
  name: string;
  unitOfMeasure: string;
  costPerUnit: number;
  stockQuantity: number;
}

export interface RationFormulaIngredient {
  id: string;
  feedIngredientId: string;
  quantityPerHeadPerDay: number;
  feedIngredient: FeedIngredient;
}

export interface RationFormula {
  id: string;
  farmId: string;
  name: string;
  targetGroup: RationTargetGroup;
  ingredients: RationFormulaIngredient[];
  costPerHeadPerDay: number;
}

export interface FeedConsumptionRecord {
  id: string;
  farmId: string;
  rationFormulaId: string;
  animalId: string | null;
  groupLabel: string | null;
  headCount: number;
  date: string;
  totalCost: number;
  rationFormula: RationFormula;
}

export interface FinancialTransaction {
  id: string;
  farmId: string;
  date: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  currency: string;
  animalId: string | null;
  animalGroupLabel: string | null;
  notes: string | null;
}

export interface SemenStraw {
  id: string;
  farmId: string;
  sireName: string;
  breed: string;
  strawIdentifier: string;
  quantityOnHand: number;
  costPerStraw: number;
}

export interface ProfitabilityRow {
  animal: { id: string; earTag: string; name: string | null } | null;
  income: number;
  expense: number;
  netProfit: number;
}

export interface SystemParameters {
  id: string;
  farmId: string;
  voluntaryWaitDays: number;
  openTooLongDays: number;
  postpartumCheckDay: number;
  heatWindowHours: number;
  pregnancyCheckDays: number;
  confirmatoryCheckDays: number;
  gestationLengthDays: number;
  dryOffOffsetDays: number;
  closeToCalvingOffsetDays: number;
  colostrumDays: number;
  freshLactationDays: number;
  peakLactationDays: number;
  midLactationDays: number;
  targetDryOffDim: number;
  yieldDropThresholdPct: number;
  missingMilkDataDays: number;
}
